-- Forward-only hotfix for consume_membership_quota (local-only in this task).
-- Production 004 declares a PL/pgSQL variable named window_start, which collides
-- with membership_quota_usage.window_start (SQLSTATE 42702). Do not edit 004.

create or replace function public.consume_membership_quota(
  p_user_id uuid,
  p_action text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota_window_start timestamptz := date_trunc('day', timezone('utc', now()));
  updated integer;
begin
  if p_user_id is null
    or p_action <> 'people_discovery_daily'
    or p_limit is null
    or p_limit < 1
    or p_limit > 1000 then
    return false;
  end if;

  insert into public.membership_quota_usage as usage (
    user_id,
    action,
    window_start,
    hit_count
  ) values (
    p_user_id,
    p_action,
    v_quota_window_start,
    1
  )
  on conflict (user_id, action, window_start) do update
    set hit_count = usage.hit_count + 1
    where usage.hit_count < p_limit;

  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.consume_membership_quota(uuid, text, integer)
  from public, anon, authenticated;
