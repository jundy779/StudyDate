-- Student account soft-deactivate + hard-delete prerequisites.
-- Soft: profiles.deactivated_at + hide from People.
-- Hard: app service removes Storage objects, then auth.admin.deleteUser (CASCADE).
-- Relax staff_members.created_by so user deletion is not blocked by RESTRICT.

alter table public.profiles
  add column if not exists deactivated_at timestamptz null;

comment on column public.profiles.deactivated_at is
  'When set, student account is soft-deactivated (hidden from People; app redirects to reactivate).';

alter table public.staff_members
  alter column created_by drop not null;

alter table public.staff_members
  drop constraint if exists staff_members_created_by_fkey;

alter table public.staff_members
  add constraint staff_members_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

create or replace function public.deactivate_my_student_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_active_staff_user(current_user_id) then
    raise exception 'Staff accounts cannot use student deactivation';
  end if;

  update public.profiles
  set
    deactivated_at = coalesce(deactivated_at, now()),
    is_discoverable = false,
    updated_at = now()
  where user_id = current_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.deactivate_my_student_account()
  from public, anon;
grant execute on function public.deactivate_my_student_account()
  to authenticated;

create or replace function public.reactivate_my_student_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_active_staff_user(current_user_id) then
    raise exception 'Staff accounts cannot use student reactivation';
  end if;

  update public.profiles
  set
    deactivated_at = null,
    updated_at = now()
  where user_id = current_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.reactivate_my_student_account()
  from public, anon;
grant execute on function public.reactivate_my_student_account()
  to authenticated;
