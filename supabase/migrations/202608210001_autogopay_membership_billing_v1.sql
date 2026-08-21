-- AutoGoPay GoPay QRIS billing for one Owner-managed StudyDate Plus offer.
-- Provider calls stay in Next.js; PostgreSQL owns order state and entitlement finalization.

create table public.membership_billing_offer (
  singleton boolean primary key default true check (singleton),
  amount_idr integer not null check (amount_idr between 1 and 10000000),
  duration_days smallint not null check (duration_days between 1 and 365),
  is_active boolean not null default false,
  updated_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.membership_payment_orders (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  user_id uuid not null references auth.users (id) on delete restrict,
  amount_idr integer not null check (amount_idr between 1 and 10000000),
  duration_days smallint not null check (duration_days between 1 and 365),
  status text not null default 'creating' check (
    status in ('creating', 'pending', 'paid', 'expired', 'cancelled', 'generation_failed')
  ),
  provider_transaction_id text null,
  provider_order_id text null,
  checkout_url text null,
  provider_expires_at timestamptz null,
  paid_at timestamptz null,
  entitlement_id uuid null references public.user_entitlements (id) on delete set null,
  failure_code text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint membership_payment_orders_public_id_format check (public_id ~ '^[0-9a-f]{32}$'),
  constraint membership_payment_orders_provider_transaction_length check (
    provider_transaction_id is null or char_length(provider_transaction_id) between 1 and 160
  ),
  constraint membership_payment_orders_provider_order_length check (
    provider_order_id is null or char_length(provider_order_id) between 1 and 160
  ),
  constraint membership_payment_orders_checkout_safe check (
    checkout_url is null or checkout_url ~ '^https://autogopay[.]site/pay/[A-Za-z0-9_-]{1,200}$'
  ),
  constraint membership_payment_orders_paid_fields check (
    (status <> 'paid' and paid_at is null and entitlement_id is null)
    or (status = 'paid' and paid_at is not null and entitlement_id is not null)
  ),
  constraint membership_payment_orders_pending_fields check (
    status not in ('pending', 'paid')
    or (
      provider_transaction_id is not null
      and provider_order_id is not null
      and checkout_url is not null
      and provider_expires_at is not null
    )
  ),
  constraint membership_payment_orders_failure_code check (
    failure_code is null or failure_code in ('provider_unavailable', 'provider_invalid')
  )
);

alter table public.membership_audit_events
  drop constraint membership_audit_events_duration_allowed;
alter table public.membership_audit_events
  add constraint membership_audit_events_duration_allowed check (
    duration_days is null or duration_days between 1 and 365
  );

create unique index membership_payment_orders_provider_transaction_idx
  on public.membership_payment_orders (provider_transaction_id)
  where provider_transaction_id is not null;
create unique index membership_payment_orders_provider_order_idx
  on public.membership_payment_orders (provider_order_id)
  where provider_order_id is not null;
create index membership_payment_orders_user_created_idx
  on public.membership_payment_orders (user_id, created_at desc);
create unique index membership_payment_orders_one_pending_user_idx
  on public.membership_payment_orders (user_id)
  where status in ('creating', 'pending');

alter table public.membership_billing_offer enable row level security;
alter table public.membership_payment_orders enable row level security;
revoke all on table public.membership_billing_offer from public, anon, authenticated;
revoke all on table public.membership_payment_orders from public, anon, authenticated;

create or replace function public.get_my_membership_billing_offer()
returns table (amount_idr integer, duration_days integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null
    or not public.is_eligible_introduction_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;

  return query
  select offer.amount_idr, offer.duration_days::integer
  from public.membership_billing_offer offer
  where offer.singleton and offer.is_active;
end;
$$;

revoke all on function public.get_my_membership_billing_offer() from public, anon;
grant execute on function public.get_my_membership_billing_offer() to authenticated;

create or replace function public.get_membership_billing_offer_ops()
returns table (amount_idr integer, duration_days integer, is_active boolean, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;

  return query
  select offer.amount_idr, offer.duration_days::integer, offer.is_active, offer.updated_at
  from public.membership_billing_offer offer
  where offer.singleton;
end;
$$;

create or replace function public.manage_membership_billing_offer(
  p_amount_idr integer,
  p_duration_days integer,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if p_amount_idr not between 1 and 10000000
    or p_duration_days not between 1 and 365
    or p_is_active is null then
    raise exception 'invalid billing offer' using errcode = '22023';
  end if;

  insert into public.membership_billing_offer (
    singleton, amount_idr, duration_days, is_active, updated_by
  ) values (
    true, p_amount_idr, p_duration_days, p_is_active, actor
  )
  on conflict (singleton) do update
    set amount_idr = excluded.amount_idr,
        duration_days = excluded.duration_days,
        is_active = excluded.is_active,
        updated_by = actor,
        updated_at = timezone('utc', now());
end;
$$;

revoke all on function public.get_membership_billing_offer_ops() from public, anon;
grant execute on function public.get_membership_billing_offer_ops() to authenticated;
revoke all on function public.manage_membership_billing_offer(integer, integer, boolean)
  from public, anon;
grant execute on function public.manage_membership_billing_offer(integer, integer, boolean)
  to authenticated;

create or replace function public.create_or_reuse_my_membership_payment_order()
returns table (
  public_id text,
  amount_idr integer,
  duration_days integer,
  status text,
  provider_transaction_id text,
  checkout_url text,
  provider_expires_at timestamptz,
  should_generate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  offer public.membership_billing_offer%rowtype;
  existing public.membership_payment_orders%rowtype;
  created public.membership_payment_orders%rowtype;
begin
  if actor is null
    or not public.is_eligible_introduction_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':membership-payment', 0));

  update public.membership_payment_orders payment
  set status = 'expired', updated_at = timezone('utc', now())
  where payment.user_id = actor
    and payment.status = 'pending'
    and payment.provider_expires_at <= timezone('utc', now());

  update public.membership_payment_orders payment
  set status = 'generation_failed',
      failure_code = 'provider_unavailable',
      updated_at = timezone('utc', now())
  where payment.user_id = actor
    and payment.status = 'creating'
    and payment.created_at <= timezone('utc', now()) - interval '2 minutes';

  select * into existing
  from public.membership_payment_orders payment
  where payment.user_id = actor
    and (
      payment.status = 'creating'
      or (
        payment.status = 'pending'
        and payment.provider_expires_at > timezone('utc', now())
      )
    )
  order by payment.created_at desc
  limit 1
  for update;

  if existing.id is not null then
    return query select existing.public_id, existing.amount_idr,
      existing.duration_days::integer, existing.status,
      existing.provider_transaction_id, existing.checkout_url,
      existing.provider_expires_at, false;
    return;
  end if;

  select * into offer
  from public.membership_billing_offer candidate
  where candidate.singleton and candidate.is_active;
  if offer.singleton is null then
    raise exception 'billing offer unavailable' using errcode = 'P0001';
  end if;

  insert into public.membership_payment_orders (
    user_id, amount_idr, duration_days
  ) values (
    actor, offer.amount_idr, offer.duration_days
  ) returning * into created;

  return query select created.public_id, created.amount_idr,
    created.duration_days::integer, created.status,
    created.provider_transaction_id, created.checkout_url,
    created.provider_expires_at, true;
end;
$$;

create or replace function public.get_my_membership_payment_order(p_public_id text default null)
returns table (
  public_id text,
  amount_idr integer,
  duration_days integer,
  status text,
  provider_transaction_id text,
  checkout_url text,
  provider_expires_at timestamptz,
  paid_at timestamptz
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
  if p_public_id is not null and p_public_id !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid payment order' using errcode = '22023';
  end if;

  update public.membership_payment_orders payment
  set status = 'expired', updated_at = timezone('utc', now())
  where payment.user_id = actor
    and payment.status = 'pending'
    and payment.provider_expires_at <= timezone('utc', now());

  update public.membership_payment_orders payment
  set status = 'generation_failed',
      failure_code = 'provider_unavailable',
      updated_at = timezone('utc', now())
  where payment.user_id = actor
    and payment.status = 'creating'
    and payment.created_at <= timezone('utc', now()) - interval '2 minutes';

  return query
  select payment.public_id, payment.amount_idr, payment.duration_days::integer,
    payment.status, payment.provider_transaction_id, payment.checkout_url,
    payment.provider_expires_at, payment.paid_at
  from public.membership_payment_orders payment
  where payment.user_id = actor
    and (p_public_id is null or payment.public_id = p_public_id)
  order by payment.created_at desc
  limit 1;
end;
$$;

revoke all on function public.create_or_reuse_my_membership_payment_order()
  from public, anon;
grant execute on function public.create_or_reuse_my_membership_payment_order()
  to authenticated;
revoke all on function public.get_my_membership_payment_order(text) from public, anon;
grant execute on function public.get_my_membership_payment_order(text) to authenticated;

create or replace function public.attach_membership_payment_provider(
  p_public_id text,
  p_provider_transaction_id text,
  p_provider_order_id text,
  p_checkout_url text,
  p_provider_expires_at timestamptz
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
  if p_public_id !~ '^[0-9a-f]{32}$'
    or char_length(coalesce(p_provider_transaction_id, '')) not between 1 and 160
    or char_length(coalesce(p_provider_order_id, '')) not between 1 and 160
    or p_checkout_url !~ '^https://autogopay[.]site/pay/[A-Za-z0-9_-]{1,200}$'
    or p_provider_expires_at <= timezone('utc', now())
    or p_provider_expires_at > timezone('utc', now()) + interval '30 minutes' then
    raise exception 'invalid provider payment' using errcode = '22023';
  end if;

  update public.membership_payment_orders payment
  set status = 'pending',
      provider_transaction_id = p_provider_transaction_id,
      provider_order_id = p_provider_order_id,
      checkout_url = p_checkout_url,
      provider_expires_at = p_provider_expires_at,
      updated_at = timezone('utc', now())
  where payment.public_id = p_public_id
    and payment.status = 'creating';
  return found;
end;
$$;

create or replace function public.fail_membership_payment_generation(
  p_public_id text,
  p_failure_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_failure_code not in ('provider_unavailable', 'provider_invalid') then
    raise exception 'invalid failure code' using errcode = '22023';
  end if;

  update public.membership_payment_orders payment
  set status = 'generation_failed',
      failure_code = p_failure_code,
      updated_at = timezone('utc', now())
  where payment.public_id = p_public_id and payment.status = 'creating';
end;
$$;

create or replace function public.cancel_my_membership_payment(p_public_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  payment public.membership_payment_orders%rowtype;
begin
  if actor is null or p_public_id !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid payment order' using errcode = '22023';
  end if;
  select * into payment
  from public.membership_payment_orders candidate
  where candidate.public_id = p_public_id and candidate.user_id = actor
  for update;
  if payment.id is null then
    raise exception 'payment unavailable' using errcode = 'P0002';
  end if;
  if payment.status = 'paid' then return 'paid'; end if;
  if payment.status <> 'pending' then return payment.status; end if;
  update public.membership_payment_orders
  set status = 'cancelled', updated_at = timezone('utc', now())
  where id = payment.id and status = 'pending';
  return 'cancelled';
end;
$$;

create or replace function public.finalize_membership_payment(
  p_provider_transaction_id text,
  p_provider_order_id text,
  p_amount_idr integer,
  p_paid_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.membership_payment_orders%rowtype;
  current_entitlement public.user_entitlements%rowtype;
  next_end timestamptz;
  entitlement_uuid uuid;
  subject text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if char_length(coalesce(p_provider_transaction_id, '')) not between 1 and 160
    or char_length(coalesce(p_provider_order_id, '')) not between 1 and 160
    or p_amount_idr not between 1 and 10000000
    or p_paid_at is null
    or p_paid_at > timezone('utc', now()) + interval '10 minutes' then
    raise exception 'invalid paid transaction' using errcode = '22023';
  end if;

  select * into payment
  from public.membership_payment_orders candidate
  where candidate.provider_transaction_id = p_provider_transaction_id
  for update;
  if payment.id is null
    or payment.provider_order_id <> p_provider_order_id
    or payment.amount_idr <> p_amount_idr then
    return 'mismatch';
  end if;
  if payment.status = 'paid' then return 'duplicate'; end if;
  if payment.status not in ('pending', 'cancelled', 'expired') then return 'invalid_state'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    payment.user_id::text || ':membership-entitlement', 0
  ));

  select * into current_entitlement
  from public.user_entitlements entitlement
  where entitlement.user_id = payment.user_id
    and entitlement.plan_code = 'plus'
    and entitlement.status = 'active'
  for update;

  if current_entitlement.id is not null
    and current_entitlement.starts_at <= timezone('utc', now())
    and current_entitlement.ends_at is null then
    entitlement_uuid := current_entitlement.id;
  elsif current_entitlement.id is not null
    and current_entitlement.starts_at <= timezone('utc', now())
    and current_entitlement.ends_at > timezone('utc', now()) then
    next_end := current_entitlement.ends_at + make_interval(days => payment.duration_days);
    update public.user_entitlements
    set ends_at = next_end, updated_at = timezone('utc', now())
    where id = current_entitlement.id
    returning id into entitlement_uuid;
  else
    if current_entitlement.id is not null then
      update public.user_entitlements
      set status = 'expired', updated_at = timezone('utc', now())
      where id = current_entitlement.id;
    end if;
    next_end := timezone('utc', now()) + make_interval(days => payment.duration_days);
    insert into public.user_entitlements (
      user_id, plan_code, status, source, starts_at, ends_at
    ) values (
      payment.user_id, 'plus', 'active', 'future_payment',
      timezone('utc', now()), next_end
    ) returning id into entitlement_uuid;
  end if;

  update public.membership_payment_orders
  set status = 'paid',
      paid_at = p_paid_at,
      entitlement_id = entitlement_uuid,
      updated_at = timezone('utc', now())
  where id = payment.id;

  select coalesce(substring(profile.public_alias from '[0-9]{6}$'), 'unknown')
  into subject from public.profiles profile where profile.user_id = payment.user_id;
  insert into public.membership_audit_events (
    actor_user_id, event_type, plan_code, duration_days, subject_suffix
  ) values (
    null,
    case when current_entitlement.id is null then 'membership_granted'
      else 'membership_extended' end,
    'plus',
    payment.duration_days,
    coalesce(subject, 'unknown')
  );
  return 'paid';
end;
$$;

revoke all on function public.attach_membership_payment_provider(
  text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.attach_membership_payment_provider(
  text, text, text, text, timestamptz
) to service_role;
revoke all on function public.fail_membership_payment_generation(text, text)
  from public, anon, authenticated;
grant execute on function public.fail_membership_payment_generation(text, text)
  to service_role;
revoke all on function public.cancel_my_membership_payment(text) from public, anon;
grant execute on function public.cancel_my_membership_payment(text) to authenticated;
revoke all on function public.finalize_membership_payment(text, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_membership_payment(text, text, integer, timestamptz)
  to service_role;

create or replace function public.manage_user_membership(
  p_target_user_id uuid,
  p_action text,
  p_duration_days integer default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_row public.user_entitlements%rowtype;
  next_end timestamptz;
  event_name text;
  duration integer;
  subject text;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if p_target_user_id is null then
    raise exception 'existing auth user required' using errcode = 'P0002';
  end if;
  if not exists (select 1 from auth.users auth_user where auth_user.id = p_target_user_id) then
    raise exception 'existing auth user required' using errcode = 'P0002';
  end if;
  if p_action not in ('grant_plus', 'revoke_plus') then
    raise exception 'invalid membership action' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_target_user_id::text || ':membership-entitlement', 0
  ));

  select coalesce(substring(profile.public_alias from '[0-9]{6}$'), 'unknown')
  into subject
  from public.profiles profile
  where profile.user_id = p_target_user_id;
  subject := coalesce(subject, 'unknown');

  select * into current_row
  from public.user_entitlements entitlement
  where entitlement.user_id = p_target_user_id
    and entitlement.plan_code = 'plus'
    and entitlement.status = 'active'
  for update;

  if p_action = 'revoke_plus' then
    if current_row.id is null then
      return false;
    end if;
    update public.user_entitlements
    set status = 'revoked',
        updated_at = timezone('utc', now())
    where id = current_row.id;
    insert into public.membership_audit_events (
      actor_user_id, event_type, plan_code, subject_suffix
    ) values (
      actor, 'membership_revoked', 'plus', subject
    );
    return true;
  end if;

  duration := p_duration_days;
  if duration not in (7, 30, 90) then
    raise exception 'invalid membership duration' using errcode = '22023';
  end if;
  next_end := timezone('utc', now()) + make_interval(days => duration);

  if current_row.id is not null
    and current_row.starts_at <= timezone('utc', now())
    and (current_row.ends_at is null or current_row.ends_at > timezone('utc', now())) then
    if current_row.ends_at is null then
      event_name := 'membership_extended';
    else
      next_end := greatest(current_row.ends_at, next_end);
      update public.user_entitlements
      set ends_at = next_end,
          updated_at = timezone('utc', now())
      where id = current_row.id;
      event_name := 'membership_extended';
    end if;
  else
    if current_row.id is not null then
      update public.user_entitlements
      set status = 'expired',
          updated_at = timezone('utc', now())
      where id = current_row.id
        and status = 'active';
    end if;
    insert into public.user_entitlements (
      user_id, plan_code, status, source, starts_at, ends_at
    ) values (
      p_target_user_id, 'plus', 'active', 'owner_grant',
      timezone('utc', now()), next_end
    );
    event_name := 'membership_granted';
  end if;

  insert into public.membership_audit_events (
    actor_user_id, event_type, plan_code, duration_days, subject_suffix
  ) values (
    actor, event_name, 'plus', duration, subject
  );
  return true;
end;
$$;

revoke all on function public.manage_user_membership(uuid, text, integer)
  from public, anon, authenticated;

create or replace function public.purge_membership_for_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.membership_payment_orders where user_id = old.user_id;
  delete from public.user_entitlements where user_id = old.user_id;
  delete from public.membership_quota_usage where user_id = old.user_id;
  return old;
end;
$$;
