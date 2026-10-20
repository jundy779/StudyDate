-- Event ticket order expiry guard v2.
--
-- Versi 202610190001 memeriksa current_setting('request.jwt.claim.role'). Pengaturan
-- lama itu tidak lagi diisi oleh PostgREST versi sekarang (yang memakai
-- request.jwt.claims), sehingga panggilan service role bisa ditolak. Semua fungsi
-- lain di StudyDate memakai auth.role(), jadi fungsi ini disamakan.
--
-- Pemanggilan dari pg_cron (session_user postgres atau supabase_admin) juga
-- diizinkan, sama seperti product_scheduler_tick(), supaya pesanan tiket yang
-- kedaluwarsa bisa dibereskan tanpa Vercel Cron kedua. Jadwalnya TIDAK dibuat
-- di migration ini; lihat docs/operations/event-activation-plan.md.
--
-- Isi logika pembersihan tidak berubah.

create or replace function public.expire_campus_event_ticket_orders(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  processed integer := 0;
begin
  if session_user not in ('postgres', 'supabase_admin')
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  for target in
    select orders.id, orders.discount_code_id
    from public.campus_event_ticket_orders orders
    where orders.status = 'pending'
      and orders.expires_at <= timezone('utc', now())
    order by orders.expires_at
    for update skip locked
    limit least(greatest(p_limit, 1), 1000)
  loop
    update public.campus_event_ticket_types ticket set
      quantity_reserved = greatest(0, ticket.quantity_reserved - item.quantity),
      updated_at = timezone('utc', now())
    from public.campus_event_ticket_order_items item
    where item.order_id = target.id and ticket.id = item.ticket_type_id;

    update public.campus_event_discount_codes
    set redemption_count = greatest(0, redemption_count - 1)
    where id = target.discount_code_id;

    update public.campus_event_ticket_orders
    set status = 'expired', updated_at = timezone('utc', now())
    where id = target.id;

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.expire_campus_event_ticket_orders(integer)
  from public, anon, authenticated;
grant execute on function public.expire_campus_event_ticket_orders(integer)
  to service_role;
