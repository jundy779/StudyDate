-- Anonymous Chat v1
-- Local-only until explicit remote preflight approval.
-- Extends conversation_shells; adds anonymous_messages + controlled RPCs.
-- No table SELECT grants: messaging uses SECURITY DEFINER RPCs + polling
-- (Realtime SELECT policies would expose sender_id UUIDs via PostgREST).

-- ---------------------------------------------------------------------------
-- 1. Extend conversation_shells
-- ---------------------------------------------------------------------------

alter table public.conversation_shells
  add column if not exists public_id text,
  add column if not exists activated_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid references auth.users (id) on delete set null;

update public.conversation_shells
set public_id = encode(extensions.gen_random_bytes(16), 'hex')
where public_id is null;

alter table public.conversation_shells
  alter column public_id set not null;

alter table public.conversation_shells
  drop constraint if exists conversation_shells_public_id_format;

alter table public.conversation_shells
  add constraint conversation_shells_public_id_format
  check (public_id ~ '^[0-9a-f]{32}$');

create unique index if not exists conversation_shells_public_id_uidx
  on public.conversation_shells (public_id);

alter table public.conversation_shells
  drop constraint if exists conversation_shells_status_allowed;

alter table public.conversation_shells
  add constraint conversation_shells_status_allowed
  check (status in ('awaiting_chat', 'active', 'ended', 'blocked'));

alter table public.conversation_shells
  alter column public_id set default encode(extensions.gen_random_bytes(16), 'hex');

comment on column public.conversation_shells.public_id is
  'Opaque URL-safe conversation identifier. Not an authorization secret.';
comment on column public.conversation_shells.status is
  'Lifecycle: awaiting_chat -> active -> ended|blocked. Client cannot set freely.';

-- ---------------------------------------------------------------------------
-- 2. anonymous_messages
-- ---------------------------------------------------------------------------

create table if not exists public.anonymous_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversation_shells (id) on delete cascade,
  sender_id uuid not null
    references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,
  moderation_status text not null default 'visible',
  client_idempotency_key text,
  constraint anonymous_messages_body_length
    check (char_length(body) between 1 and 1000),
  constraint anonymous_messages_moderation_allowed
    check (moderation_status in ('visible', 'removed')),
  constraint anonymous_messages_idempotency_format
    check (
      client_idempotency_key is null
      or client_idempotency_key ~ '^[A-Za-z0-9_-]{8,64}$'
    ),
  constraint anonymous_messages_read_after_create
    check (read_at is null or read_at >= created_at)
);

create unique index if not exists anonymous_messages_idempotency_uidx
  on public.anonymous_messages (
    conversation_id,
    sender_id,
    client_idempotency_key
  )
  where client_idempotency_key is not null;

create index if not exists anonymous_messages_conversation_created_idx
  on public.anonymous_messages (conversation_id, created_at desc, id desc);

create index if not exists anonymous_messages_unread_idx
  on public.anonymous_messages (conversation_id, sender_id, created_at)
  where read_at is null and moderation_status = 'visible';

comment on table public.anonymous_messages is
  'Anonymous Chat v1 plain-text messages. No aliases, contacts, or attachment columns.';
comment on column public.anonymous_messages.body is
  'Normalized plain text only. Best-effort contact rejection. Never log in ops.';
comment on column public.anonymous_messages.moderation_status is
  'Trusted server field. Browser cannot submit removed/visible directly.';

alter table public.anonymous_messages enable row level security;
revoke all on table public.anonymous_messages from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. conversation_events (sanitized audit)
-- ---------------------------------------------------------------------------

create table if not exists public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversation_shells (id) on delete cascade,
  actor_id uuid
    references auth.users (id) on delete set null,
  event_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint conversation_events_type_allowed
    check (
      event_type in (
        'activated',
        'message_sent',
        'ended',
        'blocked',
        'reported',
        'messages_read'
      )
    )
);

create index if not exists conversation_events_conversation_idx
  on public.conversation_events (conversation_id, created_at desc);

comment on table public.conversation_events is
  'Sanitized conversation audit. No message bodies, emails, or contacts.';

alter table public.conversation_events enable row level security;
revoke all on table public.conversation_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Extend user_reports for conversations / messages
-- ---------------------------------------------------------------------------

alter table public.user_reports
  add column if not exists conversation_id uuid
    references public.conversation_shells (id) on delete set null,
  add column if not exists anonymous_message_id uuid
    references public.anonymous_messages (id) on delete set null;

create index if not exists user_reports_conversation_idx
  on public.user_reports (conversation_id)
  where conversation_id is not null;

-- ---------------------------------------------------------------------------
-- 5. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_anonymous_message(p_message text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := replace(coalesce(p_message, ''), E'\r\n', E'\n');
  normalized := replace(normalized, E'\r', E'\n');
  normalized := regexp_replace(normalized, E'[ \t]+', ' ', 'g');
  normalized := regexp_replace(normalized, E'\n{3,}', E'\n\n', 'g');
  normalized := btrim(normalized);
  return normalized;
end;
$$;

revoke all on function public.normalize_anonymous_message(text)
  from public, anon, authenticated;

create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_shells shell
    where shell.id = p_conversation_id
      and p_user_id in (shell.participant_sender_id, shell.participant_recipient_id)
  );
$$;

revoke all on function public.is_conversation_participant(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.conversation_counterpart_id(
  p_conversation_id uuid,
  p_user_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when shell.participant_sender_id = p_user_id then shell.participant_recipient_id
    when shell.participant_recipient_id = p_user_id then shell.participant_sender_id
    else null
  end
  from public.conversation_shells shell
  where shell.id = p_conversation_id;
$$;

revoke all on function public.conversation_counterpart_id(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.close_conversations_for_block(
  p_blocker_id uuid,
  p_blocked_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversation_shells shell
  set
    status = 'blocked',
    ended_at = coalesce(shell.ended_at, timezone('utc', now())),
    ended_by = coalesce(shell.ended_by, p_blocker_id)
  where shell.status in ('awaiting_chat', 'active')
    and (
      (shell.participant_sender_id = p_blocker_id and shell.participant_recipient_id = p_blocked_id)
      or (shell.participant_sender_id = p_blocked_id and shell.participant_recipient_id = p_blocker_id)
    );

  insert into public.conversation_events (conversation_id, actor_id, event_type)
  select shell.id, p_blocker_id, 'blocked'
  from public.conversation_shells shell
  where shell.status = 'blocked'
    and shell.ended_by = p_blocker_id
    and (
      (shell.participant_sender_id = p_blocker_id and shell.participant_recipient_id = p_blocked_id)
      or (shell.participant_sender_id = p_blocked_id and shell.participant_recipient_id = p_blocker_id)
    )
    and not exists (
      select 1
      from public.conversation_events existing
      where existing.conversation_id = shell.id
        and existing.event_type = 'blocked'
        and existing.actor_id = p_blocker_id
        and existing.created_at > timezone('utc', now()) - interval '1 minute'
    );
end;
$$;

revoke all on function public.close_conversations_for_block(uuid, uuid)
  from public, anon, authenticated;

-- Patch block_student_by_alias to also close conversations
create or replace function public.block_student_by_alias(p_alias text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_alias is null or p_alias !~ '^Partner #[0-9]{6}$' then
    raise exception 'invalid discovery alias' using errcode = '22023';
  end if;

  select profile.user_id into target_id
  from public.profiles profile
  where profile.public_alias = p_alias
    and profile.onboarding_completed_at is not null
  limit 1;

  if target_id is null or target_id = current_user_id then
    raise exception 'block target unavailable' using errcode = 'P0001';
  end if;

  if public.is_active_staff_user(target_id) then
    raise exception 'block target unavailable' using errcode = 'P0001';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (current_user_id, target_id)
  on conflict (blocker_id, blocked_id) do nothing;

  perform public.close_pending_introductions_for_block(current_user_id, target_id);
  perform public.close_conversations_for_block(current_user_id, target_id);
end;
$$;

revoke all on function public.block_student_by_alias(text) from public, anon;
grant execute on function public.block_student_by_alias(text) to authenticated;

-- Ensure accept still inserts shells with public_id default (function body from intro v1)
-- Re-affirm insert path uses default public_id via column default.

-- ---------------------------------------------------------------------------
-- 6. List conversations
-- ---------------------------------------------------------------------------

create or replace function public.list_my_conversations(p_limit integer default 30)
returns table (
  public_id text,
  status text,
  counterpart_alias text,
  campus text,
  study_program text,
  semester smallint,
  is_verified boolean,
  preview_body text,
  last_activity_at timestamptz,
  unread_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  return query
  select
    shell.public_id,
    shell.status,
    counterpart.public_alias,
    counterpart.campus,
    counterpart.study_program,
    counterpart.semester,
    (counterpart.verification_status = 'verified') as is_verified,
    (
      select msg.body
      from public.anonymous_messages msg
      where msg.conversation_id = shell.id
        and msg.moderation_status = 'visible'
      order by msg.created_at desc, msg.id desc
      limit 1
    ) as preview_body,
    coalesce(
      (
        select msg.created_at
        from public.anonymous_messages msg
        where msg.conversation_id = shell.id
          and msg.moderation_status = 'visible'
        order by msg.created_at desc, msg.id desc
        limit 1
      ),
      shell.activated_at,
      shell.created_at
    ) as last_activity_at,
    (
      select count(*)::integer
      from public.anonymous_messages msg
      where msg.conversation_id = shell.id
        and msg.sender_id <> current_user_id
        and msg.read_at is null
        and msg.moderation_status = 'visible'
    ) as unread_count,
    shell.created_at
  from public.conversation_shells shell
  join public.profiles counterpart
    on counterpart.user_id = case
      when shell.participant_sender_id = current_user_id then shell.participant_recipient_id
      else shell.participant_sender_id
    end
  where current_user_id in (shell.participant_sender_id, shell.participant_recipient_id)
    and not public.is_active_staff_user(current_user_id)
  order by last_activity_at desc nulls last, shell.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.list_my_conversations(integer) from public, anon;
grant execute on function public.list_my_conversations(integer) to authenticated;

create or replace function public.count_unread_conversations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  total integer := 0;
begin
  if current_user_id is null then
    return 0;
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    return 0;
  end if;

  select count(*)::integer into total
  from public.conversation_shells shell
  where current_user_id in (shell.participant_sender_id, shell.participant_recipient_id)
    and exists (
      select 1
      from public.anonymous_messages msg
      where msg.conversation_id = shell.id
        and msg.sender_id <> current_user_id
        and msg.read_at is null
        and msg.moderation_status = 'visible'
    );

  return coalesce(total, 0);
end;
$$;

revoke all on function public.count_unread_conversations() from public, anon;
grant execute on function public.count_unread_conversations() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Get one conversation
-- ---------------------------------------------------------------------------

create or replace function public.get_conversation_by_public_id(p_public_id text)
returns table (
  public_id text,
  status text,
  counterpart_alias text,
  campus text,
  study_program text,
  semester smallint,
  is_verified boolean,
  created_at timestamptz,
  activated_at timestamptz,
  ended_at timestamptz,
  unread_count integer,
  can_send boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
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

  if shell.id is null then
    return;
  end if;

  if current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return;
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, current_user_id);

  return query
  select
    shell.public_id,
    shell.status,
    profile.public_alias,
    profile.campus,
    profile.study_program,
    profile.semester,
    (profile.verification_status = 'verified') as is_verified,
    shell.created_at,
    shell.activated_at,
    shell.ended_at,
    (
      select count(*)::integer
      from public.anonymous_messages msg
      where msg.conversation_id = shell.id
        and msg.sender_id <> current_user_id
        and msg.read_at is null
        and msg.moderation_status = 'visible'
    ) as unread_count,
    (
      shell.status in ('awaiting_chat', 'active')
      and not public.users_are_blocked(current_user_id, counterpart_id)
      and public.is_eligible_introduction_student(current_user_id)
      and public.is_eligible_introduction_student(counterpart_id)
    ) as can_send
  from public.profiles profile
  where profile.user_id = counterpart_id;
end;
$$;

revoke all on function public.get_conversation_by_public_id(text) from public, anon;
grant execute on function public.get_conversation_by_public_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. List messages (cursor: before created_at + id)
-- ---------------------------------------------------------------------------

create or replace function public.list_conversation_messages(
  p_public_id text,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 40
)
returns table (
  message_id uuid,
  body text,
  is_mine boolean,
  created_at timestamptz,
  read_at timestamptz,
  moderation_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell_id uuid;
  safe_limit integer := least(greatest(coalesce(p_limit, 40), 1), 50);
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

  select shell.id into shell_id
  from public.conversation_shells shell
  where shell.public_id = p_public_id
    and current_user_id in (shell.participant_sender_id, shell.participant_recipient_id)
  limit 1;

  if shell_id is null then
    return;
  end if;

  return query
  select
    msg.id,
    msg.body,
    (msg.sender_id = current_user_id) as is_mine,
    msg.created_at,
    msg.read_at,
    msg.moderation_status
  from public.anonymous_messages msg
  where msg.conversation_id = shell_id
    and (
      p_before_created_at is null
      or msg.created_at < p_before_created_at
      or (msg.created_at = p_before_created_at and p_before_id is not null and msg.id < p_before_id)
    )
  order by msg.created_at desc, msg.id desc
  limit safe_limit;
end;
$$;

revoke all on function public.list_conversation_messages(text, timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.list_conversation_messages(text, timestamptz, uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Send message
-- ---------------------------------------------------------------------------

create or replace function public.send_anonymous_message(
  p_public_id text,
  p_body text,
  p_idempotency_key text default null
)
returns table (
  message_id uuid,
  body text,
  is_mine boolean,
  created_at timestamptz,
  read_at timestamptz,
  moderation_status text,
  conversation_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
  normalized text;
  existing_id uuid;
  new_row public.anonymous_messages%rowtype;
  sent_last_minute integer;
  sent_last_day integer;
  recent_duplicate integer;
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

  if p_idempotency_key is not null
    and p_idempotency_key !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'invalid idempotency key' using errcode = '22023';
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

  if shell.status not in ('awaiting_chat', 'active') then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, current_user_id);

  if public.users_are_blocked(current_user_id, counterpart_id) then
    update public.conversation_shells
    set status = 'blocked',
        ended_at = coalesce(ended_at, timezone('utc', now())),
        ended_by = coalesce(ended_by, current_user_id)
    where id = shell.id;
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  if not public.is_eligible_introduction_student(counterpart_id) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select msg.id into existing_id
    from public.anonymous_messages msg
    where msg.conversation_id = shell.id
      and msg.sender_id = current_user_id
      and msg.client_idempotency_key = p_idempotency_key
    limit 1;

    if existing_id is not null then
      select * into new_row from public.anonymous_messages where id = existing_id;
      return query
      select
        new_row.id,
        new_row.body,
        true,
        new_row.created_at,
        new_row.read_at,
        new_row.moderation_status,
        shell.status;
      return;
    end if;
  end if;

  normalized := public.normalize_anonymous_message(p_body);
  if char_length(normalized) < 1 or char_length(normalized) > 1000 then
    raise exception 'invalid message length' using errcode = '22023';
  end if;

  if public.introduction_message_has_contact(normalized) then
    raise exception 'contact disclosure blocked' using errcode = '22023';
  end if;

  select count(*) into sent_last_minute
  from public.anonymous_messages msg
  where msg.sender_id = current_user_id
    and msg.created_at > timezone('utc', now()) - interval '1 minute';

  if sent_last_minute >= 20 then
    raise exception 'chat rate limited' using errcode = 'P0001';
  end if;

  select count(*) into sent_last_day
  from public.anonymous_messages msg
  where msg.sender_id = current_user_id
    and msg.created_at > timezone('utc', now()) - interval '1 day';

  if sent_last_day >= 300 then
    raise exception 'chat rate limited' using errcode = 'P0001';
  end if;

  select count(*) into recent_duplicate
  from public.anonymous_messages msg
  where msg.conversation_id = shell.id
    and msg.sender_id = current_user_id
    and msg.body = normalized
    and msg.created_at > timezone('utc', now()) - interval '8 seconds';

  if recent_duplicate > 0 then
    raise exception 'duplicate message' using errcode = 'P0001';
  end if;

  if shell.status = 'awaiting_chat' then
    update public.conversation_shells
    set status = 'active',
        activated_at = timezone('utc', now())
    where id = shell.id;
    shell.status := 'active';

    insert into public.conversation_events (conversation_id, actor_id, event_type)
    values (shell.id, current_user_id, 'activated');
  end if;

  insert into public.anonymous_messages (
    conversation_id,
    sender_id,
    body,
    client_idempotency_key
  )
  values (
    shell.id,
    current_user_id,
    normalized,
    nullif(p_idempotency_key, '')
  )
  returning * into new_row;

  insert into public.conversation_events (conversation_id, actor_id, event_type)
  values (shell.id, current_user_id, 'message_sent');

  return query
  select
    new_row.id,
    new_row.body,
    true,
    new_row.created_at,
    new_row.read_at,
    new_row.moderation_status,
    shell.status;
end;
$$;

revoke all on function public.send_anonymous_message(text, text, text) from public, anon;
grant execute on function public.send_anonymous_message(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Mark read (recipient only)
-- ---------------------------------------------------------------------------

create or replace function public.mark_conversation_messages_read(p_public_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell_id uuid;
  updated_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select shell.id into shell_id
  from public.conversation_shells shell
  where shell.public_id = p_public_id
    and current_user_id in (shell.participant_sender_id, shell.participant_recipient_id)
  limit 1;

  if shell_id is null then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  update public.anonymous_messages msg
  set read_at = timezone('utc', now())
  where msg.conversation_id = shell_id
    and msg.sender_id <> current_user_id
    and msg.read_at is null
    and msg.moderation_status = 'visible';

  get diagnostics updated_count = row_count;

  if updated_count > 0 then
    insert into public.conversation_events (conversation_id, actor_id, event_type)
    values (shell_id, current_user_id, 'messages_read');
  end if;

  return updated_count;
end;
$$;

revoke all on function public.mark_conversation_messages_read(text) from public, anon;
grant execute on function public.mark_conversation_messages_read(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. End conversation
-- ---------------------------------------------------------------------------

create or replace function public.end_conversation(p_public_id text)
returns void
language plpgsql
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

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  for update;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if shell.status in ('ended', 'blocked') then
    return;
  end if;

  update public.conversation_shells
  set status = 'ended',
      ended_at = timezone('utc', now()),
      ended_by = current_user_id
  where id = shell.id;

  insert into public.conversation_events (conversation_id, actor_id, event_type)
  values (shell.id, current_user_id, 'ended');
end;
$$;

revoke all on function public.end_conversation(text) from public, anon;
grant execute on function public.end_conversation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Report conversation / message
-- ---------------------------------------------------------------------------

create or replace function public.report_conversation(
  p_public_id text,
  p_reason_code text,
  p_details text default null,
  p_message_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
  normalized_details text;
  message_ok boolean := false;
  recent_reports integer;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_reason_code is null or p_reason_code not in (
    'harassment', 'spam', 'contact_pressure', 'fake_or_misleading', 'other'
  ) then
    raise exception 'invalid report reason' using errcode = '22023';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  for update;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, current_user_id);

  if p_message_id is not null then
    select exists (
      select 1
      from public.anonymous_messages msg
      where msg.id = p_message_id
        and msg.conversation_id = shell.id
    ) into message_ok;

    if not message_ok then
      raise exception 'message unavailable' using errcode = 'P0001';
    end if;
  end if;

  normalized_details := nullif(public.normalize_anonymous_message(coalesce(p_details, '')), '');
  if normalized_details is not null and char_length(normalized_details) > 300 then
    raise exception 'invalid report details' using errcode = '22023';
  end if;

  if normalized_details is not null
    and public.introduction_message_has_contact(normalized_details) then
    raise exception 'contact disclosure blocked' using errcode = '22023';
  end if;

  select count(*) into recent_reports
  from public.user_reports report
  where report.reporter_id = current_user_id
    and report.conversation_id = shell.id
    and report.created_at > timezone('utc', now()) - interval '1 hour';

  if recent_reports >= 3 then
    raise exception 'report rate limited' using errcode = 'P0001';
  end if;

  insert into public.user_reports (
    reporter_id,
    subject_user_id,
    conversation_id,
    anonymous_message_id,
    reason_code,
    details
  )
  values (
    current_user_id,
    counterpart_id,
    shell.id,
    p_message_id,
    p_reason_code,
    normalized_details
  );

  insert into public.conversation_events (conversation_id, actor_id, event_type)
  values (shell.id, current_user_id, 'reported');
end;
$$;

revoke all on function public.report_conversation(text, text, text, uuid) from public, anon;
grant execute on function public.report_conversation(text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Lookup public_id after introduction accept (for UI handoff)
-- ---------------------------------------------------------------------------

create or replace function public.get_conversation_public_id_for_introduction(
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select shell.public_id into result
  from public.conversation_shells shell
  join public.introduction_requests request
    on request.id = shell.introduction_request_id
  where request.id = p_request_id
    and current_user_id in (request.sender_id, request.recipient_id)
  limit 1;

  return result;
end;
$$;

revoke all on function public.get_conversation_public_id_for_introduction(uuid)
  from public, anon;
grant execute on function public.get_conversation_public_id_for_introduction(uuid)
  to authenticated;
