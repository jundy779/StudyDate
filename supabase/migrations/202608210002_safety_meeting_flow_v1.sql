-- Safety Meeting Flow v1: two-party public-place plan after Identity Reveal.

create table public.meeting_plans (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  conversation_id uuid not null references public.conversation_shells (id) on delete cascade,
  created_by uuid null references auth.users (id) on delete set null,
  counterpart_id uuid null references auth.users (id) on delete set null,
  venue_category text null,
  venue_name text null,
  venue_area text null,
  city text null,
  starts_at timestamptz null,
  expected_end_at timestamptz null,
  timezone_name text null,
  status text not null default 'pending_confirmation',
  creator_consented_at timestamptz not null default timezone('utc', now()),
  counterpart_consented_at timestamptz null,
  cancelled_at timestamptz null,
  cancellation_code text null,
  details_purged_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint meeting_plans_public_id_format check (public_id ~ '^[0-9a-f]{32}$'),
  constraint meeting_plans_distinct_participants check (created_by <> counterpart_id),
  constraint meeting_plans_status_allowed check (
    status in ('pending_confirmation', 'confirmed', 'cancelled')
  ),
  constraint meeting_plans_venue_category check (
    venue_category is null or venue_category in (
      'campus_public_area', 'cafe', 'library', 'coworking_space',
      'community_space', 'other_public_place'
    )
  ),
  constraint meeting_plans_timezone check (
    timezone_name is null or timezone_name in (
      'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'
    )
  ),
  constraint meeting_plans_text_lengths check (
    (venue_name is null or char_length(venue_name) between 3 and 120)
    and (venue_area is null or char_length(venue_area) between 8 and 240)
    and (city is null or char_length(city) between 2 and 100)
  ),
  constraint meeting_plans_time_window check (
    starts_at is null
    or (
      expected_end_at > starts_at
      and expected_end_at <= starts_at + interval '12 hours'
    )
  ),
  constraint meeting_plans_details_consistent check (
    (
      details_purged_at is null
      and venue_category is not null and venue_name is not null
      and venue_area is not null and city is not null
      and starts_at is not null and expected_end_at is not null
      and timezone_name is not null
    )
    or (
      details_purged_at is not null
      and venue_category is null and venue_name is null and venue_area is null
      and city is null and starts_at is null and expected_end_at is null
      and timezone_name is null
    )
  )
);

create unique index meeting_plans_one_active_conversation_idx
  on public.meeting_plans (conversation_id)
  where status in ('pending_confirmation', 'confirmed');
create index meeting_plans_participants_idx
  on public.meeting_plans (created_by, counterpart_id, created_at desc);

create table public.meeting_plan_participant_state (
  meeting_plan_id uuid not null references public.meeting_plans (id) on delete cascade,
  participant_id uuid not null references auth.users (id) on delete cascade,
  precheck_acknowledged_at timestamptz null,
  postcheck_status text null check (postcheck_status in ('safe', 'report_started')),
  postcheck_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (meeting_plan_id, participant_id),
  constraint meeting_plan_postcheck_consistent check (
    (postcheck_status is null and postcheck_at is null)
    or (postcheck_status is not null and postcheck_at is not null)
  )
);

alter table public.meeting_plans enable row level security;
alter table public.meeting_plan_participant_state enable row level security;
revoke all on table public.meeting_plans from public, anon, authenticated;
revoke all on table public.meeting_plan_participant_state from public, anon, authenticated;

alter table public.user_notifications
  drop constraint user_notifications_type_allowed,
  drop constraint user_notifications_metadata_safe;
alter table public.user_notifications
  add constraint user_notifications_type_allowed check (notification_type in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED'
  )),
  add constraint user_notifications_metadata_safe check (
    (
      notification_type = 'CONTACT_REVEAL_COMPLETED'
      and metadata ? 'channel'
      and metadata->>'channel' in ('telegram', 'instagram', 'linkedin')
      and metadata - 'channel' = '{}'::jsonb
    )
    or (
      notification_type in (
        'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED', 'CIRCLE_ARCHIVED',
        'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED', 'EVENT_CANCELLED'
      )
      and metadata ? 'title'
      and jsonb_typeof(metadata->'title') = 'string'
      and char_length(metadata->>'title') between 1 and 100
      and metadata - 'title' = '{}'::jsonb
    )
    or (
      notification_type = 'EVENT_SCHEDULE_CHANGED'
      and metadata ? 'title' and metadata ? 'when_label'
      and jsonb_typeof(metadata->'title') = 'string'
      and jsonb_typeof(metadata->'when_label') = 'string'
      and char_length(metadata->>'title') between 1 and 100
      and char_length(metadata->>'when_label') between 1 and 64
      and metadata - 'title' - 'when_label' = '{}'::jsonb
    )
    or (
      notification_type = 'EVENT_LOCATION_CHANGED'
      and metadata ? 'title' and metadata ? 'venue_label'
      and jsonb_typeof(metadata->'title') = 'string'
      and jsonb_typeof(metadata->'venue_label') = 'string'
      and char_length(metadata->>'title') between 1 and 100
      and char_length(metadata->>'venue_label') between 1 and 160
      and metadata - 'title' - 'venue_label' = '{}'::jsonb
    )
    or (
      notification_type in (
        'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
        'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
        'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED',
        'MEETING_PLAN_CANCELLED'
      )
      and metadata = '{}'::jsonb
    )
  );

create or replace function public.get_my_meeting_plan_state(p_conversation_public_id text)
returns table (
  eligible boolean, plan_public_id text, status text, created_by_me boolean,
  selected_by_me boolean, venue_category text, venue_name text, venue_area text,
  city text, starts_at timestamptz, expected_end_at timestamptz,
  timezone_name text, precheck_acknowledged_at timestamptz,
  postcheck_status text, postcheck_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  shell public.conversation_shells%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into shell from public.conversation_shells candidate
  where candidate.public_id = p_conversation_public_id;
  if shell.id is null
    or actor not in (shell.participant_sender_id, shell.participant_recipient_id) then
    raise exception 'conversation unavailable' using errcode = 'P0002';
  end if;

  update public.meeting_plans plan
  set venue_category = null, venue_name = null, venue_area = null, city = null,
      starts_at = null, expected_end_at = null, timezone_name = null,
      details_purged_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where plan.conversation_id = shell.id
    and plan.details_purged_at is null
    and plan.created_at <= timezone('utc', now()) - interval '90 days'
    and not exists (
      select 1 from public.user_reports report
      where report.conversation_id = shell.id
        and report.moderation_status in ('submitted', 'under_review')
    );

  return query
  select
    shell.status = 'active' and shell.mutual_interest_at is not null
      and shell.identity_revealed_at is not null
      and not public.users_are_blocked(shell.participant_sender_id, shell.participant_recipient_id)
      and public.is_eligible_introduction_student(shell.participant_sender_id)
      and public.is_eligible_introduction_student(shell.participant_recipient_id),
    plan.public_id, plan.status, plan.created_by = actor,
    plan.created_by = actor or plan.counterpart_consented_at is not null,
    plan.venue_category, plan.venue_name, plan.venue_area, plan.city,
    plan.starts_at, plan.expected_end_at, plan.timezone_name,
    own_state.precheck_acknowledged_at, own_state.postcheck_status,
    own_state.postcheck_at
  from (select 1) seed
  left join public.meeting_plans plan
    on plan.conversation_id = shell.id
    and plan.status in ('pending_confirmation', 'confirmed')
  left join public.meeting_plan_participant_state own_state
    on own_state.meeting_plan_id = plan.id and own_state.participant_id = actor
  limit 1;
end;
$$;

create or replace function public.propose_meeting_plan(
  p_conversation_public_id text, p_venue_category text, p_venue_name text,
  p_venue_area text, p_city text, p_starts_at_local text,
  p_expected_end_at_local text, p_timezone_name text,
  p_confirms_public_place boolean, p_confirms_expected_operating boolean,
  p_confirms_not_private_residence boolean,
  p_confirms_no_private_location_disclosure boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart uuid;
  venue_name_value text := public.normalize_campus_event_single_line(p_venue_name);
  venue_area_value text := public.normalize_campus_event_single_line(p_venue_area);
  city_value text := public.normalize_campus_event_single_line(p_city);
  start_value timestamptz;
  end_value timestamptz;
  plan public.meeting_plans%rowtype;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into shell from public.conversation_shells candidate
  where candidate.public_id = p_conversation_public_id for update;
  if shell.id is null or actor not in (shell.participant_sender_id, shell.participant_recipient_id)
    or shell.status <> 'active' or shell.mutual_interest_at is null
    or shell.identity_revealed_at is null
    or public.users_are_blocked(shell.participant_sender_id, shell.participant_recipient_id)
    or not public.is_eligible_introduction_student(shell.participant_sender_id)
    or not public.is_eligible_introduction_student(shell.participant_recipient_id) then
    raise exception 'meeting plan unavailable' using errcode = '42501';
  end if;
  counterpart := case when actor = shell.participant_sender_id
    then shell.participant_recipient_id else shell.participant_sender_id end;
  if p_timezone_name not in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')
    or p_starts_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
    or p_expected_end_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
    raise exception 'invalid meeting time' using errcode = '22023';
  end if;
  start_value := p_starts_at_local::timestamp at time zone p_timezone_name;
  end_value := p_expected_end_at_local::timestamp at time zone p_timezone_name;
  if start_value < timezone('utc', now()) + interval '2 hours'
    or start_value > timezone('utc', now()) + interval '180 days'
    or end_value < start_value + interval '30 minutes'
    or end_value > start_value + interval '12 hours' then
    raise exception 'invalid meeting time' using errcode = '22023';
  end if;
  if p_venue_category not in (
    'campus_public_area', 'cafe', 'library', 'coworking_space',
    'community_space', 'other_public_place'
  ) or char_length(venue_name_value) not between 3 and 120
    or char_length(venue_area_value) not between 8 and 240
    or char_length(city_value) not between 2 and 100
    or public.campus_event_has_private_venue(venue_name_value || ' ' || venue_area_value)
    or (venue_name_value || ' ' || venue_area_value) ~* '(https?://|maps[.]|[-+]?[0-9]{1,3}[.][0-9]{3,}[, ]+[-+]?[0-9]{1,3}[.][0-9]{3,})' then
    raise exception 'private venue blocked' using errcode = '22023';
  end if;
  if p_confirms_public_place is distinct from true
    or p_confirms_expected_operating is distinct from true
    or p_confirms_not_private_residence is distinct from true
    or p_confirms_no_private_location_disclosure is distinct from true then
    raise exception 'safety confirmation required' using errcode = '22023';
  end if;

  insert into public.meeting_plans (
    conversation_id, created_by, counterpart_id, venue_category, venue_name,
    venue_area, city, starts_at, expected_end_at, timezone_name
  ) values (
    shell.id, actor, counterpart, p_venue_category, venue_name_value,
    venue_area_value, city_value, start_value, end_value, p_timezone_name
  ) returning * into plan;
  insert into public.meeting_plan_participant_state (meeting_plan_id, participant_id)
  values (plan.id, actor), (plan.id, counterpart);
  perform public.emit_user_notification(
    counterpart, 'MEETING_PLAN_PROPOSED',
    '/app/messages/' || shell.public_id, '{}'::jsonb,
    'meeting_plan_proposed:' || plan.id::text
  );
  return plan.public_id;
end;
$$;

create or replace function public.confirm_meeting_plan(p_plan_public_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  plan public.meeting_plans%rowtype;
  shell public.conversation_shells%rowtype;
begin
  select * into plan from public.meeting_plans candidate
  where candidate.public_id = p_plan_public_id for update;
  select * into shell from public.conversation_shells candidate
  where candidate.id = plan.conversation_id;
  if actor is null or plan.id is null or actor <> plan.counterpart_id
    or plan.status <> 'pending_confirmation' or shell.status <> 'active'
    or public.users_are_blocked(plan.created_by, plan.counterpart_id) then
    raise exception 'meeting plan unavailable' using errcode = '42501';
  end if;
  update public.meeting_plans set status = 'confirmed',
    counterpart_consented_at = timezone('utc', now()),
    updated_at = timezone('utc', now()) where id = plan.id;
  perform public.emit_user_notification(
    plan.created_by, 'MEETING_PLAN_CONFIRMED',
    '/app/messages/' || shell.public_id, '{}'::jsonb,
    'meeting_plan_confirmed:' || plan.id::text
  );
end;
$$;

create or replace function public.cancel_meeting_plan(p_plan_public_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  plan public.meeting_plans%rowtype;
  shell public.conversation_shells%rowtype;
  recipient uuid;
begin
  select * into plan from public.meeting_plans candidate
  where candidate.public_id = p_plan_public_id for update;
  if actor is null or plan.id is null or actor not in (plan.created_by, plan.counterpart_id)
    or plan.status = 'cancelled' then
    raise exception 'meeting plan unavailable' using errcode = '42501';
  end if;
  select * into shell from public.conversation_shells candidate where candidate.id = plan.conversation_id;
  recipient := case when actor = plan.created_by then plan.counterpart_id else plan.created_by end;
  update public.meeting_plans set status = 'cancelled',
    cancelled_at = timezone('utc', now()), cancellation_code = 'participant_cancelled',
    updated_at = timezone('utc', now()) where id = plan.id;
  perform public.emit_user_notification(
    recipient, 'MEETING_PLAN_CANCELLED',
    '/app/messages/' || shell.public_id, '{}'::jsonb,
    'meeting_plan_cancelled:' || plan.id::text || ':' || recipient::text
  );
end;
$$;

create or replace function public.acknowledge_meeting_precheck(p_plan_public_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); plan public.meeting_plans%rowtype;
begin
  select * into plan from public.meeting_plans candidate where candidate.public_id = p_plan_public_id;
  if actor is null or plan.id is null or actor not in (plan.created_by, plan.counterpart_id)
    or plan.status <> 'confirmed'
    or timezone('utc', now()) < plan.starts_at - interval '24 hours'
    or timezone('utc', now()) > plan.expected_end_at then
    raise exception 'precheck unavailable' using errcode = '42501';
  end if;
  update public.meeting_plan_participant_state
  set precheck_acknowledged_at = coalesce(precheck_acknowledged_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where meeting_plan_id = plan.id and participant_id = actor;
end; $$;

create or replace function public.complete_meeting_postcheck(
  p_plan_public_id text, p_status text
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); plan public.meeting_plans%rowtype;
begin
  select * into plan from public.meeting_plans candidate where candidate.public_id = p_plan_public_id;
  if actor is null or plan.id is null or actor not in (plan.created_by, plan.counterpart_id)
    or plan.status <> 'confirmed' or timezone('utc', now()) < plan.expected_end_at
    or p_status not in ('safe', 'report_started') then
    raise exception 'postcheck unavailable' using errcode = '42501';
  end if;
  update public.meeting_plan_participant_state
  set postcheck_status = p_status, postcheck_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where meeting_plan_id = plan.id and participant_id = actor;
end; $$;

revoke all on function public.get_my_meeting_plan_state(text) from public, anon;
grant execute on function public.get_my_meeting_plan_state(text) to authenticated;
revoke all on function public.propose_meeting_plan(
  text, text, text, text, text, text, text, text, boolean, boolean, boolean, boolean
) from public, anon;
grant execute on function public.propose_meeting_plan(
  text, text, text, text, text, text, text, text, boolean, boolean, boolean, boolean
) to authenticated;
revoke all on function public.confirm_meeting_plan(text) from public, anon;
grant execute on function public.confirm_meeting_plan(text) to authenticated;
revoke all on function public.cancel_meeting_plan(text) from public, anon;
grant execute on function public.cancel_meeting_plan(text) to authenticated;
revoke all on function public.acknowledge_meeting_precheck(text) from public, anon;
grant execute on function public.acknowledge_meeting_precheck(text) to authenticated;
revoke all on function public.complete_meeting_postcheck(text, text) from public, anon;
grant execute on function public.complete_meeting_postcheck(text, text) to authenticated;

create or replace function public.cancel_meeting_plans_for_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status not in ('ended', 'blocked') and new.status in ('ended', 'blocked') then
    update public.meeting_plans set status = 'cancelled',
      cancelled_at = timezone('utc', now()), cancellation_code = 'conversation_closed',
      updated_at = timezone('utc', now())
    where conversation_id = new.id
      and status in ('pending_confirmation', 'confirmed')
      and starts_at > timezone('utc', now());
  end if;
  return new;
end; $$;
create trigger conversation_shells_cancel_meeting_plans
after update of status on public.conversation_shells
for each row execute function public.cancel_meeting_plans_for_conversation();
revoke all on function public.cancel_meeting_plans_for_conversation()
  from public, anon, authenticated;

create or replace function public.notify_meeting_plan_cancelled()
returns trigger language plpgsql security definer set search_path = '' as $$
declare shell_public_id text; actor uuid := auth.uid();
begin
  if old.status <> 'cancelled' and new.status = 'cancelled' then
    select shell.public_id into shell_public_id
    from public.conversation_shells shell where shell.id = new.conversation_id;
    if new.created_by is not null and new.created_by is distinct from actor then
      perform public.emit_user_notification(
        new.created_by, 'MEETING_PLAN_CANCELLED',
        '/app/messages/' || shell_public_id, '{}'::jsonb,
        'meeting_plan_cancelled:' || new.id::text || ':' || new.created_by::text
      );
    end if;
    if new.counterpart_id is not null and new.counterpart_id is distinct from actor then
      perform public.emit_user_notification(
        new.counterpart_id, 'MEETING_PLAN_CANCELLED',
        '/app/messages/' || shell_public_id, '{}'::jsonb,
        'meeting_plan_cancelled:' || new.id::text || ':' || new.counterpart_id::text
      );
    end if;
  end if;
  return new;
end; $$;
create trigger meeting_plans_notify_cancelled
after update of status on public.meeting_plans
for each row execute function public.notify_meeting_plan_cancelled();
revoke all on function public.notify_meeting_plan_cancelled()
  from public, anon, authenticated;

create or replace function public.purge_expired_meeting_plan_details(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare purged integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  with targets as (
    select plan.id
    from public.meeting_plans plan
    where plan.details_purged_at is null
      and plan.created_at <= timezone('utc', now()) - interval '90 days'
      and not exists (
        select 1 from public.user_reports report
        where report.conversation_id = plan.conversation_id
          and report.moderation_status in ('submitted', 'under_review')
      )
    order by plan.created_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update skip locked
  )
  update public.meeting_plans plan
  set venue_category = null, venue_name = null, venue_area = null, city = null,
      starts_at = null, expected_end_at = null, timezone_name = null,
      details_purged_at = timezone('utc', now()), updated_at = timezone('utc', now())
  from targets where plan.id = targets.id;
  get diagnostics purged = row_count;
  return purged;
end; $$;
revoke all on function public.purge_expired_meeting_plan_details(integer)
  from public, anon, authenticated;
