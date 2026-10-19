-- Optional GoPay QRIS checkout. No payment is initiated by applying this migration.
-- The application also requires EVENT_TICKET_PAYMENTS_ENABLED=true.

create table public.campus_event_payment_settings (
  singleton boolean primary key default true check (singleton),
  is_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);
insert into public.campus_event_payment_settings (singleton, is_enabled) values (true, false);
alter table public.campus_event_payment_settings enable row level security;
revoke all on table public.campus_event_payment_settings from public, anon, authenticated;

alter table public.campus_event_payment_attempts
  add column provider_order_id text null;
create unique index campus_event_payment_attempts_order_id_idx
  on public.campus_event_payment_attempts (provider, provider_order_id)
  where provider_order_id is not null;

create or replace function public.guard_campus_event_ticket_price()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.quantity_reserved + old.quantity_sold > 0
    and (new.price_amount is distinct from old.price_amount
      or new.access_type is distinct from old.access_type) then
    raise exception 'ticket price locked after reservation' using errcode = 'P0001';
  end if;
  return new;
end; $$;
create trigger campus_event_ticket_price_locked
before update on public.campus_event_ticket_types
for each row execute function public.guard_campus_event_ticket_price();

create or replace function public.list_campus_event_ticket_types(p_event_public_slug text)
returns table (
  ticket_public_id text, name text, description text, access_type text,
  price_amount integer, currency text, quantity_total integer,
  quantity_available integer, min_per_order integer, max_per_order integer,
  sales_start_at timestamptz, sales_end_at timestamptz, status text
)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.campus_events%rowtype; can_manage boolean := false;
begin
  select * into target from public.campus_events event where event.public_slug = p_event_public_slug;
  if target.id is null then return; end if;
  can_manage := actor is not null and public.event_can_manage_registrations(target.id, actor);
  return query
    select ticket.public_id, ticket.name, ticket.description, ticket.access_type,
      ticket.price_amount, ticket.currency, ticket.quantity_total,
      greatest(0, ticket.quantity_total - ticket.quantity_reserved - ticket.quantity_sold),
      ticket.min_per_order, ticket.max_per_order, ticket.sales_start_at, ticket.sales_end_at,
      ticket.status
    from public.campus_event_ticket_types ticket
    where ticket.event_id = target.id
      and (can_manage or (
        target.status = 'scheduled' and ticket.status = 'on_sale'
        and (ticket.sales_start_at is null or ticket.sales_start_at <= timezone('utc', now()))
        and (ticket.sales_end_at is null or ticket.sales_end_at > timezone('utc', now()))
        and ticket.access_type = 'public'
        and (ticket.price_amount = 0 or (
          ticket.price_amount between 1 and 10000000
          and exists (select 1 from public.campus_event_payment_settings setting
            where setting.singleton and setting.is_enabled)
        ))
      ))
    order by ticket.sort_order, ticket.created_at;
end; $$;

create or replace function public.publish_campus_event_paid_ticket(p_ticket_public_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); ticket public.campus_event_ticket_types%rowtype;
begin
  select * into ticket from public.campus_event_ticket_types item
    where item.public_id = p_ticket_public_id for update;
  if actor is null or ticket.id is null
    or not coalesce(public.event_can_manage_registrations(ticket.event_id, actor), false) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.campus_event_payment_settings setting
      where setting.singleton and setting.is_enabled) then
    raise exception 'paid ticket checkout unavailable' using errcode = 'P0001';
  end if;
  if ticket.access_type <> 'public' or ticket.price_amount not between 1 and 10000000
    or ticket.min_per_order <> 1 or ticket.max_per_order <> 1
    or ticket.status not in ('draft', 'paused') then
    raise exception 'paid ticket configuration unavailable' using errcode = 'P0001';
  end if;
  update public.campus_event_ticket_types set status = 'on_sale', updated_at = timezone('utc', now())
    where id = ticket.id;
  return true;
end; $$;

create or replace function public.reserve_my_campus_event_paid_ticket(
  p_event_public_slug text, p_ticket_public_id text, p_idempotency_key text
)
returns table (order_public_id text, amount_idr integer, should_generate boolean, checkout_url text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.campus_events%rowtype;
  ticket public.campus_event_ticket_types%rowtype;
  existing public.campus_event_ticket_orders%rowtype;
  created public.campus_event_ticket_orders%rowtype;
  registration_status text; active_order_id uuid; attempt public.campus_event_payment_attempts%rowtype;
begin
  if actor is null or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 16 and 100 then
    raise exception 'invalid ticket request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.campus_event_payment_settings setting
      where setting.singleton and setting.is_enabled) then
    raise exception 'paid ticket checkout unavailable' using errcode = 'P0001';
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_event_public_slug and event.status = 'scheduled'
      and event.starts_at > timezone('utc', now()) for update;
  if target.id is null then raise exception 'event ticket order unavailable' using errcode = 'P0001'; end if;
  select * into existing from public.campus_event_ticket_orders orders
    where orders.buyer_user_id = actor and orders.idempotency_key = p_idempotency_key for update;
  if existing.id is not null then
    if existing.event_id <> target.id or existing.status not in ('pending', 'paid')
      or not exists (select 1 from public.campus_event_ticket_order_items item
        join public.campus_event_ticket_types kind on kind.id = item.ticket_type_id
        where item.order_id = existing.id and kind.public_id = p_ticket_public_id and item.quantity = 1) then
      raise exception 'ticket request key already used' using errcode = '22023';
    end if;
    select * into attempt from public.campus_event_payment_attempts item
      where item.order_id = existing.id and item.provider = 'autogopay';
    return query select existing.public_id, existing.total_amount, false, attempt.checkout_url;
    return;
  end if;
  select rsvp.status into registration_status from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.id and rsvp.user_id = actor for update;
  if registration_status is distinct from 'going' then
    raise exception 'confirmed event registration required' using errcode = 'P0001';
  end if;
  select orders.id into active_order_id from public.campus_event_ticket_orders orders
    where orders.event_id = target.id and orders.buyer_user_id = actor
      and orders.status in ('pending', 'paid', 'free') for update;
  if active_order_id is not null then raise exception 'ticket already held for this event' using errcode = 'P0001'; end if;
  select * into ticket from public.campus_event_ticket_types item
    where item.event_id = target.id and item.public_id = p_ticket_public_id for update;
  if ticket.id is null or ticket.status <> 'on_sale' or ticket.access_type <> 'public'
    or ticket.price_amount not between 1 and 10000000
    or ticket.min_per_order <> 1 or ticket.max_per_order <> 1
    or (ticket.sales_start_at is not null and ticket.sales_start_at > timezone('utc', now()))
    or (ticket.sales_end_at is not null and ticket.sales_end_at <= timezone('utc', now()))
    or ticket.quantity_total - ticket.quantity_sold - ticket.quantity_reserved < 1 then
    raise exception 'event ticket order unavailable' using errcode = 'P0001';
  end if;
  insert into public.campus_event_ticket_orders (
    event_id, buyer_user_id, status, subtotal_amount, total_amount, idempotency_key, expires_at
  ) values (target.id, actor, 'pending', ticket.price_amount, ticket.price_amount,
    p_idempotency_key, timezone('utc', now()) + interval '20 minutes') returning * into created;
  insert into public.campus_event_ticket_order_items (order_id, ticket_type_id, quantity, unit_amount)
    values (created.id, ticket.id, 1, ticket.price_amount);
  insert into public.campus_event_payment_attempts (order_id, provider, status, amount)
    values (created.id, 'autogopay', 'created', ticket.price_amount);
  update public.campus_event_ticket_types set quantity_reserved = quantity_reserved + 1,
    updated_at = timezone('utc', now()) where id = ticket.id;
  return query select created.public_id, created.total_amount, true, null::text;
end; $$;

create or replace function public.attach_campus_event_autogopay_payment(
  p_order_public_id text, p_transaction_id text, p_provider_order_id text,
  p_checkout_url text, p_expires_at timestamptz
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target public.campus_event_ticket_orders%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if char_length(coalesce(p_transaction_id, '')) not between 1 and 160
    or char_length(coalesce(p_provider_order_id, '')) not between 1 and 160
    or p_checkout_url !~ '^https://autogopay[.]site/pay/[A-Za-z0-9_-]{1,200}$'
    or p_expires_at <= timezone('utc', now())
    or p_expires_at > timezone('utc', now()) + interval '30 minutes' then
    raise exception 'invalid provider payment' using errcode = '22023';
  end if;
  select * into target from public.campus_event_ticket_orders orders
    where orders.public_id = p_order_public_id for update;
  if target.id is null or target.status <> 'pending' or target.expires_at <= timezone('utc', now()) then
    return false;
  end if;
  update public.campus_event_payment_attempts attempt set provider_reference = p_transaction_id,
    provider_order_id = p_provider_order_id, checkout_url = p_checkout_url,
    expires_at = p_expires_at, status = 'pending', updated_at = timezone('utc', now())
    where attempt.order_id = target.id and attempt.provider = 'autogopay' and attempt.status = 'created';
  if not found then return false; end if;
  update public.campus_event_ticket_orders set expires_at = p_expires_at,
    updated_at = timezone('utc', now()) where id = target.id;
  return true;
end; $$;

create or replace function public.get_my_campus_event_ticket_payment(p_order_public_id text)
returns table (order_public_id text, status text, total_amount integer,
  checkout_url text, expires_at timestamptz, provider_transaction_id text,
  payment_status text)
language sql stable security definer set search_path = '' as $$
  select orders.public_id, orders.status, orders.total_amount, attempt.checkout_url,
    orders.expires_at, attempt.provider_reference, attempt.status
  from public.campus_event_ticket_orders orders
  join public.campus_event_payment_attempts attempt on attempt.order_id = orders.id
    and attempt.provider = 'autogopay'
  where orders.public_id = p_order_public_id and orders.buyer_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.list_campus_event_ticket_orders(p_event_public_slug text)
returns table (
  order_public_id text, ticket_name text, quantity integer, status text,
  subtotal_amount integer, discount_amount integer, total_amount integer,
  currency text, created_at timestamptz, expires_at timestamptz, paid_at timestamptz,
  refunded_amount integer
)
language plpgsql security definer set search_path = '' stable as $$
declare actor uuid := auth.uid(); target public.campus_events%rowtype;
begin
  select * into target from public.campus_events event where event.public_slug = p_event_public_slug;
  if actor is null or target.id is null or not public.event_can_manage_registrations(target.id, actor) then
    raise exception 'event ticket management required' using errcode = '42501';
  end if;
  return query select orders.public_id, ticket.name, item.quantity,
    case when orders.status <> 'paid' and exists (
      select 1 from public.campus_event_payment_attempts payment
      where payment.order_id = orders.id and payment.status = 'paid'
    ) then 'payment_review' else orders.status end,
    orders.subtotal_amount, orders.discount_amount, orders.total_amount, orders.currency,
    orders.created_at, orders.expires_at, orders.paid_at, orders.refunded_amount
  from public.campus_event_ticket_orders orders
  join public.campus_event_ticket_order_items item on item.order_id = orders.id
  join public.campus_event_ticket_types ticket on ticket.id = item.ticket_type_id
  where orders.event_id = target.id order by orders.created_at desc limit 500;
end; $$;

create or replace function public.finalize_campus_event_autogopay_payment(
  p_transaction_id text, p_provider_order_id text, p_amount_idr integer,
  p_payload_hash text, p_paid_at timestamptz
)
returns text language plpgsql security definer set search_path = '' as $$
declare attempt public.campus_event_payment_attempts%rowtype;
  target public.campus_event_ticket_orders%rowtype;
  item public.campus_event_ticket_order_items%rowtype;
  registration_status text; event_status text;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if char_length(coalesce(p_transaction_id, '')) not between 1 and 160
    or char_length(coalesce(p_provider_order_id, '')) not between 1 and 160
    or p_amount_idr not between 1 and 10000000
    or p_payload_hash !~ '^[0-9a-f]{64}$'
    or p_paid_at is null or p_paid_at > timezone('utc', now()) + interval '10 minutes' then
    raise exception 'invalid paid transaction' using errcode = '22023';
  end if;
  select * into attempt from public.campus_event_payment_attempts payment
    where payment.provider = 'autogopay' and payment.provider_reference = p_transaction_id for update;
  if attempt.id is null then return 'unknown'; end if;
  select * into target from public.campus_event_ticket_orders orders
    where orders.id = attempt.order_id for update;
  if attempt.provider_order_id is distinct from p_provider_order_id
    or attempt.amount <> p_amount_idr or target.total_amount <> p_amount_idr then
    return 'mismatch';
  end if;
  if attempt.status = 'paid' then return 'duplicate'; end if;
  if attempt.status = 'refunded' then return 'duplicate'; end if;
  if attempt.status <> 'pending' then return 'review'; end if;
  insert into public.campus_event_payment_webhooks (provider, event_id, payload_hash)
    values ('autogopay', p_transaction_id, p_payload_hash)
    on conflict (provider, event_id) do nothing;
  if not found then return 'duplicate'; end if;
  update public.campus_event_payment_attempts set status = 'paid', updated_at = timezone('utc', now())
    where id = attempt.id;
  select * into item from public.campus_event_ticket_order_items entry where entry.order_id = target.id;
  select event.status into event_status from public.campus_events event where event.id = target.event_id;
  select rsvp.status into registration_status from public.campus_event_rsvps rsvp
    where rsvp.event_id = target.event_id and rsvp.user_id = target.buyer_user_id for update;
  if target.status <> 'pending' or event_status is distinct from 'scheduled'
    or registration_status is distinct from 'going' then
    update public.campus_event_payment_webhooks set processed_at = timezone('utc', now()),
      processing_error = 'manual_review_required'
      where provider = 'autogopay' and event_id = p_transaction_id;
    return 'review';
  end if;
  update public.campus_event_ticket_types set quantity_reserved = quantity_reserved - item.quantity,
    quantity_sold = quantity_sold + item.quantity, updated_at = timezone('utc', now())
    where id = item.ticket_type_id and quantity_reserved >= item.quantity;
  if not found then
    update public.campus_event_payment_webhooks set processed_at = timezone('utc', now()),
      processing_error = 'manual_review_required'
      where provider = 'autogopay' and event_id = p_transaction_id;
    return 'review';
  end if;
  update public.campus_event_ticket_orders set status = 'paid', paid_at = p_paid_at,
    updated_at = timezone('utc', now()) where id = target.id;
  update public.campus_event_payment_webhooks set processed_at = timezone('utc', now())
    where provider = 'autogopay' and event_id = p_transaction_id;
  return 'paid';
end; $$;

revoke all on function public.guard_campus_event_ticket_price() from public, anon, authenticated;
revoke all on function public.publish_campus_event_paid_ticket(text) from public, anon;
grant execute on function public.publish_campus_event_paid_ticket(text) to authenticated;
revoke all on function public.reserve_my_campus_event_paid_ticket(text,text,text) from public, anon;
grant execute on function public.reserve_my_campus_event_paid_ticket(text,text,text) to authenticated;
revoke all on function public.attach_campus_event_autogopay_payment(text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.attach_campus_event_autogopay_payment(text,text,text,text,timestamptz) to service_role;
revoke all on function public.get_my_campus_event_ticket_payment(text) from public, anon;
grant execute on function public.get_my_campus_event_ticket_payment(text) to authenticated;
revoke all on function public.finalize_campus_event_autogopay_payment(text,text,integer,text,timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_campus_event_autogopay_payment(text,text,integer,text,timestamptz) to service_role;
