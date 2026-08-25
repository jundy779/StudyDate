create or replace function public.validate_campus_event_registration_answers(
  p_event_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  answers jsonb := coalesce(p_answers, '{}'::jsonb);
  question_row record;
  answer jsonb;
  item jsonb;
begin
  if jsonb_typeof(answers) <> 'object' or octet_length(answers::text) > 12000 then
    raise exception 'invalid registration answers' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(answers) as answer_key(key)
    where answer_key.key !~ '^[0-9a-f]{32}$'
      or not exists (
        select 1 from public.event_registration_questions registration_question
        where registration_question.event_id = p_event_id
          and registration_question.public_id = answer_key.key
      )
  ) then raise exception 'unknown registration answer' using errcode = '22023'; end if;
  for question_row in
    select * from public.event_registration_questions registration_question
    where registration_question.event_id = p_event_id
    order by registration_question.sort_order
  loop
    answer := answers -> question_row.public_id;
    if question_row.is_required and (
      answer is null or answer = 'null'::jsonb
      or (jsonb_typeof(answer) = 'string' and btrim(answer #>> '{}') = '')
      or (jsonb_typeof(answer) = 'array' and jsonb_array_length(answer) = 0)
      or (question_row.question_type = 'checkbox' and answer <> 'true'::jsonb)
    ) then raise exception 'required registration answer missing' using errcode = '22023'; end if;
    if answer is null then continue; end if;
    if question_row.question_type = 'short_text' and (
      jsonb_typeof(answer) <> 'string'
      or char_length(btrim(answer #>> '{}')) > 500
      or (answer #>> '{}') ~ '<[^>]+>'
      or public.event_registration_answer_has_contact(answer #>> '{}')
    ) then raise exception 'invalid short answer' using errcode = '22023'; end if;
    if question_row.question_type = 'single_select' and (
      jsonb_typeof(answer) <> 'string'
      or not question_row.options @> jsonb_build_array(answer)
    ) then raise exception 'invalid single selection' using errcode = '22023'; end if;
    if question_row.question_type = 'multi_select' then
      if jsonb_typeof(answer) <> 'array' or jsonb_array_length(answer) > 12 then
        raise exception 'invalid multi selection' using errcode = '22023';
      end if;
      for item in select value from jsonb_array_elements(answer)
      loop
        if jsonb_typeof(item) <> 'string'
          or not question_row.options @> jsonb_build_array(item) then
          raise exception 'invalid multi selection' using errcode = '22023';
        end if;
      end loop;
    end if;
    if question_row.question_type = 'checkbox'
      and jsonb_typeof(answer) <> 'boolean' then
      raise exception 'invalid checkbox answer' using errcode = '22023';
    end if;
  end loop;
  return answers;
end;
$$;

revoke all on function public.validate_campus_event_registration_answers(uuid, jsonb)
  from public, anon, authenticated;
