-- Early Access moderation + invitation v1
-- Forward-only. Early Access entry must be approved before it can be claimed.
-- Owner has role-implied full access; Admin review is an explicit capability.

alter table public.early_access_waitlist
  add column if not exists reviewed_at timestamptz null,
  add column if not exists reviewed_by uuid null references auth.users (id) on delete set null,
  add column if not exists invitation_sent_at timestamptz null;

-- Preserve historical claimed rows from the pre-moderation flow.
update public.early_access_waitlist
set reviewed_at = coalesce(reviewed_at, claimed_at, created_at)
where status = 'claimed'
  and reviewed_at is null;

alter table public.early_access_waitlist
  drop constraint if exists early_access_waitlist_status_allowed;

alter table public.early_access_waitlist
  add constraint early_access_waitlist_status_allowed
  check (status in ('waiting', 'approved', 'rejected', 'claimed'));

alter table public.early_access_waitlist
  drop constraint if exists early_access_waitlist_claim_consistency;

alter table public.early_access_waitlist
  add constraint early_access_waitlist_claim_consistency
  check (
    (
      status in ('waiting', 'approved', 'rejected')
      and claimed_user_id is null
      and claimed_at is null
    )
    or (
      status = 'claimed'
      and claimed_user_id is not null
      and claimed_at is not null
      and reviewed_at is not null
    )
  );

comment on column public.early_access_waitlist.reviewed_at is
  'Timestamp of the latest Owner/authorized Early Access review decision.';
comment on column public.early_access_waitlist.reviewed_by is
  'Owner/Admin reviewer; nullable if the reviewer Auth account is later deleted.';
comment on column public.early_access_waitlist.invitation_sent_at is
  'Timestamp when the approved Early Access invitation email was last delivered.';

-- If account-deletion cleanup returns a claimed entry to waiting, remove the
-- previous review/invitation metadata so the email must be reviewed again.
create or replace function public.normalize_early_access_review_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'claimed'
    and new.status = 'waiting'
    and new.claimed_user_id is null then
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.invitation_sent_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists early_access_waitlist_review_lifecycle
  on public.early_access_waitlist;
create trigger early_access_waitlist_review_lifecycle
before update of status, claimed_user_id
on public.early_access_waitlist
for each row
execute function public.normalize_early_access_review_lifecycle();

revoke all on function public.normalize_early_access_review_lifecycle()
  from public, anon, authenticated;

alter table public.staff_members
  add column if not exists can_early_access_review boolean not null default false;

comment on column public.staff_members.can_early_access_review is
  'Admin may approve/reject Early Access and send/resend invitation emails.';

-- Latest audit constraint is defined by 202608210011. Extend it without
-- exposing email or other PII in audit rows.
alter table public.staff_ops_audit_events
  drop constraint if exists staff_ops_audit_events_type_allowed;

alter table public.staff_ops_audit_events
  add constraint staff_ops_audit_events_type_allowed check (
    event_type in (
      'early_access_viewed',
      'early_access_approved',
      'early_access_rejected',
      'early_access_invitation_sent',
      'early_access_review_capability_granted',
      'early_access_review_capability_removed',
      'user_support_viewed',
      'student_account_viewed',
      'staff_capability_changed',
      'staff_assigned_by_email'
    )
  );

create or replace function public.staff_has_ops_capability(
  p_capability text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  membership public.staff_members%rowtype;
begin
  if auth.uid() is null then
    return false;
  end if;
  if not public.is_current_active_staff(array['owner', 'admin']::text[], false) then
    return false;
  end if;

  select * into membership
  from public.staff_members
  where user_id = auth.uid()
    and status = 'active';

  if not found then
    return false;
  end if;

  if membership.role = 'owner' then
    return true;
  end if;

  if p_capability = 'early_access.read' then
    return membership.can_early_access_read or membership.can_early_access_review;
  end if;
  if p_capability = 'early_access.review' then
    return membership.can_early_access_review;
  end if;
  if p_capability = 'users.read' then
    return membership.can_users_read or membership.can_users_support;
  end if;
  if p_capability = 'users.support' then
    return membership.can_users_support;
  end if;
  if p_capability = 'staff.manage' then
    return false;
  end if;
  if p_capability = 'verification.review' then
    return membership.verification_reviewer
      and public.is_current_active_staff(array['owner', 'admin']::text[], true);
  end if;
  if p_capability = 'moderation.review' then
    return false;
  end if;

  return false;
end;
$$;

revoke all on function public.staff_has_ops_capability(text)
  from public, anon, authenticated;

-- OUT shape changes, so drop before recreation.
drop function if exists public.get_current_staff_membership();

create function public.get_current_staff_membership()
returns table (
  role text,
  status text,
  verification_reviewer boolean,
  can_early_access_read boolean,
  can_early_access_review boolean,
  can_users_read boolean,
  can_users_support boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    staff.role,
    staff.status,
    staff.verification_reviewer,
    staff.can_early_access_read,
    staff.can_early_access_review,
    staff.can_users_read,
    staff.can_users_support
  from public.staff_members staff
  where staff.user_id = auth.uid()
    and public.is_current_active_staff(
      array['owner', 'admin']::text[],
      false
    );
$$;

revoke all on function public.get_current_staff_membership()
  from public, anon;
grant execute on function public.get_current_staff_membership()
  to authenticated;

-- Owner-only capability toggle dedicated to the Early Access review role.
-- This avoids widening the existing generic staff-management RPC surface.
create or replace function public.manage_early_access_review_capability(
  p_target_user_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_staff public.staff_members%rowtype;
  changed boolean := false;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_target_user_id = actor then
    raise exception 'invalid target' using errcode = '42501';
  end if;

  select * into target_staff
  from public.staff_members
  where user_id = p_target_user_id
  for update;

  if not found or target_staff.role <> 'admin' or target_staff.status <> 'active' then
    raise exception 'active admin membership required' using errcode = 'P0002';
  end if;

  if target_staff.can_early_access_review is distinct from p_enabled then
    update public.staff_members
    set can_early_access_review = p_enabled
    where user_id = p_target_user_id;
    changed := true;

    insert into public.staff_ops_audit_events (
      actor_user_id, event_type, subject_suffix
    ) values (
      actor,
      case
        when p_enabled then 'early_access_review_capability_granted'
        else 'early_access_review_capability_removed'
      end,
      right(p_target_user_id::text, 8)
    );
  end if;

  return changed;
end;
$$;

revoke all on function public.manage_early_access_review_capability(uuid, boolean)
  from public, anon;
grant execute on function public.manage_early_access_review_capability(uuid, boolean)
  to authenticated;

-- OUT shape changes, so drop before recreation.
drop function if exists public.list_staff_members();

create function public.list_staff_members()
returns table (
  user_id uuid,
  role text,
  status text,
  verification_reviewer boolean,
  can_early_access_read boolean,
  can_early_access_review boolean,
  can_users_read boolean,
  can_users_support boolean,
  created_at timestamptz,
  updated_at timestamptz,
  disabled_at timestamptz
)
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
  select
    staff.user_id,
    staff.role,
    staff.status,
    staff.verification_reviewer,
    staff.can_early_access_read,
    staff.can_early_access_review,
    staff.can_users_read,
    staff.can_users_support,
    staff.created_at,
    staff.updated_at,
    staff.disabled_at
  from public.staff_members staff
  order by staff.role desc, staff.created_at asc;
end;
$$;

revoke all on function public.list_staff_members() from public, anon;
grant execute on function public.list_staff_members() to authenticated;

-- OUT shape changes, so drop before recreation.
drop function if exists public.list_early_access_waitlist_ops(
  text, text, text, text, text, integer, integer
);

create function public.list_early_access_waitlist_ops(
  p_email text default null,
  p_status text default null,
  p_campus text default null,
  p_interest text default null,
  p_source text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  email text,
  campus text,
  interests text[],
  source text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  invitation_sent_at timestamptz,
  activation_label text,
  claimed_at timestamptz,
  total_count bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  safe_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  actor uuid := auth.uid();
begin
  if not public.staff_has_ops_capability('early_access.read') then
    raise exception 'early access authorization required' using errcode = '42501';
  end if;

  if p_status is not null
    and p_status not in ('waiting', 'approved', 'rejected', 'claimed') then
    raise exception 'invalid status filter' using errcode = '22023';
  end if;
  if p_interest is not null and p_interest not in ('people', 'groups', 'events') then
    raise exception 'invalid interest filter' using errcode = '22023';
  end if;
  if p_source is not null and p_source not in ('navbar', 'hero', 'final-cta') then
    raise exception 'invalid source filter' using errcode = '22023';
  end if;

  normalized_email := nullif(lower(btrim(coalesce(p_email, ''))), '');

  if normalized_email is not null then
    insert into public.staff_ops_audit_events (actor_user_id, event_type)
    values (actor, 'early_access_viewed');
  end if;

  return query
  with filtered as (
    select waitlist.*
    from public.early_access_waitlist waitlist
    where (normalized_email is null or lower(waitlist.email) = normalized_email)
      and (p_status is null or waitlist.status = p_status)
      and (
        p_campus is null
        or btrim(p_campus) = ''
        or lower(coalesce(waitlist.campus, '')) like '%' || lower(btrim(p_campus)) || '%'
      )
      and (p_interest is null or waitlist.interests @> array[p_interest]::text[])
      and (p_source is null or waitlist.source = p_source)
  ),
  counted as (
    select count(*)::bigint as total from filtered
  )
  select
    filtered.email,
    filtered.campus,
    filtered.interests,
    filtered.source,
    filtered.status,
    filtered.created_at,
    filtered.reviewed_at,
    filtered.invitation_sent_at,
    case filtered.status
      when 'waiting' then 'Menunggu review'
      when 'approved' then case
        when filtered.invitation_sent_at is null then 'Disetujui · undangan belum terkirim'
        else 'Disetujui · undangan sudah dikirim'
      end
      when 'rejected' then 'Tidak disetujui'
      when 'claimed' then 'Akses sudah diklaim'
      else 'Status tidak tersedia'
    end as activation_label,
    filtered.claimed_at,
    counted.total
  from filtered
  cross join counted
  order by
    case filtered.status
      when 'waiting' then 0
      when 'approved' then 1
      when 'rejected' then 2
      else 3
    end,
    filtered.created_at desc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke all on function public.list_early_access_waitlist_ops(
  text, text, text, text, text, integer, integer
) from public, anon;
grant execute on function public.list_early_access_waitlist_ops(
  text, text, text, text, text, integer, integer
) to authenticated;

-- Owner or explicitly authorized Early Access reviewer can decide one unique
-- waitlist email. The RPC returns only the email needed for server-side mail.
create or replace function public.review_early_access_entry(
  p_email text,
  p_decision text
)
returns table (
  email text,
  status text,
  invitation_sent_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  target public.early_access_waitlist%rowtype;
  next_status text;
begin
  if not public.staff_has_ops_capability('early_access.review') then
    raise exception 'early access review authorization required' using errcode = '42501';
  end if;
  if normalized_email = '' or char_length(normalized_email) > 254 then
    raise exception 'invalid early access target' using errcode = '22023';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid early access decision' using errcode = '22023';
  end if;

  select waitlist.* into target
  from public.early_access_waitlist waitlist
  where lower(waitlist.email) = normalized_email
  for update;

  if not found then
    raise exception 'early access entry unavailable' using errcode = 'P0002';
  end if;
  if target.status = 'claimed' then
    raise exception 'claimed early access cannot be reviewed' using errcode = '22023';
  end if;

  next_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;

  update public.early_access_waitlist waitlist
  set
    status = next_status,
    reviewed_at = timezone('utc', now()),
    reviewed_by = actor,
    invitation_sent_at = case
      when next_status = 'approved' and target.status = 'approved'
        then target.invitation_sent_at
      else null
    end
  where waitlist.id = target.id;

  insert into public.staff_ops_audit_events (
    actor_user_id, event_type, subject_suffix
  ) values (
    actor,
    case
      when next_status = 'approved' then 'early_access_approved'
      else 'early_access_rejected'
    end,
    right(target.id::text, 8)
  );

  return query
  select waitlist.email, waitlist.status, waitlist.invitation_sent_at
  from public.early_access_waitlist waitlist
  where waitlist.id = target.id;
end;
$$;

revoke all on function public.review_early_access_entry(text, text)
  from public, anon;
grant execute on function public.review_early_access_entry(text, text)
  to authenticated;

create or replace function public.prepare_early_access_invitation(
  p_email text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  target_email text;
begin
  if not public.staff_has_ops_capability('early_access.review') then
    raise exception 'early access review authorization required' using errcode = '42501';
  end if;

  select waitlist.email into target_email
  from public.early_access_waitlist waitlist
  where lower(waitlist.email) = normalized_email
    and waitlist.status = 'approved';

  if target_email is null then
    raise exception 'approved early access entry unavailable' using errcode = 'P0002';
  end if;

  return target_email;
end;
$$;

revoke all on function public.prepare_early_access_invitation(text)
  from public, anon;
grant execute on function public.prepare_early_access_invitation(text)
  to authenticated;

create or replace function public.mark_early_access_invitation_sent(
  p_email text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  target_id uuid;
begin
  if not public.staff_has_ops_capability('early_access.review') then
    raise exception 'early access review authorization required' using errcode = '42501';
  end if;

  update public.early_access_waitlist waitlist
  set invitation_sent_at = timezone('utc', now())
  where lower(waitlist.email) = normalized_email
    and waitlist.status = 'approved'
  returning waitlist.id into target_id;

  if target_id is null then
    return false;
  end if;

  insert into public.staff_ops_audit_events (
    actor_user_id, event_type, subject_suffix
  ) values (
    actor,
    'early_access_invitation_sent',
    right(target_id::text, 8)
  );

  return true;
end;
$$;

revoke all on function public.mark_early_access_invitation_sent(text)
  from public, anon;
grant execute on function public.mark_early_access_invitation_sent(text)
  to authenticated;

-- Approved-only claim. Email and user id stay server-authoritative.
create or replace function public.claim_early_access_for_me()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_email text;
  normalized_email text;
  waitlist_row public.early_access_waitlist%rowtype;
  waitlist_id uuid;
  outcome text;
  prefill jsonb := null;
  updated int;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.account_deletion_requests deletion
    where deletion.user_id = actor
      and deletion.status in ('pending', 'processing', 'failed')
  ) then
    return jsonb_build_object('outcome', 'not_eligible', 'prefill', null);
  end if;

  if exists (
    select 1
    from public.profiles profile
    where profile.user_id = actor
      and profile.deactivated_at is not null
  ) then
    return jsonb_build_object('outcome', 'not_eligible', 'prefill', null);
  end if;

  select btrim(auth_user.email)
  into actor_email
  from auth.users auth_user
  where auth_user.id = actor;

  if actor_email is null or actor_email = '' then
    return jsonb_build_object('outcome', 'not_eligible', 'prefill', null);
  end if;

  normalized_email := lower(actor_email);

  select waitlist.*
  into waitlist_row
  from public.early_access_waitlist waitlist
  where lower(waitlist.email) = normalized_email
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_waitlisted', 'prefill', null);
  end if;

  waitlist_id := waitlist_row.id;

  if waitlist_row.claimed_user_id = actor then
    outcome := 'already_claimed_by_self';
  elsif waitlist_row.claimed_user_id is not null then
    return jsonb_build_object('outcome', 'already_claimed_other', 'prefill', null);
  elsif waitlist_row.status <> 'approved' then
    return jsonb_build_object('outcome', 'not_eligible', 'prefill', null);
  else
    update public.early_access_waitlist
    set
      claimed_user_id = actor,
      claimed_at = timezone('utc', now()),
      status = 'claimed'
    where id = waitlist_id
      and claimed_user_id is null
      and status = 'approved';

    get diagnostics updated = row_count;

    if updated = 0 then
      select waitlist.*
      into waitlist_row
      from public.early_access_waitlist waitlist
      where waitlist.id = waitlist_id;

      if waitlist_row.claimed_user_id = actor then
        outcome := 'already_claimed_by_self';
      else
        return jsonb_build_object('outcome', 'already_claimed_other', 'prefill', null);
      end if;
    else
      outcome := 'claimed_now';
    end if;
  end if;

  if outcome in ('claimed_now', 'already_claimed_by_self') then
    prefill := jsonb_build_object(
      'campus', waitlist_row.campus,
      'interestHints', to_jsonb(waitlist_row.interests)
    );
  end if;

  return jsonb_build_object('outcome', outcome, 'prefill', prefill);
end;
$$;

revoke all on function public.claim_early_access_for_me()
  from public, anon, authenticated;
grant execute on function public.claim_early_access_for_me()
  to authenticated;

comment on function public.claim_early_access_for_me() is
  'Idempotent approved-only Early Access claim bound to auth.uid() email.';

-- Server-only eligibility check used before generating a public student magic
-- link. It prevents creation of new Auth accounts before Early Access approval
-- while allowing existing completed accounts to continue logging in.
create or replace function public.can_issue_student_magic_link(
  p_email text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if normalized_email = '' or char_length(normalized_email) > 254 then
    return false;
  end if;

  return exists (
    select 1
    from auth.users auth_user
    join public.profiles profile on profile.user_id = auth_user.id
    where lower(auth_user.email) = normalized_email
      and profile.onboarding_completed_at is not null
  ) or exists (
    select 1
    from public.early_access_waitlist waitlist
    where lower(waitlist.email) = normalized_email
      and waitlist.status in ('approved', 'claimed')
  );
end;
$$;

revoke all on function public.can_issue_student_magic_link(text)
  from public, anon, authenticated;
grant execute on function public.can_issue_student_magic_link(text)
  to service_role;

-- Direct table access remains closed to normal clients.
revoke all on table public.early_access_waitlist from anon, authenticated;
