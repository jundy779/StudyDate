-- 1) Penanda pendaftar Akses Awal yang mirip (email sama setelah dirapikan).
-- 2) Email pengumuman acara ke peserta yang sudah diterima, lewat antrean yang dikirim server.
-- Forward-only. Tidak mengubah data yang sudah ada.

-- ---------------------------------------------------------------------------
-- 1. Kunci identitas email
-- ---------------------------------------------------------------------------
-- Aturan: huruf kecil, buang "+label" di bagian depan, untuk Gmail buang titik,
-- dan rapikan salah ketik domain yang sering muncul. Ini hanya PENANDA untuk
-- petugas, bukan bukti dua email milik orang yang sama.
create or replace function public.early_access_identity_key(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text := lower(btrim(coalesce(p_email, '')));
  local_part text;
  domain_part text;
begin
  if position('@' in cleaned) = 0 then
    return cleaned;
  end if;
  local_part := split_part(cleaned, '@', 1);
  domain_part := split_part(cleaned, '@', 2);

  domain_part := case domain_part
    when 'googlemail.com' then 'gmail.com'
    when 'gmial.com' then 'gmail.com'
    when 'gmai.com' then 'gmail.com'
    when 'gmal.com' then 'gmail.com'
    when 'gamil.com' then 'gmail.com'
    when 'gmaill.com' then 'gmail.com'
    when 'gmail.co' then 'gmail.com'
    when 'gmail.con' then 'gmail.com'
    when 'gmail.cm' then 'gmail.com'
    when 'gmail.co.id' then 'gmail.com'
    when 'yahoo.co' then 'yahoo.com'
    when 'yaho.com' then 'yahoo.com'
    when 'yahooo.com' then 'yahoo.com'
    when 'hotmial.com' then 'hotmail.com'
    when 'outlok.com' then 'outlook.com'
    else domain_part
  end;

  local_part := split_part(local_part, '+', 1);
  if domain_part = 'gmail.com' then
    local_part := replace(local_part, '.', '');
  end if;

  return local_part || '@' || domain_part;
end;
$$;

create index if not exists early_access_waitlist_identity_key_idx
  on public.early_access_waitlist (public.early_access_identity_key(email));

create or replace function public.get_early_access_duplicate_hints(p_emails text[])
returns table (
  email text,
  similar_email text,
  similar_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.staff_has_ops_capability('early_access.read') then
    raise exception 'early access authorization required' using errcode = '42501';
  end if;
  if p_emails is null or cardinality(p_emails) = 0 then
    return;
  end if;
  if cardinality(p_emails) > 100 then
    raise exception 'too many emails' using errcode = '22023';
  end if;

  return query
  select
    target.email,
    other.email,
    other.status
  from public.early_access_waitlist target
  join public.early_access_waitlist other
    on public.early_access_identity_key(other.email) = public.early_access_identity_key(target.email)
   and lower(other.email) <> lower(target.email)
  where lower(target.email) = any (
    select lower(btrim(input_email)) from unnest(p_emails) as input_email
  )
  order by target.email, other.created_at;
end;
$$;

revoke all on function public.get_early_access_duplicate_hints(text[]) from public, anon;
grant execute on function public.get_early_access_duplicate_hints(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Email pengumuman acara
-- ---------------------------------------------------------------------------

-- Pilihan email per pengguna. Bawaan: menerima email pengumuman dari acara yang
-- diikuti. Token berhenti dipakai tautan "Berhenti menerima email" tanpa login.
create table if not exists public.user_email_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  event_announcements_enabled boolean not null default true,
  unsubscribe_token text not null unique default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.user_email_preferences enable row level security;
revoke all on table public.user_email_preferences from public, anon, authenticated;

alter table public.campus_event_announcements
  add column if not exists email_requested_at timestamptz null;

create table if not exists public.campus_event_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.campus_event_announcements (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  lease_expires_at timestamptz null,
  sent_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (announcement_id, recipient_user_id)
);
create index if not exists campus_event_email_deliveries_claim_idx
  on public.campus_event_email_deliveries (announcement_id, status);
alter table public.campus_event_email_deliveries enable row level security;
revoke all on table public.campus_event_email_deliveries from public, anon, authenticated;

alter table public.campus_event_audit_events
  drop constraint campus_event_audit_type,
  add constraint campus_event_audit_type check (event_type in (
    'created', 'updated', 'rsvp_joined', 'rsvp_cancelled', 'cancelled',
    'archived', 'event_reported', 'organizer_reported',
    'team_invited', 'team_accepted', 'team_declined', 'team_removed',
    'registration_submitted', 'registration_approved',
    'registration_declined', 'ticket_issued', 'ticket_regenerated',
    'checked_in_qr', 'checked_in_manual', 'checkin_undone',
    'official_enabled', 'official_disabled', 'announcement_sent',
    'announcement_email_queued'
  ));

-- Batas harian baru untuk email pengumuman.
alter table public.campus_event_rate_limits
  drop constraint campus_event_rate_limits_bucket,
  add constraint campus_event_rate_limits_bucket check (bucket in (
    'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day',
    'message_minute', 'message_day', 'ticket_regenerate_day',
    'ticket_scan_minute', 'ticket_scan_invalid_hour', 'event_team_invite_hour',
    'checkin_mutation_minute', 'announcement_day', 'calendar_follow',
    'feedback_hour', 'recap_day', 'certificate_day', 'announcement_email_day'
  ));

create or replace function public.consume_campus_event_rate_limit(
  p_actor_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare window_value timestamptz; next_hit integer;
begin
  if p_actor_user_id is null or p_bucket not in (
    'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day',
    'message_minute', 'message_day', 'ticket_regenerate_day',
    'ticket_scan_minute', 'ticket_scan_invalid_hour', 'event_team_invite_hour',
    'checkin_mutation_minute', 'announcement_day', 'calendar_follow',
    'feedback_hour', 'recap_day', 'certificate_day', 'announcement_email_day'
  ) or p_limit < 1 or p_limit > 1000
    or p_window_seconds < 1 or p_window_seconds > 86400 then return false; end if;
  window_value := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / p_window_seconds)
      * p_window_seconds
  );
  insert into public.campus_event_rate_limits as rate (
    actor_user_id, bucket, window_start, hit_count
  ) values (p_actor_user_id, p_bucket, window_value, 1)
  on conflict (actor_user_id, bucket, window_start)
  do update set hit_count = rate.hit_count + 1
    where rate.hit_count < p_limit
  returning hit_count into next_hit;
  return next_hit is not null;
end; $$;

-- Penyelenggara meminta pengumuman juga dikirim lewat email. Hanya sekali per
-- pengumuman, maksimal dua kali sehari per penyelenggara, dan hanya ke peserta
-- yang sudah diterima dan tidak mematikan email pengumuman. Penyelenggara
-- hanya mendapat jumlah, tidak pernah alamat email.
create or replace function public.queue_campus_event_announcement_email(
  p_announcement_public_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  announcement_row public.campus_event_announcements%rowtype;
  event_row public.campus_events%rowtype;
  queued integer := 0;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select announcement.* into announcement_row
  from public.campus_event_announcements announcement
  where announcement.public_id = p_announcement_public_id
  for update;
  if announcement_row.id is null then
    raise exception 'announcement unavailable' using errcode = 'P0002';
  end if;

  select event.* into event_row
  from public.campus_events event
  where event.id = announcement_row.event_id;
  if not public.event_can_manage_registrations(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  if event_row.status <> 'scheduled' then
    raise exception 'event announcement unavailable' using errcode = '22023';
  end if;
  if announcement_row.email_requested_at is not null then
    raise exception 'announcement email already requested' using errcode = 'P0001';
  end if;
  if announcement_row.created_at < timezone('utc', now()) - interval '1 day' then
    raise exception 'announcement email window closed' using errcode = '22023';
  end if;
  if not public.consume_campus_event_rate_limit(
    actor, 'announcement_email_day', 2, 86400
  ) then
    raise exception 'event announcement email rate limited' using errcode = 'P0001';
  end if;

  insert into public.campus_event_email_deliveries (announcement_id, recipient_user_id)
  select announcement_row.id, rsvp.user_id
  from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id
    and rsvp.status = 'going'
    and rsvp.user_id is not null
    and rsvp.user_id <> actor
    and public.is_notification_student(rsvp.user_id)
    and not exists (
      select 1 from public.user_email_preferences preference
      where preference.user_id = rsvp.user_id
        and not preference.event_announcements_enabled
    )
  on conflict (announcement_id, recipient_user_id) do nothing;
  get diagnostics queued = row_count;

  update public.campus_event_announcements announcement
  set email_requested_at = timezone('utc', now())
  where announcement.id = announcement_row.id;

  insert into public.campus_event_audit_events (event_id, actor_user_id, event_type)
  values (event_row.id, actor, 'announcement_email_queued');

  return queued;
end;
$$;

revoke all on function public.queue_campus_event_announcement_email(text) from public, anon;
grant execute on function public.queue_campus_event_announcement_email(text) to authenticated;

-- Penyelenggara bisa mencoba lagi email yang gagal (maksimal tiga percobaan per penerima).
create or replace function public.retry_campus_event_announcement_email(
  p_announcement_public_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  announcement_row public.campus_event_announcements%rowtype;
  reset_count integer := 0;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select announcement.* into announcement_row
  from public.campus_event_announcements announcement
  where announcement.public_id = p_announcement_public_id;
  if announcement_row.id is null
    or not public.event_can_manage_registrations(announcement_row.event_id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;

  update public.campus_event_email_deliveries delivery
  set status = 'pending', lease_expires_at = null, updated_at = timezone('utc', now())
  where delivery.announcement_id = announcement_row.id
    and delivery.status = 'failed'
    and delivery.attempt_count < 3;
  get diagnostics reset_count = row_count;
  return reset_count;
end;
$$;

revoke all on function public.retry_campus_event_announcement_email(text) from public, anon;
grant execute on function public.retry_campus_event_announcement_email(text) to authenticated;

-- Ringkasan untuk penyelenggara: hanya angka.
create or replace function public.list_campus_event_announcement_email_counts(
  p_public_slug text
)
returns table (
  announcement_public_id text,
  email_requested boolean,
  sent_count integer,
  pending_count integer,
  failed_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_event_id uuid;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select event.id into target_event_id
  from public.campus_events event
  where event.public_slug = p_public_slug;
  if target_event_id is null
    or not public.event_can_manage_registrations(target_event_id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;

  return query
  select
    announcement.public_id,
    announcement.email_requested_at is not null,
    count(delivery.id) filter (where delivery.status = 'sent')::integer,
    count(delivery.id) filter (where delivery.status in ('pending', 'processing'))::integer,
    count(delivery.id) filter (where delivery.status = 'failed')::integer
  from public.campus_event_announcements announcement
  left join public.campus_event_email_deliveries delivery
    on delivery.announcement_id = announcement.id
  where announcement.event_id = target_event_id
  group by announcement.id, announcement.public_id, announcement.email_requested_at;
end;
$$;

revoke all on function public.list_campus_event_announcement_email_counts(text) from public, anon;
grant execute on function public.list_campus_event_announcement_email_counts(text) to authenticated;

-- Server (service role) mengambil sekumpulan email untuk dikirim. Alamat email
-- hanya keluar lewat fungsi ini dan hanya ke service role.
create or replace function public.claim_campus_event_email_batch(
  p_announcement_public_id text,
  p_limit integer
)
returns table (
  delivery_id uuid,
  recipient_email text,
  unsubscribe_token text,
  event_title text,
  event_public_slug text,
  event_starts_at timestamptz,
  event_timezone text,
  announcement_title text,
  announcement_body text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  announcement_row public.campus_event_announcements%rowtype;
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select announcement.* into announcement_row
  from public.campus_event_announcements announcement
  where announcement.public_id = p_announcement_public_id;
  if announcement_row.id is null then
    return;
  end if;

  -- Pastikan setiap penerima punya token berhenti.
  insert into public.user_email_preferences (user_id)
  select delivery.recipient_user_id
  from public.campus_event_email_deliveries delivery
  where delivery.announcement_id = announcement_row.id
  on conflict (user_id) do nothing;

  return query
  with picked as (
    select delivery.id
    from public.campus_event_email_deliveries delivery
    where delivery.announcement_id = announcement_row.id
      and (
        delivery.status = 'pending'
        or (delivery.status = 'processing' and delivery.lease_expires_at < timezone('utc', now()))
      )
      and delivery.attempt_count < 3
    order by delivery.created_at
    for update skip locked
    limit safe_limit
  ),
  claimed as (
    update public.campus_event_email_deliveries delivery
    set status = 'processing',
        attempt_count = delivery.attempt_count + 1,
        lease_expires_at = timezone('utc', now()) + interval '5 minutes',
        updated_at = timezone('utc', now())
    from picked
    where delivery.id = picked.id
    returning delivery.id, delivery.recipient_user_id
  )
  select
    claimed.id,
    auth_user.email::text,
    preference.unsubscribe_token,
    event.title,
    event.public_slug,
    event.starts_at,
    event.timezone_name,
    announcement_row.title,
    announcement_row.body
  from claimed
  join auth.users auth_user on auth_user.id = claimed.recipient_user_id
  join public.user_email_preferences preference on preference.user_id = claimed.recipient_user_id
  join public.campus_events event on event.id = announcement_row.event_id
  where auth_user.email is not null
    and preference.event_announcements_enabled;
end;
$$;

revoke all on function public.claim_campus_event_email_batch(text, integer) from public, anon, authenticated;
grant execute on function public.claim_campus_event_email_batch(text, integer) to service_role;

create or replace function public.complete_campus_event_email_deliveries(
  p_delivery_ids uuid[],
  p_status text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception 'invalid delivery status' using errcode = '22023';
  end if;
  update public.campus_event_email_deliveries delivery
  set status = p_status,
      sent_at = case when p_status = 'sent' then timezone('utc', now()) else delivery.sent_at end,
      lease_expires_at = null,
      updated_at = timezone('utc', now())
  where delivery.id = any (coalesce(p_delivery_ids, array[]::uuid[]))
    and delivery.status = 'processing';
  get diagnostics updated = row_count;
  return updated;
end;
$$;

revoke all on function public.complete_campus_event_email_deliveries(uuid[], text) from public, anon, authenticated;
grant execute on function public.complete_campus_event_email_deliveries(uuid[], text) to service_role;

-- Pengguna mengatur email pengumuman acara dari Pengaturan.
create or replace function public.get_my_event_email_preference()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  enabled boolean;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select preference.event_announcements_enabled into enabled
  from public.user_email_preferences preference
  where preference.user_id = actor;
  return coalesce(enabled, true);
end;
$$;

revoke all on function public.get_my_event_email_preference() from public, anon;
grant execute on function public.get_my_event_email_preference() to authenticated;

create or replace function public.set_my_event_email_preference(p_enabled boolean)
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
  if p_enabled is null then
    raise exception 'invalid preference' using errcode = '22023';
  end if;
  insert into public.user_email_preferences (user_id, event_announcements_enabled)
  values (actor, p_enabled)
  on conflict (user_id) do update
    set event_announcements_enabled = excluded.event_announcements_enabled,
        updated_at = timezone('utc', now());
end;
$$;

revoke all on function public.set_my_event_email_preference(boolean) from public, anon;
grant execute on function public.set_my_event_email_preference(boolean) to authenticated;

-- Tautan "Berhenti menerima email" tanpa login. Dipanggil server (service role)
-- setelah penerima menekan tombol konfirmasi di halaman berhenti.
create or replace function public.unsubscribe_event_announcement_email(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if coalesce(p_token, '') !~ '^[a-f0-9]{64}$' then
    return false;
  end if;
  update public.user_email_preferences preference
  set event_announcements_enabled = false,
      updated_at = timezone('utc', now())
  where preference.unsubscribe_token = p_token;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.unsubscribe_event_announcement_email(text) from public, anon, authenticated;
grant execute on function public.unsubscribe_event_announcement_email(text) to service_role;
