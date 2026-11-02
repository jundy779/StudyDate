-- Realtime v2: sinyal pribadi per pengguna dan sinyal penyelenggara per acara.
--
-- Pola sama dengan chat (202610020002): channel privat Broadcast, izin dicek di RLS
-- realtime.messages, dan isi sinyal tanpa data pribadi. Browser mengambil data lewat
-- RPC atau halaman yang sudah ada. Realtime hanya mempercepat; polling tetap cadangan.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- 1. Topik pribadi per pengguna (kunci acak, bukan UUID akun)
-- ---------------------------------------------------------------------------

create table if not exists public.user_realtime_topics (
  user_id uuid primary key references auth.users (id) on delete cascade,
  topic_key text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_realtime_topics_key_format check (topic_key ~ '^[0-9a-f]{32}$')
);

alter table public.user_realtime_topics enable row level security;
revoke all on table public.user_realtime_topics from public, anon, authenticated;

create or replace function public.get_my_realtime_topic()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  key text;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.user_realtime_topics (user_id)
  values (actor)
  on conflict (user_id) do nothing;

  select topic.topic_key into key
  from public.user_realtime_topics topic
  where topic.user_id = actor;

  return 'user:' || key;
end;
$$;

revoke all on function public.get_my_realtime_topic() from public, anon;
grant execute on function public.get_my_realtime_topic() to authenticated;

create or replace function private.can_access_user_realtime_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_topic ~ '^user:[0-9a-f]{32}$'
    and exists (
      select 1
      from public.user_realtime_topics topic
      where p_topic = 'user:' || topic.topic_key
        and topic.user_id = (select auth.uid())
    );
$$;

revoke all on function private.can_access_user_realtime_topic(text) from public, anon;
grant execute on function private.can_access_user_realtime_topic(text) to authenticated;

-- Hanya menerima. Tidak ada policy insert, jadi browser tidak bisa mengirim ke topik pribadi.
drop policy if exists "users receive their private realtime signals" on realtime.messages;
create policy "users receive their private realtime signals"
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and private.can_access_user_realtime_topic((select realtime.topic()))
  );

create or replace function private.broadcast_user_notification_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text;
begin
  select topic.topic_key into key
  from public.user_realtime_topics topic
  where topic.user_id = new.recipient_user_id;

  -- Pengguna yang belum pernah membuka aplikasi sejak fitur ini belum punya topik.
  if key is null then
    return new;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object('type', new.notification_type),
      'notification',
      'user:' || key,
      true
    );
  exception
    when others then
      -- Sinyal hanya mempercepat. Jangan pernah menggagalkan notifikasi yang tersimpan.
      null;
  end;
  return new;
end;
$$;

revoke all on function private.broadcast_user_notification_signal()
  from public, anon, authenticated;

drop trigger if exists user_notifications_broadcast_realtime_v1 on public.user_notifications;
create trigger user_notifications_broadcast_realtime_v1
after insert on public.user_notifications
for each row execute function private.broadcast_user_notification_signal();

-- ---------------------------------------------------------------------------
-- 2. Topik penyelenggara per acara (pendaftaran dan kehadiran)
-- ---------------------------------------------------------------------------

create or replace function private.can_access_event_staff_realtime_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_topic ~ '^event-staff:event-[0-9a-f]{24}$'
    and exists (
      select 1
      from public.campus_events event_row
      where p_topic = 'event-staff:' || event_row.public_slug
        and (
          public.event_can_check_in(event_row.id, (select auth.uid()))
          or public.event_can_manage_registrations(event_row.id, (select auth.uid()))
        )
    );
$$;

revoke all on function private.can_access_event_staff_realtime_topic(text) from public, anon;
grant execute on function private.can_access_event_staff_realtime_topic(text) to authenticated;

drop policy if exists "event staff receive private realtime signals" on realtime.messages;
create policy "event staff receive private realtime signals"
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and private.can_access_event_staff_realtime_topic((select realtime.topic()))
  );

create or replace function private.broadcast_event_registration_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slug text;
begin
  if tg_op = 'UPDATE'
    and new.status is not distinct from old.status
    and new.checked_in_at is not distinct from old.checked_in_at then
    return new;
  end if;

  select event_row.public_slug into slug
  from public.campus_events event_row
  where event_row.id = new.event_id;

  if slug is null then
    return new;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object(
        'change',
        case
          when tg_op = 'UPDATE' and new.checked_in_at is distinct from old.checked_in_at then 'attendance'
          else 'registration'
        end
      ),
      'registration_changed',
      'event-staff:' || slug,
      true
    );
  exception
    when others then
      null;
  end;
  return new;
end;
$$;

revoke all on function private.broadcast_event_registration_signal()
  from public, anon, authenticated;

drop trigger if exists campus_event_rsvps_broadcast_realtime_v1 on public.campus_event_rsvps;
create trigger campus_event_rsvps_broadcast_realtime_v1
after insert or update on public.campus_event_rsvps
for each row execute function private.broadcast_event_registration_signal();
