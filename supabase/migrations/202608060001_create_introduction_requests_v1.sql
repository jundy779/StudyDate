-- Introduction Requests v1 + minimal block/report foundation.
-- Local-only until approved remote preflight. Do not apply without verification.
--
-- Privacy policy highlights:
-- - Recipient may hide People visibility after a request arrives; existing
--   participants retain list/detail access to that request. New sends still
--   require recipient discoverability.
-- - Block closes pending introductions between the pair as cancelled.
-- - Accepted introductions create one conversation_shells row (awaiting_chat)
--   as the Anonymous Chat v1 handoff. No messaging composer in this migration.
-- - Rate limits: 5/hour, 15/day, 5 pending outgoing; 7-day cooldown after
--   decline or cancellation for the same sender→recipient pair.
-- - Pending introductions expire after 14 days (expires_at).

create table public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_blocks_distinct_users check (blocker_id <> blocked_id),
  constraint user_blocks_unique_pair unique (blocker_id, blocked_id)
);

create index user_blocks_blocked_id_idx on public.user_blocks (blocked_id);
create index user_blocks_blocker_id_idx on public.user_blocks (blocker_id);

comment on table public.user_blocks is
  'Private student blocks. Prevents introductions both directions. Never expose reasons to the blocked user.';

alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from public, anon, authenticated;

create table public.introduction_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  opening_message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz null,
  cancelled_at timestamptz null,
  expires_at timestamptz not null,
  constraint introduction_requests_distinct_users check (sender_id <> recipient_id),
  constraint introduction_requests_status_allowed check (
    status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')
  ),
  constraint introduction_requests_message_length check (
    char_length(opening_message) between 12 and 300
  ),
  constraint introduction_requests_response_consistency check (
    (status = 'pending' and responded_at is null and cancelled_at is null)
    or (status = 'accepted' and responded_at is not null and cancelled_at is null)
    or (status = 'declined' and responded_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null)
    or (status = 'expired' and responded_at is null)
  )
);

create unique index introduction_requests_one_pending_pair_idx
  on public.introduction_requests (
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id)
  )
  where status = 'pending';

create index introduction_requests_recipient_status_idx
  on public.introduction_requests (recipient_id, status, created_at desc);

create index introduction_requests_sender_status_idx
  on public.introduction_requests (sender_id, status, created_at desc);

create index introduction_requests_sender_created_idx
  on public.introduction_requests (sender_id, created_at desc);

comment on table public.introduction_requests is
  'Private student introductions. No NIM, legal name, contacts, or evidence. Participant UUIDs stay server-side.';

comment on column public.introduction_requests.opening_message is
  'Plain-text opening only. Contact patterns are rejected at write time; filter is best-effort, not absolute.';

alter table public.introduction_requests enable row level security;
revoke all on table public.introduction_requests from public, anon, authenticated;

drop trigger if exists introduction_requests_set_updated_at on public.introduction_requests;
create trigger introduction_requests_set_updated_at
before update on public.introduction_requests
for each row
execute function public.set_updated_at();

create table public.conversation_shells (
  id uuid primary key default gen_random_uuid(),
  introduction_request_id uuid not null unique
    references public.introduction_requests (id) on delete cascade,
  participant_sender_id uuid not null references auth.users (id) on delete cascade,
  participant_recipient_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'awaiting_chat',
  created_at timestamptz not null default timezone('utc', now()),
  constraint conversation_shells_distinct_participants check (
    participant_sender_id <> participant_recipient_id
  ),
  constraint conversation_shells_status_allowed check (
    status in ('awaiting_chat')
  )
);

comment on table public.conversation_shells is
  'Anonymous Chat v1 handoff shell created on accept. No messages yet. One shell per accepted introduction.';

alter table public.conversation_shells enable row level security;
revoke all on table public.conversation_shells from public, anon, authenticated;

create table public.introduction_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.introduction_requests (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint introduction_events_type_allowed check (
    event_type in (
      'sent',
      'accepted',
      'declined',
      'cancelled',
      'expired',
      'blocked_closed',
      'reported'
    )
  )
);

comment on table public.introduction_events is
  'Append-only sanitized introduction audit. No message body, email, or contact content.';

alter table public.introduction_events enable row level security;
revoke all on table public.introduction_events from public, anon, authenticated;

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  subject_user_id uuid not null references auth.users (id) on delete cascade,
  introduction_request_id uuid null
    references public.introduction_requests (id) on delete set null,
  reason_code text not null,
  details text null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_reports_distinct_users check (reporter_id <> subject_user_id),
  constraint user_reports_reason_allowed check (
    reason_code in (
      'harassment',
      'spam',
      'contact_pressure',
      'fake_or_misleading',
      'other'
    )
  ),
  constraint user_reports_details_length check (
    details is null or char_length(details) <= 300
  )
);

create index user_reports_introduction_idx
  on public.user_reports (introduction_request_id)
  where introduction_request_id is not null;

comment on table public.user_reports is
  'Private participant reports. No automatic public accusation or fake moderation result.';

alter table public.user_reports enable row level security;
revoke all on table public.user_reports from public, anon, authenticated;

create or replace function public.is_active_staff_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members staff
    where staff.user_id = p_user_id
      and staff.status = 'active'
  );
$$;

revoke all on function public.is_active_staff_user(uuid)
  from public, anon, authenticated;

create or replace function public.users_are_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_blocks block
    where (block.blocker_id = p_user_a and block.blocked_id = p_user_b)
       or (block.blocker_id = p_user_b and block.blocked_id = p_user_a)
  );
$$;

revoke all on function public.users_are_blocked(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.is_eligible_introduction_student(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.user_id = p_user_id
      and profile.onboarding_completed_at is not null
      and not public.is_active_staff_user(p_user_id)
  );
$$;

revoke all on function public.is_eligible_introduction_student(uuid)
  from public, anon, authenticated;

create or replace function public.normalize_introduction_message(p_message text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := btrim(regexp_replace(coalesce(p_message, ''), '\s+', ' ', 'g'));
  return normalized;
end;
$$;

revoke all on function public.normalize_introduction_message(text)
  from public, anon, authenticated;

create or replace function public.introduction_message_has_contact(p_message text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  lowered text := lower(coalesce(p_message, ''));
begin
  if lowered ~ '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}' then
    return true;
  end if;

  if lowered ~ '(https?://|www\.|t\.me/|telegram\.me/|wa\.me/|api\.whatsapp\.com|bit\.ly/|tinyurl\.com/|instagram\.com/|ig\.me/)' then
    return true;
  end if;

  if lowered ~ '(whatsapp|wa\.me|telegram|t\.me|instagram|insta\b|line\.me|discord\.gg)' then
    return true;
  end if;

  if lowered ~ '@[a-z0-9_]{3,}' then
    return true;
  end if;

  if regexp_replace(lowered, '[^0-9]', '', 'g') ~ '[0-9]{8,}' then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.introduction_message_has_contact(text)
  from public, anon, authenticated;

create or replace function public.expire_stale_introduction_requests()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with expired as (
    update public.introduction_requests request
    set status = 'expired'
    where request.status = 'pending'
      and request.expires_at <= timezone('utc', now())
    returning request.id, request.sender_id
  )
  insert into public.introduction_events (request_id, actor_user_id, event_type)
  select expired.id, expired.sender_id, 'expired'
  from expired;
end;
$$;

revoke all on function public.expire_stale_introduction_requests()
  from public, anon, authenticated;

create or replace function public.close_pending_introductions_for_block(
  p_blocker_id uuid,
  p_blocked_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with closed as (
    update public.introduction_requests request
    set
      status = 'cancelled',
      cancelled_at = timezone('utc', now())
    where request.status = 'pending'
      and (
        (request.sender_id = p_blocker_id and request.recipient_id = p_blocked_id)
        or (request.sender_id = p_blocked_id and request.recipient_id = p_blocker_id)
      )
    returning request.id
  )
  insert into public.introduction_events (request_id, actor_user_id, event_type)
  select closed.id, p_blocker_id, 'blocked_closed'
  from closed;
end;
$$;

revoke all on function public.close_pending_introductions_for_block(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.send_introduction_request(
  p_recipient_alias text,
  p_opening_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  recipient_user_id uuid;
  normalized_message text;
  pending_outgoing integer;
  sent_last_hour integer;
  sent_last_day integer;
  recent_terminal timestamptz;
  new_request_id uuid;
begin
  perform public.expire_stale_introduction_requests();

  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_recipient_alias is null or p_recipient_alias !~ '^Partner #[0-9]{6}$' then
    raise exception 'invalid recipient' using errcode = '22023';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'sender not eligible' using errcode = '42501';
  end if;

  select profile.user_id
  into recipient_user_id
  from public.profiles profile
  where profile.public_alias = p_recipient_alias
    and profile.onboarding_completed_at is not null
    and profile.is_discoverable = true
    and not public.is_active_staff_user(profile.user_id);

  if recipient_user_id is null then
    raise exception 'recipient unavailable' using errcode = 'P0002';
  end if;

  if recipient_user_id = current_user_id then
    raise exception 'cannot introduce self' using errcode = '22023';
  end if;

  if public.users_are_blocked(current_user_id, recipient_user_id) then
    raise exception 'interaction unavailable' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.introduction_requests request
    where request.status = 'pending'
      and least(request.sender_id, request.recipient_id)
        = least(current_user_id, recipient_user_id)
      and greatest(request.sender_id, request.recipient_id)
        = greatest(current_user_id, recipient_user_id)
  ) then
    raise exception 'duplicate introduction' using errcode = '23505';
  end if;

  select max(coalesce(request.responded_at, request.cancelled_at, request.updated_at))
  into recent_terminal
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.recipient_id = recipient_user_id
    and request.status in ('declined', 'cancelled');

  if recent_terminal is not null
    and recent_terminal > timezone('utc', now()) - interval '7 days' then
    raise exception 'introduction cooldown' using errcode = 'P0001';
  end if;

  select count(*) into pending_outgoing
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.status = 'pending';

  if pending_outgoing >= 5 then
    raise exception 'introduction rate limited' using errcode = 'P0001';
  end if;

  select count(*) into sent_last_hour
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.created_at > timezone('utc', now()) - interval '1 hour';

  if sent_last_hour >= 5 then
    raise exception 'introduction rate limited' using errcode = 'P0001';
  end if;

  select count(*) into sent_last_day
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.created_at > timezone('utc', now()) - interval '1 day';

  if sent_last_day >= 15 then
    raise exception 'introduction rate limited' using errcode = 'P0001';
  end if;

  normalized_message := public.normalize_introduction_message(p_opening_message);
  if char_length(normalized_message) < 12 or char_length(normalized_message) > 300 then
    raise exception 'invalid opening message' using errcode = '22023';
  end if;

  if public.introduction_message_has_contact(normalized_message) then
    raise exception 'contact disclosure blocked' using errcode = '22023';
  end if;

  insert into public.introduction_requests (
    sender_id,
    recipient_id,
    opening_message,
    status,
    expires_at
  ) values (
    current_user_id,
    recipient_user_id,
    normalized_message,
    'pending',
    timezone('utc', now()) + interval '14 days'
  )
  returning id into new_request_id;

  insert into public.introduction_events (request_id, actor_user_id, event_type)
  values (new_request_id, current_user_id, 'sent');

  return new_request_id;
end;
$$;

revoke all on function public.send_introduction_request(text, text)
  from public, anon;
grant execute on function public.send_introduction_request(text, text)
  to authenticated;

create or replace function public.accept_introduction_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.introduction_requests%rowtype;
begin
  perform public.expire_stale_introduction_requests();

  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'recipient not eligible' using errcode = '42501';
  end if;

  select * into target
  from public.introduction_requests request
  where request.id = p_request_id
  for update;

  if target.id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  if target.recipient_id <> current_user_id then
    raise exception 'not request recipient' using errcode = '42501';
  end if;

  if public.users_are_blocked(target.sender_id, target.recipient_id) then
    raise exception 'interaction unavailable' using errcode = '42501';
  end if;

  if target.status <> 'pending' or target.expires_at <= timezone('utc', now()) then
    raise exception 'request not actionable' using errcode = '22023';
  end if;

  if not public.is_eligible_introduction_student(target.sender_id) then
    raise exception 'sender unavailable' using errcode = '42501';
  end if;

  update public.introduction_requests
  set
    status = 'accepted',
    responded_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = target.id;

  insert into public.conversation_shells (
    introduction_request_id,
    participant_sender_id,
    participant_recipient_id,
    status
  ) values (
    target.id,
    target.sender_id,
    target.recipient_id,
    'awaiting_chat'
  );

  insert into public.introduction_events (request_id, actor_user_id, event_type)
  values (target.id, current_user_id, 'accepted');
end;
$$;

revoke all on function public.accept_introduction_request(uuid)
  from public, anon;
grant execute on function public.accept_introduction_request(uuid)
  to authenticated;

create or replace function public.decline_introduction_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.introduction_requests%rowtype;
begin
  perform public.expire_stale_introduction_requests();

  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into target
  from public.introduction_requests request
  where request.id = p_request_id
  for update;

  if target.id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  if target.recipient_id <> current_user_id then
    raise exception 'not request recipient' using errcode = '42501';
  end if;

  if target.status <> 'pending' then
    raise exception 'request not actionable' using errcode = '22023';
  end if;

  update public.introduction_requests
  set
    status = 'declined',
    responded_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = target.id;

  insert into public.introduction_events (request_id, actor_user_id, event_type)
  values (target.id, current_user_id, 'declined');
end;
$$;

revoke all on function public.decline_introduction_request(uuid)
  from public, anon;
grant execute on function public.decline_introduction_request(uuid)
  to authenticated;

create or replace function public.cancel_introduction_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.introduction_requests%rowtype;
begin
  perform public.expire_stale_introduction_requests();

  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into target
  from public.introduction_requests request
  where request.id = p_request_id
  for update;

  if target.id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  if target.sender_id <> current_user_id then
    raise exception 'not request sender' using errcode = '42501';
  end if;

  if target.status <> 'pending' then
    raise exception 'request not actionable' using errcode = '22023';
  end if;

  update public.introduction_requests
  set
    status = 'cancelled',
    cancelled_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = target.id;

  insert into public.introduction_events (request_id, actor_user_id, event_type)
  values (target.id, current_user_id, 'cancelled');
end;
$$;

revoke all on function public.cancel_introduction_request(uuid)
  from public, anon;
grant execute on function public.cancel_introduction_request(uuid)
  to authenticated;

create or replace function public.list_received_introduction_requests(
  p_limit integer default 50
)
returns table (
  request_id uuid,
  counterpart_alias text,
  campus text,
  study_program text,
  semester smallint,
  is_verified boolean,
  opening_message text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
begin
  perform public.expire_stale_introduction_requests();

  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  return query
  select
    request.id,
    sender.public_alias,
    sender.campus,
    sender.study_program,
    sender.semester,
    sender.verification_status = 'verified',
    request.opening_message,
    request.status,
    request.created_at,
    request.responded_at
  from public.introduction_requests request
  join public.profiles sender on sender.user_id = request.sender_id
  where request.recipient_id = current_user_id
    and not public.users_are_blocked(request.sender_id, request.recipient_id)
  order by request.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.list_received_introduction_requests(integer)
  from public, anon;
grant execute on function public.list_received_introduction_requests(integer)
  to authenticated;

create or replace function public.list_sent_introduction_requests(
  p_limit integer default 50
)
returns table (
  request_id uuid,
  counterpart_alias text,
  campus text,
  study_program text,
  semester smallint,
  is_verified boolean,
  opening_message text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
begin
  perform public.expire_stale_introduction_requests();

  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  return query
  select
    request.id,
    recipient.public_alias,
    recipient.campus,
    recipient.study_program,
    recipient.semester,
    recipient.verification_status = 'verified',
    request.opening_message,
    request.status,
    request.created_at,
    request.responded_at
  from public.introduction_requests request
  join public.profiles recipient on recipient.user_id = request.recipient_id
  where request.sender_id = current_user_id
    and not public.users_are_blocked(request.sender_id, request.recipient_id)
  order by request.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.list_sent_introduction_requests(integer)
  from public, anon;
grant execute on function public.list_sent_introduction_requests(integer)
  to authenticated;

create or replace function public.count_pending_received_introductions()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  pending_count integer;
begin
  perform public.expire_stale_introduction_requests();

  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    return 0;
  end if;

  select count(*)::integer into pending_count
  from public.introduction_requests request
  where request.recipient_id = current_user_id
    and request.status = 'pending'
    and request.expires_at > timezone('utc', now())
    and not public.users_are_blocked(request.sender_id, request.recipient_id);

  return coalesce(pending_count, 0);
end;
$$;

revoke all on function public.count_pending_received_introductions()
  from public, anon;
grant execute on function public.count_pending_received_introductions()
  to authenticated;

create or replace function public.get_introduction_send_eligibility(
  p_recipient_alias text
)
returns table (
  can_send boolean,
  state_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  recipient_user_id uuid;
  recent_terminal timestamptz;
  pending_outgoing integer;
  sent_last_hour integer;
  sent_last_day integer;
begin
  perform public.expire_stale_introduction_requests();

  if current_user_id is null then
    return query select false, 'unavailable'::text;
    return;
  end if;

  if p_recipient_alias is null or p_recipient_alias !~ '^Partner #[0-9]{6}$' then
    return query select false, 'unavailable'::text;
    return;
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    return query select false, 'unavailable'::text;
    return;
  end if;

  select profile.user_id into recipient_user_id
  from public.profiles profile
  where profile.public_alias = p_recipient_alias;

  if recipient_user_id is null then
    return query select false, 'unavailable'::text;
    return;
  end if;

  if recipient_user_id = current_user_id then
    return query select false, 'self'::text;
    return;
  end if;

  if public.is_active_staff_user(recipient_user_id)
    or not exists (
      select 1 from public.profiles profile
      where profile.user_id = recipient_user_id
        and profile.onboarding_completed_at is not null
        and profile.is_discoverable = true
    ) then
    return query select false, 'unavailable'::text;
    return;
  end if;

  if public.users_are_blocked(current_user_id, recipient_user_id) then
    return query select false, 'blocked'::text;
    return;
  end if;

  if exists (
    select 1
    from public.introduction_requests request
    where request.status = 'pending'
      and least(request.sender_id, request.recipient_id)
        = least(current_user_id, recipient_user_id)
      and greatest(request.sender_id, request.recipient_id)
        = greatest(current_user_id, recipient_user_id)
  ) then
    return query select false, 'pending'::text;
    return;
  end if;

  select max(coalesce(request.responded_at, request.cancelled_at, request.updated_at))
  into recent_terminal
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.recipient_id = recipient_user_id
    and request.status in ('declined', 'cancelled');

  if recent_terminal is not null
    and recent_terminal > timezone('utc', now()) - interval '7 days' then
    return query select false, 'cooldown'::text;
    return;
  end if;

  select count(*) into pending_outgoing
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.status = 'pending';

  select count(*) into sent_last_hour
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.created_at > timezone('utc', now()) - interval '1 hour';

  select count(*) into sent_last_day
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.created_at > timezone('utc', now()) - interval '1 day';

  if pending_outgoing >= 5 or sent_last_hour >= 5 or sent_last_day >= 15 then
    return query select false, 'rate_limited'::text;
    return;
  end if;

  return query select true, 'ok'::text;
end;
$$;

revoke all on function public.get_introduction_send_eligibility(text)
  from public, anon;
grant execute on function public.get_introduction_send_eligibility(text)
  to authenticated;

create or replace function public.block_student_by_alias(p_alias text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'blocker not eligible' using errcode = '42501';
  end if;

  if p_alias is null or p_alias !~ '^Partner #[0-9]{6}$' then
    raise exception 'invalid alias' using errcode = '22023';
  end if;

  select profile.user_id into target_user_id
  from public.profiles profile
  where profile.public_alias = p_alias
    and profile.onboarding_completed_at is not null;

  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'block target unavailable' using errcode = 'P0002';
  end if;

  if public.is_active_staff_user(target_user_id) then
    raise exception 'block target unavailable' using errcode = 'P0002';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (current_user_id, target_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  perform public.close_pending_introductions_for_block(current_user_id, target_user_id);
end;
$$;

revoke all on function public.block_student_by_alias(text)
  from public, anon;
grant execute on function public.block_student_by_alias(text)
  to authenticated;

create or replace function public.report_introduction_request(
  p_request_id uuid,
  p_reason_code text,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.introduction_requests%rowtype;
  subject_user_id uuid;
  normalized_details text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'reporter not eligible' using errcode = '42501';
  end if;

  if p_reason_code is null or p_reason_code not in (
    'harassment', 'spam', 'contact_pressure', 'fake_or_misleading', 'other'
  ) then
    raise exception 'invalid report reason' using errcode = '22023';
  end if;

  select * into target
  from public.introduction_requests request
  where request.id = p_request_id;

  if target.id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  if current_user_id <> target.sender_id
    and current_user_id <> target.recipient_id then
    raise exception 'not request participant' using errcode = '42501';
  end if;

  subject_user_id := case
    when current_user_id = target.sender_id then target.recipient_id
    else target.sender_id
  end;

  normalized_details := nullif(
    public.normalize_introduction_message(coalesce(p_details, '')),
    ''
  );

  if normalized_details is not null and char_length(normalized_details) > 300 then
    raise exception 'invalid report details' using errcode = '22023';
  end if;

  if normalized_details is not null
    and public.introduction_message_has_contact(normalized_details) then
    raise exception 'contact disclosure blocked' using errcode = '22023';
  end if;

  insert into public.user_reports (
    reporter_id,
    subject_user_id,
    introduction_request_id,
    reason_code,
    details
  ) values (
    current_user_id,
    subject_user_id,
    target.id,
    p_reason_code,
    normalized_details
  );

  insert into public.introduction_events (request_id, actor_user_id, event_type)
  values (target.id, current_user_id, 'reported');
end;
$$;

revoke all on function public.report_introduction_request(uuid, text, text)
  from public, anon;
grant execute on function public.report_introduction_request(uuid, text, text)
  to authenticated;

-- Refresh People Discovery projections to exclude mutual blocks.
create or replace function public.list_people_discovery_profiles(
  p_campus text default null,
  p_study_program text default null,
  p_semester smallint default null,
  p_city_region text default null,
  p_connection_goal text default null,
  p_interest text default null,
  p_after_alias text default null,
  p_limit integer default 13
)
returns table (
  public_alias text,
  campus text,
  study_program text,
  semester smallint,
  city_region text,
  short_intro text,
  interests text[],
  connection_goals text[],
  is_verified boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 13), 1), 13);
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles requester
    where requester.user_id = current_user_id
      and requester.onboarding_completed_at is not null
  ) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if (p_campus is not null and char_length(btrim(p_campus)) > 120)
    or (p_study_program is not null and char_length(btrim(p_study_program)) > 120)
    or (p_city_region is not null and char_length(btrim(p_city_region)) > 120)
    or (p_semester is not null and p_semester not between 1 and 16)
    or (p_after_alias is not null and p_after_alias !~ '^Partner #[0-9]{6}$')
    or (p_connection_goal is not null and p_connection_goal not in (
      'study', 'friendship', 'networking', 'collaboration',
      'campus_activities', 'meaningful_connection'
    ))
    or (p_interest is not null and p_interest not in (
      'technology', 'design', 'business', 'languages', 'books', 'film',
      'music', 'sports', 'organizations', 'career', 'research', 'volunteering'
    )) then
    raise exception 'invalid discovery filter' using errcode = '22023';
  end if;

  return query
  select
    profile.public_alias,
    profile.campus,
    profile.study_program,
    profile.semester,
    profile.city_region,
    profile.short_intro,
    profile.interests,
    profile.connection_goals,
    profile.verification_status = 'verified'
  from public.profiles profile
  where profile.user_id <> current_user_id
    and profile.is_discoverable = true
    and profile.onboarding_completed_at is not null
    and not exists (
      select 1
      from public.staff_members staff
      where staff.user_id = profile.user_id
        and staff.status = 'active'
    )
    and not public.users_are_blocked(current_user_id, profile.user_id)
    and (p_campus is null or position(lower(btrim(p_campus)) in lower(profile.campus)) > 0)
    and (p_study_program is null or position(lower(btrim(p_study_program)) in lower(profile.study_program)) > 0)
    and (p_semester is null or profile.semester = p_semester)
    and (p_city_region is null or position(lower(btrim(p_city_region)) in lower(profile.city_region)) > 0)
    and (p_connection_goal is null or profile.connection_goals @> array[p_connection_goal])
    and (p_interest is null or profile.interests @> array[p_interest])
    and (p_after_alias is null or profile.public_alias > p_after_alias)
  order by profile.public_alias asc
  limit safe_limit;
end;
$$;

revoke all on function public.list_people_discovery_profiles(
  text, text, smallint, text, text, text, text, integer
) from public, anon;
grant execute on function public.list_people_discovery_profiles(
  text, text, smallint, text, text, text, text, integer
) to authenticated;

create or replace function public.get_people_discovery_profile(
  p_public_alias text
)
returns table (
  public_alias text,
  campus text,
  study_program text,
  semester smallint,
  city_region text,
  short_intro text,
  interests text[],
  connection_goals text[],
  is_verified boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles requester
    where requester.user_id = current_user_id
      and requester.onboarding_completed_at is not null
  ) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_alias is null or p_public_alias !~ '^Partner #[0-9]{6}$' then
    raise exception 'invalid discovery alias' using errcode = '22023';
  end if;

  return query
  select
    profile.public_alias,
    profile.campus,
    profile.study_program,
    profile.semester,
    profile.city_region,
    profile.short_intro,
    profile.interests,
    profile.connection_goals,
    profile.verification_status = 'verified'
  from public.profiles profile
  where profile.public_alias = p_public_alias
    and profile.user_id <> current_user_id
    and profile.is_discoverable = true
    and profile.onboarding_completed_at is not null
    and not exists (
      select 1
      from public.staff_members staff
      where staff.user_id = profile.user_id
        and staff.status = 'active'
    )
    and not public.users_are_blocked(current_user_id, profile.user_id);
end;
$$;

revoke all on function public.get_people_discovery_profile(text)
  from public, anon;
grant execute on function public.get_people_discovery_profile(text)
  to authenticated;
