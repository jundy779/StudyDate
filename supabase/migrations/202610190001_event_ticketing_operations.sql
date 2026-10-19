-- Event ticketing operations: codes, organizer order view, expiry and reconciliation.

create or replace function public.list_campus_event_discount_codes(p_event_public_slug text)
returns table (
  code_public_id text, code_hint text, purpose text, discount_type text,
  discount_value integer, max_redemptions integer, redemption_count integer,
  starts_at timestamptz, ends_at timestamptz, status text, created_at timestamptz
)
language plpgsql security definer set search_path = '' stable as $$
declare actor uuid := auth.uid(); target public.campus_events%rowtype;
begin
  select * into target from public.campus_events event where event.public_slug = p_event_public_slug;
  if actor is null or target.id is null or not public.event_can_manage_registrations(target.id, actor) then
    raise exception 'event ticket management required' using errcode = '42501';
  end if;
  return query select code.public_id, code.code_hint, code.purpose,
    code.discount_type, code.discount_value, code.max_redemptions,
    code.redemption_count, code.starts_at, code.ends_at, code.status, code.created_at
  from public.campus_event_discount_codes code
  where code.event_id = target.id order by code.created_at desc;
end; $$;

create or replace function public.upsert_campus_event_discount_code(
  p_event_public_slug text, p_code_public_id text, p_code_hash text, p_code_hint text,
  p_purpose text, p_discount_type text, p_discount_value integer,
  p_max_redemptions integer, p_starts_at timestamptz, p_ends_at timestamptz, p_status text
)
returns text language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.campus_events%rowtype; result text; used integer;
begin
  select * into target from public.campus_events event where event.public_slug = p_event_public_slug for update;
  if actor is null or target.id is null or not public.event_can_manage_registrations(target.id, actor) then
    raise exception 'event ticket management required' using errcode = '42501';
  end if;
  if p_code_public_id is null then
    if p_code_hash is null or char_length(p_code_hash) <> 64 then
      raise exception 'event ticket code invalid' using errcode = 'P0001';
    end if;
    if (select count(*) from public.campus_event_discount_codes where event_id = target.id and status = 'active') >= 30 then
      raise exception 'event ticket code quota' using errcode = 'P0001';
    end if;
    insert into public.campus_event_discount_codes (
      event_id, code_hash, code_hint, purpose, discount_type, discount_value,
      max_redemptions, starts_at, ends_at, status, created_by
    ) values (
      target.id, p_code_hash, upper(trim(p_code_hint)), p_purpose, p_discount_type,
      p_discount_value, p_max_redemptions, p_starts_at, p_ends_at, p_status, actor
    ) returning public_id into result;
  else
    select redemption_count into used from public.campus_event_discount_codes
      where event_id = target.id and public_id = p_code_public_id for update;
    if not found then raise exception 'event ticket code unavailable' using errcode = 'P0001'; end if;
    if p_max_redemptions is not null and p_max_redemptions < used then
      raise exception 'code limit below usage' using errcode = 'P0001';
    end if;
    update public.campus_event_discount_codes set
      purpose = p_purpose, discount_type = p_discount_type,
      discount_value = p_discount_value, max_redemptions = p_max_redemptions,
      starts_at = p_starts_at, ends_at = p_ends_at, status = p_status
    where event_id = target.id and public_id = p_code_public_id
    returning public_id into result;
  end if;
  return result;
end; $$;

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
  return query select orders.public_id, ticket.name, item.quantity, orders.status,
    orders.subtotal_amount, orders.discount_amount, orders.total_amount, orders.currency,
    orders.created_at, orders.expires_at, orders.paid_at, orders.refunded_amount
  from public.campus_event_ticket_orders orders
  join public.campus_event_ticket_order_items item on item.order_id = orders.id
  join public.campus_event_ticket_types ticket on ticket.id = item.ticket_type_id
  where orders.event_id = target.id order by orders.created_at desc limit 500;
end; $$;

create or replace function public.cancel_my_campus_event_ticket_order(p_order_public_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.campus_event_ticket_orders%rowtype;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into target from public.campus_event_ticket_orders orders
    where orders.public_id = p_order_public_id and orders.buyer_user_id = actor for update;
  -- Confirmed free tickets follow the existing RSVP cancellation flow.
  if target.id is null or target.status <> 'pending' then return false; end if;
  update public.campus_event_ticket_types ticket set
    quantity_reserved = greatest(0, ticket.quantity_reserved - item.quantity),
    updated_at = timezone('utc', now())
  from public.campus_event_ticket_order_items item
  where item.order_id = target.id and ticket.id = item.ticket_type_id;
  update public.campus_event_discount_codes set redemption_count = greatest(0, redemption_count - 1)
    where id = target.discount_code_id;
  update public.campus_event_ticket_orders set status = 'cancelled',
    cancelled_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = target.id;
  return true;
end; $$;

create or replace function public.release_campus_event_ticket_after_rsvp()
returns trigger language plpgsql security definer set search_path = '' as $$
declare order_row record;
begin
  if old.status = 'going' and new.status <> 'going' then
    for order_row in
      select orders.id, orders.discount_code_id, item.ticket_type_id, item.quantity
      from public.campus_event_ticket_orders orders
      join public.campus_event_ticket_order_items item on item.order_id = orders.id
      where orders.event_id = new.event_id and orders.buyer_user_id = new.user_id
        and orders.status = 'free' for update of orders
    loop
      update public.campus_event_ticket_types set quantity_sold = greatest(0, quantity_sold - order_row.quantity),
        updated_at = timezone('utc', now()) where id = order_row.ticket_type_id;
      update public.campus_event_discount_codes set redemption_count = greatest(0, redemption_count - 1)
        where id = order_row.discount_code_id;
      update public.campus_event_ticket_orders set status = 'cancelled', cancelled_at = timezone('utc', now()),
        updated_at = timezone('utc', now()) where id = order_row.id;
    end loop;
  end if;
  return new;
end; $$;
create trigger campus_event_rsvps_release_ticket_order
after update of status on public.campus_event_rsvps
for each row execute function public.release_campus_event_ticket_after_rsvp();

create or replace function public.expire_campus_event_ticket_orders(p_limit integer default 500)
returns integer language plpgsql security definer set search_path = '' as $$
declare target record; processed integer := 0;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  for target in
    select orders.id, orders.discount_code_id from public.campus_event_ticket_orders orders
    where orders.status = 'pending' and orders.expires_at <= timezone('utc', now())
    order by orders.expires_at for update skip locked limit least(greatest(p_limit, 1), 1000)
  loop
    update public.campus_event_ticket_types ticket set
      quantity_reserved = greatest(0, ticket.quantity_reserved - item.quantity), updated_at = timezone('utc', now())
    from public.campus_event_ticket_order_items item where item.order_id = target.id and ticket.id = item.ticket_type_id;
    update public.campus_event_discount_codes set redemption_count = greatest(0, redemption_count - 1)
      where id = target.discount_code_id;
    update public.campus_event_ticket_orders set status = 'expired', updated_at = timezone('utc', now()) where id = target.id;
    processed := processed + 1;
  end loop;
  return processed;
end; $$;

create or replace function public.reconcile_campus_event_ticket_payment(
  p_order_public_id text, p_provider text, p_provider_reference text,
  p_provider_event_id text, p_payload_hash text, p_payment_status text
)
returns text language plpgsql security definer set search_path = '' as $$
declare target public.campus_event_ticket_orders%rowtype;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  insert into public.campus_event_payment_webhooks (provider, event_id, payload_hash)
    values (p_provider, p_provider_event_id, p_payload_hash)
    on conflict (provider, event_id) do nothing;
  if not found then return 'duplicate'; end if;
  select * into target from public.campus_event_ticket_orders orders
    where orders.public_id = p_order_public_id for update;
  if target.id is null then raise exception 'ticket order unavailable' using errcode = 'P0001'; end if;
  if p_payment_status = 'paid' and target.status = 'pending' and target.expires_at > timezone('utc', now()) then
    update public.campus_event_ticket_types ticket set
      quantity_reserved = greatest(0, ticket.quantity_reserved - item.quantity),
      quantity_sold = ticket.quantity_sold + item.quantity, updated_at = timezone('utc', now())
    from public.campus_event_ticket_order_items item where item.order_id = target.id and ticket.id = item.ticket_type_id;
    update public.campus_event_ticket_orders set status = 'paid', paid_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = target.id;
  elsif p_payment_status in ('failed', 'expired') and target.status = 'pending' then
    update public.campus_event_ticket_types ticket set
      quantity_reserved = greatest(0, ticket.quantity_reserved - item.quantity), updated_at = timezone('utc', now())
    from public.campus_event_ticket_order_items item where item.order_id = target.id and ticket.id = item.ticket_type_id;
    update public.campus_event_discount_codes set redemption_count = greatest(0, redemption_count - 1) where id = target.discount_code_id;
    update public.campus_event_ticket_orders set status = case when p_payment_status = 'failed' then 'cancelled' else 'expired' end,
      cancelled_at = case when p_payment_status = 'failed' then timezone('utc', now()) else cancelled_at end,
      updated_at = timezone('utc', now()) where id = target.id;
  end if;
  insert into public.campus_event_payment_attempts (order_id, provider, provider_reference, status, amount)
    values (target.id, p_provider, p_provider_reference, p_payment_status, target.total_amount)
    on conflict (provider, provider_reference) do update set status = excluded.status, updated_at = timezone('utc', now());
  update public.campus_event_payment_webhooks set processed_at = timezone('utc', now())
    where provider = p_provider and event_id = p_provider_event_id;
  return p_payment_status;
exception when others then
  update public.campus_event_payment_webhooks set processing_error = left(sqlerrm, 500)
    where provider = p_provider and event_id = p_provider_event_id;
  raise;
end; $$;

revoke all on function public.list_campus_event_discount_codes(text) from public, anon;
revoke all on function public.upsert_campus_event_discount_code(text,text,text,text,text,text,integer,integer,timestamptz,timestamptz,text) from public, anon;
revoke all on function public.list_campus_event_ticket_orders(text) from public, anon;
revoke all on function public.cancel_my_campus_event_ticket_order(text) from public, anon;
revoke all on function public.release_campus_event_ticket_after_rsvp() from public, anon, authenticated;
revoke all on function public.expire_campus_event_ticket_orders(integer) from public, anon, authenticated;
revoke all on function public.reconcile_campus_event_ticket_payment(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.list_campus_event_discount_codes(text) to authenticated;
grant execute on function public.upsert_campus_event_discount_code(text,text,text,text,text,text,integer,integer,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.list_campus_event_ticket_orders(text) to authenticated;
grant execute on function public.cancel_my_campus_event_ticket_order(text) to authenticated;
grant execute on function public.expire_campus_event_ticket_orders(integer) to service_role;
grant execute on function public.reconcile_campus_event_ticket_payment(text,text,text,text,text,text) to service_role;
