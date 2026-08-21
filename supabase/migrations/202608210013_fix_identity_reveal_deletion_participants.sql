-- Fix migration 012 participant column names in the effective functions.

create or replace function public.list_account_deletion_storage_objects(
  p_request_id uuid,
  p_lease_token uuid
)
returns table (bucket_name text, object_key text)
language plpgsql
stable
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
    and deletion.lease_expires_at >= timezone('utc', now());

  if not found then
    raise exception 'deletion lease unavailable' using errcode = '42501';
  end if;
  if target_user_id is null and cleanup_done then return; end if;
  if target_user_id is null then
    raise exception 'deletion target unavailable' using errcode = '42501';
  end if;

  return query
  with affected_conversations as (
    select shell.id
    from public.conversation_shells shell
    where shell.participant_sender_id = target_user_id
       or shell.participant_recipient_id = target_user_id
  )
  select 'identity-reveal-photos'::text, version.photo_object_key
  from public.identity_reveal_profile_versions version
  join affected_conversations affected
    on affected.id = version.conversation_id
  union
  select 'student-verification-evidence'::text, request.evidence_path
  from public.student_verification_requests request
  where request.user_id = target_user_id
    and request.evidence_path is not null
  union
  select
    'student-verification-evidence'::text,
    request.pddikti_evidence_path
  from public.student_verification_requests request
  where request.user_id = target_user_id
    and request.pddikti_evidence_path is not null;
end;
$$;

revoke all on function public.list_account_deletion_storage_objects(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.list_account_deletion_storage_objects(uuid, uuid)
  to service_role;

create or replace function public.purge_identity_reveal_for_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.conversation_identity_reveals reveal
  where reveal.conversation_id in (
    select shell.id
    from public.conversation_shells shell
    where shell.participant_sender_id = old.user_id
       or shell.participant_recipient_id = old.user_id
  );

  delete from public.conversation_identity_reveal_consents consent
  where consent.conversation_id in (
    select shell.id
    from public.conversation_shells shell
    where shell.participant_sender_id = old.user_id
       or shell.participant_recipient_id = old.user_id
  );

  delete from public.identity_reveal_profile_versions version
  where version.conversation_id in (
    select shell.id
    from public.conversation_shells shell
    where shell.participant_sender_id = old.user_id
       or shell.participant_recipient_id = old.user_id
  );

  update public.conversation_shells shell
  set identity_revealed_at = null
  where shell.participant_sender_id = old.user_id
     or shell.participant_recipient_id = old.user_id;

  return old;
end;
$$;

revoke all on function public.purge_identity_reveal_for_deleted_profile()
  from public, anon, authenticated;
