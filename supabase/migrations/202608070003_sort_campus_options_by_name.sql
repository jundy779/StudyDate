-- Sort campus catalog A–Z by name (first letter), not by status/suggestion count.

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
  order by campus.name;
end;
$$;

revoke all on function public.list_approved_campus_options()
  from public, anon, authenticated;
grant execute on function public.list_approved_campus_options()
  to authenticated;

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
  order by campus.name
  limit safe_limit;
end;
$$;

revoke all on function public.list_staff_campus_options(text, integer)
  from public, anon, authenticated;
grant execute on function public.list_staff_campus_options(text, integer)
  to authenticated;
