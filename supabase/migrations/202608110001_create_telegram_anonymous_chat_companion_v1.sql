-- Telegram Anonymous Chat Companion v1
-- LOCAL-ONLY. Do not apply remotely until the rollout worker is configured.
-- Telegram is a private transport for an existing Anonymous Chat conversation.

-- ---------------------------------------------------------------------------
-- 1. Private storage
-- ---------------------------------------------------------------------------

create table public.telegram_link_sessions (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique
    default encode(extensions.gen_random_bytes(16), 'hex'),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null
    references public.conversation_shells (id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'created',
  pending_identity_fingerprint text null,
  pending_route_ciphertext bytea null,
  pending_route_iv bytea null,
  pending_route_auth_tag bytea null,
  pending_key_version smallint null,
  expires_at timestamptz not null,
  telegram_received_at timestamptz null,
  confirmed_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint telegram_link_sessions_public_id_format
    check (public_id ~ '^[0-9a-f]{32}$'),
  constraint telegram_link_sessions_token_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint telegram_link_sessions_status_allowed
    check (status in (
      'created', 'telegram_pending', 'confirmed', 'expired', 'revoked'
    )),
  constraint telegram_link_sessions_expiry_order
    check (expires_at > created_at and expires_at <= created_at + interval '15 minutes'),
  constraint telegram_link_sessions_pending_crypto_complete
    check (
      (
        pending_identity_fingerprint is null
        and pending_route_ciphertext is null
        and pending_route_iv is null
        and pending_route_auth_tag is null
        and pending_key_version is null
      )
      or (
        pending_identity_fingerprint ~ '^[0-9a-f]{64}$'
        and octet_length(pending_route_ciphertext) between 1 and 64
        and octet_length(pending_route_iv) = 12
        and octet_length(pending_route_auth_tag) = 16
        and pending_key_version between 1 and 32767
      )
    )
);

create index telegram_link_sessions_user_status_idx
  on public.telegram_link_sessions (user_id, status, created_at desc);
create index telegram_link_sessions_expiry_idx
  on public.telegram_link_sessions (expires_at)
  where status in ('created', 'telegram_pending');

create table public.telegram_account_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  identity_fingerprint text null,
  route_ciphertext bytea null,
  route_iv bytea null,
  route_auth_tag bytea null,
  encryption_key_version smallint null,
  linked_at timestamptz null,
  revoked_at timestamptz null,
  last_delivery_state text null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint telegram_account_bindings_fingerprint_format
    check (
      identity_fingerprint is null
      or identity_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  constraint telegram_account_bindings_crypto_complete
    check (
      (
        identity_fingerprint is null
        and route_ciphertext is null
        and route_iv is null
        and route_auth_tag is null
        and encryption_key_version is null
      )
      or (
        identity_fingerprint ~ '^[0-9a-f]{64}$'
        and octet_length(route_ciphertext) between 1 and 64
        and octet_length(route_iv) = 12
        and octet_length(route_auth_tag) = 16
        and encryption_key_version between 1 and 32767
      )
    ),
  constraint telegram_account_bindings_delivery_state_allowed
    check (
      last_delivery_state is null
      or last_delivery_state in ('delivered', 'retrying', 'unavailable')
    )
);

create unique index telegram_account_bindings_identity_uidx
  on public.telegram_account_bindings (identity_fingerprint)
  where identity_fingerprint is not null and revoked_at is null;

create table public.telegram_conversation_relays (
  user_id uuid primary key references auth.users (id) on delete cascade,
  binding_id uuid not null references public.telegram_account_bindings (id)
    on delete cascade,
  conversation_id uuid not null references public.conversation_shells (id)
    on delete cascade,
  activated_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz null,
  revoke_reason text null,
  constraint telegram_conversation_relays_revoke_reason_allowed
    check (
      revoke_reason is null
      or revoke_reason in (
        'switched', 'unlinked', 'lifecycle', 'deletion', 'binding_replaced'
      )
    )
);

create index telegram_conversation_relays_conversation_idx
  on public.telegram_conversation_relays (conversation_id)
  where revoked_at is null;

create table public.telegram_update_receipts (
  update_id bigint primary key,
  outcome text not null,
  received_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz not null default timezone('utc', now()),
  constraint telegram_update_receipts_id_nonnegative check (update_id >= 0),
  constraint telegram_update_receipts_outcome_allowed check (
    outcome in (
      'link_pending', 'message_created', 'unlinked', 'help', 'unsupported',
      'private_chat_required', 'unavailable', 'invalid', 'duplicate'
    )
  )
);

create index telegram_update_receipts_retention_idx
  on public.telegram_update_receipts (completed_at);

create table public.telegram_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  anonymous_message_id uuid not null unique
    references public.anonymous_messages (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversation_shells (id)
    on delete cascade,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default timezone('utc', now()),
  lease_token uuid null,
  lease_expires_at timestamptz null,
  telegram_message_id bigint null,
  delivered_at timestamptz null,
  failure_code text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint telegram_delivery_outbox_status_allowed
    check (status in ('pending', 'processing', 'delivered', 'failed', 'cancelled')),
  constraint telegram_delivery_outbox_attempt_nonnegative check (attempt_count >= 0),
  constraint telegram_delivery_outbox_failure_code_allowed check (
    failure_code is null
    or failure_code in (
      'rate_limited', 'telegram_unavailable', 'delivery_rejected',
      'delivery_uncertain', 'relay_unavailable'
    )
  ),
  constraint telegram_delivery_outbox_telegram_message_id_positive
    check (telegram_message_id is null or telegram_message_id > 0)
);

create index telegram_delivery_outbox_claim_idx
  on public.telegram_delivery_outbox (available_at, created_at)
  where status in ('pending', 'processing', 'failed');

create table public.telegram_companion_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  primary key (user_id, action, window_start),
  constraint telegram_companion_rate_limits_action_allowed check (
    action in ('link_create', 'confirm', 'unlink')
  ),
  constraint telegram_companion_rate_limits_hit_nonnegative check (hit_count >= 0)
);

create index telegram_companion_rate_limits_retention_idx
  on public.telegram_companion_rate_limits (window_start);

create table public.telegram_companion_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users (id) on delete cascade,
  event_type text not null,
  failure_category text null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint telegram_companion_audit_event_type_allowed check (
    event_type in (
      'link_session_created', 'telegram_pending', 'binding_confirmed',
      'relay_switched', 'unlinked', 'delivery_failure',
      'revoked_by_lifecycle', 'revoked_by_deletion'
    )
  ),
  constraint telegram_companion_audit_failure_allowed check (
    failure_category is null
    or failure_category in (
      'rate_limited', 'telegram_unavailable', 'delivery_rejected',
      'delivery_uncertain', 'relay_unavailable'
    )
  )
);

create index telegram_companion_audit_retention_idx
  on public.telegram_companion_audit_events (created_at);

comment on table public.telegram_link_sessions is
  'Private short-lived two-step Telegram link sessions. Stores HMAC token hash only.';
comment on table public.telegram_account_bindings is
  'Private Telegram routing binding. No username, name, photo, language, or raw identifier.';
comment on table public.telegram_delivery_outbox is
  'Durable delivery references. Message text remains in anonymous_messages only.';
comment on table public.telegram_companion_audit_events is
  'Sanitized lifecycle categories only; no token, routing identifier, message body, or contact.';

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'telegram_link_sessions',
    'telegram_account_bindings',
    'telegram_conversation_relays',
    'telegram_update_receipts',
    'telegram_delivery_outbox',
    'telegram_companion_rate_limits',
    'telegram_companion_audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      target_table
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Eligibility and bounded rate limits
-- ---------------------------------------------------------------------------

create or replace function public.is_telegram_conversation_eligible(
  p_user_id uuid,
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_shells shell
    where shell.id = p_conversation_id
      and p_user_id in (
        shell.participant_sender_id, shell.participant_recipient_id
      )
      and shell.status = 'active'
      and public.is_eligible_introduction_student(p_user_id)
      and public.is_eligible_introduction_student(
        public.conversation_counterpart_id(shell.id, p_user_id)
      )
      and not public.users_are_blocked(
        p_user_id,
        public.conversation_counterpart_id(shell.id, p_user_id)
      )
  );
$$;

revoke all on function public.is_telegram_conversation_eligible(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.consume_telegram_companion_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_window timestamptz;
  next_count integer;
begin
  if p_user_id is null
    or p_action not in ('link_create', 'confirm', 'unlink')
    or p_limit not between 1 and 100
    or p_window_seconds not between 60 and 86400 then
    return false;
  end if;

  target_window := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / p_window_seconds)
      * p_window_seconds
  );

  insert into public.telegram_companion_rate_limits (
    user_id, action, window_start, hit_count
  )
  values (p_user_id, p_action, target_window, 1)
  on conflict (user_id, action, window_start)
  do update set hit_count =
    public.telegram_companion_rate_limits.hit_count + 1
  where public.telegram_companion_rate_limits.hit_count < p_limit
  returning hit_count into next_count;

  return next_count is not null;
end;
$$;

revoke all on function public.consume_telegram_companion_rate_limit(
  uuid, text, integer, integer
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Safe student operations
-- ---------------------------------------------------------------------------

create or replace function public.get_my_telegram_companion_state(
  p_public_id text default null
)
returns table (
  state text,
  link_session_public_id text,
  expires_at timestamptz,
  connected boolean,
  active_on_this_conversation boolean,
  active_on_another_conversation boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_conversation_id uuid;
  latest_session public.telegram_link_sessions%rowtype;
  active_relay public.telegram_conversation_relays%rowtype;
  active_binding boolean := false;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_eligible_introduction_student(actor) then
    raise exception 'student account required' using errcode = '42501';
  end if;

  if p_public_id is not null then
    select shell.id into target_conversation_id
    from public.conversation_shells shell
    where shell.public_id = p_public_id
      and actor in (
        shell.participant_sender_id, shell.participant_recipient_id
      );
  end if;

  update public.telegram_link_sessions session
  set
    status = 'expired',
    pending_identity_fingerprint = null,
    pending_route_ciphertext = null,
    pending_route_iv = null,
    pending_route_auth_tag = null,
    pending_key_version = null
  where session.user_id = actor
    and session.status in ('created', 'telegram_pending')
    and session.expires_at <= timezone('utc', now());

  select exists (
    select 1
    from public.telegram_account_bindings binding
    where binding.user_id = actor
      and binding.revoked_at is null
      and binding.identity_fingerprint is not null
  ) into active_binding;

  select * into active_relay
  from public.telegram_conversation_relays relay
  where relay.user_id = actor and relay.revoked_at is null;

  if target_conversation_id is not null then
    select * into latest_session
    from public.telegram_link_sessions session
    where session.user_id = actor
      and session.conversation_id = target_conversation_id
      and session.status in ('created', 'telegram_pending')
      and session.expires_at > timezone('utc', now())
    order by session.created_at desc
    limit 1;
  end if;

  return query select
    case
      when active_binding
        and active_relay.conversation_id = target_conversation_id
        then 'connected'
      when active_binding and target_conversation_id is null
        then 'connected'
      when active_binding and active_relay.conversation_id is distinct from target_conversation_id
        then 'switch_required'
      when latest_session.status = 'telegram_pending'
        then 'telegram_pending'
      when latest_session.status = 'created'
        then 'link_created'
      else 'not_connected'
    end,
    latest_session.public_id,
    latest_session.expires_at,
    active_binding,
    (
      active_binding
      and target_conversation_id is not null
      and active_relay.conversation_id = target_conversation_id
    ),
    (
      active_binding
      and target_conversation_id is not null
      and active_relay.conversation_id is distinct from target_conversation_id
    );
end;
$$;

revoke all on function public.get_my_telegram_companion_state(text)
  from public, anon, authenticated;
grant execute on function public.get_my_telegram_companion_state(text)
  to authenticated;

create or replace function public.create_my_telegram_link_session(
  p_public_id text,
  p_token_hash text,
  p_ttl_seconds integer default 600
)
returns table (
  link_session_public_id text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_conversation_id uuid;
  created_session public.telegram_link_sessions%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_ttl_seconds not between 300 and 900 then
    raise exception 'invalid link session' using errcode = '22023';
  end if;

  select shell.id into target_conversation_id
  from public.conversation_shells shell
  where shell.public_id = p_public_id
    and actor in (
      shell.participant_sender_id, shell.participant_recipient_id
    )
  for update;

  if target_conversation_id is null
    or not public.is_telegram_conversation_eligible(
      actor, target_conversation_id
    ) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;
  if not public.consume_telegram_companion_rate_limit(
    actor, 'link_create', 5, 3600
  ) then
    raise exception 'link rate limited' using errcode = 'P0001';
  end if;

  update public.telegram_link_sessions session
  set
    status = 'revoked',
    revoked_at = timezone('utc', now()),
    pending_identity_fingerprint = null,
    pending_route_ciphertext = null,
    pending_route_iv = null,
    pending_route_auth_tag = null,
    pending_key_version = null
  where session.user_id = actor
    and session.status in ('created', 'telegram_pending');

  insert into public.telegram_link_sessions (
    user_id, conversation_id, token_hash, expires_at
  )
  values (
    actor,
    target_conversation_id,
    p_token_hash,
    timezone('utc', now()) + make_interval(secs => p_ttl_seconds)
  )
  returning * into created_session;

  insert into public.telegram_companion_audit_events (user_id, event_type)
  values (actor, 'link_session_created');

  return query
  select created_session.public_id, created_session.expires_at;
end;
$$;

revoke all on function public.create_my_telegram_link_session(
  text, text, integer
) from public, anon, authenticated;
grant execute on function public.create_my_telegram_link_session(
  text, text, integer
) to authenticated;

create or replace function public.cancel_my_telegram_link_session(
  p_link_session_public_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  update public.telegram_link_sessions session
  set
    status = 'revoked',
    revoked_at = timezone('utc', now()),
    pending_identity_fingerprint = null,
    pending_route_ciphertext = null,
    pending_route_iv = null,
    pending_route_auth_tag = null,
    pending_key_version = null
  where session.user_id = actor
    and session.public_id = p_link_session_public_id
    and session.status in ('created', 'telegram_pending');
end;
$$;

revoke all on function public.cancel_my_telegram_link_session(text)
  from public, anon, authenticated;
grant execute on function public.cancel_my_telegram_link_session(text)
  to authenticated;

create or replace function public.confirm_my_telegram_binding(
  p_link_session_public_id text,
  p_confirm_switch boolean default false
)
returns table (
  state text,
  switched boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_session public.telegram_link_sessions%rowtype;
  existing_binding public.telegram_account_bindings%rowtype;
  conflicting_user uuid;
  active_relay public.telegram_conversation_relays%rowtype;
  did_switch boolean := false;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.consume_telegram_companion_rate_limit(
    actor, 'confirm', 10, 3600
  ) then
    raise exception 'confirmation rate limited' using errcode = 'P0001';
  end if;

  select * into target_session
  from public.telegram_link_sessions session
  where session.public_id = p_link_session_public_id
    and session.user_id = actor
  for update;

  if target_session.id is null
    or target_session.status <> 'telegram_pending'
    or target_session.expires_at <= timezone('utc', now())
    or target_session.pending_identity_fingerprint is null then
    raise exception 'link session unavailable' using errcode = 'P0001';
  end if;
  if not public.is_telegram_conversation_eligible(
    actor, target_session.conversation_id
  ) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  select binding.user_id into conflicting_user
  from public.telegram_account_bindings binding
  where binding.identity_fingerprint =
      target_session.pending_identity_fingerprint
    and binding.revoked_at is null
    and binding.user_id <> actor
  for update;

  if conflicting_user is not null then
    raise exception 'telegram account unavailable' using errcode = 'P0001';
  end if;

  select * into existing_binding
  from public.telegram_account_bindings binding
  where binding.user_id = actor
  for update;

  if existing_binding.id is not null
    and existing_binding.revoked_at is null
    and existing_binding.identity_fingerprint is distinct from
      target_session.pending_identity_fingerprint then
    raise exception 'unlink existing telegram account first' using errcode = 'P0001';
  end if;

  select * into active_relay
  from public.telegram_conversation_relays relay
  where relay.user_id = actor
  for update;

  did_switch := active_relay.revoked_at is null
    and active_relay.conversation_id is distinct from
      target_session.conversation_id;

  if did_switch and not coalesce(p_confirm_switch, false) then
    return query select 'switch_required'::text, false;
    return;
  end if;

  insert into public.telegram_account_bindings (
    user_id,
    identity_fingerprint,
    route_ciphertext,
    route_iv,
    route_auth_tag,
    encryption_key_version,
    linked_at,
    revoked_at,
    last_delivery_state,
    updated_at
  )
  values (
    actor,
    target_session.pending_identity_fingerprint,
    target_session.pending_route_ciphertext,
    target_session.pending_route_iv,
    target_session.pending_route_auth_tag,
    target_session.pending_key_version,
    timezone('utc', now()),
    null,
    null,
    timezone('utc', now())
  )
  on conflict (user_id) do update set
    identity_fingerprint = excluded.identity_fingerprint,
    route_ciphertext = excluded.route_ciphertext,
    route_iv = excluded.route_iv,
    route_auth_tag = excluded.route_auth_tag,
    encryption_key_version = excluded.encryption_key_version,
    linked_at = timezone('utc', now()),
    revoked_at = null,
    last_delivery_state = null,
    updated_at = timezone('utc', now())
  returning * into existing_binding;

  insert into public.telegram_conversation_relays (
    user_id, binding_id, conversation_id, activated_at, revoked_at, revoke_reason
  )
  values (
    actor,
    existing_binding.id,
    target_session.conversation_id,
    timezone('utc', now()),
    null,
    null
  )
  on conflict (user_id) do update set
    binding_id = excluded.binding_id,
    conversation_id = excluded.conversation_id,
    activated_at = timezone('utc', now()),
    revoked_at = null,
    revoke_reason = null;

  update public.telegram_link_sessions session
  set
    status = 'confirmed',
    confirmed_at = timezone('utc', now()),
    pending_identity_fingerprint = null,
    pending_route_ciphertext = null,
    pending_route_iv = null,
    pending_route_auth_tag = null,
    pending_key_version = null
  where session.id = target_session.id;

  update public.telegram_link_sessions session
  set
    status = 'revoked',
    revoked_at = timezone('utc', now()),
    pending_identity_fingerprint = null,
    pending_route_ciphertext = null,
    pending_route_iv = null,
    pending_route_auth_tag = null,
    pending_key_version = null
  where session.user_id = actor
    and session.id <> target_session.id
    and session.status in ('created', 'telegram_pending');

  insert into public.telegram_companion_audit_events (user_id, event_type)
  values (
    actor,
    case when did_switch then 'relay_switched' else 'binding_confirmed' end
  );

  return query select 'connected'::text, did_switch;
end;
$$;

revoke all on function public.confirm_my_telegram_binding(text, boolean)
  from public, anon, authenticated;
grant execute on function public.confirm_my_telegram_binding(text, boolean)
  to authenticated;

create or replace function public.switch_my_telegram_relay(p_public_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_conversation_id uuid;
  binding public.telegram_account_bindings%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.consume_telegram_companion_rate_limit(
    actor, 'confirm', 10, 3600
  ) then
    raise exception 'switch rate limited' using errcode = 'P0001';
  end if;

  select shell.id into target_conversation_id
  from public.conversation_shells shell
  where shell.public_id = p_public_id
    and actor in (
      shell.participant_sender_id, shell.participant_recipient_id
    )
  for update;
  if target_conversation_id is null
    or not public.is_telegram_conversation_eligible(
      actor, target_conversation_id
    ) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  select * into binding
  from public.telegram_account_bindings candidate
  where candidate.user_id = actor
    and candidate.revoked_at is null
    and candidate.identity_fingerprint is not null
  for update;
  if binding.id is null then
    raise exception 'telegram binding unavailable' using errcode = 'P0001';
  end if;

  insert into public.telegram_conversation_relays (
    user_id, binding_id, conversation_id, activated_at, revoked_at, revoke_reason
  )
  values (
    actor, binding.id, target_conversation_id,
    timezone('utc', now()), null, null
  )
  on conflict (user_id) do update set
    binding_id = excluded.binding_id,
    conversation_id = excluded.conversation_id,
    activated_at = timezone('utc', now()),
    revoked_at = null,
    revoke_reason = null;

  insert into public.telegram_companion_audit_events (user_id, event_type)
  values (actor, 'relay_switched');
end;
$$;

revoke all on function public.switch_my_telegram_relay(text)
  from public, anon, authenticated;
grant execute on function public.switch_my_telegram_relay(text)
  to authenticated;

create or replace function public.unlink_my_telegram_companion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  changed boolean := false;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.consume_telegram_companion_rate_limit(
    actor, 'unlink', 10, 3600
  ) then
    raise exception 'unlink rate limited' using errcode = 'P0001';
  end if;

  update public.telegram_conversation_relays relay
  set revoked_at = coalesce(revoked_at, timezone('utc', now())),
      revoke_reason = coalesce(revoke_reason, 'unlinked')
  where relay.user_id = actor and relay.revoked_at is null;
  changed := found;

  update public.telegram_account_bindings binding
  set
    identity_fingerprint = null,
    route_ciphertext = null,
    route_iv = null,
    route_auth_tag = null,
    encryption_key_version = null,
    revoked_at = coalesce(revoked_at, timezone('utc', now())),
    last_delivery_state = null,
    updated_at = timezone('utc', now())
  where binding.user_id = actor
    and (
      binding.revoked_at is null
      or binding.identity_fingerprint is not null
    );
  changed := changed or found;

  update public.telegram_link_sessions session
  set
    status = 'revoked',
    revoked_at = coalesce(revoked_at, timezone('utc', now())),
    pending_identity_fingerprint = null,
    pending_route_ciphertext = null,
    pending_route_iv = null,
    pending_route_auth_tag = null,
    pending_key_version = null
  where session.user_id = actor
    and session.status in ('created', 'telegram_pending');

  update public.telegram_delivery_outbox outbox
  set
    status = 'cancelled',
    failure_code = 'relay_unavailable',
    lease_token = null,
    lease_expires_at = null,
    updated_at = timezone('utc', now())
  where outbox.recipient_user_id = actor
    and outbox.status in ('pending', 'processing', 'failed');

  if changed then
    insert into public.telegram_companion_audit_events (user_id, event_type)
    values (actor, 'unlinked');
  end if;
end;
$$;

revoke all on function public.unlink_my_telegram_companion()
  from public, anon, authenticated;
grant execute on function public.unlink_my_telegram_companion()
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Service-only Telegram update operations
-- ---------------------------------------------------------------------------

create or replace function public.accept_telegram_link_token(
  p_update_id bigint,
  p_token_hash text,
  p_identity_fingerprint text,
  p_route_ciphertext bytea,
  p_route_iv bytea,
  p_route_auth_tag bytea,
  p_key_version smallint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.telegram_link_sessions%rowtype;
  conflicting_user uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_update_id is null or p_update_id < 0
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_identity_fingerprint !~ '^[0-9a-f]{64}$'
    or octet_length(p_route_ciphertext) not between 1 and 64
    or octet_length(p_route_iv) <> 12
    or octet_length(p_route_auth_tag) <> 16
    or p_key_version not between 1 and 32767 then
    return 'invalid';
  end if;

  insert into public.telegram_update_receipts (update_id, outcome)
  values (p_update_id, 'invalid')
  on conflict (update_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  select * into target_session
  from public.telegram_link_sessions session
  where session.token_hash = p_token_hash
  for update;

  if target_session.id is null
    or target_session.status <> 'created'
    or target_session.expires_at <= timezone('utc', now())
    or not public.is_telegram_conversation_eligible(
      target_session.user_id, target_session.conversation_id
    ) then
    return 'invalid';
  end if;

  select binding.user_id into conflicting_user
  from public.telegram_account_bindings binding
  where binding.identity_fingerprint = p_identity_fingerprint
    and binding.revoked_at is null
    and binding.user_id <> target_session.user_id
  for update;

  if conflicting_user is not null then
    update public.telegram_update_receipts
    set outcome = 'unavailable', completed_at = timezone('utc', now())
    where update_id = p_update_id;
    return 'unavailable';
  end if;

  update public.telegram_link_sessions session
  set
    status = 'telegram_pending',
    pending_identity_fingerprint = p_identity_fingerprint,
    pending_route_ciphertext = p_route_ciphertext,
    pending_route_iv = p_route_iv,
    pending_route_auth_tag = p_route_auth_tag,
    pending_key_version = p_key_version,
    telegram_received_at = timezone('utc', now())
  where session.id = target_session.id;

  update public.telegram_update_receipts
  set outcome = 'link_pending', completed_at = timezone('utc', now())
  where update_id = p_update_id;
  insert into public.telegram_companion_audit_events (user_id, event_type)
  values (target_session.user_id, 'telegram_pending');

  return 'link_pending';
end;
$$;

revoke all on function public.accept_telegram_link_token(
  bigint, text, text, bytea, bytea, bytea, smallint
) from public, anon, authenticated;
grant execute on function public.accept_telegram_link_token(
  bigint, text, text, bytea, bytea, bytea, smallint
) to service_role;

-- Shared message insertion keeps web and Telegram ingress policy identical.
create or replace function public.insert_anonymous_message_for_actor(
  p_actor uuid,
  p_public_id text,
  p_body text,
  p_idempotency_key text default null,
  p_require_active boolean default false
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
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
  normalized text;
  existing_id uuid;
  new_row public.anonymous_messages%rowtype;
  sent_last_minute integer;
  sent_last_day integer;
  recent_duplicate integer;
begin
  if p_actor is null or not public.is_eligible_introduction_student(p_actor) then
    raise exception 'student account required' using errcode = '42501';
  end if;
  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    raise exception 'conversation unavailable' using errcode = 'P0001';
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
    or p_actor not in (
      shell.participant_sender_id, shell.participant_recipient_id
    )
    or shell.status not in ('awaiting_chat', 'active')
    or (p_require_active and shell.status <> 'active')
    or not public.is_eligible_introduction_student(p_actor)
    or not public.is_eligible_introduction_student(
      public.conversation_counterpart_id(shell.id, p_actor)
    )
    or public.users_are_blocked(
      p_actor,
      public.conversation_counterpart_id(shell.id, p_actor)
    ) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, p_actor);

  if public.users_are_blocked(p_actor, counterpart_id) then
    update public.conversation_shells
    set
      status = 'blocked',
      ended_at = coalesce(ended_at, timezone('utc', now())),
      ended_by = coalesce(ended_by, p_actor)
    where id = shell.id;
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select msg.id into existing_id
    from public.anonymous_messages msg
    where msg.conversation_id = shell.id
      and msg.sender_id = p_actor
      and msg.client_idempotency_key = p_idempotency_key;
    if existing_id is not null then
      select * into new_row
      from public.anonymous_messages message where message.id = existing_id;
      return query select
        new_row.id, new_row.body, true, new_row.created_at, new_row.read_at,
        new_row.moderation_status, shell.status;
      return;
    end if;
  end if;

  normalized := public.normalize_anonymous_message(p_body);
  if char_length(normalized) not between 1 and 1000 then
    raise exception 'invalid message length' using errcode = '22023';
  end if;
  if public.introduction_message_has_contact(normalized) then
    raise exception 'contact disclosure blocked' using errcode = '22023';
  end if;

  select count(*) into sent_last_minute
  from public.anonymous_messages msg
  where msg.sender_id = p_actor
    and msg.created_at > timezone('utc', now()) - interval '1 minute';
  select count(*) into sent_last_day
  from public.anonymous_messages msg
  where msg.sender_id = p_actor
    and msg.created_at > timezone('utc', now()) - interval '1 day';
  if sent_last_minute >= 20 or sent_last_day >= 300 then
    raise exception 'chat rate limited' using errcode = 'P0001';
  end if;

  select count(*) into recent_duplicate
  from public.anonymous_messages msg
  where msg.conversation_id = shell.id
    and msg.sender_id = p_actor
    and msg.body = normalized
    and msg.created_at > timezone('utc', now()) - interval '8 seconds';
  if recent_duplicate > 0 then
    raise exception 'duplicate message' using errcode = 'P0001';
  end if;

  if shell.status = 'awaiting_chat' then
    update public.conversation_shells
    set status = 'active', activated_at = timezone('utc', now())
    where id = shell.id;
    shell.status := 'active';
    insert into public.conversation_events (
      conversation_id, actor_id, event_type
    ) values (shell.id, p_actor, 'activated');
  end if;

  insert into public.anonymous_messages (
    conversation_id, sender_id, body, client_idempotency_key
  )
  values (shell.id, p_actor, normalized, nullif(p_idempotency_key, ''))
  returning * into new_row;

  insert into public.conversation_events (
    conversation_id, actor_id, event_type
  ) values (shell.id, p_actor, 'message_sent');

  return query select
    new_row.id, new_row.body, true, new_row.created_at, new_row.read_at,
    new_row.moderation_status, shell.status;
end;
$$;

revoke all on function public.insert_anonymous_message_for_actor(
  uuid, text, text, text, boolean
) from public, anon, authenticated;

create or replace function public.send_anonymous_message(
  p_public_id text,
  p_body text,
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
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return query
  select * from public.insert_anonymous_message_for_actor(
    actor, p_public_id, p_body, p_idempotency_key, false
  );
end;
$$;

revoke all on function public.send_anonymous_message(text, text, text)
  from public, anon, authenticated;
grant execute on function public.send_anonymous_message(text, text, text)
  to authenticated;

create or replace function public.send_anonymous_message_from_telegram(
  p_update_id bigint,
  p_identity_fingerprint text,
  p_body text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  binding public.telegram_account_bindings%rowtype;
  relay public.telegram_conversation_relays%rowtype;
  shell public.conversation_shells%rowtype;
  result text := 'message_created';
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_update_id is null or p_update_id < 0
    or p_identity_fingerprint !~ '^[0-9a-f]{64}$' then
    return 'invalid';
  end if;
  insert into public.telegram_update_receipts (update_id, outcome)
  values (p_update_id, 'invalid')
  on conflict (update_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  select * into binding
  from public.telegram_account_bindings candidate
  where candidate.identity_fingerprint = p_identity_fingerprint
    and candidate.revoked_at is null
  for update;
  if binding.id is null then
    update public.telegram_update_receipts
    set outcome = 'unavailable', completed_at = timezone('utc', now())
    where update_id = p_update_id;
    return 'unavailable';
  end if;

  select * into relay
  from public.telegram_conversation_relays candidate
  where candidate.user_id = binding.user_id
    and candidate.binding_id = binding.id
    and candidate.revoked_at is null
  for update;
  if relay.user_id is null
    or not public.is_telegram_conversation_eligible(
      binding.user_id, relay.conversation_id
    ) then
    update public.telegram_update_receipts
    set outcome = 'unavailable', completed_at = timezone('utc', now())
    where update_id = p_update_id;
    return 'unavailable';
  end if;

  select * into shell from public.conversation_shells candidate
  where candidate.id = relay.conversation_id;

  begin
    perform public.insert_anonymous_message_for_actor(
      binding.user_id,
      shell.public_id,
      p_body,
      'tg_' || p_update_id::text,
      true
    );
  exception
    when others then
      result := case
        when sqlstate in ('22023', 'P0001', '42501')
          then 'invalid'
        else 'unavailable'
      end;
  end;

  update public.telegram_update_receipts
  set outcome = result, completed_at = timezone('utc', now())
  where update_id = p_update_id;
  return result;
end;
$$;

revoke all on function public.send_anonymous_message_from_telegram(
  bigint, text, text
) from public, anon, authenticated;
grant execute on function public.send_anonymous_message_from_telegram(
  bigint, text, text
) to service_role;

create or replace function public.unlink_telegram_companion_by_fingerprint(
  p_update_id bigint,
  p_identity_fingerprint text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  binding public.telegram_account_bindings%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  insert into public.telegram_update_receipts (update_id, outcome)
  values (p_update_id, 'invalid')
  on conflict (update_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  select * into binding
  from public.telegram_account_bindings candidate
  where candidate.identity_fingerprint = p_identity_fingerprint
    and candidate.revoked_at is null
  for update;

  if binding.id is not null then
    update public.telegram_conversation_relays relay
    set revoked_at = coalesce(revoked_at, timezone('utc', now())),
        revoke_reason = coalesce(revoke_reason, 'unlinked')
    where relay.user_id = binding.user_id and relay.revoked_at is null;

    update public.telegram_link_sessions session
    set status = 'revoked',
        revoked_at = coalesce(revoked_at, timezone('utc', now())),
        pending_identity_fingerprint = null,
        pending_route_ciphertext = null,
        pending_route_iv = null,
        pending_route_auth_tag = null,
        pending_key_version = null
    where session.user_id = binding.user_id
      and session.status in ('created', 'telegram_pending');

    update public.telegram_account_bindings target
    set identity_fingerprint = null,
        route_ciphertext = null,
        route_iv = null,
        route_auth_tag = null,
        encryption_key_version = null,
        revoked_at = timezone('utc', now()),
        last_delivery_state = null,
        updated_at = timezone('utc', now())
    where target.id = binding.id;

    update public.telegram_delivery_outbox outbox
    set status = 'cancelled',
        failure_code = 'relay_unavailable',
        lease_token = null,
        lease_expires_at = null,
        updated_at = timezone('utc', now())
    where outbox.recipient_user_id = binding.user_id
      and outbox.status in ('pending', 'processing', 'failed');

    insert into public.telegram_companion_audit_events (user_id, event_type)
    values (binding.user_id, 'unlinked');
  end if;

  update public.telegram_update_receipts
  set outcome = 'unlinked', completed_at = timezone('utc', now())
  where update_id = p_update_id;
  return 'unlinked';
end;
$$;

revoke all on function public.unlink_telegram_companion_by_fingerprint(
  bigint, text
) from public, anon, authenticated;
grant execute on function public.unlink_telegram_companion_by_fingerprint(
  bigint, text
) to service_role;

create or replace function public.record_telegram_update_outcome(
  p_update_id bigint,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_update_id is null or p_update_id < 0
    or p_outcome not in (
      'help', 'unsupported', 'private_chat_required', 'unavailable', 'invalid'
    ) then
    return false;
  end if;
  insert into public.telegram_update_receipts (update_id, outcome)
  values (p_update_id, p_outcome)
  on conflict (update_id) do nothing;
  return found;
end;
$$;

revoke all on function public.record_telegram_update_outcome(bigint, text)
  from public, anon, authenticated;
grant execute on function public.record_telegram_update_outcome(bigint, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Durable outbound delivery
-- ---------------------------------------------------------------------------

create or replace function public.queue_telegram_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shell public.conversation_shells%rowtype;
  recipient uuid;
begin
  select * into shell
  from public.conversation_shells candidate where candidate.id = new.conversation_id;
  recipient := case
    when shell.participant_sender_id = new.sender_id
      then shell.participant_recipient_id
    else shell.participant_sender_id
  end;

  if new.sender_id is null
    or recipient is null
    or not public.is_telegram_conversation_eligible(recipient, shell.id) then
    return new;
  end if;

  insert into public.telegram_delivery_outbox (
    anonymous_message_id, recipient_user_id, conversation_id
  )
  select new.id, recipient, shell.id
  from public.telegram_conversation_relays relay
  join public.telegram_account_bindings binding
    on binding.id = relay.binding_id
  where relay.user_id = recipient
    and relay.conversation_id = shell.id
    and relay.revoked_at is null
    and binding.user_id = recipient
    and binding.revoked_at is null
    and binding.identity_fingerprint is not null
  on conflict (anonymous_message_id) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_telegram_delivery()
  from public, anon, authenticated;

create trigger anonymous_messages_queue_telegram_v1
after insert on public.anonymous_messages
for each row execute function public.queue_telegram_delivery();

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
  target public.telegram_delivery_outbox%rowtype;
  binding public.telegram_account_bindings%rowtype;
  relay public.telegram_conversation_relays%rowtype;
  message public.anonymous_messages%rowtype;
  new_lease uuid := gen_random_uuid();
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into target
  from public.telegram_delivery_outbox outbox
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
  for update skip locked
  limit 1;

  if target.id is null then return; end if;

  select * into relay
  from public.telegram_conversation_relays candidate
  where candidate.user_id = target.recipient_user_id
    and candidate.conversation_id = target.conversation_id
    and candidate.revoked_at is null;
  select * into binding
  from public.telegram_account_bindings candidate
  where candidate.id = relay.binding_id
    and candidate.user_id = target.recipient_user_id
    and candidate.revoked_at is null;
  select * into message
  from public.anonymous_messages candidate
  where candidate.id = target.anonymous_message_id
    and candidate.moderation_status = 'visible';

  if relay.user_id is null
    or binding.id is null
    or message.id is null
    or not public.is_telegram_conversation_eligible(
      target.recipient_user_id, target.conversation_id
    ) then
    update public.telegram_delivery_outbox
    set status = 'cancelled',
        failure_code = 'relay_unavailable',
        lease_token = null,
        lease_expires_at = null,
        updated_at = timezone('utc', now())
    where id = target.id;
    return;
  end if;

  update public.telegram_delivery_outbox
  set status = 'processing',
      attempt_count = attempt_count + 1,
      lease_token = new_lease,
      lease_expires_at = timezone('utc', now()) + interval '2 minutes',
      failure_code = null,
      updated_at = timezone('utc', now())
  where id = target.id;

  return query select
    target.id,
    new_lease,
    binding.route_ciphertext,
    binding.route_iv,
    binding.route_auth_tag,
    binding.encryption_key_version,
    message.body,
    target.attempt_count + 1;
end;
$$;

revoke all on function public.claim_telegram_delivery()
  from public, anon, authenticated;
grant execute on function public.claim_telegram_delivery()
  to service_role;

create or replace function public.complete_telegram_delivery(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_telegram_message_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  update public.telegram_delivery_outbox outbox
  set status = 'delivered',
      telegram_message_id = p_telegram_message_id,
      delivered_at = timezone('utc', now()),
      lease_token = null,
      lease_expires_at = null,
      failure_code = null,
      updated_at = timezone('utc', now())
  where outbox.id = p_outbox_id
    and outbox.status = 'processing'
    and outbox.lease_token = p_lease_token
    and p_telegram_message_id > 0
  returning recipient_user_id into recipient;

  if recipient is null then
    raise exception 'delivery lease unavailable' using errcode = '42501';
  end if;
  update public.telegram_account_bindings
  set last_delivery_state = 'delivered',
      updated_at = timezone('utc', now())
  where user_id = recipient and revoked_at is null;
end;
$$;

revoke all on function public.complete_telegram_delivery(uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.complete_telegram_delivery(uuid, uuid, bigint)
  to service_role;

create or replace function public.fail_telegram_delivery(
  p_outbox_id uuid,
  p_lease_token uuid,
  p_failure_code text,
  p_retry_after_seconds integer default null,
  p_permanent boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.telegram_delivery_outbox%rowtype;
  retry_seconds integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_failure_code not in (
    'rate_limited', 'telegram_unavailable', 'delivery_rejected',
    'delivery_uncertain', 'relay_unavailable'
  ) then
    raise exception 'invalid failure category' using errcode = '22023';
  end if;

  select * into target
  from public.telegram_delivery_outbox outbox
  where outbox.id = p_outbox_id
    and outbox.status = 'processing'
    and outbox.lease_token = p_lease_token
  for update;
  if target.id is null then
    raise exception 'delivery lease unavailable' using errcode = '42501';
  end if;

  retry_seconds := least(
    greatest(
      coalesce(p_retry_after_seconds, power(2, target.attempt_count)::integer * 15),
      15
    ),
    3600
  );

  update public.telegram_delivery_outbox
  set
    status = case
      when p_permanent or target.attempt_count >= 5 then 'cancelled'
      else 'failed'
    end,
    available_at = timezone('utc', now()) + make_interval(secs => retry_seconds),
    lease_token = null,
    lease_expires_at = null,
    failure_code = p_failure_code,
    updated_at = timezone('utc', now())
  where id = target.id;

  update public.telegram_account_bindings
  set last_delivery_state = case
        when p_permanent or target.attempt_count >= 5
          then 'unavailable'
        else 'retrying'
      end,
      updated_at = timezone('utc', now())
  where user_id = target.recipient_user_id and revoked_at is null;

  insert into public.telegram_companion_audit_events (
    user_id, event_type, failure_category
  )
  values (target.recipient_user_id, 'delivery_failure', p_failure_code);
end;
$$;

revoke all on function public.fail_telegram_delivery(
  uuid, uuid, text, integer, boolean
) from public, anon, authenticated;
grant execute on function public.fail_telegram_delivery(
  uuid, uuid, text, integer, boolean
) to service_role;

create or replace function public.cleanup_telegram_companion_runtime(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 500), 1), 2000);
  deleted_count integer := 0;
  affected integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  with doomed as (
    select receipt.update_id
    from public.telegram_update_receipts receipt
    where receipt.completed_at < timezone('utc', now()) - interval '7 days'
    order by receipt.completed_at
    limit safe_limit
  )
  delete from public.telegram_update_receipts receipt
  using doomed where receipt.update_id = doomed.update_id;
  get diagnostics affected = row_count;
  deleted_count := deleted_count + affected;

  delete from public.telegram_companion_rate_limits rate
  where rate.window_start < timezone('utc', now()) - interval '2 days';
  get diagnostics affected = row_count;
  deleted_count := deleted_count + affected;

  update public.telegram_link_sessions session
  set status = 'expired',
      pending_identity_fingerprint = null,
      pending_route_ciphertext = null,
      pending_route_iv = null,
      pending_route_auth_tag = null,
      pending_key_version = null
  where session.status in ('created', 'telegram_pending')
    and session.expires_at <= timezone('utc', now());

  return deleted_count;
end;
$$;

revoke all on function public.cleanup_telegram_companion_runtime(integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_telegram_companion_runtime(integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. Lifecycle and account-deletion integration
-- ---------------------------------------------------------------------------

create or replace function public.revoke_telegram_relay_for_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('awaiting_chat', 'active')
    and new.status in ('ended', 'blocked') then
    update public.telegram_conversation_relays relay
    set revoked_at = coalesce(revoked_at, timezone('utc', now())),
        revoke_reason = coalesce(revoke_reason, 'lifecycle')
    where relay.conversation_id = new.id and relay.revoked_at is null;

    update public.telegram_delivery_outbox outbox
    set status = 'cancelled',
        failure_code = 'relay_unavailable',
        lease_token = null,
        lease_expires_at = null,
        updated_at = timezone('utc', now())
    where outbox.conversation_id = new.id
      and outbox.status in ('pending', 'processing', 'failed');

    insert into public.telegram_companion_audit_events (user_id, event_type)
    select relay.user_id, 'revoked_by_lifecycle'
    from public.telegram_conversation_relays relay
    where relay.conversation_id = new.id
      and relay.revoke_reason = 'lifecycle'
      and relay.revoked_at is not null;
  end if;
  return new;
end;
$$;

revoke all on function public.revoke_telegram_relay_for_conversation()
  from public, anon, authenticated;

create trigger conversation_shells_revoke_telegram_v1
after update of status on public.conversation_shells
for each row execute function public.revoke_telegram_relay_for_conversation();

create or replace function public.revoke_telegram_for_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then return new; end if;

  update public.telegram_conversation_relays relay
  set revoked_at = coalesce(revoked_at, timezone('utc', now())),
      revoke_reason = coalesce(revoke_reason, 'deletion')
  where relay.user_id = new.user_id and relay.revoked_at is null;

  update public.telegram_link_sessions session
  set status = 'revoked',
      revoked_at = coalesce(revoked_at, timezone('utc', now())),
      pending_identity_fingerprint = null,
      pending_route_ciphertext = null,
      pending_route_iv = null,
      pending_route_auth_tag = null,
      pending_key_version = null
  where session.user_id = new.user_id
    and session.status in ('created', 'telegram_pending');

  update public.telegram_account_bindings binding
  set revoked_at = coalesce(revoked_at, timezone('utc', now())),
      last_delivery_state = null,
      updated_at = timezone('utc', now())
  where binding.user_id = new.user_id and binding.revoked_at is null;

  update public.telegram_delivery_outbox outbox
  set status = 'cancelled',
      failure_code = 'relay_unavailable',
      lease_token = null,
      lease_expires_at = null,
      updated_at = timezone('utc', now())
  where outbox.recipient_user_id = new.user_id
    and outbox.status in ('pending', 'processing', 'failed');

  insert into public.telegram_companion_audit_events (user_id, event_type)
  values (new.user_id, 'revoked_by_deletion');
  return new;
end;
$$;

revoke all on function public.revoke_telegram_for_account_deletion()
  from public, anon, authenticated;

create trigger account_deletion_requests_revoke_telegram_v1
after insert on public.account_deletion_requests
for each row execute function public.revoke_telegram_for_account_deletion();

create or replace function public.purge_telegram_for_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.telegram_delivery_outbox
  where recipient_user_id = old.user_id;
  delete from public.telegram_conversation_relays
  where user_id = old.user_id;
  delete from public.telegram_link_sessions
  where user_id = old.user_id;
  delete from public.telegram_account_bindings
  where user_id = old.user_id;
  delete from public.telegram_companion_rate_limits
  where user_id = old.user_id;
  delete from public.telegram_companion_audit_events
  where user_id = old.user_id;
  return old;
end;
$$;

revoke all on function public.purge_telegram_for_profile_delete()
  from public, anon, authenticated;

create trigger profiles_purge_telegram_v1
before delete on public.profiles
for each row execute function public.purge_telegram_for_profile_delete();

-- No direct table grants. No Telegram internal helper is student executable.
