-- Upsert requested campus labels (approved).

insert into public.campus_options (name, search_key, status, source, suggestion_count)
select
  seed.name,
  public.normalize_campus_search(seed.name),
  'approved',
  'seed',
  1
from (
  values
    ('BINUS UNIVERSITY'),
    ('Universitas Negeri Surabaya'),
    ('Universitas Indraprasta PGRI')
) as seed(name)
where public.normalize_campus_search(seed.name) is not null
on conflict (search_key) do update
set
  name = excluded.name,
  status = 'approved',
  updated_at = timezone('utc', now());
