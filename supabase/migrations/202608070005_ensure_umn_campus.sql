-- Ensure Universitas Multimedia Nusantara remains an approved campus option.

insert into public.campus_options (name, search_key, status, source, suggestion_count)
values (
  'Universitas Multimedia Nusantara',
  public.normalize_campus_search('Universitas Multimedia Nusantara'),
  'approved',
  'seed',
  1
)
on conflict (search_key) do update
set
  name = excluded.name,
  status = 'approved',
  updated_at = timezone('utc', now());
