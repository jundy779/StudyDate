-- Identity Reveal v1
-- Local-only until explicit remote preflight approval. Do not db push without approval.
--
-- Conversation-scoped (NOT a global identity profile):
--   Profile versions live under conversation_shells + owner_user_id.
--   Preparing or replacing a profile in one conversation never leaks to another.
-- Separate two-person consent after Mutual Interest. Reveals only consented first name + photo.
-- One-sided prepare/consent is NEVER exposed to the counterpart.
-- Does NOT reveal contacts, legal name, NIM, verification evidence, email, or UUIDs.
--
-- Post-completion access policy:
--   - status = ended: both participants retain access to both names/photos (retention)
--   - users_are_blocked OR status = blocked: hide counterpart identity/media;
--     viewer may still access their own name/photo; never expose block reason
-- After completion: register/select must not mutate pending consent or versions.

-- ---------------------------------------------------------------------------
-- 1. conversation_shells.identity_revealed_at (server-controlled)
-- ---------------------------------------------------------------------------

alter table public.conversation_shells
  add column if not exists identity_revealed_at timestamptz;

comment on column public.conversation_shells.identity_revealed_at is
  'Set only by Identity Reveal RPCs when both participants have active consents. Not writable by clients.';

-- ---------------------------------------------------------------------------
-- 2. Private Storage bucket for reveal photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-reveal-photos',
  'identity-reveal-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No authenticated/anon Storage policies: uploads and reads go through service-role
-- server routes only. Object keys are random and never contain email/alias/UUID/name.

-- ---------------------------------------------------------------------------
-- 3. identity_reveal_profile_versions (conversation-scoped immutable versions)
-- ---------------------------------------------------------------------------

create table if not exists public.identity_reveal_profile_versions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversation_shells (id) on delete cascade,
  owner_user_id uuid not null
    references auth.users (id) on delete cascade,
  version_number integer not null,
  first_name text not null,
  photo_object_key text not null,
  photo_content_type text not null,
  photo_byte_size integer not null,
  photo_width integer not null,
  photo_height integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  superseded_at timestamptz,
  constraint identity_reveal_profile_versions_unique_owner_version
    unique (conversation_id, owner_user_id, version_number),
  constraint identity_reveal_profile_versions_unique_photo_key
    unique (photo_object_key),
  constraint identity_reveal_profile_versions_first_name_len
    check (char_length(first_name) between 2 and 40),
  constraint identity_reveal_profile_versions_photo_type
    check (photo_content_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint identity_reveal_profile_versions_photo_size
    check (photo_byte_size > 0 and photo_byte_size <= 5242880),
  constraint identity_reveal_profile_versions_photo_dims
    check (
      photo_width between 64 and 4096
      and photo_height between 64 and 4096
    ),
  constraint identity_reveal_profile_versions_photo_key_format
    check (photo_object_key ~ '^[a-f0-9]{32}/[a-f0-9]{32}\.(jpg|png|webp)$'),
  constraint identity_reveal_profile_versions_version_positive
    check (version_number >= 1),
  constraint identity_reveal_profile_versions_supersede_order
    check (superseded_at is null or superseded_at >= created_at)
);

-- One active (non-superseded) version per conversation + owner.
create unique index if not exists identity_reveal_profile_versions_one_active_idx
  on public.identity_reveal_profile_versions (conversation_id, owner_user_id)
  where superseded_at is null;

create index if not exists identity_reveal_profile_versions_owner_idx
  on public.identity_reveal_profile_versions (conversation_id, owner_user_id, created_at desc);

comment on table public.identity_reveal_profile_versions is
  'Conversation-scoped immutable versions; not global identity; counterpart never sees prepare/replace.';

alter table public.identity_reveal_profile_versions enable row level security;
revoke all on table public.identity_reveal_profile_versions
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. conversation_identity_reveal_consents
-- ---------------------------------------------------------------------------

create table if not exists public.conversation_identity_reveal_consents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversation_shells (id) on delete cascade,
  participant_id uuid not null
    references auth.users (id) on delete cascade,
  profile_version_id uuid not null
    references public.identity_reveal_profile_versions (id),
  consented_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversation_identity_reveal_consents_unique_participant
    unique (conversation_id, participant_id),
  constraint conversation_identity_reveal_consents_withdraw_order
    check (withdrawn_at is null or withdrawn_at >= consented_at)
);

create index if not exists conversation_identity_reveal_consents_active_idx
  on public.conversation_identity_reveal_consents (conversation_id)
  where withdrawn_at is null;

comment on table public.conversation_identity_reveal_consents is
  'Private per-participant Identity Reveal consent. profile_version_id must belong to the same conversation and participant (enforced in select_identity_reveal). One-sided prepare/consent must never be exposed to the counterpart.';

alter table public.conversation_identity_reveal_consents enable row level security;
revoke all on table public.conversation_identity_reveal_consents
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. conversation_identity_reveals (immutable completion snapshot)
-- ---------------------------------------------------------------------------

create table if not exists public.conversation_identity_reveals (
  conversation_id uuid primary key
    references public.conversation_shells (id) on delete cascade,
  sender_profile_version_id uuid not null
    references public.identity_reveal_profile_versions (id),
  recipient_profile_version_id uuid not null
    references public.identity_reveal_profile_versions (id),
  revealed_at timestamptz not null default timezone('utc', now()),
  constraint conversation_identity_reveals_distinct_versions
    check (sender_profile_version_id <> recipient_profile_version_id)
);

comment on table public.conversation_identity_reveals is
  'Immutable completed Identity Reveal snapshot referencing the exact approved conversation-scoped profile versions.';

alter table public.conversation_identity_reveals enable row level security;
revoke all on table public.conversation_identity_reveals
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Allow identity_revealed on conversation_events
-- ---------------------------------------------------------------------------

alter table public.conversation_events
  drop constraint if exists conversation_events_type_allowed;

alter table public.conversation_events
  add constraint conversation_events_type_allowed
  check (
    event_type in (
      'activated',
      'message_sent',
      'ended',
      'blocked',
      'reported',
      'messages_read',
      'mutual_interest_reached',
      'identity_revealed'
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Eligibility helper (requires Mutual Interest completion)
-- ---------------------------------------------------------------------------

create or replace function public.is_conversation_eligible_for_identity_reveal(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
begin
  if p_conversation_id is null or p_user_id is null then
    return false;
  end if;

  if not public.is_eligible_introduction_student(p_user_id) then
    return false;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.id = p_conversation_id
  limit 1;

  if shell.id is null then
    return false;
  end if;

  if shell.status <> 'active' then
    return false;
  end if;

  if shell.introduction_request_id is null then
    return false;
  end if;

  if shell.mutual_interest_at is null then
    return false;
  end if;

  if shell.identity_revealed_at is not null then
    return false;
  end if;

  if p_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return false;
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, p_user_id);

  if counterpart_id is null then
    return false;
  end if;

  if not public.is_eligible_introduction_student(counterpart_id) then
    return false;
  end if;

  if public.users_are_blocked(p_user_id, counterpart_id) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.is_conversation_eligible_for_identity_reveal(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Safe state projection (never exposes counterpart prepare/consent)
-- ---------------------------------------------------------------------------

create or replace function public.project_identity_reveal_state(
  p_shell public.conversation_shells,
  p_user_id uuid
)
returns table (
  eligible boolean,
  has_profile boolean,
  selected_by_me boolean,
  completed boolean,
  completed_at timestamptz,
  can_withdraw boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mine_active boolean := false;
  mine_has_profile boolean := false;
  is_completed boolean := false;
  is_eligible boolean := false;
begin
  if p_shell.id is null or p_user_id is null then
    return query select false, false, false, false, null::timestamptz, false;
    return;
  end if;

  if p_user_id not in (p_shell.participant_sender_id, p_shell.participant_recipient_id) then
    return query select false, false, false, false, null::timestamptz, false;
    return;
  end if;

  is_completed := p_shell.identity_revealed_at is not null;
  is_eligible := public.is_conversation_eligible_for_identity_reveal(p_shell.id, p_user_id);

  -- Active version for THIS conversation + this user only (not global).
  select exists (
    select 1
    from public.identity_reveal_profile_versions profile
    where profile.conversation_id = p_shell.id
      and profile.owner_user_id = p_user_id
      and profile.superseded_at is null
  ) into mine_has_profile;

  select exists (
    select 1
    from public.conversation_identity_reveal_consents consent
    where consent.conversation_id = p_shell.id
      and consent.participant_id = p_user_id
      and consent.withdrawn_at is null
  ) into mine_active;

  -- CRITICAL: never inspect or return whether the counterpart prepared or consented.
  return query
  select
    is_eligible and not is_completed,
    mine_has_profile,
    mine_active,
    is_completed,
    case when is_completed then p_shell.identity_revealed_at else null end,
    is_eligible and mine_active and not is_completed;
end;
$$;

revoke all on function public.project_identity_reveal_state(public.conversation_shells, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. get_identity_reveal_state
-- ---------------------------------------------------------------------------

create or replace function public.get_identity_reveal_state(p_public_id text)
returns table (
  eligible boolean,
  has_profile boolean,
  selected_by_me boolean,
  completed boolean,
  completed_at timestamptz,
  can_withdraw boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    return query select false, false, false, false, null::timestamptz, false;
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return query select false, false, false, false, null::timestamptz, false;
    return;
  end if;

  return query
  select *
  from public.project_identity_reveal_state(shell, current_user_id);
end;
$$;

revoke all on function public.get_identity_reveal_state(text) from public, anon;
grant execute on function public.get_identity_reveal_state(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. get_identity_reveal_profile_preview (caller active version for THAT conversation)
-- ---------------------------------------------------------------------------

create or replace function public.get_identity_reveal_profile_preview(p_public_id text)
returns table (
  profile_version_id uuid,
  first_name text,
  photo_ready boolean,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return;
  end if;

  return query
  select
    profile.id,
    profile.first_name,
    true,
    profile.created_at
  from public.identity_reveal_profile_versions profile
  where profile.conversation_id = shell.id
    and profile.owner_user_id = current_user_id
    and profile.superseded_at is null
  order by profile.version_number desc
  limit 1;
end;
$$;

revoke all on function public.get_identity_reveal_profile_preview(text) from public, anon;
grant execute on function public.get_identity_reveal_profile_preview(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. register_identity_reveal_profile_version (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.register_identity_reveal_profile_version(
  p_public_id text,
  p_owner_user_id uuid,
  p_first_name text,
  p_photo_object_key text,
  p_photo_content_type text,
  p_photo_byte_size integer,
  p_photo_width integer,
  p_photo_height integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
  next_version integer;
  new_id uuid;
  now_utc timestamptz := timezone('utc', now());
  normalized_name text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_owner_user_id is null then
    raise exception 'owner required' using errcode = '22023';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if not public.is_eligible_introduction_student(p_owner_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  for update;

  if shell.id is null then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if p_owner_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  -- After completion: reject profile mutations.
  if shell.identity_revealed_at is not null then
    raise exception 'identity reveal unavailable' using errcode = 'P0001';
  end if;

  if shell.status in ('ended', 'blocked') then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, p_owner_user_id);

  if counterpart_id is null or public.users_are_blocked(p_owner_user_id, counterpart_id) then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  if not public.is_conversation_eligible_for_identity_reveal(shell.id, p_owner_user_id) then
    raise exception 'identity reveal unavailable' using errcode = 'P0001';
  end if;

  normalized_name := trim(both from regexp_replace(coalesce(p_first_name, ''), '\s+', ' ', 'g'));

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 40 then
    raise exception 'invalid first name' using errcode = '22023';
  end if;

  if normalized_name ~* '(https?://|www\.|@|\+?\d{8,}|<[^>]+>)' then
    raise exception 'invalid first name' using errcode = '22023';
  end if;

  if p_photo_object_key is null
    or p_photo_object_key !~ '^[a-f0-9]{32}/[a-f0-9]{32}\.(jpg|png|webp)$' then
    raise exception 'invalid photo key' using errcode = '22023';
  end if;

  if p_photo_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid photo type' using errcode = '22023';
  end if;

  if p_photo_byte_size is null
    or p_photo_byte_size <= 0
    or p_photo_byte_size > 5242880 then
    raise exception 'invalid photo size' using errcode = '22023';
  end if;

  if p_photo_width is null or p_photo_height is null
    or p_photo_width < 64 or p_photo_height < 64
    or p_photo_width > 4096 or p_photo_height > 4096 then
    raise exception 'invalid photo dimensions' using errcode = '22023';
  end if;

  -- Supersede previous active versions for this conversation + owner only.
  update public.identity_reveal_profile_versions profile
  set superseded_at = now_utc
  where profile.conversation_id = shell.id
    and profile.owner_user_id = p_owner_user_id
    and profile.superseded_at is null;

  -- Invalidate pending (pre-completion) consents for this owner on THIS conversation only.
  update public.conversation_identity_reveal_consents consent
  set withdrawn_at = now_utc,
      updated_at = now_utc
  where consent.conversation_id = shell.id
    and consent.participant_id = p_owner_user_id
    and consent.withdrawn_at is null;

  select coalesce(max(profile.version_number), 0) + 1
  into next_version
  from public.identity_reveal_profile_versions profile
  where profile.conversation_id = shell.id
    and profile.owner_user_id = p_owner_user_id;

  insert into public.identity_reveal_profile_versions (
    conversation_id,
    owner_user_id,
    version_number,
    first_name,
    photo_object_key,
    photo_content_type,
    photo_byte_size,
    photo_width,
    photo_height,
    created_at,
    superseded_at
  )
  values (
    shell.id,
    p_owner_user_id,
    next_version,
    normalized_name,
    p_photo_object_key,
    p_photo_content_type,
    p_photo_byte_size,
    p_photo_width,
    p_photo_height,
    now_utc,
    null
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.register_identity_reveal_profile_version(
  text, uuid, text, text, text, integer, integer, integer
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. select_identity_reveal
-- ---------------------------------------------------------------------------

create or replace function public.select_identity_reveal(
  p_public_id text,
  p_profile_version_id uuid
)
returns table (
  eligible boolean,
  has_profile boolean,
  selected_by_me boolean,
  completed boolean,
  completed_at timestamptz,
  can_withdraw boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
  profile public.identity_reveal_profile_versions%rowtype;
  sender_consent public.conversation_identity_reveal_consents%rowtype;
  recipient_consent public.conversation_identity_reveal_consents%rowtype;
  active_count integer;
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if p_profile_version_id is null then
    raise exception 'identity reveal unavailable' using errcode = 'P0001';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  for update;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if shell.status in ('ended', 'blocked') then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, current_user_id);

  if public.users_are_blocked(current_user_id, counterpart_id) then
    update public.conversation_shells
    set status = 'blocked',
        ended_at = coalesce(ended_at, now_utc),
        ended_by = coalesce(ended_by, current_user_id)
    where id = shell.id;
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  -- Already completed: idempotent safe projection (no further consent mutations).
  if shell.identity_revealed_at is not null then
    return query
    select *
    from public.project_identity_reveal_state(shell, current_user_id);
    return;
  end if;

  if not public.is_conversation_eligible_for_identity_reveal(shell.id, current_user_id) then
    raise exception 'identity reveal unavailable' using errcode = 'P0001';
  end if;

  select * into profile
  from public.identity_reveal_profile_versions candidate
  where candidate.id = p_profile_version_id
  limit 1;

  -- Must be owned by caller, same conversation, and not superseded.
  -- Cannot use a version prepared for another conversation.
  if profile.id is null
    or profile.owner_user_id <> current_user_id
    or profile.conversation_id <> shell.id
    or profile.superseded_at is not null then
    raise exception 'identity reveal unavailable' using errcode = 'P0001';
  end if;

  insert into public.conversation_identity_reveal_consents (
    conversation_id,
    participant_id,
    profile_version_id,
    consented_at,
    withdrawn_at,
    created_at,
    updated_at
  )
  values (
    shell.id,
    current_user_id,
    profile.id,
    now_utc,
    null,
    now_utc,
    now_utc
  )
  on conflict (conversation_id, participant_id)
  do update set
    profile_version_id = excluded.profile_version_id,
    consented_at = case
      when conversation_identity_reveal_consents.withdrawn_at is null
        then conversation_identity_reveal_consents.consented_at
      else excluded.consented_at
    end,
    withdrawn_at = null,
    updated_at = now_utc;

  select count(*) into active_count
  from public.conversation_identity_reveal_consents consent
  where consent.conversation_id = shell.id
    and consent.withdrawn_at is null
    and consent.participant_id in (
      shell.participant_sender_id,
      shell.participant_recipient_id
    );

  if active_count >= 2 and shell.identity_revealed_at is null then
    select * into sender_consent
    from public.conversation_identity_reveal_consents consent
    where consent.conversation_id = shell.id
      and consent.participant_id = shell.participant_sender_id
      and consent.withdrawn_at is null;

    select * into recipient_consent
    from public.conversation_identity_reveal_consents consent
    where consent.conversation_id = shell.id
      and consent.participant_id = shell.participant_recipient_id
      and consent.withdrawn_at is null;

    if sender_consent.id is null or recipient_consent.id is null then
      raise exception 'identity reveal unavailable' using errcode = 'P0001';
    end if;

    -- Ensure both profile versions are still active, owned correctly, and scoped to this conversation.
    if not exists (
      select 1 from public.identity_reveal_profile_versions v
      where v.id = sender_consent.profile_version_id
        and v.conversation_id = shell.id
        and v.owner_user_id = shell.participant_sender_id
        and v.superseded_at is null
    ) or not exists (
      select 1 from public.identity_reveal_profile_versions v
      where v.id = recipient_consent.profile_version_id
        and v.conversation_id = shell.id
        and v.owner_user_id = shell.participant_recipient_id
        and v.superseded_at is null
    ) then
      raise exception 'identity reveal unavailable' using errcode = 'P0001';
    end if;

    insert into public.conversation_identity_reveals (
      conversation_id,
      sender_profile_version_id,
      recipient_profile_version_id,
      revealed_at
    )
    values (
      shell.id,
      sender_consent.profile_version_id,
      recipient_consent.profile_version_id,
      now_utc
    )
    on conflict (conversation_id) do nothing;

    update public.conversation_shells
    set identity_revealed_at = now_utc
    where id = shell.id
      and identity_revealed_at is null
    returning * into shell;

    if not exists (
      select 1
      from public.conversation_events event
      where event.conversation_id = shell.id
        and event.event_type = 'identity_revealed'
    ) then
      insert into public.conversation_events (
        conversation_id,
        actor_id,
        event_type
      )
      values (
        shell.id,
        current_user_id,
        'identity_revealed'
      );
    end if;
  else
    select * into shell
    from public.conversation_shells
    where id = shell.id;
  end if;

  return query
  select *
  from public.project_identity_reveal_state(shell, current_user_id);
end;
$$;

revoke all on function public.select_identity_reveal(text, uuid) from public, anon;
grant execute on function public.select_identity_reveal(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. withdraw_identity_reveal (only before completion)
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_identity_reveal(p_public_id text)
returns table (
  eligible boolean,
  has_profile boolean,
  selected_by_me boolean,
  completed boolean,
  completed_at timestamptz,
  can_withdraw boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  for update;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if shell.identity_revealed_at is not null then
    return query
    select *
    from public.project_identity_reveal_state(shell, current_user_id);
    return;
  end if;

  if shell.status in ('ended', 'blocked') then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  update public.conversation_identity_reveal_consents consent
  set withdrawn_at = now_utc,
      updated_at = now_utc
  where consent.conversation_id = shell.id
    and consent.participant_id = current_user_id
    and consent.withdrawn_at is null;

  select * into shell
  from public.conversation_shells
  where id = shell.id;

  return query
  select *
  from public.project_identity_reveal_state(shell, current_user_id);
end;
$$;

revoke all on function public.withdraw_identity_reveal(text) from public, anon;
grant execute on function public.withdraw_identity_reveal(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. get_completed_identity_reveal (names only; no photo paths / UUIDs)
-- Post-completion: ended retains both; blocked hides counterpart name.
-- ---------------------------------------------------------------------------

create or replace function public.get_completed_identity_reveal(p_public_id text)
returns table (
  completed boolean,
  completed_at timestamptz,
  mine_first_name text,
  counterpart_first_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  reveal public.conversation_identity_reveals%rowtype;
  counterpart_id uuid;
  mine_version public.identity_reveal_profile_versions%rowtype;
  counterpart_version public.identity_reveal_profile_versions%rowtype;
  hide_counterpart boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    return query select false, null::timestamptz, null::text, null::text;
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id)
    or shell.identity_revealed_at is null then
    return query select false, null::timestamptz, null::text, null::text;
    return;
  end if;

  select * into reveal
  from public.conversation_identity_reveals candidate
  where candidate.conversation_id = shell.id
  limit 1;

  if reveal.conversation_id is null then
    return query select false, null::timestamptz, null::text, null::text;
    return;
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, current_user_id);

  if current_user_id = shell.participant_sender_id then
    select * into mine_version
    from public.identity_reveal_profile_versions v
    where v.id = reveal.sender_profile_version_id;
    select * into counterpart_version
    from public.identity_reveal_profile_versions v
    where v.id = reveal.recipient_profile_version_id;
  else
    select * into mine_version
    from public.identity_reveal_profile_versions v
    where v.id = reveal.recipient_profile_version_id;
    select * into counterpart_version
    from public.identity_reveal_profile_versions v
    where v.id = reveal.sender_profile_version_id;
  end if;

  -- Blocked: return completed + mine name; hide counterpart. Do not expose block reason.
  -- Ended: retain both names. Otherwise return both.
  hide_counterpart :=
    shell.status = 'blocked'
    or (
      counterpart_id is not null
      and public.users_are_blocked(current_user_id, counterpart_id)
    );

  if hide_counterpart then
    return query
    select
      true,
      shell.identity_revealed_at,
      mine_version.first_name,
      null::text;
    return;
  end if;

  -- status = ended (and not blocked) retains both; active completed also returns both.
  return query
  select
    true,
    shell.identity_revealed_at,
    mine_version.first_name,
    counterpart_version.first_name;
end;
$$;

revoke all on function public.get_completed_identity_reveal(text) from public, anon;
grant execute on function public.get_completed_identity_reveal(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 15. resolve_identity_reveal_photo_key (service_role only; completed media)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_identity_reveal_photo_key(
  p_public_id text,
  p_viewer_user_id uuid,
  p_which text
)
returns table (
  photo_object_key text,
  photo_content_type text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
  reveal public.conversation_identity_reveals%rowtype;
  counterpart_id uuid;
  version_id uuid;
  is_blocked boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_which not in ('mine', 'counterpart') then
    return;
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' or p_viewer_user_id is null then
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null
    or shell.identity_revealed_at is null
    or p_viewer_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return;
  end if;

  select * into reveal
  from public.conversation_identity_reveals candidate
  where candidate.conversation_id = shell.id
  limit 1;

  if reveal.conversation_id is null then
    return;
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, p_viewer_user_id);
  is_blocked :=
    shell.status = 'blocked'
    or (
      counterpart_id is not null
      and public.users_are_blocked(p_viewer_user_id, counterpart_id)
    );

  -- Blocked: counterpart media denied; own photo still allowed.
  -- Ended: allow both mine and counterpart.
  if is_blocked and p_which = 'counterpart' then
    return;
  end if;

  if p_which = 'mine' then
    version_id := case
      when p_viewer_user_id = shell.participant_sender_id
        then reveal.sender_profile_version_id
      else reveal.recipient_profile_version_id
    end;
  else
    version_id := case
      when p_viewer_user_id = shell.participant_sender_id
        then reveal.recipient_profile_version_id
      else reveal.sender_profile_version_id
    end;
  end if;

  return query
  select v.photo_object_key, v.photo_content_type
  from public.identity_reveal_profile_versions v
  where v.id = version_id
  limit 1;
end;
$$;

revoke all on function public.resolve_identity_reveal_photo_key(text, uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 16. resolve_identity_reveal_preview_photo_key (service_role; pre-completion only)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_identity_reveal_preview_photo_key(
  p_public_id text,
  p_owner_user_id uuid
)
returns table (
  photo_object_key text,
  photo_content_type text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' or p_owner_user_id is null then
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null then
    return;
  end if;

  if p_owner_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return;
  end if;

  -- Preview only while eligible for identity reveal (active, mutual done, not revealed, not blocked).
  -- If already completed, callers must use resolve_identity_reveal_photo_key instead.
  if not public.is_conversation_eligible_for_identity_reveal(shell.id, p_owner_user_id) then
    return;
  end if;

  return query
  select v.photo_object_key, v.photo_content_type
  from public.identity_reveal_profile_versions v
  where v.conversation_id = shell.id
    and v.owner_user_id = p_owner_user_id
    and v.superseded_at is null
  order by v.version_number desc
  limit 1;
end;
$$;

revoke all on function public.resolve_identity_reveal_preview_photo_key(text, uuid)
  from public, anon, authenticated;
