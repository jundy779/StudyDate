-- StudyDate Free + Plus entitlement foundation (no payments).
-- Free is the default fallback; Plus is an audited server-side entitlement.

create table if not exists public.membership_plans (
  code text primary key,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint membership_plans_code_allowed check (code in ('free', 'plus')),
  constraint membership_plans_display_name_length check (
    char_length(display_name) between 3 and 40
  )
);

insert into public.membership_plans (code, display_name)
values
  ('free', 'StudyDate Free'),
  ('plus', 'StudyDate Plus')
on conflict (code) do nothing;

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_code text not null references public.membership_plans (code),
  status text not null default 'active',
  source text not null,
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_entitlements_status_allowed check (
    status in ('active', 'expired', 'revoked')
  ),
  constraint user_entitlements_source_allowed check (
    source in ('system', 'owner_grant', 'promo', 'early_access_promo', 'future_payment')
  ),
  constraint user_entitlements_plan_plus_only check (plan_code = 'plus'),
  constraint user_entitlements_window_valid check (
    ends_at is null or ends_at > starts_at
  )
);

create unique index if not exists user_entitlements_one_active_plus_idx
  on public.user_entitlements (user_id)
  where status = 'active' and plan_code = 'plus';

create index if not exists user_entitlements_user_status_idx
  on public.user_entitlements (user_id, status, ends_at desc);

create table if not exists public.membership_quota_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  constraint membership_quota_usage_pkey primary key (user_id, action, window_start),
  constraint membership_quota_usage_action_allowed check (
    action in ('people_discovery_daily')
  ),
  constraint membership_quota_usage_hit_nonnegative check (hit_count >= 0)
);

create table if not exists public.membership_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  plan_code text not null,
  duration_days smallint null,
  subject_suffix text null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint membership_audit_events_type_allowed check (
    event_type in (
      'membership_granted',
      'membership_extended',
      'membership_revoked'
    )
  ),
  constraint membership_audit_events_plan_allowed check (plan_code in ('plus')),
  constraint membership_audit_events_duration_allowed check (
    duration_days is null or duration_days in (7, 30, 90)
  ),
  constraint membership_audit_events_subject_suffix_length check (
    subject_suffix is null or char_length(subject_suffix) between 1 and 16
  )
);

create index if not exists membership_audit_events_created_at_idx
  on public.membership_audit_events (created_at desc);

alter table public.membership_plans enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.membership_quota_usage enable row level security;
alter table public.membership_audit_events enable row level security;

revoke all on table public.membership_plans from public, anon, authenticated;
revoke all on table public.user_entitlements from public, anon, authenticated;
revoke all on table public.membership_quota_usage from public, anon, authenticated;
revoke all on table public.membership_audit_events from public, anon, authenticated;

create or replace function public.effective_membership_plan(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  matched text;
begin
  if p_user_id is null then
    return 'free';
  end if;

  select entitlement.plan_code
  into matched
  from public.user_entitlements entitlement
  where entitlement.user_id = p_user_id
    and entitlement.plan_code = 'plus'
    and entitlement.status = 'active'
    and entitlement.starts_at <= timezone('utc', now())
    and (
      entitlement.ends_at is null
      or entitlement.ends_at > timezone('utc', now())
    )
  order by entitlement.ends_at desc nulls first, entitlement.starts_at desc
  limit 1;

  return coalesce(matched, 'free');
end;
$$;

revoke all on function public.effective_membership_plan(uuid)
  from public, anon, authenticated;

create or replace function public.membership_plan_limit(p_plan text, p_key text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_plan = 'plus' and p_key = 'people_discovery_daily' then 40
    when p_plan = 'plus' and p_key = 'introduction_requests_daily' then 10
    when p_plan = 'plus' and p_key = 'active_introductions' then 10
    when p_plan = 'plus' and p_key = 'created_circles_active' then 3
    when p_plan = 'plus' and p_key = 'joined_circles_active' then 10
    when p_key = 'people_discovery_daily' then 10
    when p_key = 'introduction_requests_daily' then 3
    when p_key = 'active_introductions' then 3
    when p_key = 'created_circles_active' then 1
    when p_key = 'joined_circles_active' then 3
    else 0
  end;
$$;

revoke all on function public.membership_plan_limit(text, text)
  from public, anon, authenticated;

create or replace function public.membership_allows_advanced_discovery(p_plan text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_plan = 'plus';
$$;

revoke all on function public.membership_allows_advanced_discovery(text)
  from public, anon, authenticated;

create or replace function public.consume_membership_quota(
  p_user_id uuid,
  p_action text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start timestamptz := date_trunc('day', timezone('utc', now()));
  updated integer;
begin
  if p_user_id is null
    or p_action <> 'people_discovery_daily'
    or p_limit is null
    or p_limit < 1
    or p_limit > 1000 then
    return false;
  end if;

  insert into public.membership_quota_usage as usage (
    user_id, action, window_start, hit_count
  ) values (
    p_user_id, p_action, window_start, 1
  )
  on conflict (user_id, action, window_start) do update
    set hit_count = usage.hit_count + 1
    where usage.hit_count < p_limit;

  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.consume_membership_quota(uuid, text, integer)
  from public, anon, authenticated;

drop function if exists public.get_my_membership();

create or replace function public.get_my_membership()
returns table (
  plan_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  source text,
  status text,
  plus_expired boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  plan text;
  expired boolean := false;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  plan := public.effective_membership_plan(actor);
  if plan = 'plus' then
    return query
    select
      entitlement.plan_code,
      entitlement.starts_at,
      entitlement.ends_at,
      entitlement.source,
      entitlement.status,
      false
    from public.user_entitlements entitlement
    where entitlement.user_id = actor
      and entitlement.plan_code = 'plus'
      and entitlement.status = 'active'
      and entitlement.starts_at <= timezone('utc', now())
      and (
        entitlement.ends_at is null
        or entitlement.ends_at > timezone('utc', now())
      )
    order by entitlement.ends_at desc nulls first, entitlement.starts_at desc
    limit 1;
    return;
  end if;

  select exists (
    select 1
    from public.user_entitlements entitlement
    where entitlement.user_id = actor
      and entitlement.plan_code = 'plus'
      and entitlement.status <> 'revoked'
      and entitlement.ends_at is not null
      and entitlement.ends_at <= timezone('utc', now())
  ) into expired;

  return query
  select
    'free'::text,
    null::timestamptz,
    null::timestamptz,
    null::text,
    null::text,
    expired;
end;
$$;

revoke all on function public.get_my_membership() from public, anon;
grant execute on function public.get_my_membership() to authenticated;

create or replace function public.get_membership_snapshot(p_user_id uuid)
returns table (
  plan_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  source text,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  plan text;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'existing auth user required' using errcode = 'P0002';
  end if;

  plan := public.effective_membership_plan(p_user_id);
  if plan = 'plus' then
    return query
    select
      entitlement.plan_code,
      entitlement.starts_at,
      entitlement.ends_at,
      entitlement.source,
      entitlement.status
    from public.user_entitlements entitlement
    where entitlement.user_id = p_user_id
      and entitlement.plan_code = 'plus'
      and entitlement.status = 'active'
      and entitlement.starts_at <= timezone('utc', now())
      and (
        entitlement.ends_at is null
        or entitlement.ends_at > timezone('utc', now())
      )
    order by entitlement.ends_at desc nulls first, entitlement.starts_at desc
    limit 1;
    return;
  end if;

  return query
  select
    'free'::text,
    null::timestamptz,
    null::timestamptz,
    null::text,
    null::text;
end;
$$;

drop function if exists public.lookup_membership_ops(text);

create or replace function public.lookup_membership_ops(p_email text)
returns table (
  public_alias text,
  plan_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  source text,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  target uuid;
  target_alias text;
  snapshot record;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;

  normalized_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if normalized_email is null then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  select auth_user.id, profile.public_alias
  into target, target_alias
  from auth.users auth_user
  left join public.profiles profile on profile.user_id = auth_user.id
  where lower(auth_user.email) = normalized_email;

  if target is null then
    return;
  end if;

  select * into snapshot from public.get_membership_snapshot(target);

  return query
  select
    coalesce(target_alias, 'Belum onboarding'),
    snapshot.plan_code,
    snapshot.starts_at,
    snapshot.ends_at,
    snapshot.source,
    snapshot.status;
end;
$$;

revoke all on function public.get_membership_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function public.lookup_membership_ops(text) from public, anon;
grant execute on function public.lookup_membership_ops(text) to authenticated;

create or replace function public.manage_user_membership(
  p_target_user_id uuid,
  p_action text,
  p_duration_days integer default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_row public.user_entitlements%rowtype;
  next_end timestamptz;
  event_name text;
  duration integer;
  subject text;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if p_target_user_id is null then
    raise exception 'existing auth user required' using errcode = 'P0002';
  end if;
  if not exists (select 1 from auth.users auth_user where auth_user.id = p_target_user_id) then
    raise exception 'existing auth user required' using errcode = 'P0002';
  end if;
  if p_action not in ('grant_plus', 'revoke_plus') then
    raise exception 'invalid membership action' using errcode = '22023';
  end if;

  select coalesce(substring(profile.public_alias from '[0-9]{6}$'), 'unknown')
  into subject
  from public.profiles profile
  where profile.user_id = p_target_user_id;
  subject := coalesce(subject, 'unknown');

  select * into current_row
  from public.user_entitlements entitlement
  where entitlement.user_id = p_target_user_id
    and entitlement.plan_code = 'plus'
    and entitlement.status = 'active'
  for update;

  if p_action = 'revoke_plus' then
    if current_row.id is null then
      return false;
    end if;
    update public.user_entitlements
    set status = 'revoked',
        updated_at = timezone('utc', now())
    where id = current_row.id;
    insert into public.membership_audit_events (
      actor_user_id, event_type, plan_code, subject_suffix
    ) values (
      actor, 'membership_revoked', 'plus', subject
    );
    return true;
  end if;

  duration := p_duration_days;
  if duration not in (7, 30, 90) then
    raise exception 'invalid membership duration' using errcode = '22023';
  end if;
  next_end := timezone('utc', now()) + make_interval(days => duration);

  if current_row.id is not null
    and current_row.starts_at <= timezone('utc', now())
    and (current_row.ends_at is null or current_row.ends_at > timezone('utc', now())) then
    if current_row.ends_at is null then
      event_name := 'membership_extended';
    else
      next_end := greatest(current_row.ends_at, next_end);
      update public.user_entitlements
      set ends_at = next_end,
          updated_at = timezone('utc', now())
      where id = current_row.id;
      event_name := 'membership_extended';
    end if;
  else
    if current_row.id is not null then
      update public.user_entitlements
      set status = 'expired',
          updated_at = timezone('utc', now())
      where id = current_row.id
        and status = 'active';
    end if;
    insert into public.user_entitlements (
      user_id, plan_code, status, source, starts_at, ends_at
    ) values (
      p_target_user_id, 'plus', 'active', 'owner_grant', timezone('utc', now()), next_end
    );
    event_name := 'membership_granted';
  end if;

  insert into public.membership_audit_events (
    actor_user_id, event_type, plan_code, duration_days, subject_suffix
  ) values (
    actor, event_name, 'plus', duration, subject
  );
  return true;
end;
$$;

revoke all on function public.manage_user_membership(uuid, text, integer)
  from public, anon, authenticated;

create or replace function public.manage_user_membership_by_email(
  p_email text,
  p_action text,
  p_duration_days integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  target uuid;
  changed boolean;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  normalized_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if normalized_email is null then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  select auth_user.id into target
  from auth.users auth_user
  where lower(auth_user.email) = normalized_email;
  if target is null then
    return 'not_found';
  end if;
  changed := public.manage_user_membership(target, p_action, p_duration_days);
  if not changed then
    return 'unchanged';
  end if;
  return 'saved';
end;
$$;

revoke all on function public.manage_user_membership_by_email(text, text, integer)
  from public, anon;
grant execute on function public.manage_user_membership_by_email(text, text, integer)
  to authenticated;

create or replace function public.purge_membership_for_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.user_entitlements where user_id = old.user_id;
  delete from public.membership_quota_usage where user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists profiles_purge_membership on public.profiles;
create trigger profiles_purge_membership
before delete on public.profiles
for each row
execute function public.purge_membership_for_deleted_profile();

revoke all on function public.purge_membership_for_deleted_profile()
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
  sent_today integer;
  recent_terminal timestamptz;
  new_request_id uuid;
  plan text;
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

  plan := public.effective_membership_plan(current_user_id);

  select count(*) into pending_outgoing
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.status = 'pending';

  if pending_outgoing >= public.membership_plan_limit(plan, 'active_introductions') then
    raise exception 'introduction quota reached' using errcode = 'P0001';
  end if;

  select count(*) into sent_today
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.created_at >= date_trunc('day', timezone('utc', now()));

  if sent_today >= public.membership_plan_limit(plan, 'introduction_requests_daily') then
    raise exception 'introduction quota reached' using errcode = 'P0001';
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
  sent_today integer;
  plan text;
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

  plan := public.effective_membership_plan(current_user_id);

  select count(*) into pending_outgoing
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.status = 'pending';

  select count(*) into sent_today
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.created_at >= date_trunc('day', timezone('utc', now()));

  if pending_outgoing >= public.membership_plan_limit(plan, 'active_introductions')
    or sent_today >= public.membership_plan_limit(plan, 'introduction_requests_daily') then
    return query select false, 'quota_reached'::text;
    return;
  end if;

  select count(*) into sent_last_hour
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.created_at > timezone('utc', now()) - interval '1 hour';

  select count(*) into sent_last_day
  from public.introduction_requests request
  where request.sender_id = current_user_id
    and request.created_at > timezone('utc', now()) - interval '1 day';

  if sent_last_hour >= 5 or sent_last_day >= 15 then
    return query select false, 'rate_limited'::text;
    return;
  end if;

  return query select true, 'ok'::text;
end;
$$;

create or replace function public.create_study_circle(
  p_name text,
  p_description text,
  p_topic text,
  p_scope text,
  p_member_limit integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  normalized_name text;
  normalized_description text;
  active_owned integer;
  circle_id uuid;
  circle_slug text;
  plan text;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;

  select * into actor_profile
  from public.profiles profile
  where profile.user_id = actor
  for update;

  normalized_name := public.normalize_study_circle_single_line(p_name);
  normalized_description := public.normalize_study_circle_body(p_description);
  if char_length(normalized_name) not between 4 and 80
    or char_length(normalized_description) not between 20 and 600
    or normalized_name ~ '[<>]'
    or normalized_description ~ '<[^>]+>' then
    raise exception 'invalid circle content' using errcode = '22023';
  end if;
  if public.introduction_message_has_contact(
    normalized_name || ' ' || normalized_description
  ) then
    raise exception 'contact disclosure blocked' using errcode = '22023';
  end if;
  if p_topic not in (
    'coding', 'data_science', 'design', 'mathematics', 'languages',
    'thesis', 'exam_prep', 'general', 'other'
  ) or p_scope not in ('open', 'campus')
    or p_member_limit not between 3 and 30 then
    raise exception 'invalid circle settings' using errcode = '22023';
  end if;
  if not public.consume_study_circle_rate_limit(
    actor, 'create_day', 2, 86400
  ) then
    raise exception 'circle creation rate limited' using errcode = 'P0001';
  end if;

  plan := public.effective_membership_plan(actor);
  select count(*)::integer into active_owned
  from public.study_circles circle
  where circle.owner_user_id = actor
    and circle.status = 'active';
  if active_owned >= public.membership_plan_limit(plan, 'created_circles_active') then
    raise exception 'circle ownership quota reached' using errcode = 'P0001';
  end if;

  insert into public.study_circles (
    owner_user_id,
    name,
    description,
    topic,
    scope,
    campus_scope,
    member_limit
  )
  values (
    actor,
    normalized_name,
    normalized_description,
    p_topic,
    p_scope,
    case when p_scope = 'campus' then actor_profile.campus else null end,
    p_member_limit
  )
  returning id, public_slug into circle_id, circle_slug;

  insert into public.study_circle_memberships (
    circle_id, user_id, role, status
  ) values (circle_id, actor, 'owner', 'active');
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (circle_id, actor, 'created');

  return circle_slug;
end;
$$;

create or replace function public.join_study_circle(p_public_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  circle public.study_circles%rowtype;
  membership public.study_circle_memberships%rowtype;
  active_count integer;
  active_memberships integer;
  plan text;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into actor_profile
  from public.profiles profile
  where profile.user_id = actor
  for update;
  select * into circle
  from public.study_circles candidate
  where candidate.public_slug = p_public_slug
  for update;
  if circle.id is null
    or circle.status <> 'active'
    or circle.owner_user_id = actor
    or (circle.scope = 'campus' and circle.campus_scope <> actor_profile.campus)
    or public.users_are_blocked(actor, circle.owner_user_id) then
    raise exception 'circle unavailable' using errcode = 'P0001';
  end if;

  select * into membership
  from public.study_circle_memberships candidate
  where candidate.circle_id = circle.id
    and candidate.user_id = actor
  for update;
  if membership.status = 'active' then return false; end if;
  if membership.status = 'removed' then
    raise exception 'circle unavailable' using errcode = 'P0001';
  end if;
  if not public.consume_study_circle_rate_limit(
    actor, 'membership_day', 30, 86400
  ) then
    raise exception 'circle membership rate limited' using errcode = 'P0001';
  end if;

  select count(*)::integer into active_count
  from public.study_circle_memberships candidate
  where candidate.circle_id = circle.id
    and candidate.status = 'active';
  if active_count >= circle.member_limit then
    raise exception 'circle full' using errcode = 'P0001';
  end if;

  plan := public.effective_membership_plan(actor);
  select count(*)::integer into active_memberships
  from public.study_circle_memberships candidate
  where candidate.user_id = actor
    and candidate.status = 'active'
    and candidate.role = 'member';
  if active_memberships >= public.membership_plan_limit(plan, 'joined_circles_active') then
    raise exception 'circle membership quota reached' using errcode = 'P0001';
  end if;

  insert into public.study_circle_memberships (
    circle_id, user_id, role, status, joined_at
  )
  values (
    circle.id, actor, 'member', 'active', timezone('utc', now())
  )
  on conflict (circle_id, user_id)
  do update set
    status = 'active',
    joined_at = timezone('utc', now()),
    left_at = null,
    removed_at = null;
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (circle.id, actor, 'joined');
  return true;
end;
$$;

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
  actor uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 13), 1), 13);
  plan text;
  filter_semester smallint := p_semester;
  filter_city text := p_city_region;
  filter_goal text := p_connection_goal;
  filter_interest text := p_interest;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'active student required' using errcode = '42501';
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

  plan := public.effective_membership_plan(actor);
  if not public.membership_allows_advanced_discovery(plan) then
    filter_semester := null;
    filter_city := null;
    filter_goal := null;
    filter_interest := null;
  end if;

  if not public.consume_membership_quota(
    actor,
    'people_discovery_daily',
    public.membership_plan_limit(plan, 'people_discovery_daily')
  ) then
    raise exception 'discovery quota reached' using errcode = 'P0001';
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
  where profile.user_id <> actor
    and profile.is_discoverable = true
    and public.is_eligible_introduction_student(profile.user_id)
    and not public.users_are_blocked(actor, profile.user_id)
    and (p_campus is null
      or position(lower(btrim(p_campus)) in lower(profile.campus)) > 0)
    and (p_study_program is null
      or position(lower(btrim(p_study_program)) in lower(profile.study_program)) > 0)
    and (filter_semester is null or profile.semester = filter_semester)
    and (filter_city is null
      or position(lower(btrim(filter_city)) in lower(profile.city_region)) > 0)
    and (filter_goal is null
      or profile.connection_goals @> array[filter_goal])
    and (filter_interest is null or profile.interests @> array[filter_interest])
    and (p_after_alias is null or profile.public_alias > p_after_alias)
  order by profile.public_alias
  limit safe_limit;
end;
$$;

comment on table public.membership_plans is
  'Catalog of StudyDate Free/Plus plan codes. No payment pricing in Phase 1.';
comment on table public.user_entitlements is
  'Plus entitlements only. Free is the default fallback without a row.';
comment on table public.membership_quota_usage is
  'Server-side product quota counters. Independent from security rate limits.';
comment on table public.membership_audit_events is
  'Owner grant/extend/revoke audit without email or Auth UUID.';

