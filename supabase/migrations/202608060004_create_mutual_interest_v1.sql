-- Mutual Interest v1
-- Local-only until explicit remote preflight approval.
-- Private, reversible two-person consent inside an active anonymous conversation.
-- Does NOT reveal identity or contacts. Identity Reveal is a separate feature.
--
-- Source of truth:
--   - Per-participant rows in conversation_mutual_interests (active = withdrawn_at is null)
--   - conversation_shells.mutual_interest_at set atomically when the second active
--     consent is recorded (browser cannot write this column)
-- Policy:
--   - Before mutual: participant may withdraw privately
--   - After mutual: mutual_interest_at remains; withdraw disabled; end/block still allowed
--   - One-sided interest is NEVER exposed to the other participant

-- ---------------------------------------------------------------------------
-- 1. Extend conversation_shells with server-controlled mutual timestamp
-- ---------------------------------------------------------------------------

alter table public.conversation_shells
  add column if not exists mutual_interest_at timestamptz;

comment on column public.conversation_shells.mutual_interest_at is
  'Set only by Mutual Interest RPCs when both participants have an active consent. Not writable by clients.';

-- ---------------------------------------------------------------------------
-- 2. conversation_mutual_interests
-- ---------------------------------------------------------------------------

create table if not exists public.conversation_mutual_interests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversation_shells (id) on delete cascade,
  participant_id uuid not null
    references auth.users (id) on delete cascade,
  selected_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversation_mutual_interests_unique_participant
    unique (conversation_id, participant_id),
  constraint conversation_mutual_interests_withdraw_order
    check (withdrawn_at is null or withdrawn_at >= selected_at)
);

create index if not exists conversation_mutual_interests_active_idx
  on public.conversation_mutual_interests (conversation_id)
  where withdrawn_at is null;

comment on table public.conversation_mutual_interests is
  'Private per-participant Mutual Interest consent. One-sided rows must never be exposed to the counterpart.';

alter table public.conversation_mutual_interests enable row level security;
revoke all on table public.conversation_mutual_interests
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Allow mutual_interest_reached on conversation_events
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
      'mutual_interest_reached'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Eligibility helper (internal)
-- ---------------------------------------------------------------------------

create or replace function public.is_conversation_eligible_for_mutual_interest(
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
  sender_messages integer;
  recipient_messages integer;
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

  select count(*) into sender_messages
  from public.anonymous_messages msg
  where msg.conversation_id = shell.id
    and msg.sender_id = shell.participant_sender_id
    and msg.moderation_status = 'visible';

  select count(*) into recipient_messages
  from public.anonymous_messages msg
  where msg.conversation_id = shell.id
    and msg.sender_id = shell.participant_recipient_id
    and msg.moderation_status = 'visible';

  if sender_messages < 1 or recipient_messages < 1 then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.is_conversation_eligible_for_mutual_interest(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Safe state projection helper (never exposes counterpart consent)
-- ---------------------------------------------------------------------------

create or replace function public.project_mutual_interest_state(
  p_shell public.conversation_shells,
  p_user_id uuid
)
returns table (
  eligible boolean,
  selected_by_me boolean,
  mutual boolean,
  mutual_at timestamptz,
  can_withdraw boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mine_active boolean := false;
  is_mutual boolean := false;
  is_eligible boolean := false;
begin
  if p_shell.id is null or p_user_id is null then
    return query select false, false, false, null::timestamptz, false;
    return;
  end if;

  if p_user_id not in (p_shell.participant_sender_id, p_shell.participant_recipient_id) then
    return query select false, false, false, null::timestamptz, false;
    return;
  end if;

  is_mutual := p_shell.mutual_interest_at is not null;
  is_eligible := public.is_conversation_eligible_for_mutual_interest(p_shell.id, p_user_id);

  select exists (
    select 1
    from public.conversation_mutual_interests interest
    where interest.conversation_id = p_shell.id
      and interest.participant_id = p_user_id
      and interest.withdrawn_at is null
  ) into mine_active;

  -- CRITICAL: never inspect or return whether the counterpart has selected.
  return query
  select
    is_eligible and not is_mutual,
    mine_active,
    is_mutual,
    case when is_mutual then p_shell.mutual_interest_at else null end,
    is_eligible and mine_active and not is_mutual;
end;
$$;

revoke all on function public.project_mutual_interest_state(public.conversation_shells, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. get_mutual_interest_state
-- ---------------------------------------------------------------------------

create or replace function public.get_mutual_interest_state(p_public_id text)
returns table (
  eligible boolean,
  selected_by_me boolean,
  mutual boolean,
  mutual_at timestamptz,
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
    return query select false, false, false, null::timestamptz, false;
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    -- Same empty-safe shape as unavailable (no oracle via error).
    return query select false, false, false, null::timestamptz, false;
    return;
  end if;

  return query
  select *
  from public.project_mutual_interest_state(shell, current_user_id);
end;
$$;

revoke all on function public.get_mutual_interest_state(text) from public, anon;
grant execute on function public.get_mutual_interest_state(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. select_mutual_interest
-- ---------------------------------------------------------------------------

create or replace function public.select_mutual_interest(p_public_id text)
returns table (
  eligible boolean,
  selected_by_me boolean,
  mutual boolean,
  mutual_at timestamptz,
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

  -- Already mutual: idempotent safe projection (no withdraw, no re-select side effects).
  if shell.mutual_interest_at is not null then
    return query
    select *
    from public.project_mutual_interest_state(shell, current_user_id);
    return;
  end if;

  if not public.is_conversation_eligible_for_mutual_interest(shell.id, current_user_id) then
    raise exception 'mutual interest unavailable' using errcode = 'P0001';
  end if;

  insert into public.conversation_mutual_interests (
    conversation_id,
    participant_id,
    selected_at,
    withdrawn_at,
    created_at,
    updated_at
  )
  values (
    shell.id,
    current_user_id,
    now_utc,
    null,
    now_utc,
    now_utc
  )
  on conflict (conversation_id, participant_id)
  do update set
    selected_at = case
      when conversation_mutual_interests.withdrawn_at is null
        then conversation_mutual_interests.selected_at
      else excluded.selected_at
    end,
    withdrawn_at = null,
    updated_at = now_utc;

  select count(*) into active_count
  from public.conversation_mutual_interests interest
  where interest.conversation_id = shell.id
    and interest.withdrawn_at is null
    and interest.participant_id in (
      shell.participant_sender_id,
      shell.participant_recipient_id
    );

  if active_count >= 2 and shell.mutual_interest_at is null then
    update public.conversation_shells
    set mutual_interest_at = now_utc
    where id = shell.id
      and mutual_interest_at is null
    returning * into shell;

    insert into public.conversation_events (
      conversation_id,
      actor_id,
      event_type
    )
    values (
      shell.id,
      current_user_id,
      'mutual_interest_reached'
    );
  else
    select * into shell
    from public.conversation_shells
    where id = shell.id;
  end if;

  return query
  select *
  from public.project_mutual_interest_state(shell, current_user_id);
end;
$$;

revoke all on function public.select_mutual_interest(text) from public, anon;
grant execute on function public.select_mutual_interest(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. withdraw_mutual_interest (only before mutual completion)
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_mutual_interest(p_public_id text)
returns table (
  eligible boolean,
  selected_by_me boolean,
  mutual boolean,
  mutual_at timestamptz,
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

  -- After mutual completion, withdraw is not allowed. Return current safe state.
  if shell.mutual_interest_at is not null then
    return query
    select *
    from public.project_mutual_interest_state(shell, current_user_id);
    return;
  end if;

  if shell.status in ('ended', 'blocked') then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  update public.conversation_mutual_interests interest
  set withdrawn_at = now_utc,
      updated_at = now_utc
  where interest.conversation_id = shell.id
    and interest.participant_id = current_user_id
    and interest.withdrawn_at is null;

  select * into shell
  from public.conversation_shells
  where id = shell.id;

  return query
  select *
  from public.project_mutual_interest_state(shell, current_user_id);
end;
$$;

revoke all on function public.withdraw_mutual_interest(text) from public, anon;
grant execute on function public.withdraw_mutual_interest(text) to authenticated;
