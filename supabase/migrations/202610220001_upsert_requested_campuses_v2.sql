-- Pastikan tiga kampus yang diminta tim ada dan tampil di pilihan (approved).
-- Idempotent: kalau sudah ada (termasuk yang pernah ditolak), namanya dirapikan dan statusnya dibuka lagi.

insert into public.campus_options (name, search_key, status, source, suggestion_count)
select
  seed.name,
  public.normalize_campus_search(seed.name),
  'approved',
  'seed',
  1
from (
  values
    ('Universitas Jember'),
    ('Universitas Sebelas Maret'),
    ('Universitas Diponegoro')
) as seed(name)
where public.normalize_campus_search(seed.name) is not null
on conflict (search_key) do update
set
  name = excluded.name,
  status = 'approved',
  updated_at = timezone('utc', now());
