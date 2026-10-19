-- Free code-gated admission. The database validates the code and capacity atomically.
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
        and ((ticket.access_type in ('public', 'code') and ticket.price_amount = 0) or (
          ticket.access_type = 'public' and
          ticket.price_amount between 1 and 10000000
          and exists (select 1 from public.campus_event_payment_settings setting
            where setting.singleton and setting.is_enabled)
        ))
      ))
    order by ticket.sort_order, ticket.created_at;
end; $$;

create or replace function public.publish_campus_event_code_ticket(p_ticket_public_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.campus_events%rowtype;
  ticket public.campus_event_ticket_types%rowtype;
begin
  select event.* into target from public.campus_events event
    join public.campus_event_ticket_types item on item.event_id = event.id
    where item.public_id = p_ticket_public_id for update of event;
  if actor is null or target.id is null
    or not coalesce(public.event_can_manage_registrations(target.id, actor), false) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  select * into ticket from public.campus_event_ticket_types item
    where item.event_id = target.id and item.public_id = p_ticket_public_id for update;
  if target.status <> 'scheduled' or target.starts_at <= timezone('utc', now())
    or ticket.access_type <> 'code' or ticket.price_amount <> 0
    or ticket.min_per_order <> 1 or ticket.max_per_order <> 1
    or ticket.status not in ('draft', 'paused')
    or not exists (select 1 from public.campus_event_discount_codes code
      where code.event_id = target.id and code.purpose = 'unlock' and code.status = 'active'
        and (code.ends_at is null or code.ends_at > timezone('utc', now()))
        and (code.max_redemptions is null or code.redemption_count < code.max_redemptions)) then
    raise exception 'code ticket configuration unavailable' using errcode = 'P0001';
  end if;
  update public.campus_event_ticket_types set status = 'on_sale',
    updated_at = timezone('utc', now()) where id = ticket.id;
  return true;
end; $$;

create or replace function public.create_my_campus_event_code_ticket_order(
  p_event_public_slug text, p_ticket_public_id text, p_idempotency_key text, p_code_hash text
)
returns table (order_public_id text, order_status text, total_amount integer, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.campus_events%rowtype;
  ticket public.campus_event_ticket_types%rowtype;
  access_code public.campus_event_discount_codes%rowtype;
  existing public.campus_event_ticket_orders%rowtype;
  created public.campus_event_ticket_orders%rowtype;
  registration_status text; active_order_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 100
    or p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid ticket request' using errcode = '22023';
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_event_public_slug and event.status = 'scheduled'
      and event.starts_at > timezone('utc', now()) for update;
  if target.id is null then raise exception 'event ticket order unavailable' using errcode = 'P0001'; end if;
  select * into existing from public.campus_event_ticket_orders orders
    where orders.buyer_user_id = actor and orders.idempotency_key = p_idempotency_key for update;
  if existing.id is not null then
    if existing.event_id <> target.id or existing.discount_code_id is null
      or not exists (select 1 from public.campus_event_discount_codes code
        where code.id = existing.discount_code_id and code.event_id = target.id
          and code.code_hash = p_code_hash and code.purpose = 'unlock')
      or not exists (select 1 from public.campus_event_ticket_order_items item
        join public.campus_event_ticket_types kind on kind.id = item.ticket_type_id
        where item.order_id = existing.id and kind.public_id = p_ticket_public_id
          and kind.access_type = 'code' and item.quantity = 1) then
      raise exception 'ticket request key already used' using errcode = '22023';
    end if;
    return query select existing.public_id, existing.status, existing.total_amount, existing.expires_at;
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
  if ticket.id is null or ticket.status <> 'on_sale' or ticket.access_type <> 'code'
    or ticket.price_amount <> 0 or ticket.min_per_order <> 1 or ticket.max_per_order <> 1
    or (ticket.sales_start_at is not null and ticket.sales_start_at > timezone('utc', now()))
    or (ticket.sales_end_at is not null and ticket.sales_end_at <= timezone('utc', now()))
    or ticket.quantity_total - ticket.quantity_sold - ticket.quantity_reserved < 1 then
    raise exception 'event ticket order unavailable' using errcode = 'P0001';
  end if;
  select * into access_code from public.campus_event_discount_codes code
    where code.event_id = target.id and code.code_hash = p_code_hash
      and code.purpose = 'unlock' and code.status = 'active'
      and (code.starts_at is null or code.starts_at <= timezone('utc', now()))
      and (code.ends_at is null or code.ends_at > timezone('utc', now()))
      and (code.max_redemptions is null or code.redemption_count < code.max_redemptions)
    for update;
  if access_code.id is null then raise exception 'event ticket code invalid' using errcode = '42501'; end if;
  insert into public.campus_event_ticket_orders (
    event_id, buyer_user_id, status, subtotal_amount, discount_amount, total_amount,
    discount_code_id, idempotency_key, paid_at
  ) values (target.id, actor, 'free', 0, 0, 0, access_code.id,
    p_idempotency_key, timezone('utc', now())) returning * into created;
  insert into public.campus_event_ticket_order_items (order_id, ticket_type_id, quantity, unit_amount)
    values (created.id, ticket.id, 1, 0);
  update public.campus_event_ticket_types set quantity_sold = quantity_sold + 1,
    updated_at = timezone('utc', now()) where id = ticket.id;
  update public.campus_event_discount_codes set redemption_count = redemption_count + 1
    where id = access_code.id;
  return query select created.public_id, created.status, created.total_amount, created.expires_at;
end; $$;

revoke all on function public.publish_campus_event_code_ticket(text) from public, anon;
revoke all on function public.create_my_campus_event_code_ticket_order(text,text,text,text) from public, anon;
grant execute on function public.publish_campus_event_code_ticket(text) to authenticated;
grant execute on function public.create_my_campus_event_code_ticket_order(text,text,text,text) to authenticated;

