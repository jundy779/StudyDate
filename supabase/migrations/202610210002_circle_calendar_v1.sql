-- Circle calendar v1.
--
-- Pengalaman "kalender" ala Luma untuk StudyDate: setiap Circle punya kalender
-- acara yang ditautkan pemiliknya, dan mahasiswa bisa mengikuti kalender itu
-- untuk mendapat notifikasi saat acara baru ditambahkan.
--
-- Privasi: daftar pengikut tidak pernah diproyeksikan. Yang terlihat hanya
-- jumlah pengikut dan status mengikuti milik sendiri. Mengikuti kalender tidak
-- membuat percakapan, tidak membuka identitas, dan bukan keanggotaan Circle.
--
-- Juga memperbaiki dua hal yang membuat Pengumuman Acara (202610160001) tidak
-- pernah bisa terkirim: batas frekuensi dan batasan target notifikasi.
--
-- Batasan target notifikasi: pengumuman acara (202610160001)
-- menulis target '/app/events/<slug>#event-announcements', sedangkan batasan
-- target_safe hanya menerima path tanpa fragmen, sehingga pengiriman pengumuman
-- selalu gagal.

-- ---------------------------------------------------------------------------
-- 1. Batasan target notifikasi menerima fragmen halaman
-- ---------------------------------------------------------------------------

alter table public.user_notifications
  drop constraint user_notifications_target_safe;
alter table public.user_notifications
  add constraint user_notifications_target_safe check (
    target_path = '/app/introductions'
    or target_path ~ '^/app/messages/[0-9a-f]{32}$'
    or target_path ~ '^/app/circles/circle-[0-9a-f]{24}(#[a-z][a-z0-9-]{0,39})?$'
    or target_path ~ '^/app/events/event-[0-9a-f]{24}(#[a-z][a-z0-9-]{0,39})?$'
  );

-- ---------------------------------------------------------------------------
-- 1b. Batas frekuensi: bucket pengumuman dan ikuti kalender
-- ---------------------------------------------------------------------------
-- create_campus_event_announcement (202610160001) memakai bucket
-- 'announcement_day', tetapi bucket itu tidak ada di daftar yang diizinkan,
-- sehingga setiap pengumuman ditolak sebagai "rate limited". Bucket itu dan
-- 'calendar_follow' ditambahkan di sini. Logika lain tidak berubah.

alter table public.campus_event_rate_limits
  drop constraint if exists campus_event_rate_limits_bucket;
alter table public.campus_event_rate_limits
  add constraint campus_event_rate_limits_bucket check (bucket in (
    'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day',
    'message_minute', 'message_day', 'ticket_regenerate_day',
    'ticket_scan_minute', 'ticket_scan_invalid_hour', 'event_team_invite_hour',
    'checkin_mutation_minute', 'announcement_day', 'calendar_follow'
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
    'checkin_mutation_minute', 'announcement_day', 'calendar_follow'
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

-- ---------------------------------------------------------------------------
-- 2. Jenis notifikasi baru: CIRCLE_EVENT_PUBLISHED
-- ---------------------------------------------------------------------------

alter table public.user_notifications
  drop constraint user_notifications_type_allowed,
  drop constraint user_notifications_metadata_safe;

alter table public.user_notifications
  add constraint user_notifications_type_allowed check (notification_type in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED',
    'EVENT_REGISTRATION_PENDING', 'EVENT_REGISTRATION_APPROVED',
    'EVENT_REGISTRATION_DECLINED', 'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED',
    'EVENT_ANNOUNCEMENT', 'CIRCLE_EVENT_PUBLISHED'
  )),
  add constraint user_notifications_metadata_safe check (
    (
      notification_type = 'CONTACT_REVEAL_COMPLETED'
      and metadata ? 'channel'
      and metadata->>'channel' in ('telegram', 'instagram', 'linkedin')
      and metadata - 'channel' = '{}'::jsonb
    )
    or (
      notification_type in (
        'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED', 'CIRCLE_ARCHIVED',
        'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED', 'EVENT_CANCELLED',
        'EVENT_WAITLIST_PROMOTED', 'EVENT_REGISTRATION_PENDING',
        'EVENT_REGISTRATION_APPROVED', 'EVENT_REGISTRATION_DECLINED',
        'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED', 'EVENT_ANNOUNCEMENT', 'CIRCLE_EVENT_PUBLISHED'
      )
      and metadata ? 'title'
      and jsonb_typeof(metadata->'title') = 'string'
      and char_length(metadata->>'title') between 1 and 100
      and metadata - 'title' = '{}'::jsonb
    )
    or (
      notification_type in (
        'EVENT_SCHEDULE_CHANGED', 'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H'
      )
      and metadata ? 'title' and metadata ? 'when_label'
      and char_length(metadata->>'title') between 1 and 100
      and char_length(metadata->>'when_label') between 1 and 64
      and metadata - 'title' - 'when_label' = '{}'::jsonb
    )
    or (
      notification_type = 'EVENT_LOCATION_CHANGED'
      and metadata ? 'title' and metadata ? 'venue_label'
      and char_length(metadata->>'title') between 1 and 100
      and char_length(metadata->>'venue_label') between 1 and 160
      and metadata - 'title' - 'venue_label' = '{}'::jsonb
    )
    or (
      notification_type in (
        'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
        'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
        'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED',
        'MEETING_PLAN_CANCELLED'
      ) and metadata = '{}'::jsonb
    )
  );

alter table public.notification_preferences
  drop constraint notification_preferences_type,
  add constraint notification_preferences_type check (notification_type in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED',
    'EVENT_REGISTRATION_PENDING', 'EVENT_REGISTRATION_APPROVED',
    'EVENT_REGISTRATION_DECLINED', 'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED',
    'EVENT_ANNOUNCEMENT', 'CIRCLE_EVENT_PUBLISHED'
  ));

create or replace function public.set_my_notification_preference(
  p_notification_type text, p_in_app_enabled boolean
)
returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_notification_type not in (
    'INTRODUCTION_RECEIVED', 'INTRODUCTION_ACCEPTED', 'MESSAGE_RECEIVED',
    'MUTUAL_INTEREST_COMPLETED', 'IDENTITY_REVEAL_COMPLETED',
    'CONTACT_REVEAL_COMPLETED', 'CIRCLE_MEMBER_JOINED', 'CIRCLE_UPDATED',
    'CIRCLE_ARCHIVED', 'CIRCLE_MEMBER_REMOVED', 'EVENT_REGISTERED',
    'EVENT_SCHEDULE_CHANGED', 'EVENT_LOCATION_CHANGED', 'EVENT_CANCELLED',
    'MEETING_PLAN_PROPOSED', 'MEETING_PLAN_CONFIRMED', 'MEETING_PLAN_CANCELLED',
    'EVENT_REMINDER_24H', 'EVENT_REMINDER_2H', 'EVENT_WAITLIST_PROMOTED',
    'EVENT_REGISTRATION_PENDING', 'EVENT_REGISTRATION_APPROVED',
    'EVENT_REGISTRATION_DECLINED', 'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED',
    'EVENT_ANNOUNCEMENT', 'CIRCLE_EVENT_PUBLISHED'
  ) or p_in_app_enabled is null then
    raise exception 'invalid preference' using errcode = '22023';
  end if;
  insert into public.notification_preferences (
    user_id, notification_type, in_app_enabled
  ) values (actor, p_notification_type, p_in_app_enabled)
  on conflict (user_id, notification_type) do update
    set in_app_enabled = excluded.in_app_enabled,
        updated_at = timezone('utc', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Pengikut kalender Circle
-- ---------------------------------------------------------------------------

create table if not exists public.study_circle_calendar_follows (
  circle_id uuid not null references public.study_circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (circle_id, user_id)
);

create index if not exists study_circle_calendar_follows_user_idx
  on public.study_circle_calendar_follows (user_id, created_at desc);

alter table public.study_circle_calendar_follows enable row level security;
revoke all on table public.study_circle_calendar_follows
  from public, anon, authenticated;

drop trigger if exists study_circle_calendar_follows_reject_deletion_locked_mutation
  on public.study_circle_calendar_follows;
create trigger study_circle_calendar_follows_reject_deletion_locked_mutation
before insert or update or delete on public.study_circle_calendar_follows
for each row execute function public.reject_account_deletion_locked_mutation();

-- Circle yang boleh dilihat aktor, dengan aturan yang sama seperti get_study_circle.
create or replace function public.can_view_study_circle(
  p_circle_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.study_circles circle
    where circle.id = p_circle_id
      and (
        (
          circle.status = 'active'
          and (
            circle.scope = 'open'
            or circle.campus_scope = (
              select profile.campus from public.profiles profile
              where profile.user_id = p_user_id
            )
          )
          and not public.users_are_blocked(p_user_id, circle.owner_user_id)
        )
        or exists (
          select 1 from public.study_circle_memberships membership
          where membership.circle_id = circle.id
            and membership.user_id = p_user_id
            and membership.status = 'active'
        )
      )
  );
$$;

revoke all on function public.can_view_study_circle(uuid, uuid)
  from public, anon, authenticated;

-- Acara yang boleh dilihat aktor, dengan aturan yang sama seperti list_campus_events.
create or replace function public.can_view_listed_campus_event(
  p_event_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campus_events event
    where event.id = p_event_id
      and event.status = 'scheduled'
      and event.starts_at > timezone('utc', now())
      and public.is_campus_event_student(event.organizer_user_id)
      and (
        event.scope = 'open'
        or event.campus_scope = (
          select profile.campus from public.profiles profile
          where profile.user_id = p_user_id
        )
      )
      and not public.users_are_blocked(p_user_id, event.organizer_user_id)
      and (
        not public.is_school_email_account(p_user_id)
        or public.is_educational_event_category(event.category)
      )
  );
$$;

revoke all on function public.can_view_listed_campus_event(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC kalender
-- ---------------------------------------------------------------------------

create or replace function public.get_study_circle_calendar(p_circle_public_slug text)
returns table (
  follower_count integer,
  is_following boolean,
  can_follow boolean,
  upcoming_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.study_circles%rowtype;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_circle_public_slug is null or p_circle_public_slug !~ '^circle-[0-9a-f]{24}$' then
    return;
  end if;

  select * into target from public.study_circles circle
  where circle.public_slug = p_circle_public_slug;
  if target.id is null or not public.can_view_study_circle(target.id, actor) then
    return;
  end if;

  return query select
    (select count(*)::integer from public.study_circle_calendar_follows follow
      where follow.circle_id = target.id),
    exists (
      select 1 from public.study_circle_calendar_follows follow
      where follow.circle_id = target.id and follow.user_id = actor
    ),
    target.status = 'active' and target.owner_user_id <> actor,
    (select count(*)::integer
      from public.campus_event_circle_links link
      where link.circle_id = target.id
        and public.can_view_listed_campus_event(link.event_id, actor));
end;
$$;

revoke all on function public.get_study_circle_calendar(text) from public, anon;
grant execute on function public.get_study_circle_calendar(text) to authenticated;

create or replace function public.list_study_circle_calendar_events(
  p_circle_public_slug text,
  p_limit integer default 20
)
returns table (
  public_slug text,
  title text,
  category text,
  scope text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone_name text,
  venue_name text,
  venue_area text,
  city text,
  capacity integer,
  attendee_count integer,
  rsvp_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_id uuid;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_circle_public_slug is null or p_circle_public_slug !~ '^circle-[0-9a-f]{24}$' then
    return;
  end if;

  select circle.id into target_id from public.study_circles circle
  where circle.public_slug = p_circle_public_slug;
  if target_id is null or not public.can_view_study_circle(target_id, actor) then
    return;
  end if;

  return query
  select event.public_slug, event.title, event.category, event.scope,
    event.starts_at, event.ends_at, event.timezone_name,
    event.venue_name, event.venue_area, event.city, event.capacity::integer,
    (select count(*)::integer from public.campus_event_rsvps attendance
      where attendance.event_id = event.id and attendance.status = 'going'),
    own_rsvp.status
  from public.campus_event_circle_links link
  join public.campus_events event on event.id = link.event_id
  left join public.campus_event_rsvps own_rsvp
    on own_rsvp.event_id = event.id and own_rsvp.user_id = actor
  where link.circle_id = target_id
    and public.can_view_listed_campus_event(event.id, actor)
  order by event.starts_at asc, event.public_slug asc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke all on function public.list_study_circle_calendar_events(text, integer) from public, anon;
grant execute on function public.list_study_circle_calendar_events(text, integer) to authenticated;

create or replace function public.set_study_circle_calendar_follow(
  p_circle_public_slug text,
  p_follow boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.study_circles%rowtype;
begin
  if not public.is_study_circle_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_follow is null then
    raise exception 'invalid follow value' using errcode = '22023';
  end if;

  select * into target from public.study_circles circle
  where circle.public_slug = p_circle_public_slug;
  if target.id is null then
    raise exception 'circle unavailable' using errcode = '42501';
  end if;

  if not p_follow then
    delete from public.study_circle_calendar_follows follow
    where follow.circle_id = target.id and follow.user_id = actor;
    return false;
  end if;

  if target.status <> 'active'
    or target.owner_user_id = actor
    or not public.can_view_study_circle(target.id, actor) then
    raise exception 'circle unavailable' using errcode = '42501';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'calendar_follow', 30, 3600) then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  insert into public.study_circle_calendar_follows (circle_id, user_id)
  values (target.id, actor)
  on conflict (circle_id, user_id) do nothing;
  return true;
end;
$$;

revoke all on function public.set_study_circle_calendar_follow(text, boolean) from public, anon;
grant execute on function public.set_study_circle_calendar_follow(text, boolean) to authenticated;

-- Acara mendatang dari semua kalender Circle yang diikuti.
create or replace function public.list_my_followed_calendar_events(p_limit integer default 6)
returns table (
  public_slug text,
  title text,
  category text,
  starts_at timestamptz,
  timezone_name text,
  venue_name text,
  city text,
  circle_public_slug text,
  circle_name text,
  rsvp_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;

  return query
  select event.public_slug, event.title, event.category, event.starts_at,
    event.timezone_name, event.venue_name, event.city,
    circle.public_slug, circle.name, own_rsvp.status
  from public.study_circle_calendar_follows follow
  join public.study_circles circle on circle.id = follow.circle_id
  join public.campus_event_circle_links link on link.circle_id = circle.id
  join public.campus_events event on event.id = link.event_id
  left join public.campus_event_rsvps own_rsvp
    on own_rsvp.event_id = event.id and own_rsvp.user_id = actor
  where follow.user_id = actor
    and public.can_view_study_circle(circle.id, actor)
    and public.can_view_listed_campus_event(event.id, actor)
  order by event.starts_at asc, event.public_slug asc
  limit least(greatest(coalesce(p_limit, 6), 1), 24);
end;
$$;

revoke all on function public.list_my_followed_calendar_events(integer) from public, anon;
grant execute on function public.list_my_followed_calendar_events(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Notifikasi untuk pengikut saat acara ditautkan ke Circle
-- ---------------------------------------------------------------------------

create or replace function public.notify_circle_calendar_followers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.campus_events%rowtype;
  circle_row public.study_circles%rowtype;
begin
  if tg_op = 'UPDATE' and new.circle_id = old.circle_id then
    return new;
  end if;

  select * into event_row from public.campus_events event where event.id = new.event_id;
  select * into circle_row from public.study_circles circle where circle.id = new.circle_id;
  if event_row.id is null or circle_row.id is null
    or event_row.status <> 'scheduled'
    or event_row.starts_at <= timezone('utc', now())
    or circle_row.status <> 'active' then
    return new;
  end if;

  insert into public.user_notifications (
    recipient_user_id, notification_type, target_path, metadata, dedupe_key
  )
  select follow.user_id, 'CIRCLE_EVENT_PUBLISHED',
    '/app/events/' || event_row.public_slug,
    jsonb_build_object('title', left(event_row.title, 100)),
    left('circle_event:' || event_row.id::text || ':' || follow.user_id::text, 240)
  from public.study_circle_calendar_follows follow
  where follow.circle_id = circle_row.id
    and follow.user_id <> event_row.organizer_user_id
    and public.is_notification_student(follow.user_id)
    and public.is_campus_event_student(follow.user_id)
    and public.can_view_study_circle(circle_row.id, follow.user_id)
    and public.can_view_listed_campus_event(event_row.id, follow.user_id)
    and not exists (
      select 1 from public.notification_preferences preference
      where preference.user_id = follow.user_id
        and preference.notification_type = 'CIRCLE_EVENT_PUBLISHED'
        and not preference.in_app_enabled
    )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.notify_circle_calendar_followers()
  from public, anon, authenticated;

drop trigger if exists campus_event_circle_links_notify_followers
  on public.campus_event_circle_links;
create trigger campus_event_circle_links_notify_followers
after insert or update of circle_id on public.campus_event_circle_links
for each row execute function public.notify_circle_calendar_followers();

-- ---------------------------------------------------------------------------
-- 6. Pengumuman acara: perbaiki kolom ambigu
-- ---------------------------------------------------------------------------
-- Di versi 202610160001, "recipient_count" bentrok dengan nama kolom keluaran
-- fungsi, sehingga pengiriman pengumuman berhenti dengan galat "ambiguous".
-- Hanya pernyataan update itu yang diubah; sisanya sama persis.

create or replace function public.create_campus_event_announcement(
  p_public_slug text,
  p_title text,
  p_body text,
  p_client_idempotency_key text
)
returns table (announcement_public_id text, recipient_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  announcement_row public.campus_event_announcements%rowtype;
  inserted_count integer := 0;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select event.* into event_row
  from public.campus_events event
  where event.public_slug = p_public_slug
  for update;
  if event_row.id is null
    or not public.event_can_manage_registrations(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  if event_row.status <> 'scheduled' then
    raise exception 'event announcement unavailable' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 5 and 100
    or p_title ~ '[<>{}]' or p_title ~ '[[:cntrl:]]'
    or char_length(btrim(coalesce(p_body, ''))) not between 10 and 1200
    or p_body ~ '<[^>]+>'
    or coalesce(p_client_idempotency_key, '') !~ '^[A-Za-z0-9_-]{16,80}$' then
    raise exception 'invalid event announcement' using errcode = '22023';
  end if;
  if not public.consume_campus_event_rate_limit(
    actor, 'announcement_day', 5, 86400
  ) then
    raise exception 'event announcement rate limited' using errcode = 'P0001';
  end if;

  insert into public.campus_event_announcements (
    event_id, author_user_id, title, body, client_idempotency_key
  ) values (
    event_row.id, actor, btrim(p_title), btrim(p_body),
    p_client_idempotency_key
  )
  on conflict (event_id, author_user_id, client_idempotency_key)
  do update set client_idempotency_key = excluded.client_idempotency_key
  returning * into announcement_row;

  insert into public.user_notifications (
    recipient_user_id, notification_type, target_path, metadata, dedupe_key
  )
  select rsvp.user_id, 'EVENT_ANNOUNCEMENT',
    '/app/events/' || event_row.public_slug || '#event-announcements',
    jsonb_build_object('title', left(announcement_row.title, 100)),
    left(
      'event_announcement:' || announcement_row.id::text || ':' ||
      rsvp.user_id::text,
      240
    )
  from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id
    and rsvp.status = 'going'
    and rsvp.user_id is not null
    and rsvp.user_id <> actor
    and public.is_notification_student(rsvp.user_id)
    and not exists (
      select 1 from public.notification_preferences preference
      where preference.user_id = rsvp.user_id
        and preference.notification_type = 'EVENT_ANNOUNCEMENT'
        and not preference.in_app_enabled
    )
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;

  update public.campus_event_announcements announcement
  set recipient_count = greatest(announcement.recipient_count, inserted_count)
  where announcement.id = announcement_row.id;

  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_row.id, actor, 'announcement_sent');

  return query select announcement_row.public_id, inserted_count;
end;
$$;
