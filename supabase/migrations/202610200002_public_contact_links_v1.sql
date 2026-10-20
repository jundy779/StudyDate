-- Public contact and social links v1.
--
-- Owner mengisi tautan resmi StudyDate (WhatsApp, Telegram, kanal, grup, bot,
-- Threads, Instagram, Facebook, X, YouTube, email). Footer publik hanya
-- menampilkan tautan yang diisi dan diaktifkan. Tidak ada tautan contoh yang
-- di-seed, supaya situs tidak pernah menampilkan akun yang bukan milik StudyDate.
--
-- Tabel privat: dibaca server memakai service role, ditulis lewat RPC Owner.

create table if not exists public.public_contact_links (
  kind text primary key,
  url text not null,
  is_visible boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid null references auth.users (id) on delete set null,
  constraint public_contact_links_kind_allowed check (
    kind in (
      'whatsapp',
      'telegram',
      'telegram_channel',
      'telegram_group',
      'telegram_bot',
      'threads',
      'instagram',
      'facebook',
      'x',
      'youtube',
      'email'
    )
  ),
  constraint public_contact_links_url_length check (char_length(url) between 8 and 300),
  constraint public_contact_links_url_scheme check (
    (kind = 'email' and url ~ '^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$')
    or (kind <> 'email' and url ~ '^https://[^\s<>"]+$')
  )
);

alter table public.public_contact_links enable row level security;
revoke all on table public.public_contact_links from public, anon, authenticated;

create or replace function public.contact_link_host_allowed(p_kind text, p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_kind = 'email' then p_url ~ '^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$'
    else coalesce(
      lower(substring(p_url from '^https://([^/?#:]+)')) = any (
        case p_kind
          when 'whatsapp' then array['wa.me', 'api.whatsapp.com', 'chat.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com']
          when 'telegram' then array['t.me', 'telegram.me']
          when 'telegram_channel' then array['t.me', 'telegram.me']
          when 'telegram_group' then array['t.me', 'telegram.me']
          when 'telegram_bot' then array['t.me', 'telegram.me']
          when 'threads' then array['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com']
          when 'instagram' then array['instagram.com', 'www.instagram.com']
          when 'facebook' then array['facebook.com', 'www.facebook.com', 'fb.com', 'm.facebook.com']
          when 'x' then array['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']
          when 'youtube' then array['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']
          else array[]::text[]
        end
      ),
      false
    )
  end;
$$;

revoke all on function public.contact_link_host_allowed(text, text)
  from public, anon, authenticated;

alter table public.public_contact_links
  drop constraint if exists public_contact_links_host_allowed;
alter table public.public_contact_links
  add constraint public_contact_links_host_allowed
  check (public.contact_link_host_allowed(kind, url));

create or replace function public.owner_list_contact_links()
returns table (kind text, url text, is_visible boolean, updated_at timestamptz)
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
  select link.kind, link.url, link.is_visible, link.updated_at
  from public.public_contact_links link
  order by link.kind;
end;
$$;

revoke all on function public.owner_list_contact_links() from public, anon;
grant execute on function public.owner_list_contact_links() to authenticated;

-- Simpan atau hapus satu tautan. URL kosong berarti hapus.
create or replace function public.owner_save_contact_link(
  p_kind text,
  p_url text,
  p_is_visible boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  clean_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in (
    'whatsapp', 'telegram', 'telegram_channel', 'telegram_group', 'telegram_bot',
    'threads', 'instagram', 'facebook', 'x', 'youtube', 'email'
  ) then
    raise exception 'invalid contact kind' using errcode = '22023';
  end if;

  if clean_url is null then
    delete from public.public_contact_links where kind = p_kind;
    return false;
  end if;

  if not public.contact_link_host_allowed(p_kind, clean_url) then
    raise exception 'invalid contact url' using errcode = '22023';
  end if;

  insert into public.public_contact_links (kind, url, is_visible, updated_at, updated_by)
  values (p_kind, clean_url, coalesce(p_is_visible, false), timezone('utc', now()), actor)
  on conflict (kind) do update set
    url = excluded.url,
    is_visible = excluded.is_visible,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  return coalesce(p_is_visible, false);
end;
$$;

revoke all on function public.owner_save_contact_link(text, text, boolean) from public, anon;
grant execute on function public.owner_save_contact_link(text, text, boolean) to authenticated;
