-- Anonymous Chat Realtime v1
-- Repository implementation. Remote rollout must be verified before this is called live.
-- Durable message rows and the existing authenticated polling route remain the source of truth.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_access_conversation_realtime_topic(
  p_topic text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_topic ~ '^conversation:[0-9a-f]{32}$'
    and exists (
      select 1
      from public.conversation_shells shell
      where p_topic = 'conversation:' || shell.public_id
        and (select auth.uid()) in (
          shell.participant_sender_id,
          shell.participant_recipient_id
        )
        and shell.status in ('awaiting_chat', 'active')
    );
$$;

revoke all on function private.can_access_conversation_realtime_topic(text)
  from public, anon;
grant execute on function private.can_access_conversation_realtime_topic(text)
  to authenticated;

comment on function private.can_access_conversation_realtime_topic(text) is
  'Authorizes only an authenticated participant for a private conversation Realtime topic.';

drop policy if exists "conversation participants receive private broadcasts"
  on realtime.messages;
create policy "conversation participants receive private broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and private.can_access_conversation_realtime_topic(
      (select realtime.topic())
    )
  );

drop policy if exists "conversation participants send private broadcasts"
  on realtime.messages;
create policy "conversation participants send private broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check (
    extension = 'broadcast'
    and private.can_access_conversation_realtime_topic(
      (select realtime.topic())
    )
  );

create or replace function private.broadcast_anonymous_message_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_topic text;
begin
  select 'conversation:' || shell.public_id
  into target_topic
  from public.conversation_shells shell
  where shell.id = new.conversation_id
    and shell.status in ('awaiting_chat', 'active');

  if target_topic is null then
    return new;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object(
        'message_id', new.id,
        'change', 'created'
      ),
      'message_changed',
      target_topic,
      true
    );
  exception
    when others then
      -- Realtime accelerates delivery only. It must never block a durable message.
      null;
  end;

  return new;
end;
$$;

revoke all on function private.broadcast_anonymous_message_change()
  from public, anon, authenticated;

drop trigger if exists anonymous_messages_broadcast_realtime_v1
  on public.anonymous_messages;
create trigger anonymous_messages_broadcast_realtime_v1
after insert on public.anonymous_messages
for each row execute function private.broadcast_anonymous_message_change();

comment on function private.broadcast_anonymous_message_change() is
  'Sends a content-free private signal so authorized clients refetch the safe RPC projection.';
