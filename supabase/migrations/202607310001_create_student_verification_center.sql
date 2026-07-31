create table public.student_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null,
  status text not null default 'pending',
  campus_claim text not null,
  study_program_claim text not null,
  degree_level_claim text not null,
  nim_ciphertext bytea not null,
  nim_iv bytea not null,
  nim_auth_tag bytea not null,
  nim_last_four text not null,
  nim_fingerprint text not null,
  legal_name_ciphertext bytea not null,
  legal_name_iv bytea not null,
  legal_name_auth_tag bytea not null,
  pddikti_match_status text not null default 'not_checked',
  ownership_status text not null default 'not_checked',
  consent_version text not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  verified_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '90 days'),
  evidence_deletion_at timestamptz null,
  evidence_deleted_at timestamptz null,
  evidence_path text null,
  rejection_reason_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_verification_method_allowed
    check (method in ('campus_email', 'student_card')),
  constraint student_verification_status_allowed
    check (status in (
      'pending', 'under_review', 'needs_action', 'verified',
      'rejected', 'expired', 'cancelled'
    )),
  constraint student_verification_pddikti_status_allowed
    check (pddikti_match_status in (
      'not_checked', 'matched', 'not_found', 'mismatch', 'unavailable'
    )),
  constraint student_verification_ownership_status_allowed
    check (ownership_status in (
      'not_checked', 'campus_email_verified', 'document_verified', 'failed'
    )),
  constraint student_verification_campus_length
    check (char_length(btrim(campus_claim)) between 2 and 120),
  constraint student_verification_program_length
    check (char_length(btrim(study_program_claim)) between 2 and 120),
  constraint student_verification_degree_allowed
    check (degree_level_claim in (
      'diploma', 'sarjana', 'magister', 'doktor', 'profesi', 'spesialis'
    )),
  constraint student_verification_nim_last_four_format
    check (nim_last_four ~ '^[A-Z0-9]{4}$'),
  constraint student_verification_nim_fingerprint_format
    check (nim_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint student_verification_consent_version_length
    check (char_length(btrim(consent_version)) between 1 and 40),
  constraint student_verification_rejection_reason_allowed
    check (
      rejection_reason_code is null
      or rejection_reason_code in (
        'academic_not_found', 'academic_mismatch', 'registry_unavailable',
        'ownership_failed', 'evidence_unreadable',
        'additional_information_required'
      )
    ),
  constraint student_verification_evidence_method
    check (
      (
        method = 'student_card'
        and (evidence_path is not null or evidence_deleted_at is not null)
      )
      or (method = 'campus_email' and evidence_path is null)
    ),
  constraint student_verification_verified_requirements
    check (
      status <> 'verified'
      or (
        pddikti_match_status = 'matched'
        and ownership_status in ('campus_email_verified', 'document_verified')
        and verified_at is not null
      )
    ),
  constraint student_verification_review_timestamps
    check (
      (reviewed_at is null or reviewed_at >= submitted_at)
      and (verified_at is null or verified_at >= submitted_at)
      and expires_at > submitted_at
    )
);

create unique index student_verification_active_nim_idx
  on public.student_verification_requests (nim_fingerprint)
  where status in ('pending', 'under_review', 'needs_action', 'verified');
create unique index student_verification_active_user_idx
  on public.student_verification_requests (user_id)
  where status in ('pending', 'under_review', 'needs_action');
create index student_verification_user_created_idx
  on public.student_verification_requests (user_id, created_at desc);
create index student_verification_review_queue_idx
  on public.student_verification_requests (status, submitted_at)
  where status in ('pending', 'under_review', 'needs_action');
create index student_verification_evidence_deletion_idx
  on public.student_verification_requests (evidence_deletion_at)
  where evidence_deletion_at is not null and evidence_path is not null;

create table public.campus_email_domains (
  domain text primary key,
  campus_name text not null,
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campus_email_domain_format
    check (
      domain = lower(domain)
      and domain ~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,63}$'
    ),
  constraint campus_email_domain_campus_length
    check (char_length(btrim(campus_name)) between 2 and 120),
  constraint campus_email_domain_status_allowed
    check (status in ('pending_review', 'approved', 'rejected'))
);

create table public.campus_email_verifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.student_verification_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  resend_available_at timestamptz not null,
  verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campus_email_normalized
    check (normalized_email = lower(btrim(normalized_email))),
  constraint campus_email_length
    check (char_length(normalized_email) between 6 and 254),
  constraint campus_email_code_hash_format
    check (code_hash ~ '^[a-f0-9]{64}$'),
  constraint campus_email_attempts_range
    check (attempts between 0 and 5),
  constraint campus_email_expiry_order
    check (expires_at > created_at and resend_available_at >= created_at),
  constraint campus_email_verified_order
    check (verified_at is null or verified_at >= created_at)
);

create unique index campus_email_one_challenge_per_request_idx
  on public.campus_email_verifications (request_id);
create index campus_email_user_idx
  on public.campus_email_verifications (user_id);

create table public.verification_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.student_verification_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  created_at timestamptz not null default now(),
  constraint verification_event_type_allowed
    check (event_type in (
      'request_submitted', 'campus_email_sent', 'campus_email_verified',
      'review_started', 'action_requested', 'verification_approved',
      'verification_rejected', 'request_cancelled', 'request_expired'
    ))
);

create index verification_events_request_created_idx
  on public.verification_events (request_id, created_at);

drop trigger if exists student_verification_requests_set_updated_at
  on public.student_verification_requests;
create trigger student_verification_requests_set_updated_at
before update on public.student_verification_requests
for each row execute function public.set_updated_at();

drop trigger if exists campus_email_domains_set_updated_at
  on public.campus_email_domains;
create trigger campus_email_domains_set_updated_at
before update on public.campus_email_domains
for each row execute function public.set_updated_at();

drop trigger if exists campus_email_verifications_set_updated_at
  on public.campus_email_verifications;
create trigger campus_email_verifications_set_updated_at
before update on public.campus_email_verifications
for each row execute function public.set_updated_at();

alter table public.student_verification_requests enable row level security;
alter table public.campus_email_domains enable row level security;
alter table public.campus_email_verifications enable row level security;
alter table public.verification_events enable row level security;

revoke all on table public.student_verification_requests from public, anon, authenticated;
revoke all on table public.campus_email_domains from public, anon, authenticated;
revoke all on table public.campus_email_verifications from public, anon, authenticated;
revoke all on table public.verification_events from public, anon, authenticated;

grant select (
  id, user_id, method, status, campus_claim, study_program_claim,
  degree_level_claim, nim_last_four, pddikti_match_status, ownership_status,
  submitted_at, reviewed_at, verified_at, expires_at,
  evidence_deletion_at, evidence_deleted_at, rejection_reason_code,
  created_at, updated_at
) on table public.student_verification_requests to authenticated;

create policy "Verification requests are private to their owner"
on public.student_verification_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Campus evidence uploads use an owned request path"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-verification-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.student_verification_requests request
    where request.id::text = (storage.foldername(name))[2]
      and request.user_id = (select auth.uid())
      and request.evidence_path = name
      and request.method = 'student_card'
      and request.status in ('pending', 'needs_action')
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-verification-evidence',
  'student-verification-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

create or replace function public.cancel_student_verification_request(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.student_verification_requests
  set
    status = 'cancelled',
    evidence_deletion_at = case
      when evidence_path is null then null
      else now() + interval '24 hours'
    end
  where id = p_request_id
    and user_id = current_user_id
    and status in ('pending', 'needs_action');

  if not found then
    raise exception 'request not cancellable' using errcode = '42501';
  end if;

  update public.profiles
  set verification_status = 'unverified'
  where user_id = current_user_id;

  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  )
  values (
    p_request_id, current_user_id, current_user_id, 'request_cancelled'
  );
end;
$$;

revoke execute on function public.cancel_student_verification_request(uuid)
  from public, anon;
grant execute on function public.cancel_student_verification_request(uuid)
  to authenticated;

create or replace function public.create_student_verification_request(
  p_user_id uuid,
  p_request_id uuid,
  p_method text,
  p_campus_claim text,
  p_study_program_claim text,
  p_degree_level_claim text,
  p_nim_ciphertext bytea,
  p_nim_iv bytea,
  p_nim_auth_tag bytea,
  p_nim_last_four text,
  p_nim_fingerprint text,
  p_legal_name_ciphertext bytea,
  p_legal_name_iv bytea,
  p_legal_name_auth_tag bytea,
  p_consent_version text,
  p_evidence_path text
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

  if not exists (
    select 1 from public.profiles
    where user_id = p_user_id and onboarding_completed_at is not null
  ) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  insert into public.student_verification_requests (
    id, user_id, method, campus_claim, study_program_claim, degree_level_claim,
    nim_ciphertext, nim_iv, nim_auth_tag, nim_last_four, nim_fingerprint,
    legal_name_ciphertext, legal_name_iv, legal_name_auth_tag,
    consent_version, evidence_path,
    evidence_deletion_at
  )
  values (
    p_request_id, p_user_id, p_method, btrim(p_campus_claim),
    btrim(p_study_program_claim), p_degree_level_claim,
    p_nim_ciphertext, p_nim_iv, p_nim_auth_tag, p_nim_last_four,
    p_nim_fingerprint, p_legal_name_ciphertext, p_legal_name_iv,
    p_legal_name_auth_tag, btrim(p_consent_version), p_evidence_path,
    case
      when p_evidence_path is null then null
      else now() + interval '90 days'
    end
  );

  update public.profiles
  set verification_status = 'pending'
  where user_id = p_user_id;

  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  )
  values (p_request_id, p_user_id, p_user_id, 'request_submitted');

  return p_request_id;
end;
$$;

revoke execute on function public.create_student_verification_request(
  uuid, uuid, text, text, text, text, bytea, bytea, bytea, text, text,
  bytea, bytea, bytea, text, text
) from public, anon, authenticated;
grant execute on function public.create_student_verification_request(
  uuid, uuid, text, text, text, text, bytea, bytea, bytea, text, text,
  bytea, bytea, bytea, text, text
) to service_role;

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
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select *
  into challenge
  from public.campus_email_verifications
  where request_id = p_request_id
    and user_id = p_user_id
  for update;

  if challenge.id is null
    or challenge.verified_at is not null
    or challenge.expires_at <= now()
    or challenge.attempts >= p_max_attempts then
    return 'invalid';
  end if;

  if challenge.code_hash <> p_candidate_hash then
    update public.campus_email_verifications
    set attempts = least(attempts + 1, p_max_attempts)
    where id = challenge.id;
    return 'invalid';
  end if;

  update public.campus_email_verifications
  set verified_at = now()
  where id = challenge.id;

  update public.student_verification_requests
  set
    ownership_status = 'campus_email_verified',
    status = 'under_review',
    reviewed_at = coalesce(reviewed_at, now())
  where id = p_request_id
    and user_id = p_user_id
    and method = 'campus_email'
    and status in ('pending', 'needs_action');

  if not found then
    raise exception 'request is not eligible' using errcode = '42501';
  end if;

  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  )
  values (
    p_request_id, p_user_id, p_user_id, 'campus_email_verified'
  );

  return 'verified';
end;
$$;

revoke execute on function public.confirm_student_campus_email_code(
  uuid, uuid, text, smallint
) from public, anon, authenticated;
grant execute on function public.confirm_student_campus_email_code(
  uuid, uuid, text, smallint
) to service_role;

create or replace function public.finalize_student_verification_review(
  p_request_id uuid,
  p_actor_id uuid,
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
  target_user_id uuid;
  target_method text;
  event_name text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_request_status not in (
    'under_review', 'needs_action', 'verified', 'rejected', 'expired'
  ) then
    raise exception 'invalid review status' using errcode = '22023';
  end if;

  if p_request_status = 'verified' and not (
    p_pddikti_match_status = 'matched'
    and p_ownership_status in ('campus_email_verified', 'document_verified')
  ) then
    raise exception 'combined verification required' using errcode = '23514';
  end if;

  select user_id, method
  into target_user_id, target_method
  from public.student_verification_requests
  where id = p_request_id
  for update;

  if target_user_id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  if p_ownership_status = 'campus_email_verified'
    and target_method <> 'campus_email' then
    raise exception 'ownership method mismatch' using errcode = '23514';
  end if;

  if p_ownership_status = 'document_verified'
    and target_method <> 'student_card' then
    raise exception 'ownership method mismatch' using errcode = '23514';
  end if;

  update public.student_verification_requests
  set
    status = p_request_status,
    pddikti_match_status = p_pddikti_match_status,
    ownership_status = p_ownership_status,
    reviewed_at = now(),
    verified_at = case when p_request_status = 'verified' then now() else null end,
    evidence_deletion_at = case
      when evidence_path is null then null
      when p_request_status in ('verified', 'rejected', 'expired')
        then now() + interval '30 days'
      else evidence_deletion_at
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
  end
  where user_id = target_user_id;

  event_name := case p_request_status
    when 'under_review' then 'review_started'
    when 'needs_action' then 'action_requested'
    when 'verified' then 'verification_approved'
    when 'rejected' then 'verification_rejected'
    when 'expired' then 'request_expired'
  end;

  insert into public.verification_events (
    request_id, user_id, actor_id, event_type
  )
  values (p_request_id, target_user_id, p_actor_id, event_name);
end;
$$;

revoke execute on function public.finalize_student_verification_review(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.finalize_student_verification_review(
  uuid, uuid, text, text, text, text
) to service_role;
