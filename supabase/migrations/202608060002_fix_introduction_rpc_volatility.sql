-- Fix Introduction RPCs that perform expiry writes but were marked STABLE.
-- PostgREST may execute STABLE functions in read-only transactions, which
-- breaks list/eligibility calls after expire_stale attempts INSERT/UPDATE.

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
volatile
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
volatile
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

create or replace function public.count_pending_received_introductions()
returns integer
language plpgsql
volatile
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

create or replace function public.get_introduction_send_eligibility(
  p_recipient_alias text
)
returns table (
  can_send boolean,
  state_code text
)
language plpgsql
volatile
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
