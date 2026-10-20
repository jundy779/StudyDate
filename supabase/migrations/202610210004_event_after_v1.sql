-- Event after-party v1: ulasan peserta, rekap penyelenggara, sertifikat kehadiran.
--
-- 1. Ulasan: peserta terdaftar memberi nilai 1 sampai 5, komentar opsional, dan
--    "mau ikut lagi". Dibuka sejak acara selesai sampai 14 hari sesudahnya.
--    Penyelenggara hanya melihat angka gabungan; komentar baru tampil setelah ada
--    minimal 3 ulasan dan tidak pernah membawa alias atau identitas penulis.
-- 2. Rekap: penyelenggara atau cohost menulis rekap setelah acara selesai. Rekap
--    hanya terlihat oleh peserta terdaftar dan tim acara. Terbit pertama kali
--    mengirim notifikasi ke peserta.
-- 3. Sertifikat: penyelenggara menyalakan sertifikat dan memilih syaratnya
--    (hadir lewat check-in, atau cukup terdaftar; boleh mewajibkan ulasan).
--    Peserta mengklaim sendiri dengan nama yang mereka tulis sendiri. Setiap
--    sertifikat punya kode cek publik. Penyelenggara tidak melihat nama di
--    sertifikat; ia hanya melihat alias pendaftaran.
-- 4. Penjadwal: product_scheduler_tick() juga mengirim permintaan ulasan 1 sampai
--    48 jam setelah acara selesai. Penjadwal tetap mati sampai dinyalakan Owner.

-- ---------------------------------------------------------------------------
-- 0. Batas frekuensi dan jenis notifikasi baru
-- ---------------------------------------------------------------------------

alter table public.campus_event_rate_limits
  drop constraint if exists campus_event_rate_limits_bucket;
alter table public.campus_event_rate_limits
  add constraint campus_event_rate_limits_bucket check (bucket in (
    'create_day', 'rsvp_day', 'edit_day', 'report_hour', 'report_day',
    'message_minute', 'message_day', 'ticket_regenerate_day',
    'ticket_scan_minute', 'ticket_scan_invalid_hour', 'event_team_invite_hour',
    'checkin_mutation_minute', 'announcement_day', 'calendar_follow',
    'feedback_hour', 'recap_day', 'certificate_day'
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
    'feedback_hour', 'recap_day', 'certificate_day'
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
    'EVENT_ANNOUNCEMENT', 'CIRCLE_EVENT_PUBLISHED', 'EVENT_FEEDBACK_REQUEST',
    'EVENT_RECAP_PUBLISHED'
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
        'EVENT_WAITLISTED', 'EVENT_TEAM_INVITED', 'EVENT_ANNOUNCEMENT', 'CIRCLE_EVENT_PUBLISHED',
        'EVENT_FEEDBACK_REQUEST', 'EVENT_RECAP_PUBLISHED'
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
    'EVENT_ANNOUNCEMENT', 'CIRCLE_EVENT_PUBLISHED', 'EVENT_FEEDBACK_REQUEST',
    'EVENT_RECAP_PUBLISHED'
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
    'EVENT_ANNOUNCEMENT', 'CIRCLE_EVENT_PUBLISHED', 'EVENT_FEEDBACK_REQUEST',
    'EVENT_RECAP_PUBLISHED'
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
-- 1. Helper
-- ---------------------------------------------------------------------------

-- Acara dianggap selesai bila sudah lewat waktu selesai dan tidak dibatalkan.
create or replace function public.campus_event_has_ended(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campus_events event
    where event.id = p_event_id
      and event.status in ('scheduled', 'archived')
      and event.ends_at <= timezone('utc', now())
  );
$$;

revoke all on function public.campus_event_has_ended(uuid) from public, anon, authenticated;

create or replace function public.campus_event_certificate_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  raw bytea := extensions.gen_random_bytes(12);
  result text := '';
  i integer;
begin
  for i in 0..11 loop
    result := result || substr(alphabet, (get_byte(raw, i) % 31) + 1, 1);
    if i in (3, 7) then result := result || '-'; end if;
  end loop;
  return result;
end;
$$;

revoke all on function public.campus_event_certificate_code() from public, anon, authenticated;

create or replace function public.campus_event_certificate_name_valid(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name is not null
    and char_length(p_name) between 2 and 80
    and p_name = btrim(p_name)
    and p_name !~ '[[:cntrl:]]'
    and p_name !~ '[0-9<>{}\[\]\\/@#$%^&*_=+|~`":;?!]'
    and p_name !~ '\s{2,}';
$$;

revoke all on function public.campus_event_certificate_name_valid(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ulasan peserta
-- ---------------------------------------------------------------------------

create table if not exists public.campus_event_feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  rating smallint not null,
  would_attend_again boolean null,
  comment text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint campus_event_feedback_unique unique (event_id, user_id),
  constraint campus_event_feedback_rating check (rating between 1 and 5),
  constraint campus_event_feedback_comment check (
    comment is null or (char_length(comment) between 3 and 800 and comment !~ '<[^>]+>')
  )
);

create index if not exists campus_event_feedback_event_idx
  on public.campus_event_feedback (event_id, created_at);

alter table public.campus_event_feedback enable row level security;
revoke all on table public.campus_event_feedback from public, anon, authenticated;

drop trigger if exists campus_event_feedback_reject_deletion_locked_mutation
  on public.campus_event_feedback;
create trigger campus_event_feedback_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_feedback
for each row execute function public.reject_account_deletion_locked_mutation();

create or replace function public.submit_campus_event_feedback(
  p_public_slug text,
  p_rating integer,
  p_comment text,
  p_would_attend_again boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  clean_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null
    or event_row.organizer_user_id = actor
    or not public.campus_event_has_ended(event_row.id)
    or event_row.ends_at < timezone('utc', now()) - interval '14 days'
    or not exists (
      select 1 from public.campus_event_rsvps rsvp
      where rsvp.event_id = event_row.id and rsvp.user_id = actor and rsvp.status = 'going'
    ) then
    raise exception 'feedback unavailable' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid feedback' using errcode = '22023';
  end if;
  if clean_comment is not null and (
    char_length(clean_comment) not between 3 and 800 or clean_comment ~ '<[^>]+>'
  ) then
    raise exception 'invalid feedback' using errcode = '22023';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'feedback_hour', 20, 3600) then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  insert into public.campus_event_feedback (
    event_id, user_id, rating, would_attend_again, comment
  ) values (event_row.id, actor, p_rating, p_would_attend_again, clean_comment)
  on conflict (event_id, user_id) do update set
    rating = excluded.rating,
    would_attend_again = excluded.would_attend_again,
    comment = excluded.comment,
    updated_at = timezone('utc', now());
  return true;
end;
$$;

revoke all on function public.submit_campus_event_feedback(text, integer, text, boolean) from public, anon;
grant execute on function public.submit_campus_event_feedback(text, integer, text, boolean) to authenticated;

-- Acara yang sudah selesai dan belum diulas oleh pemanggil.
create or replace function public.list_my_pending_event_feedback(p_limit integer default 5)
returns table (public_slug text, title text, ends_at timestamptz, timezone_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  return query
  select event.public_slug, event.title, event.ends_at, event.timezone_name
  from public.campus_event_rsvps rsvp
  join public.campus_events event on event.id = rsvp.event_id
  where rsvp.user_id = actor
    and rsvp.status = 'going'
    and event.organizer_user_id <> actor
    and event.status in ('scheduled', 'archived')
    and event.ends_at <= timezone('utc', now())
    and event.ends_at > timezone('utc', now()) - interval '14 days'
    and not exists (
      select 1 from public.campus_event_feedback feedback
      where feedback.event_id = event.id and feedback.user_id = actor
    )
  order by event.ends_at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 10);
end;
$$;

revoke all on function public.list_my_pending_event_feedback(integer) from public, anon;
grant execute on function public.list_my_pending_event_feedback(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Rekap penyelenggara
-- ---------------------------------------------------------------------------

create table if not exists public.campus_event_recaps (
  event_id uuid primary key references public.campus_events (id) on delete cascade,
  body text not null,
  published_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null references auth.users (id) on delete set null,
  constraint campus_event_recaps_body check (
    char_length(body) between 20 and 3000 and body !~ '<[^>]+>'
  )
);

alter table public.campus_event_recaps enable row level security;
revoke all on table public.campus_event_recaps from public, anon, authenticated;

drop trigger if exists campus_event_recaps_reject_deletion_locked_mutation
  on public.campus_event_recaps;
create trigger campus_event_recaps_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_recaps
for each row execute function public.reject_account_deletion_locked_mutation();

create or replace function public.set_campus_event_recap(p_public_slug text, p_body text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  clean_body text := nullif(btrim(coalesce(p_body, '')), '');
  is_first boolean;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null
    or not public.can_manage_campus_event_content(event_row.id, actor)
    or not public.campus_event_has_ended(event_row.id)
    or event_row.ends_at < timezone('utc', now()) - interval '90 days' then
    raise exception 'event management required' using errcode = '42501';
  end if;

  if clean_body is null then
    delete from public.campus_event_recaps recap where recap.event_id = event_row.id;
    return false;
  end if;
  if char_length(clean_body) not between 20 and 3000 or clean_body ~ '<[^>]+>' then
    raise exception 'invalid recap' using errcode = '22023';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'recap_day', 10, 86400) then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  is_first := not exists (
    select 1 from public.campus_event_recaps recap where recap.event_id = event_row.id
  );
  insert into public.campus_event_recaps (event_id, body, updated_by)
  values (event_row.id, clean_body, actor)
  on conflict (event_id) do update set
    body = excluded.body,
    updated_at = timezone('utc', now()),
    updated_by = excluded.updated_by;

  if is_first then
    insert into public.user_notifications (
      recipient_user_id, notification_type, target_path, metadata, dedupe_key
    )
    select rsvp.user_id, 'EVENT_RECAP_PUBLISHED',
      '/app/events/' || event_row.public_slug || '#rekap',
      jsonb_build_object('title', left(event_row.title, 100)),
      left('event_recap:' || event_row.id::text || ':' || rsvp.user_id::text, 240)
    from public.campus_event_rsvps rsvp
    where rsvp.event_id = event_row.id
      and rsvp.status = 'going'
      and rsvp.user_id is not null
      and rsvp.user_id <> actor
      and public.is_notification_student(rsvp.user_id)
      and not public.users_are_blocked(rsvp.user_id, event_row.organizer_user_id)
      and not exists (
        select 1 from public.notification_preferences preference
        where preference.user_id = rsvp.user_id
          and preference.notification_type = 'EVENT_RECAP_PUBLISHED'
          and not preference.in_app_enabled
      )
    on conflict (dedupe_key) do nothing;
  end if;
  return true;
end;
$$;

revoke all on function public.set_campus_event_recap(text, text) from public, anon;
grant execute on function public.set_campus_event_recap(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Sertifikat
-- ---------------------------------------------------------------------------

create table if not exists public.campus_event_certificate_settings (
  event_id uuid primary key references public.campus_events (id) on delete cascade,
  enabled boolean not null default false,
  eligibility text not null default 'checked_in',
  requires_feedback boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null references auth.users (id) on delete set null,
  constraint campus_event_certificate_settings_eligibility
    check (eligibility in ('checked_in', 'registered'))
);

alter table public.campus_event_certificate_settings enable row level security;
revoke all on table public.campus_event_certificate_settings from public, anon, authenticated;

create table if not exists public.campus_event_certificates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.campus_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  verify_code text not null,
  recipient_name text not null,
  attendance_basis text not null,
  event_title text not null,
  event_starts_at timestamptz not null,
  event_timezone text not null,
  organizer_alias text not null,
  is_official boolean not null default false,
  issued_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz null,
  revoked_by text null,
  constraint campus_event_certificates_unique unique (event_id, user_id),
  constraint campus_event_certificates_code_unique unique (verify_code),
  constraint campus_event_certificates_code_format
    check (verify_code ~ '^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$'),
  constraint campus_event_certificates_name check (public.campus_event_certificate_name_valid(recipient_name)),
  constraint campus_event_certificates_basis check (attendance_basis in ('checked_in', 'registered')),
  constraint campus_event_certificates_revoke check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by in ('recipient', 'organizer'))
  )
);

create index if not exists campus_event_certificates_user_idx
  on public.campus_event_certificates (user_id, issued_at desc);

alter table public.campus_event_certificates enable row level security;
revoke all on table public.campus_event_certificates from public, anon, authenticated;

drop trigger if exists campus_event_certificates_reject_deletion_locked_mutation
  on public.campus_event_certificates;
create trigger campus_event_certificates_reject_deletion_locked_mutation
before insert or update or delete on public.campus_event_certificates
for each row execute function public.reject_account_deletion_locked_mutation();

create or replace function public.set_campus_event_certificate_settings(
  p_public_slug text,
  p_enabled boolean,
  p_eligibility text,
  p_requires_feedback boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null
    or event_row.status = 'cancelled'
    or not public.can_manage_campus_event_content(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  if p_enabled is null or p_requires_feedback is null
    or p_eligibility not in ('checked_in', 'registered') then
    raise exception 'invalid certificate settings' using errcode = '22023';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'edit_day', 30, 86400) then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  insert into public.campus_event_certificate_settings (
    event_id, enabled, eligibility, requires_feedback, updated_by
  ) values (event_row.id, p_enabled, p_eligibility, p_requires_feedback, actor)
  on conflict (event_id) do update set
    enabled = excluded.enabled,
    eligibility = excluded.eligibility,
    requires_feedback = excluded.requires_feedback,
    updated_at = timezone('utc', now()),
    updated_by = excluded.updated_by;
  return p_enabled;
end;
$$;

revoke all on function public.set_campus_event_certificate_settings(text, boolean, text, boolean) from public, anon;
grant execute on function public.set_campus_event_certificate_settings(text, boolean, text, boolean) to authenticated;

-- Syarat sertifikat untuk satu peserta. null berarti boleh klaim.
create or replace function public.campus_event_certificate_blocker(p_event_id uuid, p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_row public.campus_events%rowtype;
  settings public.campus_event_certificate_settings%rowtype;
  rsvp_row public.campus_event_rsvps%rowtype;
  existing public.campus_event_certificates%rowtype;
begin
  select * into event_row from public.campus_events event where event.id = p_event_id;
  select * into settings from public.campus_event_certificate_settings s where s.event_id = p_event_id;
  if event_row.id is null or settings.event_id is null or not settings.enabled then
    return 'disabled';
  end if;
  if not public.campus_event_has_ended(p_event_id) then return 'not_ended'; end if;
  if event_row.ends_at < timezone('utc', now()) - interval '180 days' then return 'window_closed'; end if;
  if event_row.organizer_user_id = p_user_id then return 'organizer'; end if;
  select * into rsvp_row from public.campus_event_rsvps rsvp
  where rsvp.event_id = p_event_id and rsvp.user_id = p_user_id and rsvp.status = 'going';
  if rsvp_row.id is null then return 'not_registered'; end if;
  select * into existing from public.campus_event_certificates cert
  where cert.event_id = p_event_id and cert.user_id = p_user_id;
  if existing.revoked_by = 'organizer' then return 'revoked_by_organizer'; end if;
  if settings.eligibility = 'checked_in' and rsvp_row.checked_in_at is null then
    return 'not_checked_in';
  end if;
  if settings.requires_feedback and not exists (
    select 1 from public.campus_event_feedback feedback
    where feedback.event_id = p_event_id and feedback.user_id = p_user_id
  ) then
    return 'feedback_required';
  end if;
  return null;
end;
$$;

revoke all on function public.campus_event_certificate_blocker(uuid, uuid) from public, anon, authenticated;

create or replace function public.claim_campus_event_certificate(
  p_public_slug text,
  p_recipient_name text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  settings public.campus_event_certificate_settings%rowtype;
  existing public.campus_event_certificates%rowtype;
  blocker text;
  clean_name text := regexp_replace(btrim(coalesce(p_recipient_name, '')), '\s+', ' ', 'g');
  new_code text;
  alias text;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null then
    raise exception 'certificate unavailable' using errcode = '42501';
  end if;
  blocker := public.campus_event_certificate_blocker(event_row.id, actor);
  if blocker is not null then
    raise exception 'certificate unavailable: %', blocker using errcode = '42501';
  end if;
  select * into existing from public.campus_event_certificates cert
  where cert.event_id = event_row.id and cert.user_id = actor
  for update;
  if existing.id is not null and existing.revoked_at is null then
    return existing.verify_code;
  end if;
  if not public.campus_event_certificate_name_valid(clean_name) then
    raise exception 'invalid certificate name' using errcode = '22023';
  end if;
  if not public.consume_campus_event_rate_limit(actor, 'certificate_day', 10, 86400) then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;

  select * into settings from public.campus_event_certificate_settings s where s.event_id = event_row.id;
  select profile.public_alias into alias from public.profiles profile
  where profile.user_id = event_row.organizer_user_id;

  loop
    new_code := public.campus_event_certificate_code();
    exit when not exists (
      select 1 from public.campus_event_certificates cert where cert.verify_code = new_code
    );
  end loop;

  if existing.id is not null then
    update public.campus_event_certificates set
      verify_code = new_code,
      recipient_name = clean_name,
      attendance_basis = settings.eligibility,
      event_title = event_row.title,
      event_starts_at = event_row.starts_at,
      event_timezone = event_row.timezone_name,
      organizer_alias = coalesce(alias, 'Penyelenggara StudyDate'),
      is_official = event_row.is_official,
      issued_at = timezone('utc', now()),
      revoked_at = null,
      revoked_by = null
    where id = existing.id;
  else
    insert into public.campus_event_certificates (
      event_id, user_id, verify_code, recipient_name, attendance_basis,
      event_title, event_starts_at, event_timezone, organizer_alias, is_official
    ) values (
      event_row.id, actor, new_code, clean_name, settings.eligibility,
      event_row.title, event_row.starts_at, event_row.timezone_name,
      coalesce(alias, 'Penyelenggara StudyDate'), event_row.is_official
    );
  end if;
  return new_code;
end;
$$;

revoke all on function public.claim_campus_event_certificate(text, text) from public, anon;
grant execute on function public.claim_campus_event_certificate(text, text) to authenticated;

create or replace function public.revoke_my_campus_event_certificate(p_verify_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  update public.campus_event_certificates cert
  set revoked_at = timezone('utc', now()), revoked_by = 'recipient'
  where cert.verify_code = upper(btrim(coalesce(p_verify_code, '')))
    and cert.user_id = actor
    and cert.revoked_at is null;
  return found;
end;
$$;

revoke all on function public.revoke_my_campus_event_certificate(text) from public, anon;
grant execute on function public.revoke_my_campus_event_certificate(text) to authenticated;

-- Penyelenggara mencabut lewat ID pendaftaran, tanpa pernah melihat nama di sertifikat.
create or replace function public.revoke_campus_event_certificate(
  p_public_slug text,
  p_registration_public_id text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null or not public.can_manage_campus_event_content(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  update public.campus_event_certificates cert
  set revoked_at = timezone('utc', now()), revoked_by = 'organizer'
  from public.campus_event_rsvps rsvp
  where rsvp.public_id = p_registration_public_id
    and rsvp.event_id = event_row.id
    and cert.event_id = event_row.id
    and cert.user_id = rsvp.user_id
    and (cert.revoked_at is null or cert.revoked_by = 'recipient');
  return found;
end;
$$;

revoke all on function public.revoke_campus_event_certificate(text, text) from public, anon;
grant execute on function public.revoke_campus_event_certificate(text, text) to authenticated;

create or replace function public.list_my_campus_event_certificates()
returns table (
  verify_code text, recipient_name text, event_public_slug text, event_title text,
  event_starts_at timestamptz, event_timezone text, organizer_alias text,
  is_official boolean, attendance_basis text, issued_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return query
  select cert.verify_code, cert.recipient_name, event.public_slug, cert.event_title,
    cert.event_starts_at, cert.event_timezone, cert.organizer_alias,
    cert.is_official, cert.attendance_basis, cert.issued_at
  from public.campus_event_certificates cert
  join public.campus_events event on event.id = cert.event_id
  where cert.user_id = actor and cert.revoked_at is null
  order by cert.event_starts_at desc
  limit 100;
end;
$$;

revoke all on function public.list_my_campus_event_certificates() from public, anon;
grant execute on function public.list_my_campus_event_certificates() to authenticated;

-- Cek keaslian publik. Sertifikat yang dicabut atau milik akun yang sedang
-- dihapus hanya mengembalikan status, tanpa nama.
create or replace function public.verify_campus_event_certificate(p_verify_code text)
returns table (
  status text, recipient_name text, event_title text, event_starts_at timestamptz,
  event_timezone text, organizer_alias text, is_official boolean,
  attendance_basis text, issued_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clean_code text := upper(btrim(coalesce(p_verify_code, '')));
  cert public.campus_event_certificates%rowtype;
begin
  if clean_code !~ '^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$' then
    return;
  end if;
  select * into cert from public.campus_event_certificates c where c.verify_code = clean_code;
  if cert.id is null then return; end if;
  if cert.revoked_at is not null or public.is_account_deletion_locked(cert.user_id) then
    return query select 'revoked'::text, null::text, null::text, null::timestamptz,
      null::text, null::text, null::boolean, null::text, null::timestamptz;
    return;
  end if;
  return query select 'valid'::text, cert.recipient_name, cert.event_title,
    cert.event_starts_at, cert.event_timezone, cert.organizer_alias,
    cert.is_official, cert.attendance_basis, cert.issued_at;
end;
$$;

revoke all on function public.verify_campus_event_certificate(text) from public;
grant execute on function public.verify_campus_event_certificate(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Tampilan peserta dan penyelenggara
-- ---------------------------------------------------------------------------

create or replace function public.get_my_campus_event_after_state(p_public_slug text)
returns table (
  has_ended boolean,
  can_give_feedback boolean,
  feedback_closes_at timestamptz,
  feedback_rating smallint,
  feedback_comment text,
  feedback_would_attend_again boolean,
  certificate_enabled boolean,
  certificate_eligibility text,
  certificate_requires_feedback boolean,
  certificate_blocker text,
  certificate_code text,
  certificate_name text,
  recap_body text,
  recap_published_at timestamptz,
  recap_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  is_attendee boolean;
  is_team boolean;
  ended boolean;
  feedback public.campus_event_feedback%rowtype;
  settings public.campus_event_certificate_settings%rowtype;
  cert public.campus_event_certificates%rowtype;
  recap public.campus_event_recaps%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null then return; end if;
  is_attendee := exists (
    select 1 from public.campus_event_rsvps rsvp
    where rsvp.event_id = event_row.id and rsvp.user_id = actor and rsvp.status = 'going'
  );
  is_team := public.can_manage_campus_event_content(event_row.id, actor)
    or public.is_event_team_member(event_row.id, actor, array['checkin_staff']::text[]);
  if not is_attendee and not is_team then return; end if;

  ended := public.campus_event_has_ended(event_row.id);
  select * into feedback from public.campus_event_feedback f
  where f.event_id = event_row.id and f.user_id = actor;
  select * into settings from public.campus_event_certificate_settings s
  where s.event_id = event_row.id;
  select * into cert from public.campus_event_certificates c
  where c.event_id = event_row.id and c.user_id = actor and c.revoked_at is null;
  select * into recap from public.campus_event_recaps r where r.event_id = event_row.id;

  return query select
    ended,
    ended and is_attendee and event_row.organizer_user_id <> actor
      and event_row.ends_at > timezone('utc', now()) - interval '14 days',
    event_row.ends_at + interval '14 days',
    feedback.rating,
    feedback.comment,
    feedback.would_attend_again,
    coalesce(settings.enabled, false),
    settings.eligibility,
    coalesce(settings.requires_feedback, false),
    case when cert.id is not null then null
      else public.campus_event_certificate_blocker(event_row.id, actor) end,
    cert.verify_code,
    cert.recipient_name,
    recap.body,
    recap.published_at,
    recap.updated_at;
end;
$$;

revoke all on function public.get_my_campus_event_after_state(text) from public, anon;
grant execute on function public.get_my_campus_event_after_state(text) to authenticated;

create or replace function public.get_campus_event_after_summary(p_public_slug text)
returns table (
  has_ended boolean,
  registered_count integer,
  checked_in_count integer,
  feedback_count integer,
  rating_average numeric,
  rating_1 integer, rating_2 integer, rating_3 integer, rating_4 integer, rating_5 integer,
  would_attend_again_count integer,
  certificate_count integer,
  certificate_enabled boolean,
  certificate_eligibility text,
  certificate_requires_feedback boolean,
  recap_body text,
  recap_published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null or not public.can_manage_campus_event_content(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;

  return query
  with going as (
    select rsvp.checked_in_at from public.campus_event_rsvps rsvp
    where rsvp.event_id = event_row.id and rsvp.status = 'going'
      and rsvp.user_id is distinct from event_row.organizer_user_id
  ), fb as (
    select f.rating, f.would_attend_again from public.campus_event_feedback f
    where f.event_id = event_row.id
  )
  select
    public.campus_event_has_ended(event_row.id),
    (select count(*)::integer from going),
    (select count(*)::integer from going where checked_in_at is not null),
    (select count(*)::integer from fb),
    (select round(avg(rating)::numeric, 1) from fb),
    (select count(*)::integer from fb where rating = 1),
    (select count(*)::integer from fb where rating = 2),
    (select count(*)::integer from fb where rating = 3),
    (select count(*)::integer from fb where rating = 4),
    (select count(*)::integer from fb where rating = 5),
    (select count(*)::integer from fb where would_attend_again),
    (select count(*)::integer from public.campus_event_certificates c
      where c.event_id = event_row.id and c.revoked_at is null),
    coalesce(s.enabled, false),
    coalesce(s.eligibility, 'checked_in'),
    coalesce(s.requires_feedback, false),
    r.body,
    r.published_at
  from (select 1) base
  left join public.campus_event_certificate_settings s on s.event_id = event_row.id
  left join public.campus_event_recaps r on r.event_id = event_row.id;
end;
$$;

revoke all on function public.get_campus_event_after_summary(text) from public, anon;
grant execute on function public.get_campus_event_after_summary(text) to authenticated;

-- Komentar tanpa identitas, baru dibuka setelah minimal 3 ulasan, urutan acak tetap.
create or replace function public.list_campus_event_feedback_comments(p_public_slug text)
returns table (rating smallint, comment text, would_attend_again boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null or not public.can_manage_campus_event_content(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  if (select count(*) from public.campus_event_feedback f where f.event_id = event_row.id) < 3 then
    return;
  end if;
  return query
  select f.rating, f.comment, f.would_attend_again
  from public.campus_event_feedback f
  where f.event_id = event_row.id and f.comment is not null
  order by md5(f.id::text)
  limit 200;
end;
$$;

revoke all on function public.list_campus_event_feedback_comments(text) from public, anon;
grant execute on function public.list_campus_event_feedback_comments(text) to authenticated;

-- Daftar penerima sertifikat untuk penyelenggara: alias pendaftaran saja.
create or replace function public.list_campus_event_certificate_recipients(p_public_slug text)
returns table (registration_public_id text, public_alias text, issued_at timestamptz, revoked_by text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  select * into event_row from public.campus_events event
  where event.public_slug = p_public_slug;
  if event_row.id is null or not public.can_manage_campus_event_content(event_row.id, actor) then
    raise exception 'event management required' using errcode = '42501';
  end if;
  return query
  select rsvp.public_id, profile.public_alias, cert.issued_at, cert.revoked_by
  from public.campus_event_certificates cert
  join public.campus_event_rsvps rsvp
    on rsvp.event_id = cert.event_id and rsvp.user_id = cert.user_id
  join public.profiles profile on profile.user_id = cert.user_id
  where cert.event_id = event_row.id
  order by cert.issued_at desc
  limit 500;
end;
$$;

revoke all on function public.list_campus_event_certificate_recipients(text) from public, anon;
grant execute on function public.list_campus_event_certificate_recipients(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Penjadwal: permintaan ulasan
-- ---------------------------------------------------------------------------
-- Isi lama product_scheduler_tick() tetap sama; hanya ditambah satu putaran.
-- inserted_count kini juga menghitung permintaan ulasan baru. Penerima yang sudah
-- pernah dikirimi dilewati, dan dedupe_key tetap mencegah dobel.

create or replace function public.product_scheduler_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare inserted_count integer := 0; reminder record;
begin
  if session_user not in ('postgres', 'supabase_admin') and auth.role() <> 'service_role' then
    raise exception 'scheduler unavailable' using errcode = '42501';
  end if;
  insert into public.product_scheduler_runs (job_name, last_started_at)
  values ('product-scheduler-v1', timezone('utc', now()))
  on conflict (job_name) do update
    set last_started_at = excluded.last_started_at, updated_at = excluded.last_started_at;

  for reminder in
    select event.id event_id, event.public_slug, event.title,
      event.starts_at, event.timezone_name, rsvp.user_id,
      '24h'::text kind, 'EVENT_REMINDER_24H'::text notification_type
    from public.campus_events event
    join public.campus_event_rsvps rsvp
      on rsvp.event_id = event.id and rsvp.status = 'going'
    where event.status = 'scheduled'
      and rsvp.user_id is not null
      and public.is_notification_student(rsvp.user_id)
      and event.starts_at > timezone('utc', now()) + interval '2 hours'
      and event.starts_at <= timezone('utc', now()) + interval '24 hours'
    union all
    select event.id, event.public_slug, event.title,
      event.starts_at, event.timezone_name, rsvp.user_id,
      '2h', 'EVENT_REMINDER_2H'
    from public.campus_events event
    join public.campus_event_rsvps rsvp
      on rsvp.event_id = event.id and rsvp.status = 'going'
    where event.status = 'scheduled'
      and rsvp.user_id is not null
      and public.is_notification_student(rsvp.user_id)
      and event.starts_at > timezone('utc', now())
      and event.starts_at <= timezone('utc', now()) + interval '2 hours'
  loop
    insert into public.campus_event_reminder_receipts (event_id, user_id, reminder_kind)
    values (reminder.event_id, reminder.user_id, reminder.kind)
    on conflict do nothing;
    if found then
      perform public.emit_user_notification(
        reminder.user_id,
        reminder.notification_type,
        '/app/events/' || reminder.public_slug,
        jsonb_build_object(
          'title', public.notification_safe_label(
            reminder.title, 100, 'Campus Event'
          ),
          'when_label', public.notification_safe_label(
            to_char(
              reminder.starts_at at time zone reminder.timezone_name,
              'YYYY-MM-DD HH24:MI'
            ),
            64, 'jadwal event'
          )
        ),
        'event_reminder:' || reminder.kind || ':' || reminder.event_id::text
          || ':' || reminder.user_id::text
      );
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  -- Permintaan ulasan 1 sampai 48 jam setelah acara selesai (202610210004).
  for reminder in
    select event.id event_id, event.public_slug, event.title, rsvp.user_id
    from public.campus_events event
    join public.campus_event_rsvps rsvp
      on rsvp.event_id = event.id and rsvp.status = 'going'
    where event.status in ('scheduled', 'archived')
      and rsvp.user_id is not null
      and rsvp.user_id <> event.organizer_user_id
      and event.ends_at <= timezone('utc', now()) - interval '1 hour'
      and event.ends_at > timezone('utc', now()) - interval '48 hours'
      and public.is_notification_student(rsvp.user_id)
      and not exists (
        select 1 from public.campus_event_feedback feedback
        where feedback.event_id = event.id and feedback.user_id = rsvp.user_id
      )
      and not exists (
        select 1 from public.user_notifications sent
        where sent.dedupe_key = 'event_feedback_request:' || event.id::text
          || ':' || rsvp.user_id::text
      )
    limit 2000
  loop
    perform public.emit_user_notification(
      reminder.user_id,
      'EVENT_FEEDBACK_REQUEST',
      '/app/events/' || reminder.public_slug || '#ulasan',
      jsonb_build_object(
        'title', public.notification_safe_label(reminder.title, 100, 'Campus Event')
      ),
      'event_feedback_request:' || reminder.event_id::text || ':' || reminder.user_id::text
    );
    inserted_count := inserted_count + 1;
  end loop;

  perform public.purge_expired_meeting_plan_details(100);
  update public.product_scheduler_runs
  set last_succeeded_at = timezone('utc', now()),
      last_result_count = inserted_count,
      updated_at = timezone('utc', now())
  where job_name = 'product-scheduler-v1';
  return inserted_count;
end;
$function$;
