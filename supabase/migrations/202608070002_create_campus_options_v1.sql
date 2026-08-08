-- Campus options catalog v1.
-- Approved names power onboarding suggestions.
-- Manual onboarding campuses become pending suggestions for owner/admin curation.

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_campus_search(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    trim(both from regexp_replace(
      lower(trim(both from coalesce(p_name, ''))),
      '[^a-z0-9]+',
      ' ',
      'g'
    )),
    ''
  );
$$;

revoke all on function public.normalize_campus_search(text)
  from public, anon, authenticated;
grant execute on function public.normalize_campus_search(text)
  to authenticated;

comment on function public.normalize_campus_search(text) is
  'Normalize campus labels for unique matching (lowercase alphanumeric tokens).';

-- ---------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------

create table if not exists public.campus_options (
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
  constraint campus_options_name_length check (
    char_length(btrim(name)) between 2 and 120
  ),
  constraint campus_options_search_key_length check (
    char_length(search_key) between 2 and 160
  ),
  constraint campus_options_status_allowed check (
    status in ('approved', 'pending', 'rejected')
  ),
  constraint campus_options_source_allowed check (
    source in ('seed', 'manual', 'staff')
  ),
  constraint campus_options_suggestion_count_positive check (
    suggestion_count >= 1
  ),
  constraint campus_options_search_key_unique unique (search_key)
);

create index if not exists campus_options_status_name_idx
  on public.campus_options (status, name);

create index if not exists campus_options_pending_queue_idx
  on public.campus_options (status, suggestion_count desc, last_suggested_at desc)
  where status = 'pending';

alter table public.campus_options enable row level security;
revoke all on table public.campus_options from public, anon, authenticated;

comment on table public.campus_options is
  'Curated campus catalog + pending manual suggestions. Staff manage via RPC only.';

-- ---------------------------------------------------------------------------
-- 3. Seed major campuses (approved)
-- ---------------------------------------------------------------------------

insert into public.campus_options (name, search_key, status, source, suggestion_count)
select
  seed.name,
  public.normalize_campus_search(seed.name),
  'approved',
  'seed',
  1
from (
  values
    ('BINUS University'),
    ('IPB University'),
    ('Institut Teknologi Bandung'),
    ('Institut Teknologi Sepuluh Nopember'),
    ('Sekolah Tinggi Teknologi Terpadu Nurul Fikri'),
    ('Telkom University'),
    ('UIN Syarif Hidayatullah Jakarta'),
    ('Universitas Airlangga'),
    ('Universitas Andalas'),
    ('Universitas Atma Jaya Yogyakarta'),
    ('Universitas Brawijaya'),
    ('Universitas Diponegoro'),
    ('Universitas Gadjah Mada'),
    ('Universitas Gunadarma'),
    ('Universitas Hasanuddin'),
    ('Universitas Indonesia'),
    ('Universitas Islam Indonesia'),
    ('Universitas Mercu Buana'),
    ('Universitas Muhammadiyah Malang'),
    ('Universitas Multimedia Nusantara'),
    ('Universitas Negeri Jakarta'),
    ('Universitas Negeri Malang'),
    ('Universitas Negeri Semarang'),
    ('Universitas Negeri Surabaya'),
    ('Universitas Negeri Yogyakarta'),
    ('Universitas Padjadjaran'),
    ('Universitas Pelita Harapan'),
    ('Universitas Sebelas Maret'),
    ('Universitas Sriwijaya'),
    ('Universitas Sumatera Utara'),
    ('Universitas Trisakti')
) as seed(name)
where public.normalize_campus_search(seed.name) is not null
on conflict (search_key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Student-facing: list approved + suggest from onboarding
-- ---------------------------------------------------------------------------

create or replace function public.list_approved_campus_options()
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
  select campus.name, campus.search_key
  from public.campus_options as campus
  where campus.status = 'approved'
  order by campus.name collate "C";
end;
$$;

revoke all on function public.list_approved_campus_options()
  from public, anon, authenticated;
grant execute on function public.list_approved_campus_options()
  to authenticated;

create or replace function public.suggest_campus_option(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized text;
  cleaned_name text;
  existing public.campus_options%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  cleaned_name := btrim(coalesce(p_name, ''));
  if char_length(cleaned_name) < 2 or char_length(cleaned_name) > 120 then
    raise exception 'invalid campus name' using errcode = '22023';
  end if;

  normalized := public.normalize_campus_search(cleaned_name);
  if normalized is null or char_length(normalized) < 2 then
    raise exception 'invalid campus name' using errcode = '22023';
  end if;

  select * into existing
  from public.campus_options
  where search_key = normalized
  for update;

  if found then
    if existing.status = 'approved' then
      update public.campus_options
      set
        suggestion_count = existing.suggestion_count + 1,
        last_suggested_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where id = existing.id;
      return existing.id;
    end if;

    update public.campus_options
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

  insert into public.campus_options (
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

revoke all on function public.suggest_campus_option(text)
  from public, anon, authenticated;
grant execute on function public.suggest_campus_option(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Staff: list + manage (owner and admin)
-- ---------------------------------------------------------------------------

create or replace function public.list_staff_campus_options(
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
    raise exception 'invalid campus status' using errcode = '22023';
  end if;

  return query
  select
    campus.id,
    campus.name,
    campus.search_key,
    campus.status,
    campus.source,
    campus.suggestion_count,
    campus.last_suggested_at,
    campus.created_at,
    campus.updated_at,
    campus.reviewed_at,
    case
      when campus.suggested_by is null then null
      else right(replace(campus.suggested_by::text, '-', ''), 6)
    end,
    case
      when campus.reviewed_by is null then null
      else right(replace(campus.reviewed_by::text, '-', ''), 6)
    end
  from public.campus_options as campus
  where p_status is null or campus.status = p_status
  order by
    case campus.status
      when 'pending' then 0
      when 'approved' then 1
      else 2
    end,
    campus.suggestion_count desc,
    campus.name
  limit safe_limit;
end;
$$;

revoke all on function public.list_staff_campus_options(text, integer)
  from public, anon, authenticated;
grant execute on function public.list_staff_campus_options(text, integer)
  to authenticated;

create or replace function public.manage_campus_option(
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
  target public.campus_options%rowtype;
  result_id uuid;
begin
  if not public.is_current_active_staff(array['owner', 'admin']::text[], false) then
    raise exception 'staff authorization required' using errcode = '42501';
  end if;

  if p_action not in ('create', 'update', 'approve', 'reject', 'delete') then
    raise exception 'invalid campus action' using errcode = '22023';
  end if;

  if p_action = 'create' then
    cleaned_name := btrim(coalesce(p_name, ''));
    if char_length(cleaned_name) < 2 or char_length(cleaned_name) > 120 then
      raise exception 'invalid campus name' using errcode = '22023';
    end if;
    normalized := public.normalize_campus_search(cleaned_name);
    if normalized is null then
      raise exception 'invalid campus name' using errcode = '22023';
    end if;

    insert into public.campus_options (
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
          when campus_options.source = 'seed' then 'seed'
          else 'staff'
        end,
        reviewed_by = actor,
        reviewed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    returning id into result_id;

    return result_id;
  end if;

  if p_id is null then
    raise exception 'campus id required' using errcode = '22023';
  end if;

  select * into target
  from public.campus_options
  where id = p_id
  for update;

  if not found then
    raise exception 'campus not found' using errcode = 'P0002';
  end if;

  if p_action = 'delete' then
    delete from public.campus_options where id = target.id;
    return target.id;
  end if;

  if p_action = 'reject' then
    update public.campus_options
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
      raise exception 'invalid campus name' using errcode = '22023';
    end if;
    normalized := public.normalize_campus_search(cleaned_name);
    if normalized is null then
      raise exception 'invalid campus name' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.campus_options other
      where other.search_key = normalized
        and other.id <> target.id
    ) then
      raise exception 'campus name already exists' using errcode = '23505';
    end if;

    update public.campus_options
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

  raise exception 'invalid campus action' using errcode = '22023';
end;
$$;

revoke all on function public.manage_campus_option(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.manage_campus_option(text, uuid, text)
  to authenticated;

comment on function public.list_approved_campus_options() is
  'Authenticated students: approved campus labels for onboarding suggestions.';
comment on function public.suggest_campus_option(text) is
  'Authenticated students: upsert pending campus suggestion after manual/onboarding entry.';
comment on function public.list_staff_campus_options(text, integer) is
  'Owner/admin sanitized campus catalog and pending queue.';
comment on function public.manage_campus_option(text, uuid, text) is
  'Owner/admin create/update/approve/reject/delete campus options.';
