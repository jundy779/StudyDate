-- Early Access queue insights v1.
--
-- 1. list_early_access_waitlist_ops_v3: sama dengan v2, ditambah urutan
--    (prioritas, terlama dulu, terbaru dulu) dan filter antrean:
--    - stale_waiting: menunggu pemeriksaan lebih dari 7 hari;
--    - pending_claim: disetujui, undangan terkirim lebih dari 3 hari, belum login;
--    - unsent_invitation: disetujui tetapi email undangan belum terkirim.
--    Antrean prioritas sekarang mendahulukan yang paling lama menunggu.
-- 2. get_early_access_queue_summary: jumlah per status dan per antrean di atas.
-- 3. prepare_early_access_reminder: pengingat undangan untuk yang belum login,
--    paling cepat 24 jam setelah email terakhir, supaya tidak jadi spam.
--
-- v2 tetap ada untuk deploy bertahap.

create or replace function public.list_early_access_waitlist_ops_v3(
  p_email text default null,
  p_status text default null,
  p_campus text default null,
  p_interest text default null,
  p_source text default null,
  p_queue text default null,
  p_sort text default 'priority',
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
  if p_queue is not null and p_queue not in ('stale_waiting', 'pending_claim', 'unsent_invitation') then
    raise exception 'invalid queue filter' using errcode = '22023';
  end if;
  if coalesce(p_sort, 'priority') not in ('priority', 'oldest', 'newest') then
    raise exception 'invalid sort' using errcode = '22023';
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
      and (
        p_queue is null
        or (
          p_queue = 'stale_waiting'
          and waitlist.status = 'waiting'
          and coalesce(waitlist.resubmitted_at, waitlist.created_at)
            < timezone('utc', now()) - interval '7 days'
        )
        or (
          p_queue = 'pending_claim'
          and waitlist.status = 'approved'
          and waitlist.invitation_sent_at is not null
          and waitlist.invitation_sent_at < timezone('utc', now()) - interval '3 days'
        )
        or (
          p_queue = 'unsent_invitation'
          and waitlist.status = 'approved'
          and waitlist.invitation_sent_at is null
        )
      )
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
    case when coalesce(p_sort, 'priority') = 'priority' then
      case filtered.status
        when 'waiting' then 0
        when 'needs_revision' then 1
        when 'approved' then 2
        when 'rejected' then 3
        else 4
      end
    else 0 end,
    case when p_sort = 'newest'
      then null
      else coalesce(filtered.resubmitted_at, filtered.created_at)
    end asc nulls last,
    coalesce(filtered.resubmitted_at, filtered.created_at) desc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke all on function public.list_early_access_waitlist_ops_v3(
  text, text, text, text, text, text, text, integer, integer
) from public, anon;
grant execute on function public.list_early_access_waitlist_ops_v3(
  text, text, text, text, text, text, text, integer, integer
) to authenticated;

create or replace function public.get_early_access_queue_summary()
returns table (
  waiting_count integer,
  needs_revision_count integer,
  approved_count integer,
  rejected_count integer,
  claimed_count integer,
  stale_waiting_count integer,
  pending_claim_count integer,
  unsent_invitation_count integer,
  oldest_waiting_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.staff_has_ops_capability('early_access.read') then
    raise exception 'early access authorization required' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where waitlist.status = 'waiting')::integer,
    count(*) filter (where waitlist.status = 'needs_revision')::integer,
    count(*) filter (where waitlist.status = 'approved')::integer,
    count(*) filter (where waitlist.status = 'rejected')::integer,
    count(*) filter (where waitlist.status = 'claimed')::integer,
    count(*) filter (
      where waitlist.status = 'waiting'
        and coalesce(waitlist.resubmitted_at, waitlist.created_at)
          < timezone('utc', now()) - interval '7 days'
    )::integer,
    count(*) filter (
      where waitlist.status = 'approved'
        and waitlist.invitation_sent_at is not null
        and waitlist.invitation_sent_at < timezone('utc', now()) - interval '3 days'
    )::integer,
    count(*) filter (
      where waitlist.status = 'approved' and waitlist.invitation_sent_at is null
    )::integer,
    min(coalesce(waitlist.resubmitted_at, waitlist.created_at))
      filter (where waitlist.status = 'waiting')
  from public.early_access_waitlist waitlist;
end;
$$;

revoke all on function public.get_early_access_queue_summary() from public, anon;
grant execute on function public.get_early_access_queue_summary() to authenticated;

create or replace function public.prepare_early_access_reminder(p_email text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  target_email text;
  last_sent timestamptz;
begin
  if not public.staff_has_ops_capability('early_access.review') then
    raise exception 'early access review authorization required' using errcode = '42501';
  end if;

  select waitlist.email, waitlist.invitation_sent_at
  into target_email, last_sent
  from public.early_access_waitlist waitlist
  where lower(waitlist.email) = normalized_email
    and waitlist.status = 'approved';

  if target_email is null then
    raise exception 'approved early access entry unavailable' using errcode = 'P0002';
  end if;
  if last_sent is not null and last_sent > timezone('utc', now()) - interval '24 hours' then
    raise exception 'early access reminder cooldown' using errcode = 'P0001';
  end if;

  return target_email;
end;
$$;

revoke all on function public.prepare_early_access_reminder(text) from public, anon;
grant execute on function public.prepare_early_access_reminder(text) to authenticated;
