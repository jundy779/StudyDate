-- LinkedIn verification links v1
-- Stores only a keyed member fingerprint and verification categories.
-- OAuth access tokens and raw LinkedIn profile responses are never persisted.

create table if not exists public.linkedin_verification_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  member_id_hash text not null,
  identity_verified boolean not null default false,
  workplace_verified boolean not null default false,
  checked_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint linkedin_verification_links_member_hash_shape
    check (member_id_hash ~ '^[0-9a-f]{64}$')
);

create unique index if not exists linkedin_verification_links_member_hash_unique
  on public.linkedin_verification_links (member_id_hash);

alter table public.linkedin_verification_links enable row level security;
alter table public.linkedin_verification_links force row level security;

revoke all on table public.linkedin_verification_links
  from public, anon, authenticated;
grant select on table public.linkedin_verification_links to authenticated;

drop policy if exists "Students can read their own LinkedIn verification"
  on public.linkedin_verification_links;
create policy "Students can read their own LinkedIn verification"
  on public.linkedin_verification_links
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.linkedin_verification_links is
  'Minimal Verified on LinkedIn result. Writes are server-only; students can read only their own row.';
comment on column public.linkedin_verification_links.member_id_hash is
  'HMAC-SHA-256 fingerprint of the app-scoped LinkedIn member ID; raw member ID is not stored.';
comment on column public.linkedin_verification_links.identity_verified is
  'True only when LinkedIn verificationReport includes the IDENTITY category.';
comment on column public.linkedin_verification_links.workplace_verified is
  'True only when LinkedIn verificationReport includes the WORKPLACE category.';

