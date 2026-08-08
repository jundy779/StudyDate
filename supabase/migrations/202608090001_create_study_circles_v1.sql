-- Study Circle v1 — local-only until a separately approved remote preflight.
-- Direct-join study groups with private member discussion and privacy-safe projections.
-- Circle membership never creates a private conversation or reveal state.

-- ---------------------------------------------------------------------------
-- 1. Core tables
-- ---------------------------------------------------------------------------

create table public.study_circles (
  id uuid primary key default gen_random_uuid(),
  public_slug text not null unique
    default ('circle-' || encode(extensions.gen_random_bytes(12), 'hex')),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null,
  topic text not null,
  scope text not null,
  campus_scope text null,
  member_limit smallint not null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz null,
  constraint study_circles_public_slug_format check (
    public_slug ~ '^circle-[0-9a-f]{24}$'
  ),
  constraint study_circles_name_length check (
    char_length(name) between 4 and 80
  ),
  constraint study_circles_description_length check (
    char_length(description) between 20 and 600
  ),
  constraint study_circles_plain_text check (
    name !~ '[<>]' and description !~ '[<>]'
  ),
  constraint study_circles_topic_allowed check (
    topic in (
      'coding',
      'data_science',
      'design',
      'mathematics',
      'languages',
      'thesis',
      'exam_prep',
      'general',
      'other'
    )
  ),
  constraint study_circles_scope_allowed check (
    scope in ('open', 'campus')
  ),
  constraint study_circles_scope_consistency check (
    (scope = 'open' and campus_scope is null)
    or (
      scope = 'campus'
      and campus_scope is not null
      and char_length(campus_scope) between 2 and 120
    )
  ),
  constraint study_circles_member_limit check (
    member_limit between 3 and 30
  ),
  constraint study_circles_status_allowed check (
    status in ('active', 'archived')
  ),
  constraint study_circles_archive_consistency check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create index study_circles_discovery_idx
  on public.study_circles (status, created_at desc, public_slug desc);
create index study_circles_owner_status_idx
  on public.study_circles (owner_user_id, status);
create index study_circles_topic_scope_idx
  on public.study_circles (topic, scope, campus_scope)
  where status = 'active';

alter table public.study_circles enable row level security;
revoke all on table public.study_circles from public, anon, authenticated;

create trigger study_circles_set_updated_at
before update on public.study_circles
for each row execute function public.set_updated_at();

create table public.study_circle_memberships (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.study_circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default timezone('utc', now()),
  left_at timestamptz null,
  removed_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint study_circle_memberships_unique unique (circle_id, user_id),
  constraint study_circle_memberships_role_allowed check (
    role in ('owner', 'member')
  ),
  constraint study_circle_memberships_status_allowed check (
    status in ('active', 'left', 'removed')
  ),
  constraint study_circle_memberships_lifecycle check (
    (status = 'active' and left_at is null and removed_at is null)
    or (status = 'left' and left_at is not null and removed_at is null)
    or (status = 'removed' and removed_at is not null)
  ),
  constraint study_circle_owner_stays_active check (
    role <> 'owner' or status = 'active'
  )
);

create index study_circle_memberships_user_status_idx
  on public.study_circle_memberships (user_id, status, joined_at desc);
create index study_circle_memberships_circle_status_idx
  on public.study_circle_memberships (circle_id, status, joined_at asc);
create unique index study_circle_one_owner_idx
  on public.study_circle_memberships (circle_id)
  where role = 'owner';

alter table public.study_circle_memberships enable row level security;
revoke all on table public.study_circle_memberships from public, anon, authenticated;

create trigger study_circle_memberships_set_updated_at
before update on public.study_circle_memberships
for each row execute function public.set_updated_at();

create table public.study_circle_messages (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  circle_id uuid not null references public.study_circles (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  moderation_status text not null default 'visible',
  client_idempotency_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint study_circle_messages_public_id_format check (
    public_id ~ '^[0-9a-f]{32}$'
  ),
  constraint study_circle_messages_body_length check (
    char_length(body) between 1 and 800
  ),
  constraint study_circle_messages_plain_text check (
    body !~ '<[^>]+>'
  ),
  constraint study_circle_messages_status_allowed check (
    moderation_status in ('visible', 'removed')
  ),
  constraint study_circle_messages_idempotency_format check (
    client_idempotency_key ~ '^[A-Za-z0-9_-]{16,80}$'
  ),
  constraint study_circle_messages_id_circle_unique unique (id, circle_id),
  constraint study_circle_messages_idempotency_unique unique (
    circle_id,
    author_user_id,
    client_idempotency_key
  )
);

create index study_circle_messages_circle_created_idx
  on public.study_circle_messages (circle_id, created_at desc, public_id desc);
create index study_circle_messages_author_created_idx
  on public.study_circle_messages (author_user_id, created_at desc);

alter table public.study_circle_messages enable row level security;
revoke all on table public.study_circle_messages from public, anon, authenticated;

create table public.study_circle_events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.study_circles (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint study_circle_events_type_allowed check (
    event_type in (
      'created',
      'updated',
      'joined',
      'left',
      'member_removed',
      'message_sent',
      'archived',
      'reported'
    )
  )
);

create index study_circle_events_circle_created_idx
  on public.study_circle_events (circle_id, created_at desc);

alter table public.study_circle_events enable row level security;
revoke all on table public.study_circle_events from public, anon, authenticated;

create table public.study_circle_rate_limits (
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  constraint study_circle_rate_limits_pkey primary key (
    actor_user_id,
    bucket,
    window_start
  ),
  constraint study_circle_rate_limits_bucket check (
    bucket in (
      'create_day',
      'membership_day',
      'message_minute',
      'message_day',
      'report_hour',
      'report_day'
    )
  ),
  constraint study_circle_rate_limits_count check (hit_count >= 0)
);

create index study_circle_rate_limits_window_idx
  on public.study_circle_rate_limits (window_start);

alter table public.study_circle_rate_limits enable row level security;
revoke all on table public.study_circle_rate_limits from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Report-scoped Circle moderation evidence
-- ---------------------------------------------------------------------------

alter table public.user_reports
  add column study_circle_id uuid null
    references public.study_circles (id) on delete set null,
  add column study_circle_message_id uuid null,
  add column study_circle_message_excerpt text null;

alter table public.user_reports
  add constraint user_reports_circle_message_context_fk
    foreign key (study_circle_message_id, study_circle_id)
    references public.study_circle_messages (id, circle_id)
    on delete cascade;

alter table public.user_reports
  add constraint user_reports_circle_context_exclusive check (
    study_circle_id is null
    or (
      introduction_request_id is null
      and conversation_id is null
      and anonymous_message_id is null
    )
  ),
  add constraint user_reports_circle_excerpt_length check (
    study_circle_message_excerpt is null
    or char_length(study_circle_message_excerpt) <= 280
  ),
  add constraint user_reports_circle_excerpt_consistency check (
    (study_circle_message_id is null and study_circle_message_excerpt is null)
    or (study_circle_message_id is not null and study_circle_message_excerpt is not null)
  );

create index user_reports_study_circle_idx
  on public.user_reports (study_circle_id)
  where study_circle_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Internal helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_study_circle_student(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.profiles profile
      where profile.user_id = p_user_id
        and profile.onboarding_completed_at is not null
        and nullif(to_jsonb(profile)->>'deactivated_at', '') is null
    )
    and not public.is_active_staff_user(p_user_id);
$$;

create or replace function public.is_active_study_circle_member(
  p_circle_id uuid,
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
    from public.study_circle_memberships membership
    where membership.circle_id = p_circle_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
  );
$$;

create or replace function public.normalize_study_circle_single_line(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g'));
$$;

create or replace function public.normalize_study_circle_body(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := replace(coalesce(p_value, ''), E'\r\n', E'\n');
  normalized := replace(normalized, E'\r', E'\n');
  normalized := regexp_replace(normalized, E'[ \t]+', ' ', 'g');
  normalized := regexp_replace(normalized, E'\n{3,}', E'\n\n', 'g');
  return btrim(normalized);
end;
$$;

create or replace function public.consume_study_circle_rate_limit(
  p_actor_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_value timestamptz;
  next_hit integer;
begin
  if p_actor_user_id is null
    or p_bucket not in (
      'create_day',
      'membership_day',
      'message_minute',
      'message_day',
      'report_hour',
      'report_day'
    )
    or p_limit < 1
    or p_limit > 1000
    or p_window_seconds < 1
    or p_window_seconds > 86400 then
    return false;
  end if;

  window_value := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / p_window_seconds)
      * p_window_seconds
  );

  insert into public.study_circle_rate_limits as rate (
    actor_user_id,
    bucket,
    window_start,
    hit_count
  )
  values (p_actor_user_id, p_bucket, window_value, 1)
  on conflict (actor_user_id, bucket, window_start)
  do update set hit_count = rate.hit_count + 1
    where rate.hit_count < p_limit
  returning hit_count into next_hit;

  return next_hit is not null;
end;
$$;

revoke all on function public.is_study_circle_student(uuid)
  from public, anon, authenticated;
revoke all on function public.is_active_study_circle_member(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.normalize_study_circle_single_line(text)
  from public, anon, authenticated;
revoke all on function public.normalize_study_circle_body(text)
  from public, anon, authenticated;
revoke all on function public.consume_study_circle_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Discovery and detail projections
-- ---------------------------------------------------------------------------

create or replace function public.list_study_circles(
  p_search text default null,
  p_topic text default null,
  p_scope text default null,
  p_before_created_at timestamptz default null,
  p_before_public_slug text default null,
  p_limit integer default 13
)
returns table (
  public_slug text,
  name text,
  description text,
  topic text,
  scope text,
  campus_scope text,
  member_limit integer,
  member_count integer,
  membership_state text,
  is_owner boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  normalized_search text;
  safe_limit integer := least(greatest(coalesce(p_limit, 13), 1), 31);
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_topic is not null and p_topic not in (
    'coding', 'data_science', 'design', 'mathematics', 'languages',
    'thesis', 'exam_prep', 'general', 'other'
  ) then
    raise exception 'invalid circle topic' using errcode = '22023';
  end if;
  if p_scope is not null and p_scope not in ('open', 'campus') then
    raise exception 'invalid circle scope' using errcode = '22023';
  end if;
  if (p_before_created_at is null) <> (p_before_public_slug is null)
    or (
      p_before_public_slug is not null
      and p_before_public_slug !~ '^circle-[0-9a-f]{24}$'
    ) then
    raise exception 'invalid circle cursor' using errcode = '22023';
  end if;

  normalized_search := nullif(public.normalize_study_circle_single_line(p_search), '');
  if normalized_search is not null and char_length(normalized_search) > 80 then
    raise exception 'invalid circle search' using errcode = '22023';
  end if;

  select profile.campus into actor_campus
  from public.profiles profile
  where profile.user_id = actor;

  return query
  select
    circle.public_slug,
    circle.name,
    circle.description,
    circle.topic,
    circle.scope,
    circle.campus_scope,
    circle.member_limit::integer,
    (
      select count(*)::integer
      from public.study_circle_memberships active_member
      where active_member.circle_id = circle.id
        and active_member.status = 'active'
    ),
    membership.status,
    circle.owner_user_id = actor,
    circle.created_at
  from public.study_circles circle
  left join public.study_circle_memberships membership
    on membership.circle_id = circle.id
   and membership.user_id = actor
  where circle.status = 'active'
    and (circle.scope = 'open' or circle.campus_scope = actor_campus)
    and (
      membership.status = 'active'
      or not public.users_are_blocked(actor, circle.owner_user_id)
    )
    and (p_topic is null or circle.topic = p_topic)
    and (p_scope is null or circle.scope = p_scope)
    and (
      normalized_search is null
      or circle.name ilike '%' || normalized_search || '%'
    )
    and (
      p_before_created_at is null
      or (circle.created_at, circle.public_slug)
        < (p_before_created_at, p_before_public_slug)
    )
  order by circle.created_at desc, circle.public_slug desc
  limit safe_limit;
end;
$$;

create or replace function public.get_study_circle(p_public_slug text)
returns table (
  public_slug text,
  name text,
  description text,
  topic text,
  scope text,
  campus_scope text,
  member_limit integer,
  member_count integer,
  status text,
  membership_state text,
  is_owner boolean,
  can_join boolean,
  can_leave boolean,
  created_at timestamptz,
  archived_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  circle public.study_circles%rowtype;
  membership public.study_circle_memberships%rowtype;
  active_count integer;
  discoverable boolean;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_public_slug is null or p_public_slug !~ '^circle-[0-9a-f]{24}$' then
    return;
  end if;

  select * into circle
  from public.study_circles candidate
  where candidate.public_slug = p_public_slug;
  if circle.id is null then return; end if;

  select profile.campus into actor_campus
  from public.profiles profile
  where profile.user_id = actor;
  select * into membership
  from public.study_circle_memberships candidate
  where candidate.circle_id = circle.id
    and candidate.user_id = actor;
  select count(*)::integer into active_count
  from public.study_circle_memberships candidate
  where candidate.circle_id = circle.id
    and candidate.status = 'active';

  discoverable :=
    circle.status = 'active'
    and (circle.scope = 'open' or circle.campus_scope = actor_campus)
    and not public.users_are_blocked(actor, circle.owner_user_id);

  if not discoverable and membership.status is distinct from 'active' then
    return;
  end if;

  return query select
    circle.public_slug,
    circle.name,
    circle.description,
    circle.topic,
    circle.scope,
    circle.campus_scope,
    circle.member_limit::integer,
    active_count,
    circle.status,
    membership.status,
    circle.owner_user_id = actor,
    (
      discoverable
      and circle.owner_user_id <> actor
      and (membership.id is null or membership.status = 'left')
      and active_count < circle.member_limit
    ),
    (
      membership.status = 'active'
      and membership.role = 'member'
      and circle.status = 'active'
    ),
    circle.created_at,
    circle.archived_at;
end;
$$;

revoke all on function public.list_study_circles(
  text, text, text, timestamptz, text, integer
) from public, anon;
grant execute on function public.list_study_circles(
  text, text, text, timestamptz, text, integer
) to authenticated;
revoke all on function public.get_study_circle(text) from public, anon;
grant execute on function public.get_study_circle(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Circle lifecycle and membership
-- ---------------------------------------------------------------------------

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

  select count(*)::integer into active_owned
  from public.study_circles circle
  where circle.owner_user_id = actor
    and circle.status = 'active';
  if active_owned >= 3 then
    raise exception 'circle ownership limit reached' using errcode = 'P0001';
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

create or replace function public.update_study_circle(
  p_public_slug text,
  p_name text,
  p_description text,
  p_topic text,
  p_member_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  circle public.study_circles%rowtype;
  normalized_name text;
  normalized_description text;
  active_count integer;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into circle
  from public.study_circles candidate
  where candidate.public_slug = p_public_slug
  for update;
  if circle.id is null
    or circle.owner_user_id <> actor
    or circle.status <> 'active' then
    raise exception 'circle unavailable' using errcode = 'P0001';
  end if;

  normalized_name := public.normalize_study_circle_single_line(p_name);
  normalized_description := public.normalize_study_circle_body(p_description);
  if char_length(normalized_name) not between 4 and 80
    or char_length(normalized_description) not between 20 and 600
    or normalized_name ~ '[<>]'
    or normalized_description ~ '<[^>]+>'
    or public.introduction_message_has_contact(
      normalized_name || ' ' || normalized_description
    )
    or p_topic not in (
      'coding', 'data_science', 'design', 'mathematics', 'languages',
      'thesis', 'exam_prep', 'general', 'other'
    )
    or p_member_limit not between 3 and 30 then
    raise exception 'invalid circle settings' using errcode = '22023';
  end if;

  select count(*)::integer into active_count
  from public.study_circle_memberships membership
  where membership.circle_id = circle.id
    and membership.status = 'active';
  if p_member_limit < active_count then
    raise exception 'member limit below active members' using errcode = '22023';
  end if;

  update public.study_circles
  set name = normalized_name,
      description = normalized_description,
      topic = p_topic,
      member_limit = p_member_limit
  where id = circle.id;
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (circle.id, actor, 'updated');
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
  select count(*)::integer into active_memberships
  from public.study_circle_memberships candidate
  where candidate.user_id = actor
    and candidate.status = 'active';
  if active_memberships >= 10 then
    raise exception 'circle membership limit reached' using errcode = 'P0001';
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

create or replace function public.leave_study_circle(p_public_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  circle public.study_circles%rowtype;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into circle
  from public.study_circles candidate
  where candidate.public_slug = p_public_slug
  for update;
  if circle.id is null or circle.owner_user_id = actor then
    raise exception 'circle unavailable' using errcode = 'P0001';
  end if;
  if not public.consume_study_circle_rate_limit(
    actor, 'membership_day', 30, 86400
  ) then
    raise exception 'circle membership rate limited' using errcode = 'P0001';
  end if;

  update public.study_circle_memberships
  set status = 'left',
      left_at = timezone('utc', now()),
      removed_at = null
  where circle_id = circle.id
    and user_id = actor
    and status = 'active'
    and role = 'member';
  if not found then return false; end if;
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (circle.id, actor, 'left');
  return true;
end;
$$;

create or replace function public.remove_study_circle_member(
  p_public_slug text,
  p_member_alias text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  circle public.study_circles%rowtype;
  target_user_id uuid;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into circle
  from public.study_circles candidate
  where candidate.public_slug = p_public_slug
  for update;
  if circle.id is null or circle.owner_user_id <> actor then
    raise exception 'circle unavailable' using errcode = 'P0001';
  end if;
  select profile.user_id into target_user_id
  from public.profiles profile
  join public.study_circle_memberships membership
    on membership.user_id = profile.user_id
   and membership.circle_id = circle.id
   and membership.status = 'active'
   and membership.role = 'member'
  where profile.public_alias = p_member_alias;
  if target_user_id is null then
    raise exception 'circle member unavailable' using errcode = 'P0001';
  end if;

  update public.study_circle_memberships
  set status = 'removed',
      removed_at = timezone('utc', now()),
      left_at = null
  where circle_id = circle.id
    and user_id = target_user_id;
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (circle.id, actor, 'member_removed');
  return true;
end;
$$;

create or replace function public.archive_study_circle(p_public_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  circle public.study_circles%rowtype;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into circle
  from public.study_circles candidate
  where candidate.public_slug = p_public_slug
  for update;
  if circle.id is null or circle.owner_user_id <> actor then
    raise exception 'circle unavailable' using errcode = 'P0001';
  end if;
  if circle.status = 'archived' then return false; end if;

  update public.study_circles
  set status = 'archived',
      archived_at = timezone('utc', now())
  where id = circle.id;
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (circle.id, actor, 'archived');
  return true;
end;
$$;

revoke all on function public.create_study_circle(text, text, text, text, integer)
  from public, anon;
grant execute on function public.create_study_circle(text, text, text, text, integer)
  to authenticated;
revoke all on function public.update_study_circle(text, text, text, text, integer)
  from public, anon;
grant execute on function public.update_study_circle(text, text, text, text, integer)
  to authenticated;
revoke all on function public.join_study_circle(text) from public, anon;
grant execute on function public.join_study_circle(text) to authenticated;
revoke all on function public.leave_study_circle(text) from public, anon;
grant execute on function public.leave_study_circle(text) to authenticated;
revoke all on function public.remove_study_circle_member(text, text)
  from public, anon;
grant execute on function public.remove_study_circle_member(text, text)
  to authenticated;
revoke all on function public.archive_study_circle(text) from public, anon;
grant execute on function public.archive_study_circle(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Privacy-safe member and discussion projections
-- ---------------------------------------------------------------------------

create or replace function public.list_study_circle_members(p_public_slug text)
returns table (
  public_alias text,
  campus text,
  study_program text,
  semester smallint,
  interests text[],
  connection_goals text[],
  is_verified boolean,
  circle_role text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  circle_id uuid;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select circle.id into circle_id
  from public.study_circles circle
  where circle.public_slug = p_public_slug;
  if circle_id is null
    or not public.is_active_study_circle_member(circle_id, actor) then
    raise exception 'circle membership required' using errcode = '42501';
  end if;

  return query
  select
    profile.public_alias,
    profile.campus,
    profile.study_program,
    profile.semester,
    profile.interests,
    profile.connection_goals,
    profile.verification_status = 'verified',
    membership.role,
    membership.joined_at
  from public.study_circle_memberships membership
  join public.profiles profile on profile.user_id = membership.user_id
  where membership.circle_id = circle_id
    and membership.status = 'active'
    and public.is_study_circle_student(membership.user_id)
  order by
    case membership.role when 'owner' then 0 else 1 end,
    membership.joined_at asc,
    profile.public_alias asc;
end;
$$;

create or replace function public.list_study_circle_messages(
  p_public_slug text,
  p_before_created_at timestamptz default null,
  p_before_public_id text default null,
  p_limit integer default 51
)
returns table (
  message_public_id text,
  author_alias text,
  author_is_verified boolean,
  body text,
  created_at timestamptz,
  is_mine boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  circle_id uuid;
  safe_limit integer := least(greatest(coalesce(p_limit, 51), 1), 101);
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if (p_before_created_at is null) <> (p_before_public_id is null)
    or (
      p_before_public_id is not null
      and p_before_public_id !~ '^[0-9a-f]{32}$'
    ) then
    raise exception 'invalid message cursor' using errcode = '22023';
  end if;
  select circle.id into circle_id
  from public.study_circles circle
  where circle.public_slug = p_public_slug;
  if circle_id is null
    or not public.is_active_study_circle_member(circle_id, actor) then
    raise exception 'circle membership required' using errcode = '42501';
  end if;

  return query
  select
    message.public_id,
    profile.public_alias,
    profile.verification_status = 'verified',
    message.body,
    message.created_at,
    message.author_user_id = actor
  from public.study_circle_messages message
  join public.profiles profile on profile.user_id = message.author_user_id
  where message.circle_id = circle_id
    and message.moderation_status = 'visible'
    and (
      p_before_created_at is null
      or (message.created_at, message.public_id)
        < (p_before_created_at, p_before_public_id)
    )
  order by message.created_at desc, message.public_id desc
  limit safe_limit;
end;
$$;

create or replace function public.send_study_circle_message(
  p_public_slug text,
  p_body text,
  p_idempotency_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  circle public.study_circles%rowtype;
  normalized_body text;
  existing_public_id text;
  new_public_id text;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into circle
  from public.study_circles candidate
  where candidate.public_slug = p_public_slug
  for update;
  if circle.id is null
    or circle.status <> 'active'
    or not public.is_active_study_circle_member(circle.id, actor) then
    raise exception 'circle membership required' using errcode = '42501';
  end if;
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    raise exception 'invalid message idempotency key' using errcode = '22023';
  end if;

  select message.public_id into existing_public_id
  from public.study_circle_messages message
  where message.circle_id = circle.id
    and message.author_user_id = actor
    and message.client_idempotency_key = p_idempotency_key;
  if existing_public_id is not null then return existing_public_id; end if;

  normalized_body := public.normalize_study_circle_body(p_body);
  if char_length(normalized_body) not between 1 and 800
    or normalized_body ~ '<[^>]+>' then
    raise exception 'invalid circle message' using errcode = '22023';
  end if;
  if public.introduction_message_has_contact(normalized_body) then
    raise exception 'contact disclosure blocked' using errcode = '22023';
  end if;
  if not public.consume_study_circle_rate_limit(
    actor, 'message_minute', 20, 60
  ) or not public.consume_study_circle_rate_limit(
    actor, 'message_day', 300, 86400
  ) then
    raise exception 'circle message rate limited' using errcode = 'P0001';
  end if;

  insert into public.study_circle_messages (
    circle_id,
    author_user_id,
    body,
    client_idempotency_key
  )
  values (circle.id, actor, normalized_body, p_idempotency_key)
  returning public_id into new_public_id;
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (circle.id, actor, 'message_sent');
  return new_public_id;
end;
$$;

revoke all on function public.list_study_circle_members(text)
  from public, anon;
grant execute on function public.list_study_circle_members(text)
  to authenticated;
revoke all on function public.list_study_circle_messages(
  text, timestamptz, text, integer
) from public, anon;
grant execute on function public.list_study_circle_messages(
  text, timestamptz, text, integer
) to authenticated;
revoke all on function public.send_study_circle_message(text, text, text)
  from public, anon;
grant execute on function public.send_study_circle_message(text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Circle-scoped reporting
-- ---------------------------------------------------------------------------

create or replace function public.report_study_circle(
  p_public_slug text,
  p_reason_code text,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  circle public.study_circles%rowtype;
  is_active_member boolean;
  normalized_details text;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_reason_code not in (
    'harassment', 'spam', 'contact_pressure', 'fake_or_misleading', 'other'
  ) then
    raise exception 'invalid report reason' using errcode = '22023';
  end if;
  select * into circle
  from public.study_circles candidate
  where candidate.public_slug = p_public_slug;
  if circle.id is null or circle.owner_user_id = actor then
    raise exception 'circle unavailable' using errcode = 'P0001';
  end if;
  select profile.campus into actor_campus
  from public.profiles profile
  where profile.user_id = actor;
  is_active_member := public.is_active_study_circle_member(circle.id, actor);
  if not is_active_member
    and (
      circle.status <> 'active'
      or (circle.scope = 'campus' and circle.campus_scope <> actor_campus)
      or public.users_are_blocked(actor, circle.owner_user_id)
    ) then
    raise exception 'circle unavailable' using errcode = 'P0001';
  end if;

  normalized_details := nullif(public.normalize_study_circle_body(p_details), '');
  if normalized_details is not null
    and (
      char_length(normalized_details) > 300
      or public.introduction_message_has_contact(normalized_details)
    ) then
    raise exception 'invalid report details' using errcode = '22023';
  end if;
  if not public.consume_study_circle_rate_limit(
    actor, 'report_hour', 3, 3600
  ) or not public.consume_study_circle_rate_limit(
    actor, 'report_day', 10, 86400
  ) then
    raise exception 'report rate limited' using errcode = 'P0001';
  end if;

  insert into public.user_reports (
    reporter_id,
    subject_user_id,
    study_circle_id,
    reason_code,
    details
  )
  values (
    actor,
    circle.owner_user_id,
    circle.id,
    p_reason_code,
    normalized_details
  );
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (circle.id, actor, 'reported');
end;
$$;

create or replace function public.report_study_circle_member(
  p_public_slug text,
  p_member_alias text,
  p_reason_code text,
  p_details text default null,
  p_message_public_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  circle_id uuid;
  target_user_id uuid;
  target_message public.study_circle_messages%rowtype;
  normalized_details text;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_reason_code not in (
    'harassment', 'spam', 'contact_pressure', 'fake_or_misleading', 'other'
  ) then
    raise exception 'invalid report reason' using errcode = '22023';
  end if;
  select circle.id into circle_id
  from public.study_circles circle
  where circle.public_slug = p_public_slug;
  if circle_id is null
    or not public.is_active_study_circle_member(circle_id, actor) then
    raise exception 'circle membership required' using errcode = '42501';
  end if;
  select profile.user_id into target_user_id
  from public.profiles profile
  join public.study_circle_memberships membership
    on membership.user_id = profile.user_id
   and membership.circle_id = circle_id
   and membership.status = 'active'
  where profile.public_alias = p_member_alias;
  if target_user_id is null or target_user_id = actor then
    raise exception 'circle member unavailable' using errcode = 'P0001';
  end if;

  if p_message_public_id is not null then
    select * into target_message
    from public.study_circle_messages message
    where message.public_id = p_message_public_id
      and message.circle_id = circle_id
      and message.author_user_id = target_user_id
      and message.moderation_status = 'visible';
    if target_message.id is null then
      raise exception 'circle message unavailable' using errcode = 'P0001';
    end if;
  end if;

  normalized_details := nullif(public.normalize_study_circle_body(p_details), '');
  if normalized_details is not null
    and (
      char_length(normalized_details) > 300
      or public.introduction_message_has_contact(normalized_details)
    ) then
    raise exception 'invalid report details' using errcode = '22023';
  end if;
  if not public.consume_study_circle_rate_limit(
    actor, 'report_hour', 3, 3600
  ) or not public.consume_study_circle_rate_limit(
    actor, 'report_day', 10, 86400
  ) then
    raise exception 'report rate limited' using errcode = 'P0001';
  end if;

  insert into public.user_reports (
    reporter_id,
    subject_user_id,
    study_circle_id,
    study_circle_message_id,
    study_circle_message_excerpt,
    reason_code,
    details
  )
  values (
    actor,
    target_user_id,
    circle_id,
    target_message.id,
    case when target_message.id is null then null else left(target_message.body, 280) end,
    p_reason_code,
    normalized_details
  );
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (circle_id, actor, 'reported');
end;
$$;

revoke all on function public.report_study_circle(text, text, text)
  from public, anon;
grant execute on function public.report_study_circle(text, text, text)
  to authenticated;
revoke all on function public.report_study_circle_member(
  text, text, text, text, text
) from public, anon;
grant execute on function public.report_study_circle_member(
  text, text, text, text, text
) to authenticated;

-- Extend the existing Owner queue without adding broad Circle surveillance.
create or replace function public.list_moderation_reports(
  p_status text default null,
  p_limit integer default 50
)
returns table (
  report_id uuid,
  moderation_status text,
  reason_code text,
  target_kind text,
  subject_suffix text,
  has_details boolean,
  has_message_ref boolean,
  created_at timestamptz,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  reviewer_suffix text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if p_status is not null
    and p_status not in ('submitted', 'under_review', 'resolved', 'dismissed') then
    raise exception 'invalid moderation status' using errcode = '22023';
  end if;

  return query
  select
    report.id,
    report.moderation_status,
    report.reason_code,
    case
      when report.study_circle_message_id is not null then 'circle_message'
      when report.study_circle_id is not null then 'circle'
      when report.anonymous_message_id is not null then 'message'
      when report.conversation_id is not null then 'conversation'
      when report.introduction_request_id is not null then 'introduction'
      else 'other'
    end,
    right(report.subject_user_id::text, 8),
    report.details is not null and char_length(report.details) > 0,
    report.anonymous_message_id is not null
      or report.study_circle_message_id is not null,
    report.created_at,
    report.reviewed_at,
    report.resolved_at,
    case
      when report.reviewer_user_id is null then null
      else right(report.reviewer_user_id::text, 8)
    end
  from public.user_reports report
  where p_status is null or report.moderation_status = p_status
  order by
    case report.moderation_status
      when 'submitted' then 0
      when 'under_review' then 1
      when 'resolved' then 2
      when 'dismissed' then 3
      else 4
    end,
    report.created_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.get_moderation_report(
  p_report_id uuid
)
returns table (
  report_id uuid,
  moderation_status text,
  reason_code text,
  target_kind text,
  subject_suffix text,
  reporter_suffix text,
  details text,
  conversation_public_id text,
  referenced_message_excerpt text,
  internal_note text,
  created_at timestamptz,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  reviewer_suffix text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  report public.user_reports%rowtype;
  shell public.conversation_shells%rowtype;
  message_body text;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  select * into report
  from public.user_reports candidate
  where candidate.id = p_report_id;
  if report.id is null then
    raise exception 'report unavailable' using errcode = 'P0001';
  end if;
  if report.conversation_id is not null then
    select * into shell
    from public.conversation_shells candidate
    where candidate.id = report.conversation_id;
  end if;
  if report.study_circle_message_id is not null then
    message_body := report.study_circle_message_excerpt;
  elsif report.anonymous_message_id is not null then
    select left(message.body, 280) into message_body
    from public.anonymous_messages message
    where message.id = report.anonymous_message_id
      and (
        report.conversation_id is null
        or message.conversation_id = report.conversation_id
      );
  end if;

  return query select
    report.id,
    report.moderation_status,
    report.reason_code,
    case
      when report.study_circle_message_id is not null then 'circle_message'
      when report.study_circle_id is not null then 'circle'
      when report.anonymous_message_id is not null then 'message'
      when report.conversation_id is not null then 'conversation'
      when report.introduction_request_id is not null then 'introduction'
      else 'other'
    end,
    right(report.subject_user_id::text, 8),
    right(report.reporter_id::text, 8),
    report.details,
    shell.public_id,
    message_body,
    report.internal_note,
    report.created_at,
    report.reviewed_at,
    report.resolved_at,
    case
      when report.reviewer_user_id is null then null
      else right(report.reviewer_user_id::text, 8)
    end;
end;
$$;

revoke all on function public.list_moderation_reports(text, integer)
  from public, anon;
grant execute on function public.list_moderation_reports(text, integer)
  to authenticated;
revoke all on function public.get_moderation_report(uuid)
  from public, anon;
grant execute on function public.get_moderation_report(uuid)
  to authenticated;

comment on table public.study_circles is
  'Privacy-safe Study Circle v1. Public slug is routing only, never authorization.';
comment on table public.study_circle_memberships is
  'Private membership rows. Cross-user access is available only through a safe RPC projection.';
comment on table public.study_circle_messages is
  'Member-only plain-text group discussion. Distinct from private Anonymous Chat.';
