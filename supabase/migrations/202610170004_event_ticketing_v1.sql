-- Campus Event ticketing v1. Disabled at application level until live verification.
-- Money is stored as integer rupiah. No card or bank credentials are stored here.

create table public.campus_event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('ett_' || encode(extensions.gen_random_bytes(12), 'hex')),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 280),
  access_type text not null default 'public' check (access_type in ('public', 'code', 'invite_only')),
  price_amount integer not null default 0 check (price_amount between 0 and 50000000),
  currency text not null default 'IDR' check (currency = 'IDR'),
  quantity_total integer not null check (quantity_total between 1 and 10000),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  min_per_order integer not null default 1 check (min_per_order between 1 and 10),
  max_per_order integer not null default 1 check (max_per_order between 1 and 10),
  sales_start_at timestamptz null,
  sales_end_at timestamptz null,
  sort_order smallint not null default 0,
  status text not null default 'draft' check (status in ('draft', 'on_sale', 'paused', 'ended', 'archived')),
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (min_per_order <= max_per_order),
  check (quantity_reserved + quantity_sold <= quantity_total),
  check (sales_end_at is null or sales_start_at is null or sales_end_at > sales_start_at)
);

create index campus_event_ticket_types_event_idx
  on public.campus_event_ticket_types (event_id, sort_order, created_at);

create table public.campus_event_discount_codes (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('edc_' || encode(extensions.gen_random_bytes(12), 'hex')),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  code_hash text not null,
  code_hint text not null check (char_length(code_hint) between 2 and 8),
  purpose text not null check (purpose in ('discount', 'unlock')),
  discount_type text null check (discount_type in ('fixed', 'percent')),
  discount_value integer not null default 0 check (discount_value >= 0),
  max_redemptions integer null check (max_redemptions between 1 and 10000),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  starts_at timestamptz null,
  ends_at timestamptz null,
  status text not null default 'active' check (status in ('active', 'paused', 'expired')),
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, code_hash),
  check ((purpose = 'unlock' and discount_type is null and discount_value = 0)
    or (purpose = 'discount' and discount_type is not null and discount_value > 0)),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.campus_event_ticket_orders (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('eto_' || encode(extensions.gen_random_bytes(12), 'hex')),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  buyer_user_id uuid null references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'free', 'expired', 'cancelled', 'refunded', 'partially_refunded')),
  currency text not null default 'IDR' check (currency = 'IDR'),
  subtotal_amount integer not null default 0 check (subtotal_amount >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  total_amount integer not null default 0 check (total_amount >= 0),
  discount_code_id uuid null references public.campus_event_discount_codes (id) on delete set null,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 100),
  expires_at timestamptz null,
  paid_at timestamptz null,
  cancelled_at timestamptz null,
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (buyer_user_id, idempotency_key),
  check (discount_amount <= subtotal_amount),
  check (total_amount = subtotal_amount - discount_amount),
  check (refunded_amount <= total_amount)
);

create index campus_event_ticket_orders_buyer_idx
  on public.campus_event_ticket_orders (buyer_user_id, created_at desc);
create index campus_event_ticket_orders_event_idx
  on public.campus_event_ticket_orders (event_id, status, created_at desc);
create unique index campus_event_ticket_orders_one_active_per_buyer_idx
  on public.campus_event_ticket_orders (event_id, buyer_user_id)
  where buyer_user_id is not null and status in ('pending', 'paid', 'free');

create table public.campus_event_ticket_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.campus_event_ticket_orders (id) on delete cascade,
  ticket_type_id uuid not null references public.campus_event_ticket_types (id) on delete restrict,
  quantity integer not null check (quantity between 1 and 10),
  unit_amount integer not null check (unit_amount >= 0),
  line_amount integer generated always as (quantity * unit_amount) stored,
  created_at timestamptz not null default timezone('utc', now()),
  unique (order_id, ticket_type_id)
);

create table public.campus_event_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.campus_event_ticket_orders (id) on delete cascade,
  provider text not null check (provider in ('manual', 'autogopay', 'midtrans', 'xendit')),
  provider_reference text null,
  status text not null default 'created' check (status in ('created', 'pending', 'paid', 'failed', 'expired', 'refunded')),
  amount integer not null check (amount >= 0),
  checkout_url text null,
  expires_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_reference)
);

create table public.campus_event_payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload_hash text not null,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz null,
  processing_error text null,
  unique (provider, event_id)
);

alter table public.campus_event_ticket_types enable row level security;
alter table public.campus_event_discount_codes enable row level security;
alter table public.campus_event_ticket_orders enable row level security;
alter table public.campus_event_ticket_order_items enable row level security;
alter table public.campus_event_payment_attempts enable row level security;
alter table public.campus_event_payment_webhooks enable row level security;

revoke all on table public.campus_event_ticket_types from public, anon, authenticated;
revoke all on table public.campus_event_discount_codes from public, anon, authenticated;
revoke all on table public.campus_event_ticket_orders from public, anon, authenticated;
revoke all on table public.campus_event_ticket_order_items from public, anon, authenticated;
revoke all on table public.campus_event_payment_attempts from public, anon, authenticated;
revoke all on table public.campus_event_payment_webhooks from public, anon, authenticated;

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
        and ticket.access_type = 'public' and ticket.price_amount = 0
      ))
    order by ticket.sort_order, ticket.created_at;
end; $$;

create or replace function public.upsert_campus_event_ticket_type(
  p_event_public_slug text, p_ticket_public_id text, p_name text, p_description text,
  p_access_type text, p_price_amount integer, p_quantity_total integer,
  p_min_per_order integer, p_max_per_order integer, p_sales_start_at timestamptz,
  p_sales_end_at timestamptz, p_status text
)
returns text language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.campus_events%rowtype; result text;
  reserved integer; sold integer; old_price integer; old_access text;
begin
  select * into target from public.campus_events event where event.public_slug = p_event_public_slug for update;
  if actor is null or target.id is null or not public.event_can_manage_registrations(target.id, actor) then
    raise exception 'event ticket management required' using errcode = '42501';
  end if;
  if target.status <> 'scheduled' or target.starts_at <= timezone('utc', now()) then
    raise exception 'event ticket sales unavailable' using errcode = 'P0001';
  end if;
  if p_status = 'on_sale' and (p_access_type <> 'public' or p_price_amount <> 0
    or p_min_per_order > 1) then
    raise exception 'only free public tickets can go on sale' using errcode = 'P0001';
  end if;
  if p_ticket_public_id is null then
    if (select count(*) from public.campus_event_ticket_types where event_id = target.id and status <> 'archived') >= 12 then
      raise exception 'event ticket type quota' using errcode = 'P0001';
    end if;
    insert into public.campus_event_ticket_types (
      event_id, name, description, access_type, price_amount, quantity_total,
      min_per_order, max_per_order, sales_start_at, sales_end_at, status, created_by
    ) values (
      target.id, trim(p_name), trim(coalesce(p_description, '')), p_access_type,
      p_price_amount, p_quantity_total, p_min_per_order, p_max_per_order,
      p_sales_start_at, p_sales_end_at, p_status, actor
    ) returning public_id into result;
  else
    select quantity_reserved, quantity_sold, price_amount, access_type
      into reserved, sold, old_price, old_access from public.campus_event_ticket_types
      where event_id = target.id and public_id = p_ticket_public_id for update;
    if not found then raise exception 'event ticket type unavailable' using errcode = 'P0001'; end if;
    if p_quantity_total < reserved + sold then raise exception 'ticket capacity below sold' using errcode = 'P0001'; end if;
    if sold > 0 and (p_price_amount is distinct from old_price
      or p_access_type is distinct from old_access) then
      raise exception 'issued ticket terms cannot change' using errcode = 'P0001';
    end if;
    update public.campus_event_ticket_types set
      name = trim(p_name), description = trim(coalesce(p_description, '')),
      access_type = p_access_type, price_amount = p_price_amount,
      quantity_total = p_quantity_total, min_per_order = p_min_per_order,
      max_per_order = p_max_per_order, sales_start_at = p_sales_start_at,
      sales_end_at = p_sales_end_at, status = p_status,
      updated_at = timezone('utc', now())
    where event_id = target.id and public_id = p_ticket_public_id
    returning public_id into result;
  end if;
  return result;
end; $$;

create or replace function public.create_campus_event_ticket_order(
  p_event_public_slug text, p_ticket_public_id text, p_quantity integer,
  p_idempotency_key text, p_code_hash text default null
)
returns table (order_public_id text, order_status text, total_amount integer, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); target public.campus_events%rowtype;
  ticket public.campus_event_ticket_types%rowtype; discount public.campus_event_discount_codes%rowtype;
  existing public.campus_event_ticket_orders%rowtype; created public.campus_event_ticket_orders%rowtype;
  subtotal integer; reduction integer := 0; final integer;
  registration_status text; active_order_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 100 then
    raise exception 'invalid ticket request' using errcode = '22023';
  end if;
  select * into target from public.campus_events event
    where event.public_slug = p_event_public_slug and event.status = 'scheduled' for update;
  if target.id is null then raise exception 'event ticket order unavailable' using errcode = 'P0001'; end if;
  select * into existing from public.campus_event_ticket_orders
    where buyer_user_id = actor and idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.event_id <> (select event.id from public.campus_events event where event.public_slug = p_event_public_slug)
      or not exists (
        select 1 from public.campus_event_ticket_order_items item
        join public.campus_event_ticket_types item_type on item_type.id = item.ticket_type_id
        where item.order_id = existing.id and item_type.public_id = p_ticket_public_id
          and item.quantity = p_quantity
      ) then
      raise exception 'ticket request key already used' using errcode = '22023';
    end if;
    return query select existing.public_id, existing.status, existing.total_amount, existing.expires_at;
    return;
  end if;
  -- Match the RSVP cancellation lock order: RSVP, order, then ticket.
  select registration.status into registration_status
    from public.campus_event_rsvps registration
    where registration.event_id = target.id and registration.user_id = actor
    for update;
  if registration_status is distinct from 'going' then
    raise exception 'confirmed event registration required' using errcode = 'P0001';
  end if;
  select orders.id into active_order_id from public.campus_event_ticket_orders orders
    where orders.event_id = target.id and orders.buyer_user_id = actor
      and orders.status in ('pending', 'paid', 'free') for update;
  if active_order_id is not null then
    raise exception 'ticket already held for this event' using errcode = 'P0001';
  end if;
  select * into ticket from public.campus_event_ticket_types item
    where item.event_id = target.id and item.public_id = p_ticket_public_id for update;
  if target.id is null or ticket.id is null or ticket.status <> 'on_sale'
    or target.starts_at <= timezone('utc', now())
    or (ticket.sales_start_at is not null and ticket.sales_start_at > timezone('utc', now()))
    or (ticket.sales_end_at is not null and ticket.sales_end_at <= timezone('utc', now()))
    or p_quantity not between ticket.min_per_order and ticket.max_per_order
    or ticket.quantity_total - ticket.quantity_reserved - ticket.quantity_sold < p_quantity then
    raise exception 'event ticket order unavailable' using errcode = 'P0001';
  end if;
  -- Paid checkout and private invitations need a verified provider/invite flow.
  if ticket.price_amount <> 0 or ticket.access_type <> 'public' or p_quantity <> 1 then
    raise exception 'paid or private ticket checkout unavailable' using errcode = 'P0001';
  end if;
  if p_code_hash is not null then
    select * into discount from public.campus_event_discount_codes code
      where code.event_id = target.id and code.code_hash = p_code_hash and code.status = 'active'
        and (code.starts_at is null or code.starts_at <= timezone('utc', now()))
        and (code.ends_at is null or code.ends_at > timezone('utc', now()))
        and (code.max_redemptions is null or code.redemption_count < code.max_redemptions)
      for update;
    if discount.id is null or discount.purpose <> 'discount' then
      raise exception 'event ticket code invalid' using errcode = '42501';
    end if;
  end if;
  subtotal := ticket.price_amount * p_quantity;
  if discount.purpose = 'discount' then
    reduction := case when discount.discount_type = 'percent'
      then floor(subtotal * discount.discount_value / 100.0)::integer
      else least(subtotal, discount.discount_value) end;
  end if;
  final := subtotal - reduction;
  insert into public.campus_event_ticket_orders (
    event_id, buyer_user_id, status, subtotal_amount, discount_amount, total_amount,
    discount_code_id, idempotency_key, expires_at, paid_at
  ) values (
    target.id, actor, 'free', subtotal, reduction, final,
    discount.id, p_idempotency_key, null, timezone('utc', now())
  ) returning * into created;
  insert into public.campus_event_ticket_order_items (order_id, ticket_type_id, quantity, unit_amount)
    values (created.id, ticket.id, p_quantity, ticket.price_amount);
  update public.campus_event_ticket_types set quantity_sold = quantity_sold + p_quantity,
    updated_at = timezone('utc', now()) where id = ticket.id;
  if discount.id is not null then
    update public.campus_event_discount_codes set redemption_count = redemption_count + 1 where id = discount.id;
  end if;
  return query select created.public_id, created.status, created.total_amount, created.expires_at;
end; $$;

create or replace function public.list_my_campus_event_ticket_orders(p_event_public_slug text)
returns table (
  order_public_id text, ticket_name text, quantity integer, status text,
  total_amount integer, currency text, expires_at timestamptz, created_at timestamptz
)
language sql security definer set search_path = '' stable as $$
  select orders.public_id, ticket.name, item.quantity, orders.status,
    orders.total_amount, orders.currency, orders.expires_at, orders.created_at
  from public.campus_event_ticket_orders orders
  join public.campus_events event on event.id = orders.event_id
  join public.campus_event_ticket_order_items item on item.order_id = orders.id
  join public.campus_event_ticket_types ticket on ticket.id = item.ticket_type_id
  where orders.buyer_user_id = auth.uid() and event.public_slug = p_event_public_slug
  order by orders.created_at desc;
$$;

revoke all on function public.list_campus_event_ticket_types(text) from public, anon;
revoke all on function public.upsert_campus_event_ticket_type(text,text,text,text,text,integer,integer,integer,integer,timestamptz,timestamptz,text) from public, anon;
revoke all on function public.create_campus_event_ticket_order(text,text,integer,text,text) from public, anon;
revoke all on function public.list_my_campus_event_ticket_orders(text) from public, anon;
grant execute on function public.list_campus_event_ticket_types(text) to authenticated;
grant execute on function public.upsert_campus_event_ticket_type(text,text,text,text,text,integer,integer,integer,integer,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.create_campus_event_ticket_order(text,text,integer,text,text) to authenticated;
grant execute on function public.list_my_campus_event_ticket_orders(text) to authenticated;

comment on table public.campus_event_payment_webhooks is
  'Idempotency ledger only. Store a digest, never raw webhook secrets or full payment payloads.';
