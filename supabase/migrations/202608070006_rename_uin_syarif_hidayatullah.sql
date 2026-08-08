-- Prefer full official UIN name over short "UIN …" label.

do $$
declare
  new_name text := 'Universitas Islam Negeri Syarif Hidayatullah';
  new_key text := public.normalize_campus_search(new_name);
  old_keys text[] := array[
    public.normalize_campus_search('UIN Syarif Hidayatullah Jakarta'),
    public.normalize_campus_search('UIN Syarif Hidayatullah'),
    public.normalize_campus_search('Universitas Islam Negeri Syarif Hidayatullah Jakarta')
  ];
begin
  delete from public.campus_options
  where search_key = any(old_keys)
    and search_key is distinct from new_key;

  insert into public.campus_options (name, search_key, status, source, suggestion_count)
  values (new_name, new_key, 'approved', 'seed', 1)
  on conflict (search_key) do update
  set
    name = excluded.name,
    status = 'approved',
    updated_at = timezone('utc', now());
end;
$$;
