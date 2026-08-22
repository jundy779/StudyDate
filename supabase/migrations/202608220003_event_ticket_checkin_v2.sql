-- Campus Events v2 tickets/check-in. Raw SDT1 tokens are never stored.

drop index public.campus_event_tickets_active_user_idx;
alter table public.campus_event_tickets
  add column rsvp_id uuid null
    references public.campus_event_rsvps (id) on delete cascade;
update public.campus_event_tickets ticket
set rsvp_id = rsvp.id
from public.campus_event_rsvps rsvp
where rsvp.event_id = ticket.event_id
  and rsvp.user_id = ticket.user_id
  and ticket.rsvp_id is null;
update public.campus_event_tickets
set revoked_at = coalesce(revoked_at, timezone('utc', now()))
where rsvp_id is null and revoked_at is null;
create unique index campus_event_tickets_active_registration_idx
  on public.campus_event_tickets (rsvp_id)
  where revoked_at is null and rsvp_id is not null;
create index campus_event_tickets_event_hash_idx
  on public.campus_event_tickets (event_id, ticket_hash);

drop function public.get_my_campus_event_ticket_state(text);
create function public.get_my_campus_event_ticket_state(p_public_slug text)
returns table (
  ticket_public_id text,
  status text,
  issued_at timestamptz,
  checked_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); registration_id uuid;
begin
  if not public.is_campus_event_student(actor) then
    raise exception 'event participation required' using errcode = '42501';
  end if;
  select rsvp.id into registration_id
  from public.campus_events event
  join public.campus_event_rsvps rsvp on rsvp.event_id = event.id
  where event.public_slug = p_public_slug
    and rsvp.user_id = actor and rsvp.status = 'going';
  if registration_id is null then return; end if;
  return query
  select ticket.public_id,
    case
      when ticket.revoked_at is not null then 'revoked'
      when rsvp.checked_in_at is not null then 'checked_in'
      else 'issued'
    end,
    ticket.issued_at, rsvp.checked_in_at
  from public.campus_event_tickets ticket
  join public.campus_event_rsvps rsvp on rsvp.id = ticket.rsvp_id
  where ticket.rsvp_id = registration_id
  order by ticket.issued_at desc, ticket.id desc
  limit 1;
end;
$$;

drop function public.issue_my_campus_event_ticket(text);
create function public.issue_my_campus_event_ticket(
  p_public_slug text,
  p_ticket_public_id text,
  p_ticket_hash text,
  p_regenerate boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  registration public.campus_event_rsvps%rowtype;
  active_ticket public.campus_event_tickets%rowtype;
begin
  if not public.is_campus_event_student(actor)
    or p_ticket_public_id !~ '^[0-9a-f]{32}$'
    or p_ticket_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'ticket request unavailable' using errcode = '42501';
  end if;
  select event.* into event_row from public.campus_events event
  where event.public_slug = p_public_slug and event.status = 'scheduled'
    and event.ends_at > timezone('utc', now());
  select rsvp.* into registration from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id and rsvp.user_id = actor
    and rsvp.status = 'going' for update;
  if event_row.id is null or registration.id is null then
    raise exception 'event participation required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    registration.id::text || ':event-ticket', 0
  ));
  select * into active_ticket from public.campus_event_tickets ticket
  where ticket.rsvp_id = registration.id and ticket.revoked_at is null
  for update;
  if active_ticket.id is not null and not coalesce(p_regenerate, false) then
    return active_ticket.public_id;
  end if;
  if active_ticket.id is not null then
    if registration.checked_in_at is not null then
      raise exception 'checked-in ticket cannot regenerate' using errcode = 'P0001';
    end if;
    if not public.consume_campus_event_rate_limit(
      actor, 'ticket_regenerate_day', 3, 86400
    ) then
      raise exception 'ticket regeneration rate limited' using errcode = 'P0001';
    end if;
    update public.campus_event_tickets
    set revoked_at = timezone('utc', now())
    where id = active_ticket.id;
  end if;
  insert into public.campus_event_tickets (
    public_id, event_id, user_id, rsvp_id, ticket_hash
  ) values (
    p_ticket_public_id, event_row.id, actor, registration.id, lower(p_ticket_hash)
  );
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (
    event_row.id, actor,
    case when active_ticket.id is null then 'ticket_issued'
      else 'ticket_regenerated' end
  );
  return p_ticket_public_id;
end;
$$;

create or replace function public.event_can_check_in(
  p_event_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campus_events event
    where event.id = p_event_id
      and (
        event.organizer_user_id = p_user_id
        or public.is_event_team_member(
          event.id, p_user_id, array['cohost', 'checkin_staff']::text[]
        )
      )
  );
$$;

drop function public.check_in_campus_event_ticket(text, text);
create function public.check_in_campus_event_ticket(
  p_event_public_slug text,
  p_ticket_token text
)
returns table (
  status text,
  attendee_alias text,
  checked_in_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  ticket public.campus_event_tickets%rowtype;
  registration public.campus_event_rsvps%rowtype;
  token_hash text;
  alias_value text;
begin
  select * into event_row from public.campus_events event
  where event.public_slug = p_event_public_slug;
  if actor is null or event_row.id is null
    or not public.event_can_check_in(event_row.id, actor) then
    raise exception 'check-in unavailable' using errcode = '42501';
  end if;
  if not public.consume_campus_event_rate_limit(
    actor, 'ticket_scan_minute', 60, 60
  ) then
    return query select 'rate_limited'::text, null::text, null::timestamptz;
    return;
  end if;
  if p_ticket_token is null
    or p_ticket_token !~ '^SDT1\.[A-Za-z0-9_-]{43}$' then
    perform public.consume_campus_event_rate_limit(
      actor, 'ticket_scan_invalid_hour', 120, 3600
    );
    return query select 'invalid'::text, null::text, null::timestamptz;
    return;
  end if;
  token_hash := encode(extensions.digest(p_ticket_token, 'sha256'), 'hex');
  select * into ticket from public.campus_event_tickets candidate
  where candidate.event_id = event_row.id
    and candidate.ticket_hash = token_hash for update;
  if ticket.id is null then
    if exists (
      select 1 from public.campus_event_tickets candidate
      where candidate.ticket_hash = token_hash
    ) then
      return query select 'wrong_event'::text, null::text, null::timestamptz;
      return;
    end if;
    perform public.consume_campus_event_rate_limit(
      actor, 'ticket_scan_invalid_hour', 120, 3600
    );
    return query select 'invalid'::text, null::text, null::timestamptz;
    return;
  end if;
  if ticket.revoked_at is not null then
    return query select 'revoked'::text, null::text, null::timestamptz;
    return;
  end if;
  if event_row.status <> 'scheduled'
    or timezone('utc', now()) < event_row.starts_at - interval '2 hours'
    or timezone('utc', now()) > event_row.ends_at + interval '2 hours' then
    return query select 'outside_window'::text, null::text, null::timestamptz;
    return;
  end if;
  select * into registration from public.campus_event_rsvps rsvp
  where rsvp.id = ticket.rsvp_id and rsvp.event_id = event_row.id for update;
  if registration.id is null or registration.status <> 'going'
    or registration.user_id is null then
    return query select 'not_eligible'::text, null::text, null::timestamptz;
    return;
  end if;
  select profile.public_alias into alias_value
  from public.profiles profile where profile.user_id = registration.user_id;
  if registration.checked_in_at is not null then
    return query select 'duplicate'::text, alias_value,
      registration.checked_in_at;
    return;
  end if;
  update public.campus_event_rsvps
  set checked_in_at = timezone('utc', now()), checked_in_by = actor,
    checkin_method = 'qr'
  where id = registration.id
  returning campus_event_rsvps.checked_in_at into registration.checked_in_at;
  update public.campus_event_tickets
  set checked_in_at = registration.checked_in_at, checked_in_by = actor
  where id = ticket.id;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_row.id, actor, 'checked_in_qr');
  return query select 'checked_in'::text, alias_value,
    registration.checked_in_at;
end;
$$;

create or replace function public.manual_check_in_campus_event_registration(
  p_event_public_slug text,
  p_registration_public_id text
)
returns table (
  status text,
  attendee_alias text,
  checked_in_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  event_row public.campus_events%rowtype;
  registration public.campus_event_rsvps%rowtype;
  alias_value text;
begin
  select * into event_row from public.campus_events event
  where event.public_slug = p_event_public_slug;
  if event_row.id is null or not public.event_can_check_in(event_row.id, actor) then
    raise exception 'check-in unavailable' using errcode = '42501';
  end if;
  if event_row.status <> 'scheduled'
    or timezone('utc', now()) < event_row.starts_at - interval '2 hours'
    or timezone('utc', now()) > event_row.ends_at + interval '2 hours' then
    return query select 'outside_window'::text, null::text, null::timestamptz;
    return;
  end if;
  select * into registration from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id
    and rsvp.public_id = p_registration_public_id for update;
  if registration.id is null or registration.status <> 'going'
    or registration.user_id is null then
    return query select 'not_eligible'::text, null::text, null::timestamptz;
    return;
  end if;
  select profile.public_alias into alias_value
  from public.profiles profile where profile.user_id = registration.user_id;
  if registration.checked_in_at is not null then
    return query select 'duplicate'::text, alias_value,
      registration.checked_in_at;
    return;
  end if;
  update public.campus_event_rsvps
  set checked_in_at = timezone('utc', now()), checked_in_by = actor,
    checkin_method = 'manual'
  where id = registration.id
  returning campus_event_rsvps.checked_in_at into registration.checked_in_at;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_row.id, actor, 'checked_in_manual');
  return query select 'checked_in'::text, alias_value,
    registration.checked_in_at;
end;
$$;

create or replace function public.undo_campus_event_check_in(
  p_event_public_slug text,
  p_registration_public_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); event_id_value uuid; registration_id uuid;
begin
  select event.id into event_id_value from public.campus_events event
  where event.public_slug = p_event_public_slug
    and (
      event.organizer_user_id = actor
      or public.is_event_team_member(
        event.id, actor, array['cohost']::text[]
      )
    );
  if event_id_value is null then
    raise exception 'event management required' using errcode = '42501';
  end if;
  update public.campus_event_rsvps rsvp
  set checked_in_at = null, checked_in_by = null, checkin_method = null
  where rsvp.event_id = event_id_value
    and rsvp.public_id = p_registration_public_id
    and rsvp.checked_in_at is not null
  returning rsvp.id into registration_id;
  if registration_id is null then return false; end if;
  update public.campus_event_tickets
  set checked_in_at = null, checked_in_by = null
  where rsvp_id = registration_id and revoked_at is null;
  insert into public.campus_event_audit_events (
    event_id, actor_user_id, event_type
  ) values (event_id_value, actor, 'checkin_undone');
  return true;
end;
$$;

create or replace function public.revoke_campus_event_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'campus_event_rsvps'
    and old.status = 'going' and new.status <> 'going' then
    update public.campus_event_tickets
    set revoked_at = coalesce(revoked_at, timezone('utc', now()))
    where rsvp_id = new.id and revoked_at is null;
  elsif tg_table_name = 'campus_events'
    and old.status = 'scheduled' and new.status <> 'scheduled' then
    update public.campus_event_tickets
    set revoked_at = coalesce(revoked_at, timezone('utc', now()))
    where event_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$$;

create or replace function public.audit_owner_event_official_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_official is distinct from old.is_official then
    insert into public.campus_event_audit_events (
      event_id, actor_user_id, event_type
    ) values (
      new.id, auth.uid(),
      case when new.is_official then 'official_enabled' else 'official_disabled' end
    );
  end if;
  return new;
end;
$$;
create trigger campus_events_audit_official_change
after update of is_official on public.campus_events
for each row execute function public.audit_owner_event_official_change();

create or replace function public.cleanup_account_deletion_database(
  p_request_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  cleanup_done boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select deletion.user_id, deletion.database_cleanup_at is not null
  into target_user_id, cleanup_done
  from public.account_deletion_requests deletion
  where deletion.id = p_request_id
    and deletion.status = 'processing'
    and deletion.lease_token = p_lease_token
    and deletion.lease_expires_at >= timezone('utc', now())
  for update;
  if not found then
    raise exception 'deletion lease unavailable' using errcode = '42501';
  end if;
  if target_user_id is null and cleanup_done then return; end if;
  if target_user_id is null then
    raise exception 'deletion target unavailable' using errcode = '42501';
  end if;

  update public.study_circles
  set status = 'archived', archived_at = coalesce(archived_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where owner_user_id = target_user_id and status <> 'archived';
  update public.campus_events
  set status = 'cancelled', cancelled_at = coalesce(cancelled_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where organizer_user_id = target_user_id and status = 'scheduled'
    and starts_at > timezone('utc', now());

  update public.user_reports set account_deletion_request_id = p_request_id
  where (reporter_id = target_user_id or subject_user_id = target_user_id)
    and moderation_status in ('submitted', 'under_review', 'resolved', 'dismissed');
  update public.introduction_events set account_deletion_request_id = p_request_id
  where actor_user_id = target_user_id;
  update public.conversation_events set account_deletion_request_id = p_request_id
  where actor_id = target_user_id;
  update public.study_circle_events set account_deletion_request_id = p_request_id
  where actor_user_id = target_user_id;
  update public.campus_event_audit_events set account_deletion_request_id = p_request_id
  where actor_user_id = target_user_id;

  delete from public.user_blocks
  where blocker_id = target_user_id or blocked_id = target_user_id;
  delete from public.conversation_mutual_interests where participant_id = target_user_id;
  delete from public.study_circle_memberships
  where user_id = target_user_id and status <> 'active';

  delete from public.campus_event_tickets ticket
  using public.campus_event_rsvps rsvp
  where ticket.rsvp_id = rsvp.id and rsvp.user_id = target_user_id
    and rsvp.status <> 'going';
  delete from public.campus_event_rsvps
  where user_id = target_user_id and status <> 'going';
  update public.event_team_members
  set user_id = null, status = 'removed',
    removed_at = coalesce(removed_at, timezone('utc', now()))
  where user_id = target_user_id;
  delete from public.event_organizer_eligibility where user_id = target_user_id;
  delete from public.study_circle_rate_limits where actor_user_id = target_user_id;
  delete from public.campus_event_rate_limits where actor_user_id = target_user_id;

  delete from public.conversation_contact_reveals reveal
  where exists (
    select 1 from public.conversation_contact_versions version
    where version.owner_user_id = target_user_id
      and version.id in (
        reveal.sender_contact_version_id, reveal.recipient_contact_version_id
      )
  );
  delete from public.conversation_contact_reveal_consents
  where participant_id = target_user_id;
  delete from public.conversation_contact_versions where owner_user_id = target_user_id;
  delete from public.conversation_identity_reveals reveal
  where exists (
    select 1 from public.identity_reveal_profile_versions version
    where version.owner_user_id = target_user_id
      and version.id in (
        reveal.sender_profile_version_id, reveal.recipient_profile_version_id
      )
  );
  delete from public.conversation_identity_reveal_consents
  where participant_id = target_user_id;
  delete from public.identity_reveal_profile_versions where owner_user_id = target_user_id;

  delete from public.student_verification_requests where user_id = target_user_id;
  delete from public.onboarding_academic_claims where user_id = target_user_id;
  delete from public.student_social_contacts where user_id = target_user_id;
  delete from public.privacy_preferences where user_id = target_user_id;
  delete from public.user_consents where user_id = target_user_id;
  delete from public.user_notifications where recipient_user_id = target_user_id;
  update public.early_access_waitlist
  set claimed_user_id = null, claimed_at = null, status = 'waiting'
  where claimed_user_id = target_user_id;
  delete from public.profiles where user_id = target_user_id;

  update public.account_deletion_requests
  set database_cleanup_at = coalesce(database_cleanup_at, timezone('utc', now()))
  where id = p_request_id;
  insert into public.account_deletion_audit_events (
    deletion_request_id, event_type
  ) values (p_request_id, 'database_cleaned')
  on conflict do nothing;
end;
$$;

create or replace function public.cleanup_event_v2_profile_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Terminal registrations must not survive until the profile-trigger stage:
  -- their nullable Auth FK would otherwise be blocked by related v2 rows.
  delete from public.campus_event_tickets ticket
  using public.campus_event_rsvps rsvp
  where ticket.rsvp_id = rsvp.id
    and rsvp.user_id = old.user_id
    and rsvp.status <> 'going';
  delete from public.event_organizer_eligibility where user_id = old.user_id;
  update public.event_team_members
  set user_id = null, status = 'removed',
    removed_at = coalesce(removed_at, timezone('utc', now()))
  where user_id = old.user_id;
  return old;
end;
$$;
create trigger profiles_cleanup_event_v2_data
after delete on public.profiles
for each row execute function public.cleanup_event_v2_profile_data();

revoke all on function public.event_can_check_in(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.revoke_campus_event_ticket()
  from public, anon, authenticated;
revoke all on function public.audit_owner_event_official_change()
  from public, anon, authenticated;
revoke all on function public.cleanup_event_v2_profile_data()
  from public, anon, authenticated;
revoke all on function public.cleanup_account_deletion_database(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cleanup_account_deletion_database(uuid, uuid)
  to service_role;

revoke all on function public.get_my_campus_event_ticket_state(text)
  from public, anon;
grant execute on function public.get_my_campus_event_ticket_state(text)
  to authenticated;
revoke all on function public.issue_my_campus_event_ticket(
  text, text, text, boolean
) from public, anon;
grant execute on function public.issue_my_campus_event_ticket(
  text, text, text, boolean
) to authenticated;
revoke all on function public.check_in_campus_event_ticket(text, text)
  from public, anon;
grant execute on function public.check_in_campus_event_ticket(text, text)
  to authenticated;
revoke all on function public.manual_check_in_campus_event_registration(text, text)
  from public, anon;
grant execute on function public.manual_check_in_campus_event_registration(text, text)
  to authenticated;
revoke all on function public.undo_campus_event_check_in(text, text)
  from public, anon;
grant execute on function public.undo_campus_event_check_in(text, text)
  to authenticated;

comment on table public.campus_event_tickets is
  'Registration-scoped SHA-256 ticket hashes only. Raw SDT1 tokens are application-derived and never stored.';
