-- Fix PL/pgSQL ambiguity between local circle_id variables and table columns.
-- Forward-only replacement of the affected Study Circle RPCs.

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
  target_circle_id uuid;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select circle.id into target_circle_id
  from public.study_circles circle
  where circle.public_slug = p_public_slug;
  if target_circle_id is null
    or not public.is_active_study_circle_member(target_circle_id, actor) then
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
  where membership.circle_id = target_circle_id
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
  target_circle_id uuid;
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
  select circle.id into target_circle_id
  from public.study_circles circle
  where circle.public_slug = p_public_slug;
  if target_circle_id is null
    or not public.is_active_study_circle_member(target_circle_id, actor) then
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
  where message.circle_id = target_circle_id
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
  target_circle_id uuid;
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
  select circle.id into target_circle_id
  from public.study_circles circle
  where circle.public_slug = p_public_slug;
  if target_circle_id is null
    or not public.is_active_study_circle_member(target_circle_id, actor) then
    raise exception 'circle membership required' using errcode = '42501';
  end if;
  select profile.user_id into target_user_id
  from public.profiles profile
  join public.study_circle_memberships membership
    on membership.user_id = profile.user_id
   and membership.circle_id = target_circle_id
   and membership.status = 'active'
  where profile.public_alias = p_member_alias;
  if target_user_id is null or target_user_id = actor then
    raise exception 'circle member unavailable' using errcode = 'P0001';
  end if;

  if p_message_public_id is not null then
    select * into target_message
    from public.study_circle_messages message
    where message.public_id = p_message_public_id
      and message.circle_id = target_circle_id
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
    target_circle_id,
    target_message.id,
    case
      when target_message.id is null then null
      else left(target_message.body, 280)
    end,
    p_reason_code,
    normalized_details
  );
  insert into public.study_circle_events (
    circle_id, actor_user_id, event_type
  ) values (target_circle_id, actor, 'reported');
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
revoke all on function public.report_study_circle_member(
  text, text, text, text, text
) from public, anon;
grant execute on function public.report_study_circle_member(
  text, text, text, text, text
) to authenticated;
