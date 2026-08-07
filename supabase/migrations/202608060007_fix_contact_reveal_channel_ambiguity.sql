-- Fix Contact Reveal PL/pgSQL ambiguity between OUT column "channel" and table columns.
-- Forward-only after 202608060006. Does not change privacy model or client state shape.
-- Bare ON CONFLICT (... channel) targets conflict with RETURNS TABLE(channel ...).

create or replace function public.project_contact_reveal_channel_state(
  p_shell public.conversation_shells,
  p_user_id uuid,
  p_channel text
)
returns table (
  channel text,
  eligible boolean,
  has_contact boolean,
  selected_by_me boolean,
  completed boolean,
  completed_at timestamptz,
  can_withdraw boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  mine_active boolean := false;
  mine_has_contact boolean := false;
  is_completed boolean := false;
  is_eligible boolean := false;
  reveal_at timestamptz;
begin
  if p_shell.id is null
    or p_user_id is null
    or p_channel is null
    or p_channel not in ('telegram', 'instagram', 'linkedin') then
    return query
    select
      coalesce(p_channel, '')::text,
      false,
      false,
      false,
      false,
      null::timestamptz,
      false;
    return;
  end if;

  if p_user_id not in (p_shell.participant_sender_id, p_shell.participant_recipient_id) then
    return query
    select p_channel, false, false, false, false, null::timestamptz, false;
    return;
  end if;

  select candidate.revealed_at into reveal_at
  from public.conversation_contact_reveals candidate
  where candidate.conversation_id = p_shell.id
    and candidate.channel = p_channel
  limit 1;

  is_completed := reveal_at is not null;
  is_eligible := public.is_conversation_eligible_for_contact_reveal(p_shell.id, p_user_id);

  -- Active version for THIS conversation + this user + this channel only.
  select exists (
    select 1
    from public.conversation_contact_versions version_row
    where version_row.conversation_id = p_shell.id
      and version_row.owner_user_id = p_user_id
      and version_row.channel = p_channel
      and version_row.superseded_at is null
  ) into mine_has_contact;

  select exists (
    select 1
    from public.conversation_contact_reveal_consents consent
    where consent.conversation_id = p_shell.id
      and consent.participant_id = p_user_id
      and consent.channel = p_channel
      and consent.withdrawn_at is null
  ) into mine_active;

  -- CRITICAL: never inspect or return whether the counterpart prepared or consented.
  return query
  select
    p_channel,
    is_eligible and not is_completed,
    mine_has_contact,
    mine_active,
    is_completed,
    case when is_completed then reveal_at else null end,
    is_eligible and mine_active and not is_completed;
end;
$$;

create or replace function public.get_contact_reveal_state(p_public_id text)
returns table (
  channel text,
  eligible boolean,
  has_contact boolean,
  selected_by_me boolean,
  completed boolean,
  completed_at timestamptz,
  can_withdraw boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    return query
    select * from (
      values
        ('telegram'::text, false, false, false, false, null::timestamptz, false),
        ('instagram'::text, false, false, false, false, null::timestamptz, false),
        ('linkedin'::text, false, false, false, false, null::timestamptz, false)
    ) as empty_state(channel, eligible, has_contact, selected_by_me, completed, completed_at, can_withdraw);
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return query
    select * from (
      values
        ('telegram'::text, false, false, false, false, null::timestamptz, false),
        ('instagram'::text, false, false, false, false, null::timestamptz, false),
        ('linkedin'::text, false, false, false, false, null::timestamptz, false)
    ) as empty_state(channel, eligible, has_contact, selected_by_me, completed, completed_at, can_withdraw);
    return;
  end if;

  return query
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
end;
$$;

create or replace function public.get_contact_reveal_preview(
  p_public_id text,
  p_channel text
)
returns table (
  contact_version_id uuid,
  channel text,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    return;
  end if;

  if p_channel is null or p_channel not in ('telegram', 'instagram', 'linkedin') then
    return;
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  limit 1;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    return;
  end if;

  return query
  select
    version_row.id,
    version_row.channel,
    version_row.created_at
  from public.conversation_contact_versions version_row
  where version_row.conversation_id = shell.id
    and version_row.owner_user_id = current_user_id
    and version_row.channel = p_channel
    and version_row.superseded_at is null
  order by version_row.version_number desc
  limit 1;
end;
$$;

create or replace function public.select_contact_reveal(
  p_public_id text,
  p_channel text,
  p_contact_version_id uuid
)
returns table (
  channel text,
  eligible boolean,
  has_contact boolean,
  selected_by_me boolean,
  completed boolean,
  completed_at timestamptz,
  can_withdraw boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  counterpart_id uuid;
  version_row public.conversation_contact_versions%rowtype;
  sender_consent public.conversation_contact_reveal_consents%rowtype;
  recipient_consent public.conversation_contact_reveal_consents%rowtype;
  active_count integer;
  now_utc timestamptz := timezone('utc', now());
  already_completed boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if p_channel is null or p_channel not in ('telegram', 'instagram', 'linkedin') then
    raise exception 'invalid channel' using errcode = '22023';
  end if;

  if p_contact_version_id is null then
    raise exception 'contact reveal unavailable' using errcode = 'P0001';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  for update;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if shell.status in ('ended', 'blocked') then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  counterpart_id := public.conversation_counterpart_id(shell.id, current_user_id);

  if public.users_are_blocked(current_user_id, counterpart_id) then
    update public.conversation_shells
    set status = 'blocked',
        ended_at = coalesce(ended_at, now_utc),
        ended_by = coalesce(ended_by, current_user_id)
    where id = shell.id;
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.conversation_contact_reveals reveal
    where reveal.conversation_id = shell.id
      and reveal.channel = p_channel
  ) into already_completed;

  -- Already completed for this channel: idempotent safe projection (no further consent mutations).
  if already_completed then
    return query
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
    union all
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
    union all
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
    return;
  end if;

  if not public.is_conversation_eligible_for_contact_reveal(shell.id, current_user_id) then
    raise exception 'contact reveal unavailable' using errcode = 'P0001';
  end if;

  select * into version_row
  from public.conversation_contact_versions candidate
  where candidate.id = p_contact_version_id
  for update;

  -- Must be owned by caller, same conversation + channel, and not superseded.
  if version_row.id is null
    or version_row.owner_user_id <> current_user_id
    or version_row.conversation_id <> shell.id
    or version_row.channel <> p_channel
    or version_row.superseded_at is not null then
    raise exception 'contact reveal unavailable' using errcode = 'P0001';
  end if;

  insert into public.conversation_contact_reveal_consents (
    conversation_id,
    participant_id,
    channel,
    contact_version_id,
    consented_at,
    withdrawn_at,
    created_at,
    updated_at
  )
  values (
    shell.id,
    current_user_id,
    p_channel,
    version_row.id,
    now_utc,
    null,
    now_utc,
    now_utc
  )
  on conflict on constraint conversation_contact_reveal_consents_unique_participant_channel
  do update set
    contact_version_id = excluded.contact_version_id,
    consented_at = case
      when conversation_contact_reveal_consents.withdrawn_at is null
        then conversation_contact_reveal_consents.consented_at
      else excluded.consented_at
    end,
    withdrawn_at = null,
    updated_at = now_utc;

  -- Lock active consent rows for this channel before counting / completing.
  perform 1
  from public.conversation_contact_reveal_consents consent
  where consent.conversation_id = shell.id
    and consent.channel = p_channel
    and consent.withdrawn_at is null
    and consent.participant_id in (
      shell.participant_sender_id,
      shell.participant_recipient_id
    )
  for update;

  select count(*) into active_count
  from public.conversation_contact_reveal_consents consent
  where consent.conversation_id = shell.id
    and consent.channel = p_channel
    and consent.withdrawn_at is null
    and consent.participant_id in (
      shell.participant_sender_id,
      shell.participant_recipient_id
    );

  if active_count >= 2 then
    select * into sender_consent
    from public.conversation_contact_reveal_consents consent
    where consent.conversation_id = shell.id
      and consent.participant_id = shell.participant_sender_id
      and consent.channel = p_channel
      and consent.withdrawn_at is null
    for update;

    select * into recipient_consent
    from public.conversation_contact_reveal_consents consent
    where consent.conversation_id = shell.id
      and consent.participant_id = shell.participant_recipient_id
      and consent.channel = p_channel
      and consent.withdrawn_at is null
    for update;

    if sender_consent.id is null or recipient_consent.id is null then
      raise exception 'contact reveal unavailable' using errcode = 'P0001';
    end if;

    -- Ensure both contact versions are still active, owned correctly, and scoped to this conversation + channel.
    if not exists (
      select 1 from public.conversation_contact_versions v
      where v.id = sender_consent.contact_version_id
        and v.conversation_id = shell.id
        and v.owner_user_id = shell.participant_sender_id
        and v.channel = p_channel
        and v.superseded_at is null
    ) or not exists (
      select 1 from public.conversation_contact_versions v
      where v.id = recipient_consent.contact_version_id
        and v.conversation_id = shell.id
        and v.owner_user_id = shell.participant_recipient_id
        and v.channel = p_channel
        and v.superseded_at is null
    ) then
      raise exception 'contact reveal unavailable' using errcode = 'P0001';
    end if;

    insert into public.conversation_contact_reveals (
      conversation_id,
      channel,
      sender_contact_version_id,
      recipient_contact_version_id,
      revealed_at
    )
    values (
      shell.id,
      p_channel,
      sender_consent.contact_version_id,
      recipient_consent.contact_version_id,
      now_utc
    )
    on conflict on constraint conversation_contact_reveals_pkey do nothing;

    if not exists (
      select 1
      from public.conversation_events event
      where event.conversation_id = shell.id
        and event.event_type = 'contact_revealed'
        and event.event_channel = p_channel
    ) then
      insert into public.conversation_events (
        conversation_id,
        actor_id,
        event_type,
        event_channel
      )
      values (
        shell.id,
        current_user_id,
        'contact_revealed',
        p_channel
      );
    end if;
  end if;

  select * into shell
  from public.conversation_shells
  where id = shell.id;

  return query
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
end;
$$;

create or replace function public.withdraw_contact_reveal(
  p_public_id text,
  p_channel text
)
returns table (
  channel text,
  eligible boolean,
  has_contact boolean,
  selected_by_me boolean,
  completed boolean,
  completed_at timestamptz,
  can_withdraw boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  current_user_id uuid := auth.uid();
  shell public.conversation_shells%rowtype;
  now_utc timestamptz := timezone('utc', now());
  already_completed boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.is_eligible_introduction_student(current_user_id) then
    raise exception 'onboarding required' using errcode = '42501';
  end if;

  if p_public_id is null or p_public_id !~ '^[0-9a-f]{32}$' then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  if p_channel is null or p_channel not in ('telegram', 'instagram', 'linkedin') then
    raise exception 'invalid channel' using errcode = '22023';
  end if;

  select * into shell
  from public.conversation_shells candidate
  where candidate.public_id = p_public_id
  for update;

  if shell.id is null
    or current_user_id not in (shell.participant_sender_id, shell.participant_recipient_id) then
    raise exception 'conversation unavailable' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.conversation_contact_reveals reveal
    where reveal.conversation_id = shell.id
      and reveal.channel = p_channel
  ) into already_completed;

  if already_completed then
    return query
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
    union all
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
    union all
    select *
    from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
    return;
  end if;

  if shell.status in ('ended', 'blocked') then
    raise exception 'conversation closed' using errcode = 'P0001';
  end if;

  update public.conversation_contact_reveal_consents consent
  set withdrawn_at = now_utc,
      updated_at = now_utc
  where consent.conversation_id = shell.id
    and consent.participant_id = current_user_id
    and consent.channel = p_channel
    and consent.withdrawn_at is null;

  select * into shell
  from public.conversation_shells
  where id = shell.id;

  return query
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'telegram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'instagram')
  union all
  select *
  from public.project_contact_reveal_channel_state(shell, current_user_id, 'linkedin');
end;
$$;

revoke all on function public.project_contact_reveal_channel_state(
  public.conversation_shells, uuid, text
) from public, anon, authenticated;

revoke all on function public.get_contact_reveal_state(text) from public, anon;
grant execute on function public.get_contact_reveal_state(text) to authenticated;

revoke all on function public.get_contact_reveal_preview(text, text) from public, anon;
grant execute on function public.get_contact_reveal_preview(text, text) to authenticated;

revoke all on function public.select_contact_reveal(text, text, uuid) from public, anon;
grant execute on function public.select_contact_reveal(text, text, uuid) to authenticated;

revoke all on function public.withdraw_contact_reveal(text, text) from public, anon;
grant execute on function public.withdraw_contact_reveal(text, text) to authenticated;

