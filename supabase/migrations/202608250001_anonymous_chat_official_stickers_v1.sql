-- StudyDate Anonymous Chat official stickers v1
-- Adds a bounded message type for first-party mascot stickers while preserving
-- plain-text body fallback for legacy clients, Telegram Companion v1, reports,
-- notifications, and existing conversation previews.

alter table public.anonymous_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists sticker_id text;

alter table public.anonymous_messages
  drop constraint if exists anonymous_messages_type_allowed;
alter table public.anonymous_messages
  add constraint anonymous_messages_type_allowed
  check (message_type in ('text', 'sticker'));

alter table public.anonymous_messages
  drop constraint if exists anonymous_messages_sticker_shape;
alter table public.anonymous_messages
  add constraint anonymous_messages_sticker_shape
  check (
    (message_type = 'text' and sticker_id is null)
    or
    (
      message_type = 'sticker'
      and sticker_id in (
        'studydate_hello',
        'studydate_study',
        'studydate_chat',
        'studydate_ready'
      )
    )
  );

comment on column public.anonymous_messages.message_type is
  'Bounded render type. v1 supports text and first-party StudyDate stickers only.';
comment on column public.anonymous_messages.sticker_id is
  'Allowlisted first-party sticker identifier; never a user-controlled URL or storage path.';

-- Keep the deployed v1 projection intact for older clients. New clients use
-- a versioned RPC so rollout does not require changing the return type of an
-- existing PostgreSQL function in place.
create or replace function public.list_conversation_messages_v2(
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
    and current_user_id in (
      shell.participant_sender_id,
      shell.participant_recipient_id
    )
  limit 1;

  if shell_id is null then
    return;
  end if;

  return query
  select
    msg.id,
    msg.body,
    msg.message_type,
    msg.sticker_id,
    (msg.sender_id = current_user_id) as is_mine,
    msg.created_at,
    msg.read_at,
    msg.moderation_status
  from public.anonymous_messages msg
  where msg.conversation_id = shell_id
    and (
      p_before_created_at is null
      or msg.created_at < p_before_created_at
      or (
        msg.created_at = p_before_created_at
        and p_before_id is not null
        and msg.id < p_before_id
      )
    )
  order by msg.created_at desc, msg.id desc
  limit safe_limit;
end;
$$;

revoke all on function public.list_conversation_messages_v2(
  text, timestamptz, uuid, integer
) from public, anon;
grant execute on function public.list_conversation_messages_v2(
  text, timestamptz, uuid, integer
) to authenticated;

create or replace function public.send_anonymous_sticker(
  p_public_id text,
  p_sticker_id text,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
  fallback_body text;
  existing public.anonymous_messages%rowtype;
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

  fallback_body := case p_sticker_id
    when 'studydate_hello' then 'Stiker StudyDate: Halo 👋'
    when 'studydate_study' then 'Stiker StudyDate: Semangat belajar 📚'
    when 'studydate_chat' then 'Stiker StudyDate: Yuk ngobrol 💬'
    when 'studydate_ready' then 'Stiker StudyDate: Siap ✨'
    else null
  end;

  if fallback_body is null then
    raise exception 'invalid sticker' using errcode = '22023';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  for update;

  if shell.id is null
    or current_user_id not in (
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
    select * into existing
    from public.anonymous_messages msg
    where msg.conversation_id = shell.id
      and msg.sender_id = current_user_id
      and msg.client_idempotency_key = p_idempotency_key
    limit 1;

    if existing.id is not null then
      if existing.message_type = 'sticker'
        and existing.sticker_id = p_sticker_id then
        return existing.id;
      end if;
      raise exception 'invalid idempotency key' using errcode = '22023';
    end if;
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
    and msg.message_type = 'sticker'
    and msg.sticker_id = p_sticker_id
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

    insert into public.conversation_events (
      conversation_id,
      actor_id,
      event_type
    ) values (shell.id, current_user_id, 'activated');
  end if;

  insert into public.anonymous_messages (
    conversation_id,
    sender_id,
    body,
    message_type,
    sticker_id,
    client_idempotency_key
  ) values (
    shell.id,
    current_user_id,
    fallback_body,
    'sticker',
    p_sticker_id,
    nullif(p_idempotency_key, '')
  ) returning * into new_row;

  insert into public.conversation_events (
    conversation_id,
    actor_id,
    event_type
  ) values (shell.id, current_user_id, 'message_sent');

  return new_row.id;
end;
$$;

revoke all on function public.send_anonymous_sticker(text, text, text)
  from public, anon;
grant execute on function public.send_anonymous_sticker(text, text, text)
  to authenticated;
