-- StudyDate Plus duration catalog: 7, 30, and 90 day purchases.
-- Purchases extend the current paid window; they are not auto-renewing subscriptions.

drop function if exists public.get_my_membership_billing_offer();
drop function if exists public.get_membership_billing_offer_ops();
drop function if exists public.manage_membership_billing_offer(integer, integer, boolean);
drop function if exists public.create_or_reuse_my_membership_payment_order();

alter table public.membership_billing_offer
  drop constraint if exists membership_billing_offer_pkey;
alter table public.membership_billing_offer
  drop constraint if exists membership_billing_offer_singleton_check;
alter table public.membership_billing_offer
  add column package_code text null;

do $$
declare
  last_actor uuid;
begin
  select offer.updated_by
  into last_actor
  from public.membership_billing_offer offer
  order by offer.updated_at desc
  limit 1;

  delete from public.membership_billing_offer;

  insert into public.membership_billing_offer (
    singleton,
    package_code,
    amount_idr,
    duration_days,
    is_active,
    updated_by
  ) values
    (true, 'plus_7', 9000, 7, false, last_actor),
    (true, 'plus_30', 19000, 30, false, last_actor),
    (true, 'plus_90', 49000, 90, false, last_actor);
end;
$$;

alter table public.membership_billing_offer
  drop column singleton,
  alter column package_code set not null,
  add constraint membership_billing_offer_pkey primary key (package_code),
  add constraint membership_billing_offer_package_allowed check (
    package_code in ('plus_7', 'plus_30', 'plus_90')
  ),
  add constraint membership_billing_offer_duration_matches check (
    (package_code = 'plus_7' and duration_days = 7)
    or (package_code = 'plus_30' and duration_days = 30)
    or (package_code = 'plus_90' and duration_days = 90)
  );

create or replace function public.get_my_membership_billing_offer()
returns table (package_code text, amount_idr integer, duration_days integer)
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
  select offer.package_code, offer.amount_idr, offer.duration_days::integer
  from public.membership_billing_offer offer
  where offer.is_active
  order by offer.duration_days;
end;
$$;

create or replace function public.get_membership_billing_offer_ops()
returns table (
  package_code text,
  amount_idr integer,
  duration_days integer,
  is_active boolean,
  updated_at timestamptz
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

  return query
  select
    offer.package_code,
    offer.amount_idr,
    offer.duration_days::integer,
    offer.is_active,
    offer.updated_at
  from public.membership_billing_offer offer
  order by offer.duration_days;
end;
$$;

create or replace function public.manage_membership_billing_offer(
  p_package_code text,
  p_amount_idr integer,
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
  if p_package_code not in ('plus_7', 'plus_30', 'plus_90')
    or p_amount_idr not between 1 and 10000000
    or p_is_active is null then
    raise exception 'invalid billing offer' using errcode = '22023';
  end if;

  update public.membership_billing_offer offer
  set amount_idr = p_amount_idr,
      is_active = p_is_active,
      updated_by = actor,
      updated_at = timezone('utc', now())
  where offer.package_code = p_package_code;

  if not found then
    raise exception 'billing offer unavailable' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.create_or_reuse_my_membership_payment_order(
  p_package_code text
)
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
  if p_package_code not in ('plus_7', 'plus_30', 'plus_90') then
    raise exception 'invalid billing package' using errcode = '22023';
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
  where candidate.package_code = p_package_code
    and candidate.is_active;
  if offer.package_code is null then
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

revoke all on function public.get_my_membership_billing_offer() from public, anon;
grant execute on function public.get_my_membership_billing_offer() to authenticated;
revoke all on function public.get_membership_billing_offer_ops() from public, anon;
grant execute on function public.get_membership_billing_offer_ops() to authenticated;
revoke all on function public.manage_membership_billing_offer(text, integer, boolean)
  from public, anon;
grant execute on function public.manage_membership_billing_offer(text, integer, boolean)
  to authenticated;
revoke all on function public.create_or_reuse_my_membership_payment_order(text)
  from public, anon;
grant execute on function public.create_or_reuse_my_membership_payment_order(text)
  to authenticated;

comment on table public.membership_billing_offer is
  'Owner-managed fixed-duration StudyDate Plus purchase catalog; never auto-renewing.';
