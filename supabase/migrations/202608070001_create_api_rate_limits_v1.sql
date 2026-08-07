-- API rate limits v1 — durable counters for serverless (Vercel) abuse control.
-- Service-role RPC only. Subjects must be pre-hashed (IP/email) — never store raw PII.

create table if not exists public.api_rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  constraint api_rate_limits_pkey primary key (bucket, subject_hash, window_start),
  constraint api_rate_limits_bucket_length check (
    char_length(bucket) between 1 and 64
  ),
  constraint api_rate_limits_subject_length check (
    char_length(subject_hash) between 16 and 128
  ),
  constraint api_rate_limits_hit_count_nonneg check (hit_count >= 0)
);

create index if not exists api_rate_limits_window_start_idx
  on public.api_rate_limits (window_start);

comment on table public.api_rate_limits is
  'Hashed subject rate-limit windows for public API abuse control. No raw IP/email.';

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_bucket text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_hit integer;
begin
  if p_bucket is null
    or char_length(p_bucket) < 1
    or char_length(p_bucket) > 64 then
    return false;
  end if;

  if p_subject_hash is null
    or char_length(p_subject_hash) < 16
    or char_length(p_subject_hash) > 128 then
    return false;
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    return false;
  end if;

  if p_window_seconds is null
    or p_window_seconds < 1
    or p_window_seconds > 86400 then
    return false;
  end if;

  v_window_start := to_timestamp(
    floor(
      extract(epoch from timezone('utc', now())) / p_window_seconds
    ) * p_window_seconds
  );

  insert into public.api_rate_limits as r (
    bucket,
    subject_hash,
    window_start,
    hit_count
  )
  values (
    p_bucket,
    p_subject_hash,
    v_window_start,
    1
  )
  on conflict (bucket, subject_hash, window_start)
  do update
    set hit_count = r.hit_count + 1
    where r.hit_count < p_limit
  returning r.hit_count into v_hit;

  if v_hit is null then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

comment on function public.consume_api_rate_limit(text, text, integer, integer) is
  'Atomically consume one hit in a fixed window. Returns false when over limit or invalid args.';

-- Optional housekeeping: delete windows older than 2 days (call from ops/cron later).
create or replace function public.cleanup_api_rate_limits(
  p_older_than_seconds integer default 172800
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_older_than_seconds is null
    or p_older_than_seconds < 3600
    or p_older_than_seconds > 2592000 then
    return 0;
  end if;

  delete from public.api_rate_limits
  where window_start < timezone('utc', now()) - make_interval(secs => p_older_than_seconds);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_api_rate_limits(integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_api_rate_limits(integer)
  to service_role;
