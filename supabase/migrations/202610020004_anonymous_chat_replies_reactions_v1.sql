-- Anonymous Chat replies and reactions v1
-- Repository implementation. Remote rollout must be verified before this is called live.
-- Existing chat RPCs stay intact so text, stickers, Telegram, and polling keep working.

alter table public.anonymous_messages
  add column if not exists reply_to_message_id uuid
    references public.anonymous_messages (id) on delete set null;

alter table public.anonymous_messages
  drop constraint if exists anonymous_messages_reply_not_self;
alter table public.anonymous_messages
  add constraint anonymous_messages_reply_not_self
  check (reply_to_message_id is null or reply_to_message_id <> id);

create index if not exists anonymous_messages_reply_idx
  on public.anonymous_messages (reply_to_message_id)
  where reply_to_message_id is not null;

comment on column public.anonymous_messages.reply_to_message_id is
  'Optional reply target. Versioned send RPCs enforce same-conversation membership.';

create table if not exists public.anonymous_message_reactions (
  message_id uuid not null
    references public.anonymous_messages (id) on delete cascade,
  user_id uuid not null
    references auth.users (id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (message_id, user_id),
  constraint anonymous_message_reactions_allowed
    check (reaction in ('like', 'love', 'laugh', 'support', 'celebrate'))
);

alter table public.anonymous_message_reactions enable row level security;
revoke all on table public.anonymous_message_reactions
  from public, anon, authenticated;

comment on table public.anonymous_message_reactions is
  'One bounded reaction per participant and message. Access is RPC-only.';

create or replace function public.anonymous_chat_interactions_available()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()) is not null;
$$;

revoke all on function public.anonymous_chat_interactions_available()
  from public, anon, authenticated;
grant execute on function public.anonymous_chat_interactions_available()
  to authenticated;

create or replace function public.send_anonymous_message_v2(
  p_public_id text,
  p_body text,
  p_reply_to_message_id uuid default null,
  p_idempotency_key text default null
)
returns table (
  message_id uuid,
  body text,
  is_mine boolean,
  created_at timestamptz,
  read_at timestamptz,
  moderation_status text,
  conversation_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  reply_target public.anonymous_messages%rowtype;
  existing public.anonymous_messages%rowtype;
  sent record;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
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

  if shell.id is null then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

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

  if p_idempotency_key is not null then
    select * into existing
    from public.anonymous_messages candidate
    where candidate.conversation_id = shell.id
      and candidate.sender_id = actor
      and candidate.client_idempotency_key = p_idempotency_key
    limit 1;

    if existing.id is not null then
      if existing.reply_to_message_id is distinct from p_reply_to_message_id then
        raise exception 'idempotency conflict' using errcode = 'P0001';
      end if;
      return query
      select
        existing.id,
        existing.body,
        true,
        existing.created_at,
        existing.read_at,
        existing.moderation_status,
        shell.status;
      return;
    end if;
  end if;

  select * into sent
  from public.send_anonymous_message(
    p_public_id,
    p_body,
    p_idempotency_key
  );

  if p_reply_to_message_id is not null then
    update public.anonymous_messages message
    set reply_to_message_id = p_reply_to_message_id
    where message.id = sent.message_id
      and message.conversation_id = shell.id
      and message.sender_id = actor;
  end if;

  return query
  select
    sent.message_id,
    sent.body,
    sent.is_mine,
    sent.created_at,
    sent.read_at,
    sent.moderation_status,
    sent.conversation_status;
end;
$$;

revoke all on function public.send_anonymous_message_v2(
  text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.send_anonymous_message_v2(
  text, text, uuid, text
) to authenticated;

create or replace function public.send_anonymous_sticker_v2(
  p_public_id text,
  p_sticker_id text,
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
  reply_target public.anonymous_messages%rowtype;
  existing public.anonymous_messages%rowtype;
  sent_id uuid;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
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

  if shell.id is null then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

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

  if p_idempotency_key is not null then
    select * into existing
    from public.anonymous_messages candidate
    where candidate.conversation_id = shell.id
      and candidate.sender_id = actor
      and candidate.client_idempotency_key = p_idempotency_key
    limit 1;

    if existing.id is not null then
      if existing.reply_to_message_id is distinct from p_reply_to_message_id then
        raise exception 'idempotency conflict' using errcode = 'P0001';
      end if;
      return existing.id;
    end if;
  end if;

  sent_id := public.send_anonymous_sticker(
    p_public_id,
    p_sticker_id,
    p_idempotency_key
  );

  if p_reply_to_message_id is not null then
    update public.anonymous_messages message
    set reply_to_message_id = p_reply_to_message_id
    where message.id = sent_id
      and message.conversation_id = shell.id
      and message.sender_id = actor;
  end if;

  return sent_id;
end;
$$;

revoke all on function public.send_anonymous_sticker_v2(
  text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.send_anonymous_sticker_v2(
  text, text, uuid, text
) to authenticated;

create or replace function public.toggle_anonymous_message_reaction(
  p_public_id text,
  p_message_id uuid,
  p_reaction text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  target public.anonymous_messages%rowtype;
  current_reaction text;
  normalized_reaction text := nullif(lower(btrim(coalesce(p_reaction, ''))), '');
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'active student required' using errcode = '42501';
  end if;
  if normalized_reaction is not null
    and normalized_reaction not in (
      'like', 'love', 'laugh', 'support', 'celebrate'
    ) then
    raise exception 'invalid reaction' using errcode = '22023';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
    and actor in (
      candidate.participant_sender_id,
      candidate.participant_recipient_id
    )
    and candidate.status = 'active'
  limit 1;

  if shell.id is null
    or public.users_are_blocked(
      actor,
      public.conversation_counterpart_id(shell.id, actor)
    ) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  select * into target
  from public.anonymous_messages candidate
  where candidate.id = p_message_id
    and candidate.conversation_id = shell.id
    and candidate.moderation_status = 'visible';

  if target.id is null then
    raise exception 'message unavailable' using errcode = 'P0001';
  end if;

  select reaction into current_reaction
  from public.anonymous_message_reactions existing
  where existing.message_id = target.id
    and existing.user_id = actor
  for update;

  if normalized_reaction is null or current_reaction = normalized_reaction then
    delete from public.anonymous_message_reactions existing
    where existing.message_id = target.id
      and existing.user_id = actor;
    return null;
  end if;

  insert into public.anonymous_message_reactions (
    message_id,
    user_id,
    reaction
  ) values (
    target.id,
    actor,
    normalized_reaction
  )
  on conflict (message_id, user_id)
  do update set
    reaction = excluded.reaction,
    updated_at = timezone('utc', now());

  return normalized_reaction;
end;
$$;

revoke all on function public.toggle_anonymous_message_reaction(
  text, uuid, text
) from public, anon, authenticated;
grant execute on function public.toggle_anonymous_message_reaction(
  text, uuid, text
) to authenticated;

create or replace function public.list_conversation_messages_v3(
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
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
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

  if shell_id is null then
    return;
  end if;

  return query
  select
    message.id,
    message.body,
    message.message_type,
    message.sticker_id,
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

revoke all on function public.list_conversation_messages_v3(
  text, timestamptz, uuid, integer
) from public, anon, authenticated;
grant execute on function public.list_conversation_messages_v3(
  text, timestamptz, uuid, integer
) to authenticated;

create or replace function private.broadcast_anonymous_message_reaction_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_message_id uuid := coalesce(new.message_id, old.message_id);
  target_topic text;
begin
  select 'conversation:' || shell.public_id
  into target_topic
  from public.anonymous_messages message
  join public.conversation_shells shell
    on shell.id = message.conversation_id
  where message.id = target_message_id
    and shell.status in ('awaiting_chat', 'active');

  if target_topic is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object(
        'message_id', target_message_id,
        'change', 'reactions'
      ),
      'message_changed',
      target_topic,
      true
    );
  exception
    when others then
      null;
  end;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.broadcast_anonymous_message_reaction_change()
  from public, anon, authenticated;

drop trigger if exists anonymous_message_reactions_broadcast_realtime_v1
  on public.anonymous_message_reactions;
create trigger anonymous_message_reactions_broadcast_realtime_v1
after insert or update or delete on public.anonymous_message_reactions
for each row execute function private.broadcast_anonymous_message_reaction_change();
