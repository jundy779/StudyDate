create table if not exists public.early_access_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  campus text null,
  interests text[] not null default '{}',
  source text null,
  status text not null default 'waiting',
  consent_version text not null default 'v1',
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint early_access_waitlist_email_length
    check (char_length(email) between 3 and 254),
  constraint early_access_waitlist_campus_length
    check (campus is null or char_length(campus) <= 120),
  constraint early_access_waitlist_interests_allowed
    check (interests <@ array['people', 'groups', 'events']::text[]),
  constraint early_access_waitlist_source_allowed
    check (source is null or source in ('navbar', 'hero', 'final-cta')),
  constraint early_access_waitlist_status_allowed
    check (status = 'waiting'),
  constraint early_access_waitlist_consent_version_length
    check (char_length(consent_version) between 1 and 20)
);

create unique index if not exists early_access_waitlist_email_lower_unique
  on public.early_access_waitlist (lower(email));

alter table public.early_access_waitlist enable row level security;

revoke all on table public.early_access_waitlist from anon, authenticated;
