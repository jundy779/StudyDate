-- Student access tiers v1.
--
-- Keputusan pemilik produk (20 Oktober 2026):
-- 1. Semua akun mahasiswa wajib lolos verifikasi PDDikti (status profil
--    'verified') sebelum memakai fitur sosial inti: Cari Teman, Perkenalan,
--    Chat, Circle, dan Acara.
-- 2. Akun dengan email .sch.id (sekolah) tidak bisa diverifikasi lewat PDDikti,
--    jadi hanya boleh mengikuti acara edukatif. Mereka tidak tampil di Cari
--    Teman, tidak bisa berkenalan, chat, gabung Circle, atau membuat acara.
--
-- Aturan 1 dikendalikan saklar `require_student_verification` yang DEFAULT OFF,
-- karena verifikasi mahasiswa belum dibuka untuk semua pengguna. Menyalakannya
-- sebelum verifikasi siap akan mengunci semua mahasiswa dari fitur inti.
-- Aturan 2 langsung berlaku.
--
-- Migration ini forward-only dan tidak mengubah data pengguna.

-- ---------------------------------------------------------------------------
-- 1. Saklar platform
-- ---------------------------------------------------------------------------

create table if not exists public.platform_settings (
  key text primary key,
  bool_value boolean not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null references auth.users (id) on delete set null,
  constraint platform_settings_key_allowed check (
    key in ('require_student_verification')
  )
);

alter table public.platform_settings enable row level security;
revoke all on table public.platform_settings from public, anon, authenticated;

insert into public.platform_settings (key, bool_value)
values ('require_student_verification', false)
on conflict (key) do nothing;

create or replace function public.is_student_verification_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select setting.bool_value
    from public.platform_settings setting
    where setting.key = 'require_student_verification'
  ), false);
$$;

revoke all on function public.is_student_verification_required()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Jenis akun berdasarkan domain email login
-- ---------------------------------------------------------------------------

create or replace function public.is_school_email_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select lower(split_part(btrim(auth_user.email), '@', 2)) = 'sch.id'
      or lower(split_part(btrim(auth_user.email), '@', 2)) like '%.sch.id'
    from auth.users auth_user
    where auth_user.id = p_user_id
  ), false);
$$;

revoke all on function public.is_school_email_account(uuid)
  from public, anon, authenticated;

create or replace function public.passes_student_verification_gate(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_student_verification_required()
    or exists (
      select 1
      from public.profiles profile
      where profile.user_id = p_user_id
        and profile.verification_status = 'verified'
    );
$$;

revoke all on function public.passes_student_verification_gate(uuid)
  from public, anon, authenticated;

-- Kategori acara yang dianggap edukatif untuk akun sekolah.
create or replace function public.is_educational_event_category(p_category text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_category in (
    'study_together',
    'coding_tech',
    'design',
    'languages',
    'exam_prep',
    'workshop',
    'seminar'
  );
$$;

revoke all on function public.is_educational_event_category(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Guard bersama
-- ---------------------------------------------------------------------------

-- Kondisi dasar akun yang sebelumnya berada di is_eligible_introduction_student
-- (202608100001), dipisah supaya Acara bisa memakai dasar yang sama tanpa
-- syarat fitur sosial.
create or replace function public.is_base_student_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.user_id = p_user_id
      and profile.onboarding_completed_at is not null
      and profile.deactivated_at is null
      and not exists (
        select 1
        from public.staff_members staff
        where staff.user_id = p_user_id
          and staff.status = 'active'
      )
      and not exists (
        select 1
        from public.account_deletion_requests deletion
        where deletion.user_id = p_user_id
          and deletion.status in ('pending', 'processing', 'failed')
      )
  );
$$;

revoke all on function public.is_base_student_account(uuid)
  from public, anon, authenticated;

-- Fitur sosial inti: Perkenalan, Chat, Kenal Lebih Jauh, Identitas, Kontak,
-- Cari Teman, dan berbagi kartu Circle/Acara di chat.
create or replace function public.is_eligible_introduction_student(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_base_student_account(p_user_id)
    and not public.is_school_email_account(p_user_id)
    and public.passes_student_verification_gate(p_user_id);
$$;

revoke all on function public.is_eligible_introduction_student(uuid)
  from public, anon, authenticated;

-- Acara: akun sekolah boleh masuk (dibatasi ke acara edukatif lewat trigger di
-- bawah), akun lain mengikuti gerbang verifikasi.
create or replace function public.is_campus_event_student(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_base_student_account(p_user_id)
    and (
      public.is_school_email_account(p_user_id)
      or public.passes_student_verification_gate(p_user_id)
    );
$$;

-- Circle: kondisi lama dipertahankan, ditambah aturan sekolah dan verifikasi.
create or replace function public.is_study_circle_student(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.profiles profile
      where profile.user_id = p_user_id
        and profile.onboarding_completed_at is not null
        and nullif(to_jsonb(profile)->>'deactivated_at', '') is null
    )
    and not public.is_active_staff_user(p_user_id)
    and not public.is_school_email_account(p_user_id)
    and public.passes_student_verification_gate(p_user_id);
$$;

-- Penyelenggara acara: akun sekolah tidak pernah bisa membuat acara, termasuk
-- lewat izin Owner.
create or replace function public.is_event_organizer_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_campus_event_student(p_user_id)
    and not public.is_school_email_account(p_user_id)
    and not exists (
      select 1 from public.staff_members staff
      where staff.user_id = p_user_id and staff.status = 'active'
    )
    and coalesce((
      select eligibility.status <> 'revoked'
      from public.event_organizer_eligibility eligibility
      where eligibility.user_id = p_user_id
    ), true)
    and (
      exists (
        select 1 from public.profiles profile
        where profile.user_id = p_user_id
          and profile.verification_status = 'verified'
      )
      or exists (
        select 1 from public.event_organizer_eligibility eligibility
        where eligibility.user_id = p_user_id
          and eligibility.status = 'eligible'
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 4. Akun sekolah hanya bisa mendaftar acara edukatif
-- ---------------------------------------------------------------------------

create or replace function public.enforce_school_account_event_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_category text;
begin
  if new.status in ('cancelled', 'declined') then
    return new;
  end if;

  if not public.is_school_email_account(new.user_id) then
    return new;
  end if;

  select event.category into event_category
  from public.campus_events event
  where event.id = new.event_id;

  if not public.is_educational_event_category(event_category) then
    raise exception 'event not available for school account'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_school_account_event_category()
  from public, anon, authenticated;

drop trigger if exists campus_event_rsvps_school_account_category
  on public.campus_event_rsvps;
create trigger campus_event_rsvps_school_account_category
before insert or update of status on public.campus_event_rsvps
for each row execute function public.enforce_school_account_event_category();

-- ---------------------------------------------------------------------------
-- 5. RPC untuk aplikasi
-- ---------------------------------------------------------------------------

-- Status akses milik pengguna yang sedang masuk. Tidak membuka email.
create or replace function public.get_my_student_access()
returns table (
  account_tier text,
  verification_required boolean,
  verification_status text,
  social_features_allowed boolean,
  events_allowed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select
    case when public.is_school_email_account(actor) then 'school' else 'student' end,
    public.is_student_verification_required(),
    profile.verification_status,
    public.is_eligible_introduction_student(actor),
    public.is_campus_event_student(actor)
  from public.profiles profile
  where profile.user_id = actor;
end;
$$;

revoke all on function public.get_my_student_access() from public, anon;
grant execute on function public.get_my_student_access() to authenticated;

create or replace function public.owner_get_student_verification_requirement()
returns table (required boolean, updated_at timestamptz)
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
  select setting.bool_value, setting.updated_at
  from public.platform_settings setting
  where setting.key = 'require_student_verification';
end;
$$;

revoke all on function public.owner_get_student_verification_requirement()
  from public, anon;
grant execute on function public.owner_get_student_verification_requirement()
  to authenticated;

create or replace function public.owner_set_student_verification_requirement(
  p_required boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;

  if p_required is null then
    raise exception 'invalid setting value' using errcode = '22023';
  end if;

  update public.platform_settings
  set bool_value = p_required,
      updated_at = timezone('utc', now()),
      updated_by = actor
  where key = 'require_student_verification';

  return p_required;
end;
$$;

revoke all on function public.owner_set_student_verification_requirement(boolean)
  from public, anon;
grant execute on function public.owner_set_student_verification_requirement(boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Daftar acara di aplikasi
-- ---------------------------------------------------------------------------
-- Filter kategori sebelumnya masih memakai 11 kategori lama, sehingga memilih
-- Seminar, Meetup, atau Hackathon di /app/events berakhir galat. Sekalian, akun
-- sekolah hanya melihat acara edukatif.
CREATE OR REPLACE FUNCTION public.list_campus_events(p_search text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_scope text DEFAULT NULL::text, p_before_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_public_slug text DEFAULT NULL::text, p_limit integer DEFAULT 13)
 RETURNS TABLE(public_slug text, title text, description text, category text, scope text, campus_scope text, starts_at timestamp with time zone, ends_at timestamp with time zone, timezone_name text, venue_category text, venue_name text, venue_area text, city text, capacity integer, attendee_count integer, rsvp_status text, is_organizer boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 set search_path = ''
AS $$
declare
  actor uuid := auth.uid();
  actor_campus text;
  actor_is_school boolean;
  normalized_search text;
  safe_limit integer := least(greatest(coalesce(p_limit, 13), 1), 31);
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'student access required' using errcode = '42501';
  end if;
  if p_category is not null and p_category not in (
    'study_together', 'coding_tech', 'design', 'languages', 'thesis',
    'exam_prep', 'workshop', 'discussion', 'networking', 'community',
    'seminar', 'meetup', 'hackathon', 'other'
  ) then raise exception 'invalid event category' using errcode = '22023'; end if;
  if p_scope is not null and p_scope not in ('open', 'campus') then
    raise exception 'invalid event scope' using errcode = '22023';
  end if;
  if (p_before_starts_at is null) <> (p_before_public_slug is null)
    or (p_before_public_slug is not null
      and p_before_public_slug !~ '^event-[0-9a-f]{24}$') then
    raise exception 'invalid event cursor' using errcode = '22023';
  end if;
  normalized_search := nullif(
    public.normalize_campus_event_single_line(p_search), ''
  );
  if normalized_search is not null and char_length(normalized_search) > 100 then
    raise exception 'invalid event search' using errcode = '22023';
  end if;
  select profile.campus into actor_campus
  from public.profiles profile where profile.user_id = actor;
  actor_is_school := public.is_school_email_account(actor);

  return query
  select event.public_slug, event.title, event.description, event.category,
    event.scope, event.campus_scope, event.starts_at, event.ends_at,
    event.timezone_name, event.venue_category, event.venue_name,
    event.venue_area, event.city, event.capacity::integer,
    (select count(*)::integer from public.campus_event_rsvps attendance
      where attendance.event_id = event.id and attendance.status = 'going'),
    own_rsvp.status, event.organizer_user_id = actor
  from public.campus_events event
  left join public.campus_event_rsvps own_rsvp
    on own_rsvp.event_id = event.id and own_rsvp.user_id = actor
  where event.status = 'scheduled'
    and event.starts_at > timezone('utc', now())
    and public.is_campus_event_student(event.organizer_user_id)
    and (event.scope = 'open' or event.campus_scope = actor_campus)
    and not public.users_are_blocked(actor, event.organizer_user_id)
    and (p_category is null or event.category = p_category)
    and (not actor_is_school or public.is_educational_event_category(event.category))
    and (p_scope is null or event.scope = p_scope)
    and (
      normalized_search is null
      or event.title ilike '%' || normalized_search || '%'
    )
    and (
      p_before_starts_at is null
      or (event.starts_at, event.public_slug)
        > (p_before_starts_at, p_before_public_slug)
    )
  order by event.starts_at asc, event.public_slug asc
  limit safe_limit;
end;
$$;
