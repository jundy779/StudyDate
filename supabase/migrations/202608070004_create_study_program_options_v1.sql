-- Study program (jurusan) catalog v1 — mirrors campus_options.
-- Approved names power onboarding suggestions; manual entries become pending.

create table if not exists public.study_program_options (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  search_key text not null,
  status text not null default 'pending',
  source text not null default 'manual',
  suggestion_count integer not null default 1,
  suggested_by uuid null references auth.users (id) on delete set null,
  reviewed_by uuid null references auth.users (id) on delete set null,
  reviewed_at timestamptz null,
  last_suggested_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint study_program_options_name_length check (
    char_length(btrim(name)) between 2 and 120
  ),
  constraint study_program_options_search_key_length check (
    char_length(search_key) between 2 and 160
  ),
  constraint study_program_options_status_allowed check (
    status in ('approved', 'pending', 'rejected')
  ),
  constraint study_program_options_source_allowed check (
    source in ('seed', 'manual', 'staff')
  ),
  constraint study_program_options_suggestion_count_positive check (
    suggestion_count >= 1
  ),
  constraint study_program_options_search_key_unique unique (search_key)
);

create index if not exists study_program_options_status_name_idx
  on public.study_program_options (status, name);

create index if not exists study_program_options_pending_queue_idx
  on public.study_program_options (status, suggestion_count desc, last_suggested_at desc)
  where status = 'pending';

alter table public.study_program_options enable row level security;
revoke all on table public.study_program_options from public, anon, authenticated;

comment on table public.study_program_options is
  'Curated study-program catalog + pending manual suggestions. Staff manage via RPC only.';

insert into public.study_program_options (name, search_key, status, source, suggestion_count)
select
  seed.name,
  public.normalize_campus_search(seed.name),
  'approved',
  'seed',
  1
from (
  values
    ('Administrasi Bisnis'),
    ('Akuntansi'),
    ('Arsitektur'),
    ('Biologi'),
    ('Desain Komunikasi Visual'),
    ('Ekonomi Pembangunan'),
    ('Farmasi'),
    ('Fisika'),
    ('Gizi'),
    ('Hubungan Internasional'),
    ('Hukum'),
    ('Ilmu Komputer'),
    ('Ilmu Komunikasi'),
    ('Kedokteran'),
    ('Keperawatan'),
    ('Kimia'),
    ('Manajemen'),
    ('Matematika'),
    ('Pendidikan Bahasa Inggris'),
    ('Pendidikan Guru Sekolah Dasar'),
    ('Perencanaan Wilayah dan Kota'),
    ('Psikologi'),
    ('Sastra Indonesia'),
    ('Sastra Inggris'),
    ('Sistem Informasi'),
    ('Statistika'),
    ('Teknik Elektro'),
    ('Teknik Industri'),
    ('Teknik Informatika'),
    ('Teknik Kimia'),
    ('Teknik Lingkungan'),
    ('Teknik Mesin'),
    ('Teknik Sipil'),
    ('Teknologi Informasi')
) as seed(name)
where public.normalize_campus_search(seed.name) is not null
on conflict (search_key) do nothing;

create or replace function public.list_approved_study_program_options()
returns table (
  name text,
  search_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select program.name, program.search_key
  from public.study_program_options as program
  where program.status = 'approved'
  order by program.name;
end;
$$;

revoke all on function public.list_approved_study_program_options()
  from public, anon, authenticated;
grant execute on function public.list_approved_study_program_options()
  to authenticated;

create or replace function public.suggest_study_program_option(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized text;
  cleaned_name text;
  existing public.study_program_options%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  cleaned_name := btrim(coalesce(p_name, ''));
  if char_length(cleaned_name) < 2 or char_length(cleaned_name) > 120 then
    raise exception 'invalid study program name' using errcode = '22023';
  end if;

  normalized := public.normalize_campus_search(cleaned_name);
  if normalized is null or char_length(normalized) < 2 then
    raise exception 'invalid study program name' using errcode = '22023';
  end if;

  select * into existing
  from public.study_program_options
  where search_key = normalized
  for update;

  if found then
    if existing.status = 'approved' then
      update public.study_program_options
      set
        suggestion_count = existing.suggestion_count + 1,
        last_suggested_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where id = existing.id;
      return existing.id;
    end if;

    update public.study_program_options
    set
      status = 'pending',
      name = cleaned_name,
      suggestion_count = existing.suggestion_count + 1,
      suggested_by = coalesce(existing.suggested_by, actor),
      last_suggested_at = timezone('utc', now()),
      reviewed_by = null,
      reviewed_at = null,
      updated_at = timezone('utc', now())
    where id = existing.id;

    return existing.id;
  end if;

  insert into public.study_program_options (
    name,
    search_key,
    status,
    source,
    suggestion_count,
    suggested_by
  )
  values (
    cleaned_name,
    normalized,
    'pending',
    'manual',
    1,
    actor
  )
  returning id into existing.id;

  return existing.id;
end;
$$;

revoke all on function public.suggest_study_program_option(text)
  from public, anon, authenticated;
grant execute on function public.suggest_study_program_option(text)
  to authenticated;

create or replace function public.list_staff_study_program_options(
  p_status text default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  name text,
  search_key text,
  status text,
  source text,
  suggestion_count integer,
  last_suggested_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  reviewed_at timestamptz,
  suggested_by_suffix text,
  reviewed_by_suffix text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
begin
  if not public.is_current_active_staff(array['owner', 'admin']::text[], false) then
    raise exception 'staff authorization required' using errcode = '42501';
  end if;

  if p_status is not null
    and p_status not in ('approved', 'pending', 'rejected') then
    raise exception 'invalid study program status' using errcode = '22023';
  end if;

  return query
  select
    program.id,
    program.name,
    program.search_key,
    program.status,
    program.source,
    program.suggestion_count,
    program.last_suggested_at,
    program.created_at,
    program.updated_at,
    program.reviewed_at,
    case
      when program.suggested_by is null then null
      else right(replace(program.suggested_by::text, '-', ''), 6)
    end,
    case
      when program.reviewed_by is null then null
      else right(replace(program.reviewed_by::text, '-', ''), 6)
    end
  from public.study_program_options as program
  where p_status is null or program.status = p_status
  order by program.name
  limit safe_limit;
end;
$$;

revoke all on function public.list_staff_study_program_options(text, integer)
  from public, anon, authenticated;
grant execute on function public.list_staff_study_program_options(text, integer)
  to authenticated;

create or replace function public.manage_study_program_option(
  p_action text,
  p_id uuid default null,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  cleaned_name text;
  normalized text;
  target public.study_program_options%rowtype;
  result_id uuid;
begin
  if not public.is_current_active_staff(array['owner', 'admin']::text[], false) then
    raise exception 'staff authorization required' using errcode = '42501';
  end if;

  if p_action not in ('create', 'update', 'approve', 'reject', 'delete') then
    raise exception 'invalid study program action' using errcode = '22023';
  end if;

  if p_action = 'create' then
    cleaned_name := btrim(coalesce(p_name, ''));
    if char_length(cleaned_name) < 2 or char_length(cleaned_name) > 120 then
      raise exception 'invalid study program name' using errcode = '22023';
    end if;
    normalized := public.normalize_campus_search(cleaned_name);
    if normalized is null then
      raise exception 'invalid study program name' using errcode = '22023';
    end if;

    insert into public.study_program_options (
      name,
      search_key,
      status,
      source,
      suggestion_count,
      reviewed_by,
      reviewed_at
    )
    values (
      cleaned_name,
      normalized,
      'approved',
      'staff',
      1,
      actor,
      timezone('utc', now())
    )
    on conflict (search_key) do update
      set
        name = excluded.name,
        status = 'approved',
        source = case
          when study_program_options.source = 'seed' then 'seed'
          else 'staff'
        end,
        reviewed_by = actor,
        reviewed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    returning id into result_id;

    return result_id;
  end if;

  if p_id is null then
    raise exception 'study program id required' using errcode = '22023';
  end if;

  select * into target
  from public.study_program_options
  where id = p_id
  for update;

  if not found then
    raise exception 'study program not found' using errcode = 'P0002';
  end if;

  if p_action = 'delete' then
    delete from public.study_program_options where id = target.id;
    return target.id;
  end if;

  if p_action = 'reject' then
    update public.study_program_options
    set
      status = 'rejected',
      reviewed_by = actor,
      reviewed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
    where id = target.id;
    return target.id;
  end if;

  if p_action in ('update', 'approve') then
    cleaned_name := btrim(coalesce(nullif(p_name, ''), target.name));
    if char_length(cleaned_name) < 2 or char_length(cleaned_name) > 120 then
      raise exception 'invalid study program name' using errcode = '22023';
    end if;
    normalized := public.normalize_campus_search(cleaned_name);
    if normalized is null then
      raise exception 'invalid study program name' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.study_program_options other
      where other.search_key = normalized
        and other.id <> target.id
    ) then
      raise exception 'study program name already exists' using errcode = '23505';
    end if;

    update public.study_program_options
    set
      name = cleaned_name,
      search_key = normalized,
      status = case
        when p_action = 'approve' then 'approved'
        else target.status
      end,
      reviewed_by = case
        when p_action = 'approve' then actor
        else target.reviewed_by
      end,
      reviewed_at = case
        when p_action = 'approve' then timezone('utc', now())
        else target.reviewed_at
      end,
      updated_at = timezone('utc', now())
    where id = target.id;

    return target.id;
  end if;

  raise exception 'invalid study program action' using errcode = '22023';
end;
$$;

revoke all on function public.manage_study_program_option(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.manage_study_program_option(text, uuid, text)
  to authenticated;
