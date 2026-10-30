-- Saklar Owner untuk fitur acara: pengumuman ke peserta (Event Blast) dan email pengumuman.
--
-- Dua lapis: env Vercel (EVENT_BLAST_ENABLED, EVENT_EMAIL_ENABLED) tetap menjadi izin teknis,
-- dan saklar ini dipakai Owner untuk menyalakan atau mematikan dari dashboard. Fitur hanya jalan
-- bila keduanya menyala. Bawaan mati.

alter table public.platform_settings
  drop constraint if exists platform_settings_key_allowed;
alter table public.platform_settings
  add constraint platform_settings_key_allowed check (
    key in ('require_student_verification', 'event_blast_enabled', 'event_email_enabled')
  );

insert into public.platform_settings (key, bool_value)
values ('event_blast_enabled', false), ('event_email_enabled', false)
on conflict (key) do nothing;

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
      'staff_assigned_by_email',
      'event_blast_enabled',
      'event_blast_disabled',
      'event_email_enabled',
      'event_email_disabled'
    )
  );

-- Dibaca halaman acara mahasiswa untuk memutuskan apakah form pengumuman tampil.
-- Hanya dua nilai ya/tidak, tidak ada data pribadi.
create or replace function public.get_event_feature_switches()
returns table (event_blast boolean, event_email boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select setting.bool_value from public.platform_settings setting
              where setting.key = 'event_blast_enabled'), false),
    coalesce((select setting.bool_value from public.platform_settings setting
              where setting.key = 'event_email_enabled'), false);
$$;

revoke all on function public.get_event_feature_switches() from public, anon;
grant execute on function public.get_event_feature_switches() to authenticated;

create or replace function public.owner_set_event_feature_switch(
  p_key text,
  p_enabled boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_value boolean;
begin
  if not public.is_current_active_staff(array['owner']::text[], false) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  if p_key not in ('event_blast_enabled', 'event_email_enabled') or p_enabled is null then
    raise exception 'invalid setting' using errcode = '22023';
  end if;

  select setting.bool_value into current_value
  from public.platform_settings setting
  where setting.key = p_key
  for update;

  if current_value is not distinct from p_enabled then
    return false;
  end if;

  update public.platform_settings
  set bool_value = p_enabled,
      updated_at = timezone('utc', now()),
      updated_by = actor
  where key = p_key;

  insert into public.staff_ops_audit_events (actor_user_id, event_type)
  values (
    actor,
    case
      when p_key = 'event_blast_enabled' and p_enabled then 'event_blast_enabled'
      when p_key = 'event_blast_enabled' then 'event_blast_disabled'
      when p_enabled then 'event_email_enabled'
      else 'event_email_disabled'
    end
  );
  return true;
end;
$$;

revoke all on function public.owner_set_event_feature_switch(text, boolean) from public, anon;
grant execute on function public.owner_set_event_feature_switch(text, boolean) to authenticated;
