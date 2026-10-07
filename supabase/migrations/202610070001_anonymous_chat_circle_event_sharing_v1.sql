-- Anonymous chat Circle and Event sharing v1.
-- This migration is repository-ready but remains inactive until the approved
-- Supabase rollout. Existing text, sticker, reply, and reaction RPCs remain intact.

alter table public.anonymous_messages
  add column if not exists share_kind text,
  add column if not exists share_public_slug text,
  add column if not exists share_title text,
  add column if not exists share_description text,
  add column if not exists share_meta text,
  add column if not exists share_starts_at timestamptz,
  add column if not exists share_timezone_name text;

alter table public.anonymous_messages
  drop constraint if exists anonymous_messages_type_allowed;
alter table public.anonymous_messages
  add constraint anonymous_messages_type_allowed
  check (message_type in ('text', 'sticker', 'circle_invite', 'event_invite'));

alter table public.anonymous_messages
  drop constraint if exists anonymous_messages_sticker_shape;
alter table public.anonymous_messages
  add constraint anonymous_messages_sticker_shape
  check (
    (
      message_type = 'text'
      and sticker_id is null
      and share_kind is null
      and share_public_slug is null
      and share_title is null
      and share_description is null
      and share_meta is null
      and share_starts_at is null
      and share_timezone_name is null
    )
    or (
      message_type = 'sticker'
      and sticker_id in (
        'studydate_hello',
        'studydate_study',
        'studydate_chat',
        'studydate_ready'
      )
      and share_kind is null
      and share_public_slug is null
      and share_title is null
      and share_description is null
      and share_meta is null
      and share_starts_at is null
      and share_timezone_name is null
    )
    or (
      message_type = 'circle_invite'
      and sticker_id is null
      and share_kind = 'circle'
      and share_public_slug ~ '^circle-[0-9a-f]{24}$'
      and char_length(share_title) between 4 and 100
      and char_length(share_description) between 1 and 280
      and char_length(share_meta) between 1 and 120
      and share_starts_at is null
      and share_timezone_name is null
    )
    or (
      message_type = 'event_invite'
      and sticker_id is null
      and share_kind = 'event'
      and share_public_slug ~ '^event-[0-9a-f]{24}$'
      and char_length(share_title) between 5 and 120
      and char_length(share_description) between 1 and 280
      and char_length(share_meta) between 1 and 120
      and share_starts_at is not null
      and share_timezone_name in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')
    )
  );

comment on column public.anonymous_messages.share_kind is
  'Bounded internal share type. Never stores an external URL.';
comment on column public.anonymous_messages.share_public_slug is
  'Opaque StudyDate Circle or Event slug used to build an internal route.';
comment on column public.anonymous_messages.share_title is
  'Server-authored title snapshot for a durable invitation card.';
comment on column public.anonymous_messages.share_description is
  'Server-authored safe description, never copied from contact-bearing user input.';

create or replace function public.anonymous_chat_sharing_available()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null;
$$;

revoke all on function public.anonymous_chat_sharing_available()
  from public, anon, authenticated;
grant execute on function public.anonymous_chat_sharing_available()
  to authenticated;

create or replace function public.list_chat_shareables(p_public_id text)
returns table (
  share_kind text,
  public_slug text,
  title text,
  description text,
  meta text,
  starts_at timestamptz,
  timezone_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart uuid;
  counterpart_campus text;
begin
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
    and actor in (
      candidate.participant_sender_id,
      candidate.participant_recipient_id
    )
    and candidate.status in ('awaiting_chat', 'active')
  limit 1;

  if shell.id is null then return; end if;

  counterpart := public.conversation_counterpart_id(shell.id, actor);
  if not public.is_eligible_introduction_student(counterpart)
    or public.users_are_blocked(actor, counterpart) then
    return;
  end if;

  select profile.campus into counterpart_campus
  from public.profiles profile
  where profile.user_id = counterpart;

  return query
  select
    'circle'::text,
    circle.public_slug,
    circle.name,
    'Circle belajar yang bisa kalian ikuti bersama.'::text,
    circle.topic,
    null::timestamptz,
    null::text
  from public.study_circles circle
  join public.study_circle_memberships mine
    on mine.circle_id = circle.id
   and mine.user_id = actor
   and mine.status = 'active'
  where circle.status = 'active'
    and not public.introduction_message_has_contact(circle.name)
    and (circle.scope = 'open' or circle.campus_scope = counterpart_campus)
    and not public.users_are_blocked(counterpart, circle.owner_user_id)
    and not exists (
      select 1
      from public.study_circle_memberships already_member
      where already_member.circle_id = circle.id
        and already_member.user_id = counterpart
        and already_member.status = 'active'
    )
    and (
      select count(*)
      from public.study_circle_memberships active_member
      where active_member.circle_id = circle.id
        and active_member.status = 'active'
    ) < circle.member_limit
  order by circle.updated_at desc, circle.public_slug
  limit 8;

  return query
  select
    'event'::text,
    event.public_slug,
    event.title,
    'Acara kampus yang bisa kalian cek dan ikuti bersama.'::text,
    event.city,
    event.starts_at,
    event.timezone_name
  from public.campus_events event
  where event.status = 'scheduled'
    and event.starts_at > timezone('utc', now())
    and not public.introduction_message_has_contact(event.title)
    and (event.scope = 'open' or event.campus_scope = counterpart_campus)
    and not public.users_are_blocked(counterpart, event.organizer_user_id)
    and (
      event.organizer_user_id = actor
      or exists (
        select 1
        from public.campus_event_rsvps mine
        where mine.event_id = event.id
          and mine.user_id = actor
          and mine.status in ('going', 'pending', 'waitlisted')
      )
      or exists (
        select 1
        from public.event_team_members team
        where team.event_id = event.id
          and team.user_id = actor
          and team.status = 'active'
      )
    )
    and not exists (
      select 1
      from public.campus_event_rsvps already_registered
      where already_registered.event_id = event.id
        and already_registered.user_id = counterpart
        and already_registered.status in ('going', 'pending', 'waitlisted')
    )
  order by event.starts_at, event.public_slug
  limit 8;
end;
$$;

revoke all on function public.list_chat_shareables(text)
  from public, anon, authenticated;
grant execute on function public.list_chat_shareables(text)
  to authenticated;

create or replace function public.send_anonymous_share_v1(
  p_public_id text,
  p_share_kind text,
  p_share_public_slug text,
  p_reply_to_message_id uuid default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart uuid;
  counterpart_campus text;
  reply_target public.anonymous_messages%rowtype;
  existing public.anonymous_messages%rowtype;
  new_row public.anonymous_messages%rowtype;
  share_title_value text;
  share_description_value text;
  share_meta_value text;
  share_starts_at_value timestamptz;
  share_timezone_name_value text;
  fallback_body text;
  sent_last_minute integer;
  sent_last_day integer;
  recent_duplicate integer;
begin
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_share_kind not in ('circle', 'event') then
    raise exception 'invalid share' using errcode = '22023';
  end if;
  if (p_share_kind = 'circle' and p_share_public_slug !~ '^circle-[0-9a-f]{24}$')
    or (p_share_kind = 'event' and p_share_public_slug !~ '^event-[0-9a-f]{24}$') then
    raise exception 'invalid share' using errcode = '22023';
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
    or actor not in (
      shell.participant_sender_id,
      shell.participant_recipient_id
    ) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;
  if shell.status in ('ended', 'blocked') then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;
  if shell.status not in ('awaiting_chat', 'active') then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  counterpart := public.conversation_counterpart_id(shell.id, actor);
  if not public.is_eligible_introduction_student(counterpart)
    or public.users_are_blocked(actor, counterpart) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;
  select profile.campus into counterpart_campus
  from public.profiles profile
  where profile.user_id = counterpart;

  if p_reply_to_message_id is not null then
    select * into reply_target
    from public.anonymous_messages candidate
    where candidate.id = p_reply_to_message_id
      and candidate.conversation_id = shell.id
      and candidate.moderation_status = 'visible';
    if reply_target.id is null then
      raise exception 'reply unavailable' using errcode = 'P0001';
    end if;
  end if;

  if p_share_kind = 'circle' then
    select
      circle.name,
      'Circle belajar yang bisa kalian ikuti bersama.',
      circle.topic,
      null::timestamptz,
      null::text
    into
      share_title_value,
      share_description_value,
      share_meta_value,
      share_starts_at_value,
      share_timezone_name_value
    from public.study_circles circle
    join public.study_circle_memberships mine
      on mine.circle_id = circle.id
     and mine.user_id = actor
     and mine.status = 'active'
    where circle.public_slug = p_share_public_slug
      and circle.status = 'active'
      and not public.introduction_message_has_contact(circle.name)
      and (circle.scope = 'open' or circle.campus_scope = counterpart_campus)
      and not public.users_are_blocked(counterpart, circle.owner_user_id)
      and not exists (
        select 1
        from public.study_circle_memberships already_member
        where already_member.circle_id = circle.id
          and already_member.user_id = counterpart
          and already_member.status = 'active'
      )
      and (
        select count(*)
        from public.study_circle_memberships active_member
        where active_member.circle_id = circle.id
          and active_member.status = 'active'
      ) < circle.member_limit;
    fallback_body := 'Ajakan Circle belajar: ' || coalesce(share_title_value, '');
  else
    select
      event.title,
      'Acara kampus yang bisa kalian cek dan ikuti bersama.',
      event.city,
      event.starts_at,
      event.timezone_name
    into
      share_title_value,
      share_description_value,
      share_meta_value,
      share_starts_at_value,
      share_timezone_name_value
    from public.campus_events event
    where event.public_slug = p_share_public_slug
      and event.status = 'scheduled'
      and event.starts_at > timezone('utc', now())
      and not public.introduction_message_has_contact(event.title)
      and (event.scope = 'open' or event.campus_scope = counterpart_campus)
      and not public.users_are_blocked(counterpart, event.organizer_user_id)
      and (
        event.organizer_user_id = actor
        or exists (
          select 1
          from public.campus_event_rsvps mine
          where mine.event_id = event.id
            and mine.user_id = actor
            and mine.status in ('going', 'pending', 'waitlisted')
        )
        or exists (
          select 1
          from public.event_team_members team
          where team.event_id = event.id
            and team.user_id = actor
            and team.status = 'active'
        )
      )
      and not exists (
        select 1
        from public.campus_event_rsvps already_registered
        where already_registered.event_id = event.id
          and already_registered.user_id = counterpart
          and already_registered.status in ('going', 'pending', 'waitlisted')
      );
    fallback_body := 'Ajakan Acara kampus: ' || coalesce(share_title_value, '');
  end if;

  if share_title_value is null then
    raise exception 'share unavailable' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.anonymous_messages message
    where message.conversation_id = shell.id
      and message.sender_id = actor
      and message.client_idempotency_key = p_idempotency_key
    limit 1;

    if existing.id is not null then
      if existing.share_kind = p_share_kind
        and existing.share_public_slug = p_share_public_slug
        and existing.reply_to_message_id is not distinct from p_reply_to_message_id then
        return existing.id;
      end if;
      raise exception 'idempotency conflict' using errcode = 'P0001';
    end if;
  end if;

  select count(*) into sent_last_minute
  from public.anonymous_messages message
  where message.sender_id = actor
    and message.created_at > timezone('utc', now()) - interval '1 minute';
  if sent_last_minute >= 20 then
    raise exception 'chat rate limited' using errcode = 'P0001';
  end if;

  select count(*) into sent_last_day
  from public.anonymous_messages message
  where message.sender_id = actor
    and message.created_at > timezone('utc', now()) - interval '1 day';
  if sent_last_day >= 300 then
    raise exception 'chat rate limited' using errcode = 'P0001';
  end if;

  select count(*) into recent_duplicate
  from public.anonymous_messages message
  where message.conversation_id = shell.id
    and message.sender_id = actor
    and message.share_kind = p_share_kind
    and message.share_public_slug = p_share_public_slug
    and message.created_at > timezone('utc', now()) - interval '15 seconds';
  if recent_duplicate > 0 then
    raise exception 'duplicate message' using errcode = 'P0001';
  end if;

  if shell.status = 'awaiting_chat' then
    update public.conversation_shells
    set status = 'active',
        activated_at = timezone('utc', now())
    where id = shell.id;
    insert into public.conversation_events (
      conversation_id,
      actor_id,
      event_type
    ) values (shell.id, actor, 'activated');
  end if;

  insert into public.anonymous_messages (
    conversation_id,
    sender_id,
    body,
    message_type,
    sticker_id,
    reply_to_message_id,
    share_kind,
    share_public_slug,
    share_title,
    share_description,
    share_meta,
    share_starts_at,
    share_timezone_name,
    client_idempotency_key
  ) values (
    shell.id,
    actor,
    fallback_body,
    case p_share_kind
      when 'circle' then 'circle_invite'
      else 'event_invite'
    end,
    null,
    p_reply_to_message_id,
    p_share_kind,
    p_share_public_slug,
    share_title_value,
    share_description_value,
    share_meta_value,
    share_starts_at_value,
    share_timezone_name_value,
    nullif(p_idempotency_key, '')
  ) returning * into new_row;

  insert into public.conversation_events (
    conversation_id,
    actor_id,
    event_type
  ) values (shell.id, actor, 'message_sent');

  return new_row.id;
end;
$$;

revoke all on function public.send_anonymous_share_v1(
  text, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.send_anonymous_share_v1(
  text, text, text, uuid, text
) to authenticated;

create or replace function public.list_conversation_messages_v4(
  p_public_id text,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 40
)
returns table (
  message_id uuid,
  body text,
  message_type text,
  sticker_id text,
  share_kind text,
  share_public_slug text,
  share_title text,
  share_description text,
  share_meta text,
  share_starts_at timestamptz,
  share_timezone_name text,
  is_mine boolean,
  created_at timestamptz,
  read_at timestamptz,
  moderation_status text,
  reply_message_id uuid,
  reply_body text,
  reply_message_type text,
  reply_sticker_id text,
  reply_is_mine boolean,
  reactions jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  shell_id uuid;
  safe_limit integer := least(greatest(coalesce(p_limit, 40), 1), 50);
begin
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;
  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    return;
  end if;

  select shell.id into shell_id
  from public.conversation_shells shell
  where shell.public_id = p_public_id
    and actor in (
      shell.participant_sender_id,
      shell.participant_recipient_id
    )
  limit 1;
  if shell_id is null then return; end if;

  return query
  select
    message.id,
    message.body,
    message.message_type,
    message.sticker_id,
    case when message.moderation_status = 'visible' then message.share_kind end,
    case when message.moderation_status = 'visible' then message.share_public_slug end,
    case when message.moderation_status = 'visible' then message.share_title end,
    case when message.moderation_status = 'visible' then message.share_description end,
    case when message.moderation_status = 'visible' then message.share_meta end,
    case when message.moderation_status = 'visible' then message.share_starts_at end,
    case when message.moderation_status = 'visible' then message.share_timezone_name end,
    (message.sender_id = actor),
    message.created_at,
    message.read_at,
    message.moderation_status,
    reply.id,
    case
      when reply.id is null then null
      when reply.moderation_status = 'removed' then 'Pesan tidak tersedia.'
      else reply.body
    end,
    case
      when reply.id is null then null
      when reply.moderation_status = 'removed' then 'text'
      else reply.message_type
    end,
    case
      when reply.id is null or reply.moderation_status = 'removed' then null
      else reply.sticker_id
    end,
    coalesce(reply.sender_id = actor, false),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'reaction', grouped.reaction,
          'count', grouped.reaction_count,
          'reacted_by_me', grouped.reacted_by_me
        )
        order by grouped.reaction
      )
      from (
        select
          reaction.reaction,
          count(*)::integer as reaction_count,
          bool_or(reaction.user_id = actor) as reacted_by_me
        from public.anonymous_message_reactions reaction
        where reaction.message_id = message.id
        group by reaction.reaction
      ) grouped
    ), '[]'::jsonb)
  from public.anonymous_messages message
  left join public.anonymous_messages reply
    on reply.id = message.reply_to_message_id
   and reply.conversation_id = message.conversation_id
  where message.conversation_id = shell_id
    and (
      p_before_created_at is null
      or message.created_at < p_before_created_at
      or (
        message.created_at = p_before_created_at
        and p_before_id is not null
        and message.id < p_before_id
      )
    )
  order by message.created_at desc, message.id desc
  limit safe_limit;
end;
$$;

revoke all on function public.list_conversation_messages_v4(
  text, timestamptz, uuid, integer
) from public, anon, authenticated;
grant execute on function public.list_conversation_messages_v4(
  text, timestamptz, uuid, integer
) to authenticated;
