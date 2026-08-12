-- PDDIKTI Academic Lookup + Manual Verification Fallback v1.
-- LOCAL-ONLY: Student Verification and provider remain disabled by default.

alter table public.student_verification_requests
  drop constraint student_verification_method_allowed,
  drop constraint student_verification_evidence_method,
  add column academic_match_source text not null default 'manual',
  add column provider_identifier text null,
  add column provider_checked_at timestamptz null,
  add column provider_outcome text null,
  add column academic_claim_fingerprint text null,
  add constraint student_verification_method_allowed
    check (method in ('academic_pending', 'campus_email', 'student_card')),
  add constraint student_verification_evidence_method
    check (
      (method = 'student_card' and (evidence_path is not null or evidence_deleted_at is not null))
      or (method in ('academic_pending', 'campus_email') and evidence_path is null)
    ),
  add constraint student_verification_academic_source_allowed
    check (academic_match_source in ('provider', 'manual')),
  add constraint student_verification_provider_outcome_allowed
    check (
      provider_outcome is null
      or provider_outcome in (
        'academic_match', 'not_found', 'mismatch',
        'provider_unavailable', 'provider_invalid_response'
      )
    ),
  add constraint student_verification_provider_metadata_consistent
    check (
      (
        academic_match_source = 'provider'
        and provider_identifier = 'third_party_pddikti_lookup'
        and provider_checked_at is not null
        and provider_outcome = 'academic_match'
        and academic_claim_fingerprint ~ '^[a-f0-9]{64}$'
      )
      or (
        academic_match_source = 'manual'
        and academic_claim_fingerprint is null
        and provider_identifier is null
        and provider_checked_at is null
        and provider_outcome is null
      )
    );

create unique index student_verification_provider_claim_idx
  on public.student_verification_requests (academic_claim_fingerprint)
  where academic_claim_fingerprint is not null
    and status in ('pending', 'under_review', 'needs_action', 'verified');

revoke select (nim_last_four) on table public.student_verification_requests
  from authenticated;

create or replace function public.is_eligible_verification_student(
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.profiles as profile
    where profile.user_id = p_user_id
      and profile.onboarding_completed_at is not null
      and profile.deactivated_at is null
      and not exists (
        select 1
        from public.staff_members as staff
        where staff.user_id = p_user_id
          and staff.status = 'active'
      )
      and not exists (
        select 1
        from public.account_deletion_requests as deletion
        where deletion.user_id = p_user_id
          and deletion.status in ('pending', 'processing', 'failed')
      )
  );
end;
$$;

revoke all on function public.is_eligible_verification_student(uuid)
  from public, anon, authenticated;
grant execute on function public.is_eligible_verification_student(uuid)
  to service_role;

create or replace function public.lock_eligible_verification_student(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.profiles%rowtype;
begin
  if auth.role() <> 'service_role'
    and not public.is_current_active_staff(
      array['owner', 'admin']::text[], true
    ) then
    raise exception 'trusted verification actor required' using errcode = '42501';
  end if;

  select profile.* into target_profile
  from public.profiles as profile
  where profile.user_id = p_user_id
  for update;

  if target_profile.user_id is null
    or target_profile.onboarding_completed_at is null
    or target_profile.deactivated_at is not null
    or public.is_account_deletion_locked(p_user_id)
    or exists (
      select 1 from public.staff_members as staff
      where staff.user_id = p_user_id and staff.status = 'active'
    ) then
    raise exception 'verification target unavailable' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.lock_eligible_verification_student(uuid)
  from public, anon, authenticated;

create or replace function public.create_pddikti_academic_match_request(
  p_user_id uuid,
  p_request_id uuid,
  p_campus_claim text,
  p_study_program_claim text,
  p_degree_level_claim text,
  p_semester_claim smallint,
  p_nim_ciphertext bytea,
  p_nim_iv bytea,
  p_nim_auth_tag bytea,
  p_nim_last_four text,
  p_nim_fingerprint text,
  p_legal_name_ciphertext bytea,
  p_legal_name_iv bytea,
  p_legal_name_auth_tag bytea,
  p_academic_claim_fingerprint text,
  p_consent_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  perform public.lock_eligible_verification_student(p_user_id);

  insert into public.student_verification_requests (
    id, user_id, method, status, campus_claim, study_program_claim,
    degree_level_claim, semester_claim, nim_ciphertext, nim_iv, nim_auth_tag,
    nim_last_four, nim_fingerprint, legal_name_ciphertext, legal_name_iv,
    legal_name_auth_tag, pddikti_match_status, ownership_status,
    academic_match_source, provider_identifier, provider_checked_at,
    provider_outcome, academic_claim_fingerprint, consent_version
  )
  values (
    p_request_id, p_user_id, 'academic_pending', 'under_review',
    btrim(p_campus_claim), btrim(p_study_program_claim), p_degree_level_claim,
    p_semester_claim, p_nim_ciphertext, p_nim_iv, p_nim_auth_tag,
    p_nim_last_four, p_nim_fingerprint, p_legal_name_ciphertext,
    p_legal_name_iv, p_legal_name_auth_tag, 'matched', 'not_checked',
    'provider', 'third_party_pddikti_lookup', timezone('utc', now()),
    'academic_match', p_academic_claim_fingerprint, btrim(p_consent_version)
  );

  update public.profiles set verification_status = 'pending'
  where user_id = p_user_id;
  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  ) values (p_request_id, p_user_id, p_user_id, 'request_submitted');
  return p_request_id;
exception
  when unique_violation then
    raise exception 'academic identity unavailable' using errcode = '23505';
end;
$$;

revoke all on function public.create_pddikti_academic_match_request(
  uuid, uuid, text, text, text, smallint, bytea, bytea, bytea, text, text,
  bytea, bytea, bytea, text, text
) from public, anon, authenticated;
grant execute on function public.create_pddikti_academic_match_request(
  uuid, uuid, text, text, text, smallint, bytea, bytea, bytea, text, text,
  bytea, bytea, bytea, text, text
) to service_role;

create or replace function public.complete_student_verification_ownership(
  p_user_id uuid,
  p_request_id uuid,
  p_method text,
  p_evidence_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  perform public.lock_eligible_verification_student(p_user_id);
  if p_method not in ('campus_email', 'student_card')
    or (p_method = 'campus_email' and p_evidence_path is not null)
    or (p_method = 'student_card' and p_evidence_path is null) then
    raise exception 'request is not eligible' using errcode = '42501';
  end if;

  update public.student_verification_requests
  set method = p_method,
    evidence_path = p_evidence_path,
    evidence_deletion_at = case
      when p_evidence_path is null then null
      else timezone('utc', now()) + interval '90 days'
    end,
    status = 'pending'
  where id = p_request_id
    and user_id = p_user_id
    and method = 'academic_pending'
    and status = 'under_review'
    and pddikti_match_status = 'matched'
    and ownership_status = 'not_checked';
  if not found then
    raise exception 'request is not eligible' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.complete_student_verification_ownership(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.complete_student_verification_ownership(
  uuid, uuid, text, text
) to service_role;

create or replace function public.prepare_student_campus_email_challenge(
  p_user_id uuid,
  p_request_id uuid,
  p_normalized_email text,
  p_code_hash text,
  p_expires_at timestamptz,
  p_resend_available_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  perform public.lock_eligible_verification_student(p_user_id);

  if not exists (
    select 1
    from public.student_verification_requests as request
    where request.id = p_request_id
      and request.user_id = p_user_id
      and request.method = 'campus_email'
      and request.status in ('pending', 'under_review', 'needs_action')
      and request.pddikti_match_status = 'matched'
  ) then
    raise exception 'request is not eligible' using errcode = '42501';
  end if;

  insert into public.campus_email_verifications (
    request_id, user_id, normalized_email, code_hash, expires_at,
    attempts, resend_available_at, verified_at
  )
  values (
    p_request_id, p_user_id, p_normalized_email, p_code_hash, p_expires_at,
    0, p_resend_available_at, null
  )
  on conflict (request_id) do update
  set normalized_email = excluded.normalized_email,
      code_hash = excluded.code_hash,
      expires_at = excluded.expires_at,
      attempts = 0,
      resend_available_at = excluded.resend_available_at,
      verified_at = null;
end;
$$;

revoke all on function public.prepare_student_campus_email_challenge(
  uuid, uuid, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.prepare_student_campus_email_challenge(
  uuid, uuid, text, text, timestamptz, timestamptz
) to service_role;

create or replace function public.authorize_student_campus_email_delivery(
  p_user_id uuid,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  perform public.lock_eligible_verification_student(p_user_id);

  if not exists (
    select 1
    from public.student_verification_requests as request
    join public.campus_email_verifications as challenge
      on challenge.request_id = request.id
     and challenge.user_id = request.user_id
    where request.id = p_request_id
      and request.user_id = p_user_id
      and request.method = 'campus_email'
      and request.status in ('pending', 'under_review', 'needs_action')
      and request.pddikti_match_status = 'matched'
      and challenge.verified_at is null
      and challenge.expires_at > timezone('utc', now())
  ) then
    raise exception 'email delivery unavailable' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.authorize_student_campus_email_delivery(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.authorize_student_campus_email_delivery(uuid, uuid)
  to service_role;

create or replace function public.confirm_student_campus_email_code(
  p_user_id uuid,
  p_request_id uuid,
  p_candidate_hash text,
  p_max_attempts smallint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge public.campus_email_verifications%rowtype;
  target public.student_verification_requests%rowtype;
  final_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  perform public.lock_eligible_verification_student(p_user_id);
  select * into challenge
  from public.campus_email_verifications
  where request_id = p_request_id and user_id = p_user_id
  for update;
  if challenge.id is null or challenge.verified_at is not null
    or challenge.expires_at <= timezone('utc', now())
    or challenge.attempts >= p_max_attempts then
    return 'invalid';
  end if;
  if challenge.code_hash <> p_candidate_hash then
    update public.campus_email_verifications
    set attempts = least(attempts + 1, p_max_attempts)
    where id = challenge.id;
    return 'invalid';
  end if;

  select * into target
  from public.student_verification_requests
  where id = p_request_id and user_id = p_user_id and method = 'campus_email'
    and status in ('pending', 'needs_action', 'under_review')
  for update;
  if target.id is null then
    raise exception 'request is not eligible' using errcode = '42501';
  end if;
  final_status := case
    when target.pddikti_match_status = 'matched' then 'verified'
    else 'under_review'
  end;

  update public.campus_email_verifications
  set verified_at = timezone('utc', now()) where id = challenge.id;
  update public.student_verification_requests
  set ownership_status = 'campus_email_verified',
    status = final_status,
    reviewed_at = coalesce(reviewed_at, timezone('utc', now())),
    verified_at = case
      when final_status = 'verified' then timezone('utc', now()) else null
    end
  where id = p_request_id;
  update public.profiles
  set verification_status = case
    when final_status = 'verified' then 'verified' else 'pending'
  end
  where user_id = p_user_id;
  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  ) values (p_request_id, p_user_id, p_user_id, 'campus_email_verified');
  return 'verified';
end;
$$;

revoke all on function public.confirm_student_campus_email_code(
  uuid, uuid, text, smallint
) from public, anon, authenticated;
grant execute on function public.confirm_student_campus_email_code(
  uuid, uuid, text, smallint
) to service_role;

create or replace function public.create_manual_academic_review_request(
  p_user_id uuid,
  p_request_id uuid,
  p_method text,
  p_campus_claim text,
  p_study_program_claim text,
  p_degree_level_claim text,
  p_semester_claim smallint,
  p_nim_ciphertext bytea,
  p_nim_iv bytea,
  p_nim_auth_tag bytea,
  p_nim_last_four text,
  p_nim_fingerprint text,
  p_legal_name_ciphertext bytea,
  p_legal_name_iv bytea,
  p_legal_name_auth_tag bytea,
  p_consent_version text,
  p_evidence_path text,
  p_pddikti_evidence_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_request_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  perform public.lock_eligible_verification_student(p_user_id);
  if p_pddikti_evidence_path is null then
    raise exception 'request is not eligible' using errcode = '42501';
  end if;

  select public.create_student_verification_request_v2(
    p_user_id, p_request_id, p_method, p_campus_claim, p_study_program_claim,
    p_degree_level_claim, p_semester_claim, p_nim_ciphertext, p_nim_iv,
    p_nim_auth_tag, p_nim_last_four, p_nim_fingerprint,
    p_legal_name_ciphertext, p_legal_name_iv, p_legal_name_auth_tag,
    p_consent_version, p_evidence_path, p_pddikti_evidence_path
  ) into created_request_id;

  update public.student_verification_requests
  set status = 'under_review', academic_match_source = 'manual'
  where id = created_request_id;
  return created_request_id;
end;
$$;

revoke all on function public.create_manual_academic_review_request(
  uuid, uuid, text, text, text, text, smallint, bytea, bytea, bytea, text,
  text, bytea, bytea, bytea, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_manual_academic_review_request(
  uuid, uuid, text, text, text, text, smallint, bytea, bytea, bytea, text,
  text, bytea, bytea, bytea, text, text, text
) to service_role;

create or replace function public.approve_manual_academic_match(
  p_request_id uuid,
  p_approved boolean,
  p_needs_action boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_user uuid;
  event_name text;
begin
  if not public.is_current_active_staff(
    array['owner', 'admin']::text[], true
  ) then
    raise exception 'reviewer authorization required' using errcode = '42501';
  end if;
  select request.user_id into target_user
  from public.student_verification_requests request
  where request.id = p_request_id
    and request.academic_match_source = 'manual'
    and request.status in ('pending', 'under_review', 'needs_action')
  for update;
  if target_user is null or target_user = actor then
    raise exception 'review is not allowed' using errcode = '42501';
  end if;
  perform public.lock_eligible_verification_student(target_user);

  update public.student_verification_requests
  set pddikti_match_status = case when p_approved then 'matched' else 'mismatch' end,
    status = case
      when p_approved then 'under_review'
      when p_needs_action then 'needs_action'
      else 'rejected'
    end,
    reviewed_at = timezone('utc', now()),
    rejection_reason_code = case
      when p_approved then null
      when p_needs_action then 'additional_information_required'
      else 'academic_mismatch'
    end
  where id = p_request_id;

  update public.profiles
  set verification_status = case
    when p_approved or p_needs_action then 'pending' else 'rejected'
  end
  where user_id = target_user;

  event_name := case
    when p_approved then 'review_started'
    when p_needs_action then 'action_requested'
    else 'verification_rejected'
  end;
  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  ) values (p_request_id, target_user, actor, event_name);
end;
$$;

revoke all on function public.approve_manual_academic_match(uuid, boolean, boolean)
  from public, anon;
grant execute on function public.approve_manual_academic_match(uuid, boolean, boolean)
  to authenticated;

create or replace function public.finalize_staff_verification_review(
  p_request_id uuid,
  p_request_status text,
  p_pddikti_match_status text,
  p_ownership_status text,
  p_rejection_reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  target public.student_verification_requests%rowtype;
  event_name text;
begin
  if not public.is_current_active_staff(
    array['owner', 'admin']::text[], true
  ) then
    raise exception 'reviewer authorization required' using errcode = '42501';
  end if;
  if p_request_status not in (
    'under_review', 'needs_action', 'verified', 'rejected', 'expired'
  ) then
    raise exception 'invalid review status' using errcode = '22023';
  end if;
  select * into target from public.student_verification_requests request
  where request.id = p_request_id for update;
  if target.id is null or target.user_id = actor_user_id then
    raise exception 'review is not allowed' using errcode = '42501';
  end if;
  perform public.lock_eligible_verification_student(target.user_id);
  if target.method = 'academic_pending'
    or p_pddikti_match_status <> target.pddikti_match_status then
    raise exception 'academic result must use dedicated workflow' using errcode = '42501';
  end if;
  if p_request_status = 'verified' and not (
    target.pddikti_match_status = 'matched'
    and p_ownership_status in ('campus_email_verified', 'document_verified')
  ) then
    raise exception 'combined verification required' using errcode = '23514';
  end if;
  if p_ownership_status = 'campus_email_verified'
    and target.method <> 'campus_email' then
    raise exception 'ownership method mismatch' using errcode = '23514';
  end if;
  if p_ownership_status = 'document_verified'
    and target.method <> 'student_card' then
    raise exception 'ownership method mismatch' using errcode = '23514';
  end if;

  update public.student_verification_requests
  set status = p_request_status,
    ownership_status = p_ownership_status,
    reviewed_at = timezone('utc', now()),
    verified_at = case
      when p_request_status = 'verified' then timezone('utc', now()) else null
    end,
    evidence_deletion_at = case
      when evidence_path is null then null
      when p_request_status in ('verified', 'rejected', 'expired')
        then timezone('utc', now()) + interval '30 days'
      else evidence_deletion_at
    end,
    pddikti_evidence_deletion_at = case
      when pddikti_evidence_path is null then null
      when p_request_status in ('verified', 'rejected', 'expired')
        then timezone('utc', now()) + interval '30 days'
      else pddikti_evidence_deletion_at
    end,
    rejection_reason_code = case
      when p_request_status in ('needs_action', 'rejected')
        then p_rejection_reason_code
      else null
    end
  where id = p_request_id;
  update public.profiles
  set verification_status = case
    when p_request_status = 'verified' then 'verified'
    when p_request_status = 'rejected' then 'rejected'
    else 'pending'
  end where user_id = target.user_id;

  event_name := case p_request_status
    when 'under_review' then 'review_started'
    when 'needs_action' then 'action_requested'
    when 'verified' then 'verification_approved'
    when 'rejected' then 'verification_rejected'
    when 'expired' then 'request_expired'
  end;
  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  ) values (p_request_id, target.user_id, actor_user_id, event_name);
end;
$$;

revoke all on function public.finalize_staff_verification_review(
  uuid, text, text, text, text
) from public, anon;
grant execute on function public.finalize_staff_verification_review(
  uuid, text, text, text, text
) to authenticated;

drop function public.list_staff_verification_requests(text, integer);

create or replace function public.list_staff_verification_requests(
  p_status text default null,
  p_limit integer default 50
)
returns table (
  request_id uuid, status text, method text, pddikti_match_status text,
  ownership_status text, submitted_at timestamptz, reviewed_at timestamptz,
  rejection_reason_code text, academic_match_source text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_current_active_staff(
    array['owner', 'admin']::text[], true
  ) then
    raise exception 'reviewer authorization required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in (
    'pending', 'under_review', 'needs_action', 'verified',
    'rejected', 'expired', 'cancelled'
  ) then
    raise exception 'invalid verification status' using errcode = '22023';
  end if;
  return query
  select request.id, request.status, request.method,
    request.pddikti_match_status, request.ownership_status,
    request.submitted_at, request.reviewed_at,
    request.rejection_reason_code, request.academic_match_source
  from public.student_verification_requests request
  where p_status is null or request.status = p_status
  order by request.submitted_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

revoke all on function public.list_staff_verification_requests(text, integer)
  from public, anon;
grant execute on function public.list_staff_verification_requests(text, integer)
  to authenticated;

create or replace function public.enforce_verification_deletion_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
begin
  target_user := case
    when tg_op = 'DELETE' then old.user_id
    else new.user_id
  end;
  if auth.role() <> 'service_role'
    and public.is_account_deletion_locked(target_user) then
    raise exception 'account deletion lock active' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.enforce_verification_deletion_lock()
  from public, anon, authenticated;

drop trigger if exists campus_email_verifications_deletion_lock
  on public.campus_email_verifications;
create trigger campus_email_verifications_deletion_lock
before insert or update or delete on public.campus_email_verifications
for each row execute function public.enforce_verification_deletion_lock();

create or replace function public.invalidate_verification_for_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.campus_email_verifications as challenge
  where challenge.user_id = new.user_id
    and challenge.verified_at is null;
  return new;
end;
$$;

revoke all on function public.invalidate_verification_for_account_deletion()
  from public, anon, authenticated;

drop trigger if exists account_deletion_requests_invalidate_verification
  on public.account_deletion_requests;
create trigger account_deletion_requests_invalidate_verification
before insert on public.account_deletion_requests
for each row execute function public.invalidate_verification_for_account_deletion();
