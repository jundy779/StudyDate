-- Forward-only fix for the deployed Telegram delivery claim.
-- Migration 202608110001 is already applied and must remain immutable.

create or replace function public.claim_telegram_delivery()
returns table (
  outbox_id uuid,
  lease_token uuid,
  route_ciphertext bytea,
  route_iv bytea,
  route_auth_tag bytea,
  encryption_key_version smallint,
  message_body text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_outbox public.telegram_delivery_outbox%rowtype;
  target_binding public.telegram_account_bindings%rowtype;
  target_relay public.telegram_conversation_relays%rowtype;
  target_message public.anonymous_messages%rowtype;
  new_lease uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select outbox.*
  into target_outbox
  from public.telegram_delivery_outbox as outbox
  where (
      outbox.status in ('pending', 'failed')
      or (
        outbox.status = 'processing'
        and outbox.lease_expires_at < timezone('utc', now())
      )
    )
    and outbox.available_at <= timezone('utc', now())
    and outbox.attempt_count < 5
  order by outbox.available_at, outbox.created_at
  for update of outbox skip locked
  limit 1;

  if target_outbox.id is null then return; end if;

  select candidate.*
  into target_relay
  from public.telegram_conversation_relays as candidate
  where candidate.user_id = target_outbox.recipient_user_id
    and candidate.conversation_id = target_outbox.conversation_id
    and candidate.revoked_at is null;

  select candidate.*
  into target_binding
  from public.telegram_account_bindings as candidate
  where candidate.id = target_relay.binding_id
    and candidate.user_id = target_outbox.recipient_user_id
    and candidate.revoked_at is null;

  select candidate.*
  into target_message
  from public.anonymous_messages as candidate
  where candidate.id = target_outbox.anonymous_message_id
    and candidate.moderation_status = 'visible';

  if target_relay.user_id is null
    or target_binding.id is null
    or target_message.id is null
    or not public.is_telegram_conversation_eligible(
      target_outbox.recipient_user_id,
      target_outbox.conversation_id
    ) then
    update public.telegram_delivery_outbox as outbox
    set status = 'cancelled',
        failure_code = 'relay_unavailable',
        lease_token = null,
        lease_expires_at = null,
        updated_at = timezone('utc', now())
    where outbox.id = target_outbox.id;
    return;
  end if;

  update public.telegram_delivery_outbox as outbox
  set status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      lease_token = new_lease,
      lease_expires_at = timezone('utc', now()) + interval '2 minutes',
      failure_code = null,
      updated_at = timezone('utc', now())
  where outbox.id = target_outbox.id;

  return query select
    target_outbox.id,
    new_lease,
    target_binding.route_ciphertext,
    target_binding.route_iv,
    target_binding.route_auth_tag,
    target_binding.encryption_key_version,
    target_message.body,
    target_outbox.attempt_count + 1;
end;
$$;

revoke all on function public.claim_telegram_delivery()
  from public, anon, authenticated;
grant execute on function public.claim_telegram_delivery()
  to service_role;
