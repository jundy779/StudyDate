-- Campus Events v2: organizer trust, team roles, registration lifecycle,
-- questions, management projections, and notification contracts.

alter table public.campus_events
  drop constraint campus_events_capacity,
  add column is_official boolean not null default false,
  add column registration_mode text not null default 'instant',
  add column waitlist_enabled boolean not null default true,
  add column registration_closes_at timestamptz null,
  add constraint campus_events_capacity check (capacity between 3 and 200),
  add constraint campus_events_registration_mode check (
    registration_mode in ('instant', 'approval')
  ),
  add constraint campus_events_registration_close check (
    registration_closes_at is null or registration_closes_at <= starts_at
  );

create table public.event_organizer_eligibility (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('eligible', 'revoked')),
  granted_by uuid null references auth.users (id) on delete set null,
  granted_at timestamptz null,
  revoked_by uuid null references auth.users (id) on delete set null,
  revoked_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_organizer_eligibility_lifecycle check (
    (status = 'eligible' and granted_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table public.event_organizer_eligibility_audit (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid null references auth.users (id) on delete set null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null check (event_type in ('granted', 'revoked')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.event_organizer_eligibility enable row level security;
alter table public.event_organizer_eligibility_audit enable row level security;
revoke all on table public.event_organizer_eligibility
  from public, anon, authenticated;
revoke all on table public.event_organizer_eligibility_audit
  from public, anon, authenticated;

create trigger event_organizer_eligibility_set_updated_at
before update on public.event_organizer_eligibility
for each row execute function public.set_updated_at();
create trigger event_organizer_eligibility_reject_deletion_locked_mutation
before insert or update or delete on public.event_organizer_eligibility
for each row execute function public.reject_account_deletion_locked_mutation();

create or replace function public.is_event_organizer_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_campus_event_student(p_user_id)
    and not exists (
      select 1 from public.staff_members staff
      where staff.user_id = p_user_id and staff.status = 'active'
    )
    and coalesce((
      select eligibility.status <> 'revoked'
      from public.event_organizer_eligibility eligibility
      where eligibility.user_id = p_user_id
    ), true)
    and (
      exists (
        select 1 from public.profiles profile
        where profile.user_id = p_user_id
          and profile.verification_status = 'verified'
      )
      or exists (
        select 1 from public.event_organizer_eligibility eligibility
        where eligibility.user_id = p_user_id
          and eligibility.status = 'eligible'
      )
    );
$$;

create or replace function public.get_my_event_organizer_eligibility()
returns table (
  eligible boolean,
  source text,
  explicit_status text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  return query
  select public.is_event_organizer_eligible(actor),
    case
      when profile.verification_status = 'verified' then 'verified'
      when eligibility.status = 'eligible' then 'owner_grant'
      else 'none'
    end,
    eligibility.status,
    eligibility.updated_at
  from public.profiles profile
  left join public.event_organizer_eligibility eligibility
    on eligibility.user_id = profile.user_id
  where profile.user_id = actor;
end;
$$;

create or replace function public.owner_lookup_event_organizer_eligibility(
  p_public_alias text
)
returns table (
  public_alias text,
  campus text,
  study_program text,
  is_verified boolean,
  eligibility_status text,
  effective_eligible boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare normalized_alias text := public.normalize_campus_event_single_line(p_public_alias);
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if normalized_alias = '' or char_length(normalized_alias) > 80 then
    raise exception 'invalid public alias' using errcode = '22023';
  end if;
  return query
  select profile.public_alias, profile.campus, profile.study_program,
    profile.verification_status = 'verified', eligibility.status,
    public.is_event_organizer_eligible(profile.user_id), eligibility.updated_at
  from public.profiles profile
  left join public.event_organizer_eligibility eligibility
    on eligibility.user_id = profile.user_id
  where lower(profile.public_alias) = lower(normalized_alias)
    and not exists (
      select 1 from public.staff_members staff
      where staff.user_id = profile.user_id and staff.status = 'active'
    )
  limit 1;
end;
$$;

create or replace function public.owner_manage_event_organizer_eligibility(
  p_public_alias text,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_user uuid;
  current_status text;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if p_action not in ('grant', 'revoke') then
    raise exception 'invalid organizer action' using errcode = '22023';
  end if;
  select profile.user_id into target_user
  from public.profiles profile
  where lower(profile.public_alias) = lower(
    public.normalize_campus_event_single_line(p_public_alias)
  )
    and public.is_campus_event_student(profile.user_id)
    and not exists (
      select 1 from public.staff_members staff
      where staff.user_id = profile.user_id and staff.status = 'active'
    )
  limit 1;
  if target_user is null then
    raise exception 'student unavailable' using errcode = 'P0001';
  end if;
  select eligibility.status into current_status
  from public.event_organizer_eligibility eligibility
  where eligibility.user_id = target_user for update;
  if (p_action = 'grant' and current_status = 'eligible')
    or (p_action = 'revoke' and current_status = 'revoked') then
    return false;
  end if;
  insert into public.event_organizer_eligibility (
    user_id, status, granted_by, granted_at, revoked_by, revoked_at
  ) values (
    target_user, case when p_action = 'grant' then 'eligible' else 'revoked' end,
    case when p_action = 'grant' then actor else null end,
    case when p_action = 'grant' then timezone('utc', now()) else null end,
    case when p_action = 'revoke' then actor else null end,
    case when p_action = 'revoke' then timezone('utc', now()) else null end
  )
  on conflict (user_id) do update set
    status = excluded.status,
    granted_by = case when p_action = 'grant' then actor
      else event_organizer_eligibility.granted_by end,
    granted_at = case when p_action = 'grant' then timezone('utc', now())
      else event_organizer_eligibility.granted_at end,
    revoked_by = case when p_action = 'revoke' then actor else null end,
    revoked_at = case when p_action = 'revoke' then timezone('utc', now()) else null end;
  insert into public.event_organizer_eligibility_audit (
    target_user_id, actor_user_id, event_type
  ) values (
    target_user, actor, case when p_action = 'grant' then 'granted' else 'revoked' end
  );
  return true;
end;
$$;

create or replace function public.event_membership_limit(p_plan text, p_key text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_plan = 'plus' and p_key = 'created_events_active' then 3
    when p_key = 'created_events_active' then 1
    when p_plan = 'plus' and p_key = 'joined_events_active' then 10
    when p_key = 'joined_events_active' then 5
    when p_plan = 'plus' and p_key = 'participant_capacity' then 200
    when p_key = 'participant_capacity' then 50
    when p_plan = 'plus' and p_key = 'event_cohosts' then 3
    when p_key = 'event_cohosts' then 1
    when p_key = 'event_checkin_staff' then 10
    when p_plan = 'plus' and p_key = 'event_custom_questions' then 10
    when p_key = 'event_custom_questions' then 3
    else 0
  end;
$$;

create or replace function public.enforce_campus_event_v2_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan text;
  active_owned integer;
  participant_limit integer;
begin
  if new.status <> 'scheduled' or new.starts_at <= timezone('utc', now()) then
    return new;
  end if;
  if tg_op = 'INSERT' and not public.is_event_organizer_eligible(new.organizer_user_id) then
    raise exception 'organizer eligibility required' using errcode = '42501';
  end if;
  plan := public.effective_membership_plan(new.organizer_user_id);
  participant_limit := public.event_membership_limit(plan, 'participant_capacity');
  if tg_op = 'INSERT' and new.capacity > participant_limit then
    raise exception 'event participant capacity quota reached' using errcode = 'P0001';
  end if;
  -- Existing larger events are grandfathered; updates may not increase above plan.
  if tg_op = 'UPDATE' and new.capacity > old.capacity
    and new.capacity > participant_limit then
    raise exception 'event participant capacity quota reached' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT'
    or not (old.status = 'scheduled' and old.starts_at > timezone('utc', now())) then
    perform pg_advisory_xact_lock(hashtextextended(
      new.organizer_user_id::text || ':event-owner-quota', 0
    ));
    select count(*)::integer into active_owned
    from public.campus_events event
    where event.organizer_user_id = new.organizer_user_id
      and event.status = 'scheduled'
      and event.starts_at > timezone('utc', now())
      and event.id <> new.id;
    if active_owned >= public.event_membership_limit(plan, 'created_events_active') then
      raise exception 'event ownership quota reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger campus_events_membership_quota on public.campus_events;
create trigger campus_events_membership_quota
before insert or update of status, starts_at, capacity on public.campus_events
for each row execute function public.enforce_campus_event_v2_limits();

create or replace function public.guard_campus_event_official_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.is_official then
    raise exception 'official flag is owner managed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.is_official is distinct from old.is_official
    and not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'official flag is owner managed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger campus_events_guard_official_flag
before insert or update of is_official on public.campus_events
for each row execute function public.guard_campus_event_official_flag();

create or replace function public.owner_set_campus_event_official(
  p_public_slug text,
  p_is_official boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  update public.campus_events
  set is_official = p_is_official
  where public_slug = p_public_slug
    and is_official is distinct from p_is_official;
  return found;
end;
$$;

alter table public.campus_event_rsvps
  drop constraint campus_event_rsvps_status,
  drop constraint campus_event_rsvps_lifecycle,
  add column public_id text,
  add column registration_answers jsonb not null default '{}'::jsonb,
  add column checked_in_at timestamptz null,
  add column checked_in_by uuid null references auth.users (id) on delete set null,
  add column checkin_method text null,
  add constraint campus_event_rsvps_status check (
    status in ('pending', 'going', 'waitlisted', 'declined', 'cancelled')
  ),
  add constraint campus_event_rsvps_answers check (
    jsonb_typeof(registration_answers) = 'object'
    and octet_length(registration_answers::text) <= 12000
  ),
  add constraint campus_event_rsvps_checkin check (
    (checked_in_at is null and checked_in_by is null and checkin_method is null)
    or (
      checked_in_at is not null and checked_in_by is not null
      and checkin_method in ('qr', 'manual')
    )
  );
update public.campus_event_rsvps
set public_id = encode(extensions.gen_random_bytes(16), 'hex')
where public_id is null;
alter table public.campus_event_rsvps
  alter column public_id set not null,
  add constraint campus_event_rsvps_public_id_format check (
    public_id ~ '^[0-9a-f]{32}$'
  ),
  add constraint campus_event_rsvps_public_id_unique unique (public_id),
  add constraint campus_event_rsvps_v2_lifecycle check (
    (
      status in ('pending', 'going', 'waitlisted')
      and cancelled_at is null
    )
    or (
      status in ('declined', 'cancelled')
      and cancelled_at is not null
    )
  ),
  add constraint campus_event_rsvps_checkin_status check (
    checked_in_at is null or status = 'going'
  );

insert into public.campus_event_rsvps (
  event_id, user_id, status, public_id, rsvped_at, cancelled_at
)
select waitlist.event_id, waitlist.user_id, 'waitlisted',
  encode(extensions.gen_random_bytes(16), 'hex'), waitlist.joined_at, null
from public.campus_event_waitlist waitlist
where waitlist.status = 'waiting'
on conflict (event_id, user_id) do update
set status = case
    when campus_event_rsvps.status = 'going' then 'going'
    else 'waitlisted'
  end,
  rsvped_at = least(campus_event_rsvps.rsvped_at, excluded.rsvped_at),
  cancelled_at = null;

drop trigger campus_event_rsvps_promote_waitlist on public.campus_event_rsvps;
drop trigger campus_events_sync_waitlist_lifecycle on public.campus_events;
drop function public.notify_event_waitlist_slot();
drop function public.sync_campus_event_waitlist_lifecycle();
drop function public.promote_campus_event_waitlist(uuid);
drop function public.join_campus_event_waitlist(text);
drop function public.leave_campus_event_waitlist(text);
drop function public.get_my_campus_event_waitlist_position(text);
drop table public.campus_event_waitlist;

create or replace function public.cleanup_event_roadmap_profile_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notification_preferences where user_id = old.user_id;
  delete from public.campus_event_reminder_receipts where user_id = old.user_id;
  update public.campus_event_circle_links set linked_by = null
  where linked_by = old.user_id;
  update public.campus_event_tickets
  set revoked_at = case
      when checked_in_at is null then coalesce(revoked_at, timezone('utc', now()))
      else revoked_at
    end,
    user_id = null
  where user_id = old.user_id;
  return old;
end;
$$;

create table public.event_team_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  role text not null check (role in ('cohost', 'checkin_staff')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'declined', 'removed')),
  invited_by uuid null references auth.users (id) on delete set null,
  invited_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz null,
  removed_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_team_members_unique unique (event_id, user_id),
  constraint event_team_members_lifecycle check (
    (status = 'invited' and responded_at is null and removed_at is null)
    or (status in ('active', 'declined') and responded_at is not null and removed_at is null)
    or (status = 'removed' and removed_at is not null)
  )
);
create index event_team_members_event_status_idx
  on public.event_team_members (event_id, status, role);
alter table public.event_team_members enable row level security;
revoke all on table public.event_team_members from public, anon, authenticated;
create trigger event_team_members_set_updated_at
before update on public.event_team_members
for each row execute function public.set_updated_at();
create trigger event_team_members_reject_deletion_locked_mutation
before insert or update or delete on public.event_team_members
for each row execute function public.reject_account_deletion_locked_mutation();

create table public.event_registration_questions (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  question_type text not null check (
    question_type in ('short_text', 'single_select', 'multi_select', 'checkbox')
  ),
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  sort_order smallint not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint event_registration_questions_public_id check (
    public_id ~ '^[0-9a-f]{32}$'
  ),
  constraint event_registration_questions_prompt check (
    char_length(prompt) between 5 and 160 and prompt !~ '<[^>]+>'
  ),
  constraint event_registration_questions_options check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 12
  ),
  constraint event_registration_questions_order check (
    sort_order between 1 and 10
  )
);
create unique index event_registration_questions_order_idx
  on public.event_registration_questions (event_id, sort_order);
alter table public.event_registration_questions enable row level security;
revoke all on table public.event_registration_questions
  from public, anon, authenticated;
create trigger event_registration_questions_reject_deletion_locked_mutation
before insert or update or delete on public.event_registration_questions
for each row execute function public.reject_account_deletion_locked_mutation();

create or replace function public.is_event_team_member(
  p_event_id uuid,
  p_user_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_team_members member
    where member.event_id = p_event_id
      and member.user_id = p_user_id
      and member.status = 'active'
      and member.role = any(p_roles)
  );
$$;

create or replace function public.event_can_manage_registrations(
  p_event_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campus_events event
    where event.id = p_event_id
      and (
        event.organizer_user_id = p_user_id
        or public.is_event_team_member(event.id, p_user_id, array['cohost']::text[])
      )
  );
$$;

create or replace function public.invite_campus_event_team_member(
  p_public_slug text,
  p_public_alias text,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  target_user uuid;
  active_count integer;
  role_limit integer;
begin
  if p_role not in ('cohost', 'checkin_staff') then
    raise exception 'invalid event role' using errcode = '22023';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug for update;
  if event_row.id is null or event_row.organizer_user_id <> actor
    or event_row.status <> 'scheduled' then
    raise exception 'event unavailable' using errcode = '42501';
  end if;
  select profile.user_id into target_user from public.profiles profile
  where lower(profile.public_alias) = lower(
    public.normalize_campus_event_single_line(p_public_alias)
  )
    and public.is_campus_event_student(profile.user_id)
  limit 1;
  if target_user is null or target_user = actor
    or public.users_are_blocked(actor, target_user) then
    raise exception 'student unavailable' using errcode = 'P0001';
  end if;
  role_limit := case when p_role = 'cohost' then
    public.event_membership_limit(
      public.effective_membership_plan(actor), 'event_cohosts'
    )
    else 10 end;
  select count(*)::integer into active_count
  from public.event_team_members member
  where member.event_id = event_row.id and member.role = p_role
    and member.status in ('invited', 'active') and member.user_id <> target_user;
  if active_count >= role_limit then
    raise exception 'event team quota reached' using errcode = 'P0001';
  end if;
  insert into public.event_team_members (
    event_id, user_id, role, status, invited_by
  ) values (event_row.id, target_user, p_role, 'invited', actor)
  on conflict (event_id, user_id) do update set
    role = excluded.role, status = 'invited', invited_by = actor,
    invited_at = timezone('utc', now()), responded_at = null, removed_at = null;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_row.id, actor, 'team_invited');
  perform public.emit_user_notification(
    target_user, 'EVENT_TEAM_INVITED', '/app/events/' || event_row.public_slug,
    jsonb_build_object(
      'title', public.notification_safe_label(event_row.title, 100, 'Campus Event')
    ),
    'event_team_invited:' || event_row.id::text || ':' || target_user::text
      || ':' || p_role || ':' || extract(epoch from timezone('utc', now()))::text
  );
  return true;
end;
$$;

create or replace function public.respond_campus_event_team_invitation(
  p_public_slug text,
  p_response text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_id_value uuid;
begin
  if p_response not in ('accept', 'decline') then
    raise exception 'invalid invitation response' using errcode = '22023';
  end if;
  select event.id into event_id_value from public.campus_events event
  where event.public_slug = p_public_slug;
  update public.event_team_members member
  set status = case when p_response = 'accept' then 'active' else 'declined' end,
    responded_at = timezone('utc', now()), removed_at = null
  where member.event_id = event_id_value and member.user_id = actor
    and member.status = 'invited';
  if not found then return false; end if;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (
    event_id_value, actor,
    case when p_response = 'accept' then 'team_accepted' else 'team_declined' end
  );
  return true;
end;
$$;

create or replace function public.list_my_campus_event_team_invitations(
  p_limit integer default 31
)
returns table (
  event_public_slug text,
  event_title text,
  team_role text,
  invitation_status text,
  invited_at timestamptz,
  responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  return query
  select event.public_slug, event.title, member.role, member.status,
    member.invited_at, member.responded_at
  from public.event_team_members member
  join public.campus_events event on event.id = member.event_id
  where member.user_id = actor
    and member.status in ('invited', 'active', 'declined')
  order by member.invited_at desc
  limit least(greatest(coalesce(p_limit, 31), 1), 51);
end;
$$;

create or replace function public.list_campus_event_team_members(
  p_public_slug text
)
returns table (
  public_alias text,
  team_role text,
  invitation_status text,
  invited_at timestamptz,
  responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_id_value uuid;
begin
  select event.id into event_id_value from public.campus_events event
  where event.public_slug = p_public_slug and event.organizer_user_id = actor;
  if event_id_value is null then
    raise exception 'event management required' using errcode = '42501';
  end if;
  return query
  select coalesce(profile.public_alias, 'Akun dihapus'), member.role,
    member.status, member.invited_at, member.responded_at
  from public.event_team_members member
  left join public.profiles profile on profile.user_id = member.user_id
  where member.event_id = event_id_value and member.status in ('invited', 'active')
  order by member.role, member.invited_at, member.id;
end;
$$;

create or replace function public.remove_campus_event_team_member(
  p_public_slug text,
  p_public_alias text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_id_value uuid; target_user uuid;
begin
  select event.id into event_id_value from public.campus_events event
  where event.public_slug = p_public_slug and event.organizer_user_id = actor;
  select profile.user_id into target_user from public.profiles profile
  where lower(profile.public_alias) = lower(
    public.normalize_campus_event_single_line(p_public_alias)
  );
  update public.event_team_members member
  set status = 'removed', removed_at = timezone('utc', now())
  where member.event_id = event_id_value and member.user_id = target_user
    and member.status in ('invited', 'active');
  if not found then return false; end if;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_id_value, actor, 'team_removed');
  return true;
end;
$$;

create or replace function public.list_campus_event_registration_questions(
  p_public_slug text
)
returns table (
  question_public_id text,
  question_type text,
  prompt text,
  options jsonb,
  is_required boolean,
  sort_order smallint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_row public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null or event_row.status <> 'scheduled'
    or event_row.starts_at <= timezone('utc', now()) then return; end if;
  return query
  select question.public_id, question.question_type, question.prompt,
    question.options, question.is_required, question.sort_order
  from public.event_registration_questions question
  where question.event_id = event_row.id
  order by question.sort_order, question.public_id;
end;
$$;

create or replace function public.event_question_prompt_is_safe(p_prompt text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(public.normalize_campus_event_single_line(p_prompt))
    !~ '(^|[^[:alnum:]_])(password|kata sandi|otp|one.?time password|nim|nomor induk|nik|ktp|passport|paspor|government id|legal id|alamat rumah|alamat pribadi|private address|home address|auth credential|kredensial|contact reveal|kampus|campus|program studi|study program|semester|minat|interests)([^[:alnum:]_]|$)';
$$;

create or replace function public.add_campus_event_registration_question(
  p_public_slug text,
  p_question_type text,
  p_prompt text,
  p_options jsonb default '[]'::jsonb,
  p_is_required boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  normalized_prompt text := public.normalize_campus_event_single_line(p_prompt);
  question_count integer;
  option_value jsonb;
  new_public_id text;
begin
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug for update;
  if event_row.id is null or event_row.organizer_user_id <> actor
    or event_row.status <> 'scheduled' then
    raise exception 'event unavailable' using errcode = '42501';
  end if;
  if p_question_type not in ('short_text', 'single_select', 'multi_select', 'checkbox')
    or char_length(normalized_prompt) not between 5 and 160
    or not public.event_question_prompt_is_safe(normalized_prompt)
    or jsonb_typeof(coalesce(p_options, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_options, '[]'::jsonb)) > 12 then
    raise exception 'invalid registration question' using errcode = '22023';
  end if;
  if p_question_type in ('single_select', 'multi_select')
    and jsonb_array_length(p_options) < 2 then
    raise exception 'question options required' using errcode = '22023';
  end if;
  if p_question_type in ('short_text', 'checkbox')
    and jsonb_array_length(p_options) <> 0 then
    raise exception 'question options unavailable' using errcode = '22023';
  end if;
  for option_value in select value from jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  loop
    if jsonb_typeof(option_value) <> 'string'
      or char_length(btrim(option_value #>> '{}')) not between 1 and 80 then
      raise exception 'invalid question option' using errcode = '22023';
    end if;
  end loop;
  select count(*)::integer into question_count
  from public.event_registration_questions question
  where question.event_id = event_row.id;
  if question_count >= public.event_membership_limit(
    public.effective_membership_plan(actor), 'event_custom_questions'
  ) then raise exception 'registration question quota reached' using errcode = 'P0001'; end if;
  insert into public.event_registration_questions (
    event_id, question_type, prompt, options, is_required, sort_order
  ) values (
    event_row.id, p_question_type, normalized_prompt, coalesce(p_options, '[]'::jsonb),
    coalesce(p_is_required, false), question_count + 1
  ) returning public_id into new_public_id;
  return new_public_id;
end;
$$;

create or replace function public.delete_campus_event_registration_question(
  p_public_slug text,
  p_question_public_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_id_value uuid;
begin
  select event.id into event_id_value from public.campus_events event
  where event.public_slug = p_public_slug and event.organizer_user_id = actor
    and event.status = 'scheduled';
  delete from public.event_registration_questions question
  where question.event_id = event_id_value
    and question.public_id = p_question_public_id;
  return found;
end;
$$;

create or replace function public.update_campus_event_registration_settings(
  p_public_slug text,
  p_registration_mode text,
  p_waitlist_enabled boolean,
  p_registration_closes_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_row public.campus_events%rowtype;
begin
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug for update;
  if event_row.id is null or event_row.organizer_user_id <> actor
    or event_row.status <> 'scheduled'
    or event_row.starts_at <= timezone('utc', now()) then
    raise exception 'event unavailable' using errcode = '42501';
  end if;
  if p_registration_mode not in ('instant', 'approval')
    or p_waitlist_enabled is null
    or (p_registration_closes_at is not null
      and (
        p_registration_closes_at <= timezone('utc', now())
        or p_registration_closes_at > event_row.starts_at
      )) then
    raise exception 'invalid registration settings' using errcode = '22023';
  end if;
  update public.campus_events
  set registration_mode = p_registration_mode,
    waitlist_enabled = p_waitlist_enabled,
    registration_closes_at = p_registration_closes_at
  where id = event_row.id;
  return true;
end;
$$;

create or replace function public.get_campus_event_v2_settings(p_public_slug text)
returns table (
  is_official boolean,
  registration_mode text,
  waitlist_enabled boolean,
  registration_closes_at timestamptz,
  can_manage_registrations boolean,
  can_check_in boolean,
  can_manage_team boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_row public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null then return; end if;
  return query select event_row.is_official, event_row.registration_mode,
    event_row.waitlist_enabled, event_row.registration_closes_at,
    public.event_can_manage_registrations(event_row.id, actor),
    event_row.organizer_user_id = actor
      or public.is_event_team_member(
        event_row.id, actor, array['cohost', 'checkin_staff']::text[]
      ),
    event_row.organizer_user_id = actor;
end;
$$;

create or replace function public.get_campus_event(p_public_slug text)
returns table (
  public_slug text, title text, description text, category text, scope text,
  campus_scope text, starts_at timestamptz, ends_at timestamptz,
  timezone_name text, venue_category text, venue_name text, venue_area text,
  city text, capacity integer, attendee_count integer, rsvp_status text,
  is_organizer boolean, organizer_alias text, organizer_is_verified boolean,
  status text, is_past boolean, can_rsvp boolean,
  can_cancel_rsvp boolean, can_edit boolean, schedule_venue_locked boolean,
  can_cancel_event boolean, can_archive boolean,
  cancelled_at timestamptz, archived_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  target public.campus_events%rowtype;
  own_rsvp public.campus_event_rsvps%rowtype;
  going_count integer;
  has_history boolean;
  organizer_deleted boolean;
  blocked boolean;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_public_slug is null or p_public_slug !~ '^event-[0-9a-f]{24}$' then return; end if;
  select * into target from public.campus_events event
  where event.public_slug = p_public_slug;
  if target.id is null then return; end if;
  select profile.campus into actor_campus from public.profiles profile
  where profile.user_id = actor;
  select * into own_rsvp from public.campus_event_rsvps rsvp
  where rsvp.event_id = target.id and rsvp.user_id = actor;
  has_history := own_rsvp.id is not null;
  blocked := public.users_are_blocked(actor, target.organizer_user_id);
  organizer_deleted := public.is_account_deletion_locked(target.organizer_user_id);
  if organizer_deleted and not has_history then return; end if;
  if target.status = 'archived'
    and target.organizer_user_id <> actor and not has_history then return; end if;
  if target.scope = 'campus' and target.campus_scope <> actor_campus
    and target.organizer_user_id <> actor and not has_history then return; end if;
  if blocked and target.organizer_user_id <> actor and not has_history then return; end if;
  select count(*)::integer into going_count
  from public.campus_event_rsvps rsvp
  where rsvp.event_id = target.id and rsvp.status = 'going';

  return query select target.public_slug, target.title, target.description,
    target.category, target.scope, target.campus_scope, target.starts_at,
    target.ends_at, target.timezone_name, target.venue_category,
    target.venue_name, target.venue_area, target.city, target.capacity::integer,
    going_count, own_rsvp.status, target.organizer_user_id = actor,
    case when organizer_deleted then 'Akun dihapus' else organizer.public_alias end,
    case when organizer_deleted then false
      else organizer.verification_status = 'verified' end,
    target.status, target.ends_at <= timezone('utc', now()),
    not organizer_deleted
      and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now())
      and (target.registration_closes_at is null
        or target.registration_closes_at > timezone('utc', now()))
      and target.organizer_user_id <> actor
      and not blocked
      and (target.scope = 'open' or target.campus_scope = actor_campus)
      and own_rsvp.status not in ('pending', 'going', 'waitlisted')
      and (going_count < target.capacity or target.waitlist_enabled),
    own_rsvp.status in ('pending', 'going', 'waitlisted')
      and target.organizer_user_id <> actor
      and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now()),
    target.organizer_user_id = actor
      and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now()) + interval '2 hours',
    exists (
      select 1 from public.campus_event_rsvps attendee
      where attendee.event_id = target.id
        and attendee.user_id <> target.organizer_user_id
        and attendee.status = 'going'
    ),
    target.organizer_user_id = actor
      and target.status = 'scheduled'
      and target.starts_at > timezone('utc', now()),
    target.organizer_user_id = actor
      and target.status <> 'archived'
      and (target.status = 'cancelled'
        or target.ends_at <= timezone('utc', now())),
    target.cancelled_at, target.archived_at
  from (select 1) seed
  left join public.profiles organizer
    on organizer.user_id = target.organizer_user_id;
end;
$$;

drop function public.update_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean
);
create function public.update_campus_event(
  p_public_slug text, p_title text, p_description text, p_category text,
  p_starts_at_local text, p_ends_at_local text, p_timezone_name text,
  p_venue_category text, p_venue_name text, p_venue_area text, p_city text,
  p_capacity integer, p_confirms_public_place boolean,
  p_confirms_expected_operating boolean, p_confirms_not_private_residence boolean,
  p_confirms_no_private_location_disclosure boolean,
  p_registration_mode text, p_waitlist_enabled boolean,
  p_registration_closes_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  normalized_title text := public.normalize_campus_event_single_line(p_title);
  normalized_description text := public.normalize_campus_event_body(p_description);
  normalized_venue_name text := public.normalize_campus_event_single_line(p_venue_name);
  normalized_venue_area text := public.normalize_campus_event_single_line(p_venue_area);
  normalized_city text := public.normalize_campus_event_single_line(p_city);
  start_value timestamptz;
  end_value timestamptz;
  going_count integer;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug for update;
  if event_row.id is null or event_row.organizer_user_id <> actor
    or event_row.status <> 'scheduled'
    or event_row.starts_at <= timezone('utc', now()) + interval '2 hours' then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'edit_day', 20, 86400) then
    raise exception 'event edit rate limited' using errcode = 'P0001';
  end if;
  if p_timezone_name not in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')
    or p_starts_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
    or p_ends_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
    raise exception 'invalid event time' using errcode = '22023';
  end if;
  start_value := p_starts_at_local::timestamp at time zone p_timezone_name;
  end_value := p_ends_at_local::timestamp at time zone p_timezone_name;
  if start_value < timezone('utc', now()) + interval '2 hours'
    or start_value > timezone('utc', now()) + interval '180 days'
    or end_value - start_value not between interval '30 minutes' and interval '12 hours'
  then raise exception 'invalid event time' using errcode = '22023'; end if;
  if char_length(normalized_title) not between 5 and 100
    or char_length(normalized_description) not between 20 and 1000
    or char_length(normalized_venue_name) not between 3 and 120
    or char_length(normalized_venue_area) not between 8 and 240
    or char_length(normalized_city) not between 2 and 100
    or p_category not in (
      'study_together', 'coding_tech', 'design', 'languages', 'thesis',
      'exam_prep', 'workshop', 'discussion', 'networking', 'community', 'other'
    )
    or p_venue_category not in (
      'campus_public_area', 'cafe', 'library', 'coworking_space',
      'community_space', 'other_public_place'
    )
    or p_capacity not between 3 and 200
    or p_registration_mode not in ('instant', 'approval')
    or p_waitlist_enabled is null
    or (p_registration_closes_at is not null
      and (
        p_registration_closes_at <= timezone('utc', now())
        or p_registration_closes_at > start_value
      )) then
    raise exception 'invalid event settings' using errcode = '22023';
  end if;
  if p_confirms_public_place is distinct from true
    or p_confirms_expected_operating is distinct from true
    or p_confirms_not_private_residence is distinct from true
    or p_confirms_no_private_location_disclosure is distinct from true
    or public.campus_event_has_private_venue(
      normalized_venue_name || ' ' || normalized_venue_area
    ) then raise exception 'safety confirmation required' using errcode = '22023'; end if;
  select count(*)::integer into going_count from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id and rsvp.status = 'going';
  if p_capacity < going_count then
    raise exception 'capacity below attendees' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.campus_event_rsvps attendee
    where attendee.event_id = event_row.id
      and attendee.user_id <> event_row.organizer_user_id
      and attendee.status = 'going'
  ) and (
    start_value <> event_row.starts_at or end_value <> event_row.ends_at
    or p_timezone_name <> event_row.timezone_name
    or p_venue_category <> event_row.venue_category
    or normalized_venue_name <> event_row.venue_name
    or normalized_venue_area <> event_row.venue_area
    or normalized_city <> event_row.city
  ) then raise exception 'schedule venue locked after rsvp' using errcode = 'P0001'; end if;
  update public.campus_events
  set title = normalized_title, description = normalized_description,
    category = p_category, starts_at = start_value, ends_at = end_value,
    timezone_name = p_timezone_name, venue_category = p_venue_category,
    venue_name = normalized_venue_name, venue_area = normalized_venue_area,
    city = normalized_city, capacity = p_capacity,
    registration_mode = p_registration_mode,
    waitlist_enabled = p_waitlist_enabled,
    registration_closes_at = p_registration_closes_at,
    safety_confirmed_at = timezone('utc', now())
  where id = event_row.id;
  while (select count(*) from public.campus_event_rsvps rsvp
    where rsvp.event_id = event_row.id and rsvp.status = 'going') < p_capacity
  loop
    exit when public.promote_campus_event_waitlisted_rsvp(event_row.id) is null;
  end loop;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_row.id, actor, 'updated');
end;
$$;

create or replace function public.validate_campus_event_registration_answers(
  p_event_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  answers jsonb := coalesce(p_answers, '{}'::jsonb);
  question record;
  answer jsonb;
  item jsonb;
begin
  if jsonb_typeof(answers) <> 'object' or octet_length(answers::text) > 12000 then
    raise exception 'invalid registration answers' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(answers) as answer_key(key)
    where answer_key.key !~ '^[0-9a-f]{32}$'
      or not exists (
        select 1 from public.event_registration_questions question
        where question.event_id = p_event_id
          and question.public_id = answer_key.key
      )
  ) then raise exception 'unknown registration answer' using errcode = '22023'; end if;
  for question in
    select * from public.event_registration_questions q
    where q.event_id = p_event_id order by q.sort_order
  loop
    answer := answers -> question.public_id;
    if question.is_required and (
      answer is null or answer = 'null'::jsonb
      or (jsonb_typeof(answer) = 'string' and btrim(answer #>> '{}') = '')
      or (jsonb_typeof(answer) = 'array' and jsonb_array_length(answer) = 0)
      or (question.question_type = 'checkbox' and answer <> 'true'::jsonb)
    ) then raise exception 'required registration answer missing' using errcode = '22023'; end if;
    if answer is null then continue; end if;
    if question.question_type = 'short_text' and (
      jsonb_typeof(answer) <> 'string'
      or char_length(btrim(answer #>> '{}')) > 500
      or (answer #>> '{}') ~ '<[^>]+>'
    ) then raise exception 'invalid short answer' using errcode = '22023'; end if;
    if question.question_type = 'single_select' and (
      jsonb_typeof(answer) <> 'string' or not question.options @> jsonb_build_array(answer)
    ) then raise exception 'invalid single selection' using errcode = '22023'; end if;
    if question.question_type = 'multi_select' then
      if jsonb_typeof(answer) <> 'array' or jsonb_array_length(answer) > 12 then
        raise exception 'invalid multi selection' using errcode = '22023';
      end if;
      for item in select value from jsonb_array_elements(answer)
      loop
        if jsonb_typeof(item) <> 'string' or not question.options @> jsonb_build_array(item) then
          raise exception 'invalid multi selection' using errcode = '22023';
        end if;
      end loop;
    end if;
    if question.question_type = 'checkbox' and jsonb_typeof(answer) <> 'boolean' then
      raise exception 'invalid checkbox answer' using errcode = '22023';
    end if;
  end loop;
  return answers;
end;
$$;

create or replace function public.promote_campus_event_waitlisted_rsvp(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.campus_events%rowtype;
  promoted_id uuid;
begin
  select * into event_row from public.campus_events event
  where event.id = p_event_id for update;
  if event_row.id is null or event_row.status <> 'scheduled' then return null; end if;
  if (select count(*) from public.campus_event_rsvps rsvp
      where rsvp.event_id = event_row.id and rsvp.status = 'going') >= event_row.capacity
  then return null; end if;
  select rsvp.id into promoted_id
  from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id and rsvp.status = 'waitlisted'
    and public.is_campus_event_student(rsvp.user_id)
    and not public.users_are_blocked(rsvp.user_id, event_row.organizer_user_id)
    and (
      select count(*)
      from public.campus_event_rsvps active_rsvp
      join public.campus_events active_event
        on active_event.id = active_rsvp.event_id
      where active_rsvp.user_id = rsvp.user_id
        and active_rsvp.status = 'going'
        and active_event.status = 'scheduled'
        and active_event.starts_at > timezone('utc', now())
    ) < public.event_membership_limit(
      public.effective_membership_plan(rsvp.user_id),
      'joined_events_active'
    )
  order by rsvp.rsvped_at, rsvp.id, rsvp.public_id
  for update skip locked limit 1;
  if promoted_id is null then return null; end if;
  update public.campus_event_rsvps
  set status = 'going', cancelled_at = null
  where id = promoted_id and status = 'waitlisted';
  return promoted_id;
end;
$$;

create or replace function public.register_for_campus_event(
  p_public_slug text,
  p_answers jsonb default '{}'::jsonb
)
returns table (registration_public_id text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  actor_campus text;
  going_count integer;
  next_status text;
  safe_answers jsonb;
  registration_id text;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug for update;
  select profile.campus into actor_campus from public.profiles profile
  where profile.user_id = actor;
  if event_row.id is null or event_row.status <> 'scheduled'
    or event_row.starts_at <= timezone('utc', now())
    or (event_row.registration_closes_at is not null
      and event_row.registration_closes_at <= timezone('utc', now()))
    or event_row.organizer_user_id = actor
    or (event_row.scope = 'campus' and event_row.campus_scope <> actor_campus)
    or public.users_are_blocked(actor, event_row.organizer_user_id) then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'rsvp_day', 30, 86400) then
    raise exception 'event registration rate limited' using errcode = 'P0001';
  end if;
  safe_answers := public.validate_campus_event_registration_answers(
    event_row.id, p_answers
  );
  select count(*)::integer into going_count from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id and rsvp.status = 'going';
  if event_row.registration_mode = 'approval' then
    next_status := 'pending';
  elsif going_count < event_row.capacity then
    next_status := 'going';
  elsif event_row.waitlist_enabled then
    next_status := 'waitlisted';
  else
    raise exception 'event full' using errcode = 'P0001';
  end if;
  insert into public.campus_event_rsvps (
    event_id, user_id, status, public_id, registration_answers,
    rsvped_at, cancelled_at, checked_in_at, checked_in_by, checkin_method
  ) values (
    event_row.id, actor, next_status, encode(extensions.gen_random_bytes(16), 'hex'),
    safe_answers, timezone('utc', now()), null, null, null, null
  )
  on conflict (event_id, user_id) do update set
    status = excluded.status, registration_answers = excluded.registration_answers,
    rsvped_at = timezone('utc', now()), cancelled_at = null,
    checked_in_at = null, checked_in_by = null, checkin_method = null
  returning public_id into registration_id;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_row.id, actor, 'registration_submitted');
  return query select registration_id, next_status;
end;
$$;

create or replace function public.manage_campus_event_registration(
  p_public_slug text,
  p_registration_public_id text,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  registration public.campus_event_rsvps%rowtype;
  going_count integer;
  next_status text;
begin
  if p_action not in ('approve', 'decline') then
    raise exception 'invalid registration action' using errcode = '22023';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug for update;
  if event_row.id is null
    or not public.event_can_manage_registrations(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  select * into registration from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id
    and rsvp.public_id = p_registration_public_id for update;
  if registration.id is null or registration.status <> 'pending' then
    raise exception 'registration unavailable' using errcode = 'P0001';
  end if;
  if p_action = 'decline' then
    next_status := 'declined';
  else
    select count(*)::integer into going_count from public.campus_event_rsvps rsvp
    where rsvp.event_id = event_row.id and rsvp.status = 'going';
    if going_count < event_row.capacity then next_status := 'going';
    elsif event_row.waitlist_enabled then next_status := 'waitlisted';
    else raise exception 'event full' using errcode = 'P0001'; end if;
  end if;
  update public.campus_event_rsvps set status = next_status,
    cancelled_at = case when next_status = 'declined' then timezone('utc', now()) else null end
  where id = registration.id;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (
    event_row.id, actor,
    case when p_action = 'approve' then 'registration_approved'
      else 'registration_declined' end
  );
  return next_status;
end;
$$;

create or replace function public.cancel_campus_event_rsvp(p_public_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  prior_status text;
begin
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug for update;
  if event_row.id is null or event_row.status <> 'scheduled'
    or event_row.starts_at <= timezone('utc', now())
    or event_row.organizer_user_id = actor then
    raise exception 'event unavailable' using errcode = 'P0001';
  end if;
  select rsvp.status into prior_status from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id and rsvp.user_id = actor for update;
  if prior_status not in ('pending', 'going', 'waitlisted') then return false; end if;
  update public.campus_event_rsvps
  set status = 'cancelled', cancelled_at = timezone('utc', now()),
    checked_in_at = null, checked_in_by = null, checkin_method = null
  where event_id = event_row.id and user_id = actor;
  if prior_status = 'going' then
    perform public.promote_campus_event_waitlisted_rsvp(event_row.id);
  end if;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_row.id, actor, 'rsvp_cancelled');
  return true;
end;
$$;

drop function public.list_campus_event_attendees(text);
create function public.list_campus_event_attendees(p_public_slug text)
returns table (
  registration_public_id text, public_alias text, campus text,
  study_program text, semester smallint, interests text[],
  registration_status text, checked_in_at timestamptz, checkin_method text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_id_value uuid; is_checkin_only boolean;
begin
  select event.id into event_id_value from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_id_value is null then return; end if;
  is_checkin_only := public.is_event_team_member(
    event_id_value, actor, array['checkin_staff']::text[]
  ) and not public.event_can_manage_registrations(event_id_value, actor);
  if not public.event_can_manage_registrations(event_id_value, actor)
    and not is_checkin_only then
    raise exception 'event management required' using errcode = '42501';
  end if;
  return query
  select rsvp.public_id, profile.public_alias, profile.campus, profile.study_program,
    case when is_checkin_only then null else profile.semester end,
    case when is_checkin_only then array[]::text[] else profile.interests end,
    rsvp.status, rsvp.checked_in_at, rsvp.checkin_method
  from public.campus_event_rsvps rsvp
  join public.profiles profile on profile.user_id = rsvp.user_id
  where rsvp.event_id = event_id_value
    and rsvp.status in ('going', 'pending', 'waitlisted')
  order by rsvp.rsvped_at, rsvp.public_id
  limit 200;
end;
$$;

create or replace function public.list_campus_event_registrations(
  p_public_slug text,
  p_status text default null,
  p_before_rsvped_at timestamptz default null,
  p_before_public_id text default null,
  p_limit integer default 51
)
returns table (
  registration_public_id text,
  public_alias text,
  campus text,
  study_program text,
  semester smallint,
  interests text[],
  registration_status text,
  registration_answers jsonb,
  checked_in_at timestamptz,
  checkin_method text,
  rsvped_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_id_value uuid;
  safe_limit integer := least(greatest(coalesce(p_limit, 51), 1), 101);
begin
  select event.id into event_id_value from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_id_value is null
    or not public.event_can_manage_registrations(event_id_value, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  if p_status is not null
    and p_status not in ('pending', 'going', 'waitlisted', 'declined', 'cancelled') then
    raise exception 'invalid registration status' using errcode = '22023';
  end if;
  if (p_before_rsvped_at is null) <> (p_before_public_id is null)
    or (p_before_public_id is not null and p_before_public_id !~ '^[0-9a-f]{32}$') then
    raise exception 'invalid registration cursor' using errcode = '22023';
  end if;
  return query
  select rsvp.public_id, profile.public_alias, profile.campus,
    profile.study_program, profile.semester, profile.interests,
    rsvp.status, rsvp.registration_answers, rsvp.checked_in_at,
    rsvp.checkin_method, rsvp.rsvped_at
  from public.campus_event_rsvps rsvp
  join public.profiles profile on profile.user_id = rsvp.user_id
  where rsvp.event_id = event_id_value
    and (p_status is null or rsvp.status = p_status)
    and (
      p_before_rsvped_at is null
      or (rsvp.rsvped_at, rsvp.public_id)
        > (p_before_rsvped_at, p_before_public_id)
    )
  order by rsvp.rsvped_at, rsvp.public_id
  limit safe_limit;
end;
$$;

create or replace function public.get_campus_event_registration_overview(
  p_public_slug text
)
returns table (
  pending_count integer,
  going_count integer,
  waitlisted_count integer,
  declined_count integer,
  cancelled_count integer,
  checked_in_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_id_value uuid;
begin
  select event.id into event_id_value from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_id_value is null
    or not public.event_can_manage_registrations(event_id_value, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  return query select
    count(*) filter (where status = 'pending')::integer,
    count(*) filter (where status = 'going')::integer,
    count(*) filter (where status = 'waitlisted')::integer,
    count(*) filter (where status = 'declined')::integer,
    count(*) filter (where status = 'cancelled')::integer,
    count(*) filter (where checked_in_at is not null)::integer
  from public.campus_event_rsvps where event_id = event_id_value;
end;
$$;

alter table public.campus_event_audit_events
  drop constraint campus_event_audit_type,
  add constraint campus_event_audit_type check (event_type in (
    'created', 'updated', 'rsvp_joined', 'rsvp_cancelled', 'cancelled',
    'archived', 'event_reported', 'organizer_reported',
    'team_invited', 'team_accepted', 'team_declined', 'team_removed',
    'registration_submitted', 'registration_approved',
    'registration_declined', 'ticket_issued', 'ticket_regenerated',
    'checked_in_qr', 'checked_in_manual', 'checkin_undone',
    'official_enabled', 'official_disabled'
  ));

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
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED',
    'EVENT_REGISTRATION_PENDING', 'EVENT_REGISTRATION_APPROVED',
    'EVENT_REGISTRATION_DECLINED', 'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED'
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
        'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED', 'EVENT_CANCELLED',
        'EVENT_WAITLIST_PROMOTED', 'EVENT_REGISTRATION_PENDING',
        'EVENT_REGISTRATION_APPROVED', 'EVENT_REGISTRATION_DECLINED',
        'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED'
      )
      and metadata ? 'title'
      and jsonb_typeof(metadata->'title') = 'string'
      and char_length(metadata->>'title') between 1 and 100
      and metadata - 'title' = '{}'::jsonb
    )
    or (
      notification_type in (
        'EVENT_SCHEDULE_CHANGED', 'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H'
      )
      and metadata ? 'title' and metadata ? 'when_label'
      and char_length(metadata->>'title') between 1 and 100
      and char_length(metadata->>'when_label') between 1 and 64
      and metadata - 'title' - 'when_label' = '{}'::jsonb
    )
    or (
      notification_type = 'EVENT_LOCATION_CHANGED'
      and metadata ? 'title' and metadata ? 'venue_label'
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
      ) and metadata = '{}'::jsonb
    )
  );

alter table public.notification_preferences
  drop constraint notification_preferences_type,
  add constraint notification_preferences_type check (notification_type in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED',
    'EVENT_REGISTRATION_PENDING', 'EVENT_REGISTRATION_APPROVED',
    'EVENT_REGISTRATION_DECLINED', 'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED'
  ));

create or replace function public.set_my_notification_preference(
  p_notification_type text, p_in_app_enabled boolean
)
returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_notification_type not in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED',
    'EVENT_REGISTRATION_PENDING', 'EVENT_REGISTRATION_APPROVED',
    'EVENT_REGISTRATION_DECLINED', 'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED'
  ) or p_in_app_enabled is null then
    raise exception 'invalid preference' using errcode = '22023';
  end if;
  insert into public.notification_preferences (
    user_id, notification_type, in_app_enabled
  ) values (actor, p_notification_type, p_in_app_enabled)
  on conflict (user_id, notification_type) do update
  set in_app_enabled = excluded.in_app_enabled,
      updated_at = timezone('utc', now());
end; $$;

drop trigger campus_event_rsvps_notify_v1 on public.campus_event_rsvps;
create or replace function public.notify_campus_event_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.campus_events%rowtype;
  notification_type text;
  dedupe text;
begin
  select * into event_row from public.campus_events event where event.id = new.event_id;
  if event_row.id is null or event_row.organizer_user_id = new.user_id then return new; end if;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    notification_type := 'EVENT_REGISTRATION_PENDING';
  elsif new.status = 'going'
    and (tg_op = 'INSERT' or old.status is distinct from 'going')
    and (tg_op = 'INSERT' or old.status <> 'waitlisted') then
    notification_type := case when tg_op = 'UPDATE' and old.status = 'pending'
      then 'EVENT_REGISTRATION_APPROVED' else 'EVENT_REGISTERED' end;
  elsif new.status = 'waitlisted' and (tg_op = 'INSERT' or old.status is distinct from 'waitlisted') then
    notification_type := 'EVENT_WAITLISTED';
  elsif new.status = 'declined' and tg_op = 'UPDATE'
    and old.status is distinct from 'declined' then
    notification_type := 'EVENT_REGISTRATION_DECLINED';
  else return new;
  end if;
  dedupe := lower(notification_type) || ':' || new.id::text || ':'
    || new.status;
  perform public.emit_user_notification(
    new.user_id, notification_type, '/app/events/' || event_row.public_slug,
    jsonb_build_object(
      'title', public.notification_safe_label(event_row.title, 100, 'Campus Event')
    ), dedupe
  );
  return new;
end;
$$;
create trigger campus_event_rsvps_notify_v2
after insert or update of status on public.campus_event_rsvps
for each row execute function public.notify_campus_event_registration();

create or replace function public.notify_campus_event_waitlist_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.campus_events%rowtype;
begin
  if tg_op <> 'UPDATE' or old.status <> 'waitlisted' or new.status <> 'going'
    or new.user_id is null then return new; end if;
  select * into event_row from public.campus_events event where event.id = new.event_id;
  if event_row.id is null or event_row.organizer_user_id = new.user_id then return new; end if;
  perform public.emit_user_notification(
    new.user_id, 'EVENT_WAITLIST_PROMOTED',
    '/app/events/' || event_row.public_slug,
    jsonb_build_object(
      'title', public.notification_safe_label(event_row.title, 100, 'Campus Event')
    ),
    'event_waitlist_promoted:' || new.id::text
  );
  return new;
end;
$$;
create trigger campus_event_rsvps_notify_waitlist_promotion_v2
after update of status on public.campus_event_rsvps
for each row execute function public.notify_campus_event_waitlist_promotion();

create or replace function public.notify_campus_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_path_value text := '/app/events/' || new.public_slug;
  safe_title text := public.notification_safe_label(new.title, 100, 'Campus Event');
  when_text text;
begin
  if old.status = 'scheduled' and new.status = 'cancelled' then
    perform public.fanout_event_going_notifications(
      new.id, 'EVENT_CANCELLED', target_path_value,
      jsonb_build_object('title', safe_title),
      'event_cancelled:' || new.id::text || ':' || new.updated_at::text,
      new.organizer_user_id
    );
    return new;
  end if;
  if old.status <> 'scheduled' or new.status <> 'scheduled' then return new; end if;
  if row(old.starts_at, old.ends_at, old.timezone_name) is distinct from
    row(new.starts_at, new.ends_at, new.timezone_name) then
    when_text := public.notification_safe_label(
      to_char(new.starts_at at time zone new.timezone_name, 'YYYY-MM-DD HH24:MI')
        || ' '
        || case new.timezone_name
          when 'Asia/Makassar' then 'WITA'
          when 'Asia/Jayapura' then 'WIT'
          else 'WIB'
        end,
      64,
      'jadwal baru'
    );
    perform public.fanout_event_going_notifications(
      new.id, 'EVENT_SCHEDULE_CHANGED', target_path_value,
      jsonb_build_object(
        'title', safe_title,
        'when_label', when_text
      ),
      'event_schedule_changed:' || new.id::text || ':' || new.updated_at::text,
      new.organizer_user_id
    );
  end if;
  if row(old.venue_name, old.venue_area, old.city) is distinct from
    row(new.venue_name, new.venue_area, new.city) then
    perform public.fanout_event_going_notifications(
      new.id, 'EVENT_LOCATION_CHANGED', target_path_value,
      jsonb_build_object(
        'title', safe_title,
        'venue_label', public.notification_safe_label(
          new.venue_name || ' · ' || new.city, 160, 'Lokasi publik'
        )
      ),
      'event_location_changed:' || new.id::text || ':' || new.updated_at::text,
      new.organizer_user_id
    );
  end if;
  return new;
end;
$$;

create or replace function public.fanout_event_going_notifications(
  p_event_id uuid, p_notification_type text, p_target_path text,
  p_metadata jsonb, p_dedupe_prefix text, p_exclude_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user not in ('postgres', 'supabase_admin', 'authenticator') then
    raise exception 'notification emitter unavailable' using errcode = '42501';
  end if;
  insert into public.user_notifications (
    recipient_user_id, notification_type, target_path, metadata, dedupe_key
  )
  select rsvp.user_id, p_notification_type, p_target_path,
    coalesce(p_metadata, '{}'::jsonb),
    left(p_dedupe_prefix || ':' || rsvp.user_id::text, 240)
  from public.campus_event_rsvps rsvp
  where rsvp.event_id = p_event_id
    and rsvp.status in ('pending', 'going', 'waitlisted')
    and rsvp.user_id is not null
    and (p_exclude_user_id is null or rsvp.user_id <> p_exclude_user_id)
    and public.is_notification_student(rsvp.user_id)
    and not exists (
      select 1 from public.notification_preferences preference
      where preference.user_id = rsvp.user_id
        and preference.notification_type = p_notification_type
        and not preference.in_app_enabled
    )
  on conflict (dedupe_key) do nothing;
end;
$$;

alter table public.campus_event_rate_limits
  drop constraint campus_event_rate_limits_bucket,
  add constraint campus_event_rate_limits_bucket check (bucket in (
    'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day',
    'message_minute', 'message_day', 'ticket_regenerate_day',
    'ticket_scan_minute', 'ticket_scan_invalid_hour'
  ));

create or replace function public.consume_campus_event_rate_limit(
  p_actor_user_id uuid, p_bucket text, p_limit integer, p_window_seconds integer
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare window_value timestamptz; next_hit integer;
begin
  if p_actor_user_id is null or p_bucket not in (
    'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day',
    'message_minute', 'message_day', 'ticket_regenerate_day',
    'ticket_scan_minute', 'ticket_scan_invalid_hour'
  ) or p_limit < 1 or p_limit > 1000
    or p_window_seconds < 1 or p_window_seconds > 86400 then return false; end if;
  window_value := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / p_window_seconds)
      * p_window_seconds
  );
  insert into public.campus_event_rate_limits as rate (
    actor_user_id, bucket, window_start, hit_count
  ) values (p_actor_user_id, p_bucket, window_value, 1)
  on conflict (actor_user_id, bucket, window_start)
  do update set hit_count = rate.hit_count + 1
    where rate.hit_count < p_limit
  returning hit_count into next_hit;
  return next_hit is not null;
end; $$;

-- The legacy signature remains for current UI, but creation now requires trust,
-- enforces 2/day, and accepts the v2 capacity ceiling.
drop function public.create_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean
);
create or replace function public.create_campus_event(
  p_title text, p_description text, p_category text, p_scope text,
  p_starts_at_local text, p_ends_at_local text, p_timezone_name text,
  p_venue_category text, p_venue_name text, p_venue_area text, p_city text,
  p_capacity integer, p_confirms_public_place boolean,
  p_confirms_expected_operating boolean, p_confirms_not_private_residence boolean,
  p_confirms_no_private_location_disclosure boolean,
  p_registration_mode text, p_waitlist_enabled boolean,
  p_registration_closes_at timestamptz default null
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); actor_campus text; new_id uuid; new_slug text;
  start_value timestamptz; end_value timestamptz;
  normalized_title text := public.normalize_campus_event_single_line(p_title);
  normalized_description text := public.normalize_campus_event_body(p_description);
  normalized_venue_name text := public.normalize_campus_event_single_line(p_venue_name);
  normalized_venue_area text := public.normalize_campus_event_single_line(p_venue_area);
  normalized_city text := public.normalize_campus_event_single_line(p_city);
begin
  if not public.is_event_organizer_eligible(actor) then
    raise exception 'organizer eligibility required' using errcode = '42501'; end if;
  if p_timezone_name not in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')
    or p_starts_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
    or p_ends_at_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
    raise exception 'invalid event time' using errcode = '22023'; end if;
  start_value := p_starts_at_local::timestamp at time zone p_timezone_name;
  end_value := p_ends_at_local::timestamp at time zone p_timezone_name;
  if start_value < timezone('utc', now()) + interval '2 hours'
    or start_value > timezone('utc', now()) + interval '180 days'
    or end_value - start_value not between interval '30 minutes' and interval '12 hours'
  then raise exception 'invalid event time' using errcode = '22023'; end if;
  if char_length(normalized_title) not between 5 and 100
    or char_length(normalized_description) not between 20 and 1000
    or char_length(normalized_venue_name) not between 3 and 120
    or char_length(normalized_venue_area) not between 8 and 240
    or char_length(normalized_city) not between 2 and 100
    or p_category not in (
      'study_together', 'coding_tech', 'design', 'languages', 'thesis',
      'exam_prep', 'workshop', 'discussion', 'networking', 'community', 'other'
    ) or p_scope not in ('open', 'campus')
    or p_venue_category not in (
      'campus_public_area', 'cafe', 'library', 'coworking_space',
      'community_space', 'other_public_place'
    ) or p_capacity not between 3 and 200
    or p_registration_mode not in ('instant', 'approval')
    or p_waitlist_enabled is null
    or (p_registration_closes_at is not null
      and (
        p_registration_closes_at <= timezone('utc', now())
        or p_registration_closes_at > start_value
      )) then
    raise exception 'invalid event settings' using errcode = '22023'; end if;
  if p_confirms_public_place is distinct from true
    or p_confirms_expected_operating is distinct from true
    or p_confirms_not_private_residence is distinct from true
    or p_confirms_no_private_location_disclosure is distinct from true then
    raise exception 'safety confirmation required' using errcode = '22023'; end if;
  if public.campus_event_has_private_venue(
    normalized_venue_name || ' ' || normalized_venue_area
  ) then raise exception 'private venue blocked' using errcode = '22023'; end if;
  if not public.consume_campus_event_rate_limit(actor, 'create_day', 2, 86400) then
    raise exception 'event creation rate limited' using errcode = 'P0001'; end if;
  select profile.campus into actor_campus from public.profiles profile
  where profile.user_id = actor for update;
  insert into public.campus_events (
    organizer_user_id, title, description, category, scope, campus_scope,
    starts_at, ends_at, timezone_name, venue_category, venue_name,
    venue_area, city, capacity, safety_confirmed_at,
    registration_mode, waitlist_enabled, registration_closes_at
  ) values (
    actor, normalized_title, normalized_description, p_category, p_scope,
    case when p_scope = 'campus' then actor_campus else null end,
    start_value, end_value, p_timezone_name, p_venue_category,
    normalized_venue_name, normalized_venue_area, normalized_city,
    p_capacity, timezone('utc', now()), p_registration_mode,
    p_waitlist_enabled, p_registration_closes_at
  ) returning id, public_slug into new_id, new_slug;
  insert into public.campus_event_rsvps (
    event_id, user_id, status, public_id
  ) values (new_id, actor, 'going', encode(extensions.gen_random_bytes(16), 'hex'));
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (new_id, actor, 'created');
  return new_slug;
end; $$;

create or replace function public.rsvp_campus_event(p_public_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare result_status text;
begin
  select registration.status into result_status
  from public.register_for_campus_event(p_public_slug, '{}'::jsonb) registration;
  return result_status is not null;
end;
$$;

revoke all on function public.is_event_organizer_eligible(uuid)
  from public, anon, authenticated;
revoke all on function public.event_membership_limit(text, text)
  from public, anon, authenticated;
revoke all on function public.enforce_campus_event_v2_limits()
  from public, anon, authenticated;
revoke all on function public.guard_campus_event_official_flag()
  from public, anon, authenticated;
revoke all on function public.is_event_team_member(uuid, uuid, text[])
  from public, anon, authenticated;
revoke all on function public.event_can_manage_registrations(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.event_question_prompt_is_safe(text)
  from public, anon, authenticated;
revoke all on function public.validate_campus_event_registration_answers(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.promote_campus_event_waitlisted_rsvp(uuid)
  from public, anon, authenticated;
revoke all on function public.notify_campus_event_registration()
  from public, anon, authenticated;
revoke all on function public.notify_campus_event_waitlist_promotion()
  from public, anon, authenticated;
revoke all on function public.notify_campus_event_change()
  from public, anon, authenticated;
revoke all on function public.cleanup_event_roadmap_profile_data()
  from public, anon, authenticated;

revoke all on function public.get_my_event_organizer_eligibility()
  from public, anon;
grant execute on function public.get_my_event_organizer_eligibility()
  to authenticated;
revoke all on function public.owner_lookup_event_organizer_eligibility(text)
  from public, anon;
grant execute on function public.owner_lookup_event_organizer_eligibility(text)
  to authenticated;
revoke all on function public.owner_manage_event_organizer_eligibility(text, text)
  from public, anon;
grant execute on function public.owner_manage_event_organizer_eligibility(text, text)
  to authenticated;
revoke all on function public.owner_set_campus_event_official(text, boolean)
  from public, anon;
grant execute on function public.owner_set_campus_event_official(text, boolean)
  to authenticated;
revoke all on function public.invite_campus_event_team_member(text, text, text)
  from public, anon;
grant execute on function public.invite_campus_event_team_member(text, text, text)
  to authenticated;
revoke all on function public.respond_campus_event_team_invitation(text, text)
  from public, anon;
grant execute on function public.respond_campus_event_team_invitation(text, text)
  to authenticated;
revoke all on function public.list_my_campus_event_team_invitations(integer)
  from public, anon;
grant execute on function public.list_my_campus_event_team_invitations(integer)
  to authenticated;
revoke all on function public.list_campus_event_team_members(text)
  from public, anon;
grant execute on function public.list_campus_event_team_members(text)
  to authenticated;
revoke all on function public.remove_campus_event_team_member(text, text)
  from public, anon;
grant execute on function public.remove_campus_event_team_member(text, text)
  to authenticated;
revoke all on function public.add_campus_event_registration_question(
  text, text, text, jsonb, boolean
) from public, anon;
grant execute on function public.add_campus_event_registration_question(
  text, text, text, jsonb, boolean
) to authenticated;
revoke all on function public.delete_campus_event_registration_question(text, text)
  from public, anon;
grant execute on function public.delete_campus_event_registration_question(text, text)
  to authenticated;
revoke all on function public.list_campus_event_registration_questions(text)
  from public, anon;
grant execute on function public.list_campus_event_registration_questions(text)
  to authenticated;
revoke all on function public.update_campus_event_registration_settings(
  text, text, boolean, timestamptz
) from public, anon;
grant execute on function public.update_campus_event_registration_settings(
  text, text, boolean, timestamptz
) to authenticated;
revoke all on function public.get_campus_event_v2_settings(text)
  from public, anon;
grant execute on function public.get_campus_event_v2_settings(text)
  to authenticated;
revoke all on function public.update_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean, text, boolean, timestamptz
) from public, anon;
grant execute on function public.update_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean, text, boolean, timestamptz
) to authenticated;
revoke all on function public.register_for_campus_event(text, jsonb)
  from public, anon;
grant execute on function public.register_for_campus_event(text, jsonb)
  to authenticated;
revoke all on function public.manage_campus_event_registration(text, text, text)
  from public, anon;
grant execute on function public.manage_campus_event_registration(text, text, text)
  to authenticated;
revoke all on function public.list_campus_event_attendees(text) from public, anon;
grant execute on function public.list_campus_event_attendees(text) to authenticated;
revoke all on function public.list_campus_event_registrations(
  text, text, timestamptz, text, integer
) from public, anon;
grant execute on function public.list_campus_event_registrations(
  text, text, timestamptz, text, integer
) to authenticated;
revoke all on function public.get_campus_event_registration_overview(text)
  from public, anon;
grant execute on function public.get_campus_event_registration_overview(text)
  to authenticated;
revoke all on function public.create_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean, text, boolean, timestamptz
) from public, anon;
grant execute on function public.create_campus_event(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, boolean, boolean, boolean, boolean, text, boolean, timestamptz
) to authenticated;

comment on table public.event_organizer_eligibility is
  'Owner-managed student organizer trust. Membership plan alone never grants organizer eligibility.';
comment on table public.event_team_members is
  'Event-scoped cohost/check-in roles; never global staff.';
comment on table public.event_registration_questions is
  'Bounded non-profile registration questions with server-side answer validation.';
