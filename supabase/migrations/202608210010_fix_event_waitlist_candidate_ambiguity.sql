-- Forward fix: PL/pgSQL record `candidate` conflicted with a SQL table alias.

create or replace function public.promote_campus_event_waitlist(p_event_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare event_row public.campus_events%rowtype; next_user uuid; going_count integer;
  next_joined_at timestamptz; queue_candidate record; joined_active integer;
begin
  select * into event_row from public.campus_events target_event
  where target_event.id = p_event_id for update;
  if event_row.id is null or event_row.status <> 'scheduled'
    or event_row.starts_at <= timezone('utc', now())
    or not public.is_campus_event_student(event_row.organizer_user_id)
    then return null; end if;
  select count(*)::integer into going_count from public.campus_event_rsvps rsvp
  where rsvp.event_id = event_row.id and rsvp.status = 'going';
  if going_count >= event_row.capacity then return null; end if;
  for queue_candidate in
    select waiting.user_id, waiting.joined_at
    from public.campus_event_waitlist waiting
    join public.profiles candidate_profile
      on candidate_profile.user_id = waiting.user_id
    where waiting.event_id = event_row.id and waiting.status = 'waiting'
      and public.is_campus_event_student(waiting.user_id)
      and (
        event_row.scope = 'open'
        or event_row.campus_scope = candidate_profile.campus
      )
      and not public.users_are_blocked(
        waiting.user_id, event_row.organizer_user_id
      )
      and not exists (
        select 1 from public.campus_event_rsvps existing
        where existing.event_id = event_row.id
          and existing.user_id = waiting.user_id
          and existing.status = 'going'
      )
    order by waiting.joined_at, waiting.user_id
    for update of waiting skip locked
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      queue_candidate.user_id::text || ':event-rsvp-quota', 0
    ));
    select count(*)::integer into joined_active
    from public.campus_event_rsvps active_rsvp
    join public.campus_events active_event on active_event.id = active_rsvp.event_id
    where active_rsvp.user_id = queue_candidate.user_id
      and active_rsvp.status = 'going'
      and active_event.status = 'scheduled'
      and active_event.starts_at > timezone('utc', now());
    if joined_active < public.event_membership_limit(
      public.effective_membership_plan(queue_candidate.user_id),
      'joined_events_active'
    ) then
      next_user := queue_candidate.user_id;
      next_joined_at := queue_candidate.joined_at;
      exit;
    end if;
  end loop;
  if next_user is null then return null; end if;
  insert into public.campus_event_rsvps (
    event_id, user_id, status, rsvped_at, cancelled_at
  ) values (
    event_row.id, next_user, 'going', timezone('utc', now()), null
  )
  on conflict (event_id, user_id) do update set status = 'going',
    rsvped_at = timezone('utc', now()), cancelled_at = null;
  update public.campus_event_waitlist set status = 'promoted',
    promoted_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where event_id = event_row.id and user_id = next_user;
  perform public.emit_user_notification(
    next_user, 'EVENT_WAITLIST_PROMOTED',
    '/app/events/' || event_row.public_slug,
    jsonb_build_object(
      'title',
      public.notification_safe_label(event_row.title, 100, 'Campus Event')
    ),
    'event_waitlist_promoted:' || event_row.id::text || ':' || next_user::text
      || ':' || extract(epoch from next_joined_at)::text
  );
  return next_user;
end; $$;

revoke all on function public.promote_campus_event_waitlist(uuid)
  from public, anon, authenticated;
