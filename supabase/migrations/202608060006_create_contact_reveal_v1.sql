-- Contact Reveal v1
-- Applied remotely to StudyDate project ctbqudtvrfezuoqcecyj after controlled preflight.
--
-- Conversation-scoped Contact Reveal v1 for channels telegram|instagram|linkedin only.
-- Eligible only after identity_revealed_at is set, active shell, mutual done (implied by IR),
-- both participants eligible students (non-staff), and not blocked.
-- One-sided prepare/consent is NEVER exposed to the counterpart.
-- No WhatsApp / phone / email / arbitrary URLs — ciphertext only for allowed channels.
--
-- Post-completion access policy:
--   - status = ended: both participants retain access to both contacts (retention)
--   - users_are_blocked OR status = blocked: hide counterpart contact ciphertext;
--     viewer may still access their own; never expose block reason
-- After a channel completes: register/select must not mutate pending consent or versions
-- for that channel.

-- ---------------------------------------------------------------------------
-- 1. conversation_events: contact_revealed + event_channel
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
      'identity_revealed',
      'contact_revealed'
    )
  );

alter table public.conversation_events
  add column if not exists event_channel text null;

comment on column public.conversation_events.event_channel is
  'Channel for contact_revealed events only (telegram|instagram|linkedin). Null for all other event types.';

alter table public.conversation_events
  drop constraint if exists conversation_events_event_channel_null_or_contact;

alter table public.conversation_events
  add constraint conversation_events_event_channel_null_or_contact
  check (event_channel is null or event_type = 'contact_revealed');

alter table public.conversation_events
  drop constraint if exists conversation_events_event_channel_allowed;

alter table public.conversation_events
  add constraint conversation_events_event_channel_allowed
  check (
    event_channel is null
    or event_channel in ('telegram', 'instagram', 'linkedin')
  );

create unique index if not exists conversation_events_one_contact_revealed_per_channel_idx
  on public.conversation_events (conversation_id, event_channel)
  where event_type = 'contact_revealed' and event_channel is not null;

-- ---------------------------------------------------------------------------
-- 2. conversation_contact_versions (conversation-scoped immutable encrypted versions)
-- ---------------------------------------------------------------------------

create table if not exists public.conversation_contact_versions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversation_shells (id) on delete cascade,
  owner_user_id uuid not null
    references auth.users (id) on delete cascade,
  channel text not null,
  version_number integer not null,
  contact_ciphertext bytea not null,
  contact_iv bytea not null,
  contact_auth_tag bytea not null,
  encryption_key_version smallint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  superseded_at timestamptz,
  constraint conversation_contact_versions_channel_allowed
    check (channel in ('telegram', 'instagram', 'linkedin')),
  constraint conversation_contact_versions_unique_owner_channel_version
    unique (conversation_id, owner_user_id, channel, version_number),
  constraint conversation_contact_versions_version_positive
    check (version_number >= 1),
  constraint conversation_contact_versions_key_version_positive
    check (encryption_key_version >= 1),
  constraint conversation_contact_versions_supersede_order
    check (superseded_at is null or superseded_at >= created_at)
);

-- One active (non-superseded) version per conversation + owner + channel.
create unique index if not exists conversation_contact_versions_one_active_idx
  on public.conversation_contact_versions (conversation_id, owner_user_id, channel)
  where superseded_at is null;

create index if not exists conversation_contact_versions_owner_idx
  on public.conversation_contact_versions (conversation_id, owner_user_id, channel, created_at desc);

comment on table public.conversation_contact_versions is
  'Conversation-scoped immutable encrypted contact versions per channel; counterpart never sees prepare/replace.';

alter table public.conversation_contact_versions enable row level security;
revoke all on table public.conversation_contact_versions
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. conversation_contact_reveal_consents
-- ---------------------------------------------------------------------------

create table if not exists public.conversation_contact_reveal_consents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversation_shells (id) on delete cascade,
  participant_id uuid not null
    references auth.users (id) on delete cascade,
  channel text not null,
  contact_version_id uuid not null
    references public.conversation_contact_versions (id),
  consented_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversation_contact_reveal_consents_channel_allowed
    check (channel in ('telegram', 'instagram', 'linkedin')),
  constraint conversation_contact_reveal_consents_unique_participant_channel
    unique (conversation_id, participant_id, channel),
  constraint conversation_contact_reveal_consents_withdraw_order
    check (withdrawn_at is null or withdrawn_at >= consented_at)
);

create index if not exists conversation_contact_reveal_consents_active_idx
  on public.conversation_contact_reveal_consents (conversation_id, channel)
  where withdrawn_at is null;

comment on table public.conversation_contact_reveal_consents is
  'Private per-participant Contact Reveal consent per channel. contact_version_id must belong to the same conversation, participant, and channel (enforced in select_contact_reveal). One-sided prepare/consent must never be exposed to the counterpart.';

alter table public.conversation_contact_reveal_consents enable row level security;
revoke all on table public.conversation_contact_reveal_consents
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. conversation_contact_reveals (immutable per-channel completion snapshot)
-- ---------------------------------------------------------------------------

create table if not exists public.conversation_contact_reveals (
  conversation_id uuid not null
    references public.conversation_shells (id) on delete cascade,
  channel text not null,
  sender_contact_version_id uuid not null
    references public.conversation_contact_versions (id),
  recipient_contact_version_id uuid not null
    references public.conversation_contact_versions (id),
  revealed_at timestamptz not null default timezone('utc', now()),
  primary key (conversation_id, channel),
  constraint conversation_contact_reveals_channel_allowed
    check (channel in ('telegram', 'instagram', 'linkedin')),
  constraint conversation_contact_reveals_distinct_versions
    check (sender_contact_version_id <> recipient_contact_version_id)
);

comment on table public.conversation_contact_reveals is
  'Immutable completed Contact Reveal snapshot per channel referencing the exact approved conversation-scoped contact versions.';

alter table public.conversation_contact_reveals enable row level security;
revoke all on table public.conversation_contact_reveals
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Eligibility helper (requires Identity Reveal completion)
-- ---------------------------------------------------------------------------

create or replace function public.is_conversation_eligible_for_contact_reveal(
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

  if shell.identity_revealed_at is null then
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

revoke all on function public.is_conversation_eligible_for_contact_reveal(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Safe per-channel state projection (never exposes counterpart prepare/consent)
-- ---------------------------------------------------------------------------

create or replace function public.project_contact_reveal_channel_state(
  p_shell public.conversation_shells,
  p_user_id uuid,
  p_channel text
)
returns table (
  channel text,
  eligible boolean,
  has_contact boolean,
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
  mine_has_contact boolean := false;
  is_completed boolean := false;
  is_eligible boolean := false;
  reveal_at timestamptz;
begin
  if p_shell.id is null
    or p_user_id is null
    or p_channel is null
    or p_channel not in ('telegram', 'instagram', 'linkedin') then
    return query
    select
      coalesce(p_channel, '')::text,
      false,
      false,
      false,
      false,
      null::timestamptz,
      false;
    return;
  end if;

  if p_user_id not in (p_shell.participant_sender_id, p_shell.participant_recipient_id) then
    return query
    select p_channel, false, false, false, false, null::timestamptz, false;
    return;
  end if;

  select candidate.revealed_at into reveal_at
  from public.conversation_contact_reveals candidate
  where candidate.conversation_id = p_shell.id
    and candidate.channel = p_channel
  limit 1;

  is_completed := reveal_at is not null;
  is_eligible := public.is_conversation_eligible_for_contact_reveal(p_shell.id, p_user_id);

  -- Active version for THIS conversation + this user + this channel only.
  select exists (
    select 1
    from public.conversation_contact_versions version_row
    where version_row.conversation_id = p_shell.id
      and version_row.owner_user_id = p_user_id
      and version_row.channel = p_channel
      and version_row.superseded_at is null
  ) into mine_has_contact;

  select exists (
    select 1
    from public.conversation_contact_reveal_consents consent
    where consent.conversation_id = p_shell.id
      and consent.participant_id = p_user_id
      and consent.channel = p_channel
      and consent.withdrawn_at is null
  ) into mine_active;

  -- CRITICAL: never inspect or return whether the counterpart prepared or consented.
  return query
  select
    p_channel,
    is_eligible and not is_completed,
    mine_has_contact,
    mine_active,
    is_completed,
    case when is_completed then reveal_at else null end,
    is_eligible and mine_active and not is_completed;
end;
$$;

revoke all on function public.project_contact_reveal_channel_state(
  public.conversation_shells, uuid, text
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. get_contact_reveal_state (all three channels for caller)
-- ---------------------------------------------------------------------------

create or replace function public.get_contact_reveal_state(p_public_id text)
returns table (
  channel text,
  eligible boolean,
  has_contact boolean,
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
    return query
    select * from (
      values
        ('telegram'::text, false, false, false, false, null::timestamptz, false),
        ('instagram'::text, false, false, false, false, null::timestamptz, false),
        ('linkedin'::text, false, false, false, false, null::timestamptz, false)
    ) as empty_state(channel, eligible, has_contact, selected_by_me, completed, completed_at, can_withdraw);
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return query
    select * from (
      values
        ('telegram'::text, false, false, false, false, null::timestamptz, false),
        ('instagram'::text, false, false, false, false, null::timestamptz, false),
        ('linkedin'::text, false, false, false, false, null::timestamptz, false)
    ) as empty_state(channel, eligible, has_contact, selected_by_me, completed, completed_at, can_withdraw);
    return;
  end if;

  return query
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
end;
$$;

revoke all on function public.get_contact_reveal_state(text) from public, anon;
grant execute on function public.get_contact_reveal_state(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. get_contact_reveal_preview (caller active version metadata only; no ciphertext)
-- ---------------------------------------------------------------------------

create or replace function public.get_contact_reveal_preview(
  p_public_id text,
  p_channel text
)
returns table (
  contact_version_id uuid,
  channel text,
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

  if p_channel is null or p_channel not in ('telegram', 'instagram', 'linkedin') then
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
    version_row.id,
    version_row.channel,
    version_row.created_at
  from public.conversation_contact_versions version_row
  where version_row.conversation_id = shell.id
    and version_row.owner_user_id = current_user_id
    and version_row.channel = p_channel
    and version_row.superseded_at is null
  order by version_row.version_number desc
  limit 1;
end;
$$;

revoke all on function public.get_contact_reveal_preview(text, text) from public, anon;
grant execute on function public.get_contact_reveal_preview(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. register_contact_reveal_version (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.register_contact_reveal_version(
  p_public_id text,
  p_owner_user_id uuid,
  p_channel text,
  p_contact_ciphertext bytea,
  p_contact_iv bytea,
  p_contact_auth_tag bytea,
  p_encryption_key_version integer
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

  if p_channel is null or p_channel not in ('telegram', 'instagram', 'linkedin') then
    raise exception 'invalid channel' using errcode = '22023';
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

  -- After this channel completes: reject contact mutations for that channel.
  if exists (
    select 1
    from public.conversation_contact_reveals reveal
    where reveal.conversation_id = shell.id
      and reveal.channel = p_channel
  ) then
    raise exception 'contact reveal unavailable' using errcode = 'P0001';
  end if;

  if shell.status in ('ended', 'blocked') then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, p_owner_user_id);

  if counterpart_id is null or public.users_are_blocked(p_owner_user_id, counterpart_id) then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  if not public.is_conversation_eligible_for_contact_reveal(shell.id, p_owner_user_id) then
    raise exception 'contact reveal unavailable' using errcode = 'P0001';
  end if;

  if p_contact_ciphertext is null or octet_length(p_contact_ciphertext) = 0 then
    raise exception 'invalid contact ciphertext' using errcode = '22023';
  end if;

  if p_contact_iv is null or octet_length(p_contact_iv) <> 12 then
    raise exception 'invalid contact iv' using errcode = '22023';
  end if;

  if p_contact_auth_tag is null or octet_length(p_contact_auth_tag) <> 16 then
    raise exception 'invalid contact auth tag' using errcode = '22023';
  end if;

  if p_encryption_key_version is null or p_encryption_key_version < 1 then
    raise exception 'invalid encryption key version' using errcode = '22023';
  end if;

  -- Supersede previous active versions for this conversation + owner + channel only.
  update public.conversation_contact_versions version_row
  set superseded_at = now_utc
  where version_row.conversation_id = shell.id
    and version_row.owner_user_id = p_owner_user_id
    and version_row.channel = p_channel
    and version_row.superseded_at is null;

  -- Invalidate pending (pre-completion) consents for this owner + channel on THIS conversation only.
  update public.conversation_contact_reveal_consents consent
  set withdrawn_at = now_utc,
      updated_at = now_utc
  where consent.conversation_id = shell.id
    and consent.participant_id = p_owner_user_id
    and consent.channel = p_channel
    and consent.withdrawn_at is null;

  select coalesce(max(version_row.version_number), 0) + 1
  into next_version
  from public.conversation_contact_versions version_row
  where version_row.conversation_id = shell.id
    and version_row.owner_user_id = p_owner_user_id
    and version_row.channel = p_channel;

  insert into public.conversation_contact_versions (
    conversation_id,
    owner_user_id,
    channel,
    version_number,
    contact_ciphertext,
    contact_iv,
    contact_auth_tag,
    encryption_key_version,
    created_at,
    superseded_at
  )
  values (
    shell.id,
    p_owner_user_id,
    p_channel,
    next_version,
    p_contact_ciphertext,
    p_contact_iv,
    p_contact_auth_tag,
    p_encryption_key_version::smallint,
    now_utc,
    null
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.register_contact_reveal_version(
  text, uuid, text, bytea, bytea, bytea, integer
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. select_contact_reveal
-- ---------------------------------------------------------------------------

create or replace function public.select_contact_reveal(
  p_public_id text,
  p_channel text,
  p_contact_version_id uuid
)
returns table (
  channel text,
  eligible boolean,
  has_contact boolean,
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
  version_row public.conversation_contact_versions%rowtype;
  sender_consent public.conversation_contact_reveal_consents%rowtype;
  recipient_consent public.conversation_contact_reveal_consents%rowtype;
  active_count integer;
  now_utc timestamptz := timezone('utc', now());
  already_completed boolean := false;
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

  if p_channel is null or p_channel not in ('telegram', 'instagram', 'linkedin') then
    raise exception 'invalid channel' using errcode = '22023';
  end if;

  if p_contact_version_id is null then
    raise exception 'contact reveal unavailable' using errcode = 'P0001';
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

  select exists (
    select 1
    from public.conversation_contact_reveals reveal
    where reveal.conversation_id = shell.id
      and reveal.channel = p_channel
  ) into already_completed;

  -- Already completed for this channel: idempotent safe projection (no further consent mutations).
  if already_completed then
    return query
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
    union all
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
    union all
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
    return;
  end if;

  if not public.is_conversation_eligible_for_contact_reveal(shell.id, current_user_id) then
    raise exception 'contact reveal unavailable' using errcode = 'P0001';
  end if;

  select * into version_row
  from public.conversation_contact_versions candidate
  where candidate.id = p_contact_version_id
  for update;

  -- Must be owned by caller, same conversation + channel, and not superseded.
  if version_row.id is null
    or version_row.owner_user_id <> current_user_id
    or version_row.conversation_id <> shell.id
    or version_row.channel <> p_channel
    or version_row.superseded_at is not null then
    raise exception 'contact reveal unavailable' using errcode = 'P0001';
  end if;

  insert into public.conversation_contact_reveal_consents (
    conversation_id,
    participant_id,
    channel,
    contact_version_id,
    consented_at,
    withdrawn_at,
    created_at,
    updated_at
  )
  values (
    shell.id,
    current_user_id,
    p_channel,
    version_row.id,
    now_utc,
    null,
    now_utc,
    now_utc
  )
  on conflict (conversation_id, participant_id, channel)
  do update set
    contact_version_id = excluded.contact_version_id,
    consented_at = case
      when conversation_contact_reveal_consents.withdrawn_at is null
        then conversation_contact_reveal_consents.consented_at
      else excluded.consented_at
    end,
    withdrawn_at = null,
    updated_at = now_utc;

  -- Lock active consent rows for this channel before counting / completing.
  perform 1
  from public.conversation_contact_reveal_consents consent
  where consent.conversation_id = shell.id
    and consent.channel = p_channel
    and consent.withdrawn_at is null
    and consent.participant_id in (
      shell.participant_sender_id,
      shell.participant_recipient_id
    )
  for update;

  select count(*) into active_count
  from public.conversation_contact_reveal_consents consent
  where consent.conversation_id = shell.id
    and consent.channel = p_channel
    and consent.withdrawn_at is null
    and consent.participant_id in (
      shell.participant_sender_id,
      shell.participant_recipient_id
    );

  if active_count >= 2 then
    select * into sender_consent
    from public.conversation_contact_reveal_consents consent
    where consent.conversation_id = shell.id
      and consent.participant_id = shell.participant_sender_id
      and consent.channel = p_channel
      and consent.withdrawn_at is null
    for update;

    select * into recipient_consent
    from public.conversation_contact_reveal_consents consent
    where consent.conversation_id = shell.id
      and consent.participant_id = shell.participant_recipient_id
      and consent.channel = p_channel
      and consent.withdrawn_at is null
    for update;

    if sender_consent.id is null or recipient_consent.id is null then
      raise exception 'contact reveal unavailable' using errcode = 'P0001';
    end if;

    -- Ensure both contact versions are still active, owned correctly, and scoped to this conversation + channel.
    if not exists (
      select 1 from public.conversation_contact_versions v
      where v.id = sender_consent.contact_version_id
        and v.conversation_id = shell.id
        and v.owner_user_id = shell.participant_sender_id
        and v.channel = p_channel
        and v.superseded_at is null
    ) or not exists (
      select 1 from public.conversation_contact_versions v
      where v.id = recipient_consent.contact_version_id
        and v.conversation_id = shell.id
        and v.owner_user_id = shell.participant_recipient_id
        and v.channel = p_channel
        and v.superseded_at is null
    ) then
      raise exception 'contact reveal unavailable' using errcode = 'P0001';
    end if;

    insert into public.conversation_contact_reveals (
      conversation_id,
      channel,
      sender_contact_version_id,
      recipient_contact_version_id,
      revealed_at
    )
    values (
      shell.id,
      p_channel,
      sender_consent.contact_version_id,
      recipient_consent.contact_version_id,
      now_utc
    )
    on conflict (conversation_id, channel) do nothing;

    if not exists (
      select 1
      from public.conversation_events event
      where event.conversation_id = shell.id
        and event.event_type = 'contact_revealed'
        and event.event_channel = p_channel
    ) then
      insert into public.conversation_events (
        conversation_id,
        actor_id,
        event_type,
        event_channel
      )
      values (
        shell.id,
        current_user_id,
        'contact_revealed',
        p_channel
      );
    end if;
  end if;

  select * into shell
  from public.conversation_shells
  where id = shell.id;

  return query
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
end;
$$;

revoke all on function public.select_contact_reveal(text, text, uuid) from public, anon;
grant execute on function public.select_contact_reveal(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. withdraw_contact_reveal (only before channel completion; private)
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_contact_reveal(
  p_public_id text,
  p_channel text
)
returns table (
  channel text,
  eligible boolean,
  has_contact boolean,
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
  already_completed boolean := false;
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

  if p_channel is null or p_channel not in ('telegram', 'instagram', 'linkedin') then
    raise exception 'invalid channel' using errcode = '22023';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  for update;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.conversation_contact_reveals reveal
    where reveal.conversation_id = shell.id
      and reveal.channel = p_channel
  ) into already_completed;

  if already_completed then
    return query
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
    union all
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
    union all
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
    return;
  end if;

  if shell.status in ('ended', 'blocked') then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  update public.conversation_contact_reveal_consents consent
  set withdrawn_at = now_utc,
      updated_at = now_utc
  where consent.conversation_id = shell.id
    and consent.participant_id = current_user_id
    and consent.channel = p_channel
    and consent.withdrawn_at is null;

  select * into shell
  from public.conversation_shells
  where id = shell.id;

  return query
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
end;
$$;

revoke all on function public.withdraw_contact_reveal(text, text) from public, anon;
grant execute on function public.withdraw_contact_reveal(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. get_completed_contact_reveal_cipher (service_role only)
-- Post-completion: ended retains both; blocked hides counterpart fields.
-- Never expose block reason.
-- ---------------------------------------------------------------------------

create or replace function public.get_completed_contact_reveal_cipher(
  p_public_id text,
  p_viewer_user_id uuid,
  p_channel text
)
returns table (
  completed boolean,
  completed_at timestamptz,
  mine_ciphertext bytea,
  mine_iv bytea,
  mine_auth_tag bytea,
  mine_key_version smallint,
  counterpart_ciphertext bytea,
  counterpart_iv bytea,
  counterpart_auth_tag bytea,
  counterpart_key_version smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
  reveal public.conversation_contact_reveals%rowtype;
  counterpart_id uuid;
  mine_version public.conversation_contact_versions%rowtype;
  counterpart_version public.conversation_contact_versions%rowtype;
  hide_counterpart boolean := false;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_public_id is null
    or p_public_id !~ '^[0-9a-f]{32}$'
    or p_viewer_user_id is null then
    return query
    select
      false,
      null::timestamptz,
      null::bytea,
      null::bytea,
      null::bytea,
      null::smallint,
      null::bytea,
      null::bytea,
      null::bytea,
      null::smallint;
    return;
  end if;

  if p_channel is null or p_channel not in ('telegram', 'instagram', 'linkedin') then
    return query
    select
      false,
      null::timestamptz,
      null::bytea,
      null::bytea,
      null::bytea,
      null::smallint,
      null::bytea,
      null::bytea,
      null::bytea,
      null::smallint;
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null
    or p_viewer_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return query
    select
      false,
      null::timestamptz,
      null::bytea,
      null::bytea,
      null::bytea,
      null::smallint,
      null::bytea,
      null::bytea,
      null::bytea,
      null::smallint;
    return;
  end if;

  select * into reveal
  from public.conversation_contact_reveals candidate
  where candidate.conversation_id = shell.id
    and candidate.channel = p_channel
  limit 1;

  if reveal.conversation_id is null then
    return query
    select
      false,
      null::timestamptz,
      null::bytea,
      null::bytea,
      null::bytea,
      null::smallint,
      null::bytea,
      null::bytea,
      null::bytea,
      null::smallint;
    return;
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, p_viewer_user_id);

  if p_viewer_user_id = shell.participant_sender_id then
    select * into mine_version
    from public.conversation_contact_versions v
    where v.id = reveal.sender_contact_version_id;
    select * into counterpart_version
    from public.conversation_contact_versions v
    where v.id = reveal.recipient_contact_version_id;
  else
    select * into mine_version
    from public.conversation_contact_versions v
    where v.id = reveal.recipient_contact_version_id;
    select * into counterpart_version
    from public.conversation_contact_versions v
    where v.id = reveal.sender_contact_version_id;
  end if;

  -- Blocked: return completed + mine cipher; hide counterpart. Do not expose block reason.
  -- Ended: retain both. Otherwise return both.
  hide_counterpart :=
    shell.status = 'blocked'
    or (
      counterpart_id is not null
      and public.users_are_blocked(p_viewer_user_id, counterpart_id)
    );

  if hide_counterpart then
    return query
    select
      true,
      reveal.revealed_at,
      mine_version.contact_ciphertext,
      mine_version.contact_iv,
      mine_version.contact_auth_tag,
      mine_version.encryption_key_version,
      null::bytea,
      null::bytea,
      null::bytea,
      null::smallint;
    return;
  end if;

  return query
  select
    true,
    reveal.revealed_at,
    mine_version.contact_ciphertext,
    mine_version.contact_iv,
    mine_version.contact_auth_tag,
    mine_version.encryption_key_version,
    counterpart_version.contact_ciphertext,
    counterpart_version.contact_iv,
    counterpart_version.contact_auth_tag,
    counterpart_version.encryption_key_version;
end;
$$;

revoke all on function public.get_completed_contact_reveal_cipher(text, uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 16. resolve_contact_reveal_preview_cipher (service_role; own active version only)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_contact_reveal_preview_cipher(
  p_public_id text,
  p_owner_user_id uuid,
  p_channel text
)
returns table (
  contact_ciphertext bytea,
  contact_iv bytea,
  contact_auth_tag bytea,
  encryption_key_version smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_public_id is null
    or p_public_id !~ '^[0-9a-f]{32}$'
    or p_owner_user_id is null
    or p_channel is null
    or p_channel not in ('telegram', 'instagram', 'linkedin') then
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null then
    return;
  end if;

  if not public.is_conversation_eligible_for_contact_reveal(shell.id, p_owner_user_id) then
    return;
  end if;

  -- Preview only while this channel is not yet completed.
  if exists (
    select 1
    from public.conversation_contact_reveals reveal
    where reveal.conversation_id = shell.id
      and reveal.channel = p_channel
  ) then
    return;
  end if;

  return query
  select
    version.contact_ciphertext,
    version.contact_iv,
    version.contact_auth_tag,
    version.encryption_key_version
  from public.conversation_contact_versions version
  where version.conversation_id = shell.id
    and version.owner_user_id = p_owner_user_id
    and version.channel = p_channel
    and version.superseded_at is null
  limit 1;
end;
$$;

revoke all on function public.resolve_contact_reveal_preview_cipher(text, uuid, text)
  from public, anon, authenticated;
