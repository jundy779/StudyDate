-- Early Access review reasons + revision v1
-- Forward-only. Keeps approval, revision, rejection, and claim as separate states.

alter table public.early_access_waitlist
  add column if not exists review_reason_codes text[] not null default '{}'::text[],
  add column if not exists review_user_note text null,
  add column if not exists review_internal_note text null,
  add column if not exists revision_token_hash text null,
  add column if not exists revision_token_expires_at timestamptz null,
  add column if not exists resubmitted_at timestamptz null;

alter table public.early_access_waitlist
  drop constraint if exists early_access_waitlist_status_allowed;

alter table public.early_access_waitlist
  add constraint early_access_waitlist_status_allowed
  check (status in ('waiting', 'approved', 'needs_revision', 'rejected', 'claimed'));

alter table public.early_access_waitlist
  drop constraint if exists early_access_waitlist_claim_consistency;

alter table public.early_access_waitlist
  add constraint early_access_waitlist_claim_consistency
  check (
    (
      status in ('waiting', 'approved', 'needs_revision', 'rejected')
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

alter table public.early_access_waitlist
  drop constraint if exists early_access_waitlist_revision_token_shape;

alter table public.early_access_waitlist
  add constraint early_access_waitlist_revision_token_shape
  check (
    (status = 'needs_revision' and revision_token_hash is not null and revision_token_expires_at is not null)
    or
    (status <> 'needs_revision' and revision_token_hash is null and revision_token_expires_at is null)
  );

alter table public.early_access_waitlist
  drop constraint if exists early_access_waitlist_review_note_lengths;

alter table public.early_access_waitlist
  add constraint early_access_waitlist_review_note_lengths
  check (
    char_length(coalesce(review_user_note, '')) <= 500
    and char_length(coalesce(review_internal_note, '')) <= 800
  );

create unique index if not exists early_access_waitlist_revision_token_hash_unique
  on public.early_access_waitlist (revision_token_hash)
  where revision_token_hash is not null;

comment on column public.early_access_waitlist.review_reason_codes is
  'Latest structured Early Access review reasons; non-sensitive reason codes only.';
comment on column public.early_access_waitlist.review_user_note is
  'Optional reviewer note that may be shown to the applicant.';
comment on column public.early_access_waitlist.review_internal_note is
  'Optional internal reviewer note; never included in applicant email.';
comment on column public.early_access_waitlist.revision_token_hash is
  'SHA-256 hash of the one-time revision token. Raw token is never stored.';
comment on column public.early_access_waitlist.resubmitted_at is
  'Timestamp when an applicant submitted requested Early Access corrections.';

alter table public.staff_ops_audit_events
  drop constraint if exists staff_ops_audit_events_type_allowed;

alter table public.staff_ops_audit_events
  add constraint staff_ops_audit_events_type_allowed check (
    event_type in (
      'early_access_viewed',
      'early_access_approved',
      'early_access_rejected',
      'early_access_revision_requested',
      'early_access_invitation_sent',
      'early_access_review_capability_granted',
      'early_access_review_capability_removed',
      'user_support_viewed',
      'student_account_viewed',
      'staff_capability_changed',
      'staff_assigned_by_email'
    )
  );

create or replace function public.review_early_access_entry_v2(
  p_email text,
  p_decision text,
  p_reason_codes text[] default '{}'::text[],
  p_user_note text default null,
  p_internal_note text default null,
  p_revision_token_hash text default null,
  p_revision_token_expires_at timestamptz default null
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
  reason text;
  allowed_reasons constant text[] := array[
    'use_campus_email',
    'campus_full_name',
    'incomplete_information',
    'email_campus_mismatch',
    'duplicate_application',
    'eligibility_not_met',
    'other'
  ]::text[];
begin
  if not public.staff_has_ops_capability('early_access.review') then
    raise exception 'early access review authorization required' using errcode = '42501';
  end if;
  if normalized_email = '' or char_length(normalized_email) > 254 then
    raise exception 'invalid early access target' using errcode = '22023';
  end if;
  if p_decision not in ('approve', 'needs_revision', 'reject') then
    raise exception 'invalid early access decision' using errcode = '22023';
  end if;
  if char_length(coalesce(p_user_note, '')) > 500
    or char_length(coalesce(p_internal_note, '')) > 800 then
    raise exception 'review note too long' using errcode = '22023';
  end if;

  foreach reason in array coalesce(p_reason_codes, '{}'::text[]) loop
    if not (reason = any(allowed_reasons)) then
      raise exception 'invalid early access review reason' using errcode = '22023';
    end if;
  end loop;

  if p_decision in ('needs_revision', 'reject')
    and cardinality(coalesce(p_reason_codes, '{}'::text[])) = 0 then
    raise exception 'review reason required' using errcode = '22023';
  end if;

  if p_decision = 'needs_revision' then
    if p_revision_token_hash is null
      or p_revision_token_hash !~ '^[0-9a-f]{64}$'
      or p_revision_token_expires_at is null
      or p_revision_token_expires_at <= timezone('utc', now()) then
      raise exception 'valid revision token required' using errcode = '22023';
    end if;
  elsif p_revision_token_hash is not null or p_revision_token_expires_at is not null then
    raise exception 'revision token not allowed for this decision' using errcode = '22023';
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

  next_status := case
    when p_decision = 'approve' then 'approved'
    when p_decision = 'needs_revision' then 'needs_revision'
    else 'rejected'
  end;

  update public.early_access_waitlist waitlist
  set
    status = next_status,
    reviewed_at = timezone('utc', now()),
    reviewed_by = actor,
    invitation_sent_at = case
      when next_status = 'approved' and target.status = 'approved' then target.invitation_sent_at
      else null
    end,
    review_reason_codes = case
      when next_status = 'approved' then '{}'::text[]
      else coalesce(p_reason_codes, '{}'::text[])
    end,
    review_user_note = case when next_status = 'approved' then null else nullif(btrim(coalesce(p_user_note, '')), '') end,
    review_internal_note = case when next_status = 'approved' then null else nullif(btrim(coalesce(p_internal_note, '')), '') end,
    revision_token_hash = case when next_status = 'needs_revision' then p_revision_token_hash else null end,
    revision_token_expires_at = case when next_status = 'needs_revision' then p_revision_token_expires_at else null end
  where waitlist.id = target.id;

  insert into public.staff_ops_audit_events (
    actor_user_id, event_type, subject_suffix
  ) values (
    actor,
    case
      when next_status = 'approved' then 'early_access_approved'
      when next_status = 'needs_revision' then 'early_access_revision_requested'
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

revoke all on function public.review_early_access_entry_v2(
  text, text, text[], text, text, text, timestamptz
) from public, anon;
grant execute on function public.review_early_access_entry_v2(
  text, text, text[], text, text, text, timestamptz
) to authenticated;

create or replace function public.list_early_access_waitlist_ops_v2(
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
  review_reason_codes text[],
  review_user_note text,
  review_internal_note text,
  resubmitted_at timestamptz,
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
    and p_status not in ('waiting', 'approved', 'needs_revision', 'rejected', 'claimed') then
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
        p_campus is null or btrim(p_campus) = ''
        or lower(coalesce(waitlist.campus, '')) like '%' || lower(btrim(p_campus)) || '%'
      )
      and (p_interest is null or waitlist.interests @> array[p_interest]::text[])
      and (p_source is null or waitlist.source = p_source)
  ), counted as (
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
      when 'waiting' then case
        when filtered.resubmitted_at is null then 'Menunggu review'
        else 'Menunggu review · perbaikan sudah dikirim'
      end
      when 'approved' then case
        when filtered.invitation_sent_at is null then 'Disetujui · undangan belum terkirim'
        else 'Disetujui · undangan sudah dikirim'
      end
      when 'needs_revision' then 'Perlu diperbaiki · email petunjuk sudah dikirim'
      when 'rejected' then 'Tidak disetujui'
      when 'claimed' then 'Akses sudah diklaim'
      else 'Status tidak tersedia'
    end,
    filtered.claimed_at,
    filtered.review_reason_codes,
    filtered.review_user_note,
    filtered.review_internal_note,
    filtered.resubmitted_at,
    counted.total
  from filtered
  cross join counted
  order by
    case filtered.status
      when 'waiting' then 0
      when 'needs_revision' then 1
      when 'approved' then 2
      when 'rejected' then 3
      else 4
    end,
    coalesce(filtered.resubmitted_at, filtered.created_at) desc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke all on function public.list_early_access_waitlist_ops_v2(
  text, text, text, text, text, integer, integer
) from public, anon;
grant execute on function public.list_early_access_waitlist_ops_v2(
  text, text, text, text, text, integer, integer
) to authenticated;

-- Keep account-deletion re-review cleanup aligned with the extended review metadata.
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
    new.review_reason_codes := '{}'::text[];
    new.review_user_note := null;
    new.review_internal_note := null;
    new.revision_token_hash := null;
    new.revision_token_expires_at := null;
    new.resubmitted_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_early_access_review_lifecycle()
  from public, anon, authenticated;
