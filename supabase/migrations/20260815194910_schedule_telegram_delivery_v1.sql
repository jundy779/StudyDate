create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'studydate-telegram-delivery-v1';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'studydate-telegram-delivery-v1',
  '* * * * *',
  $$
  select net.http_get(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'studydate_production_url'
    ) || '/api/internal/telegram/delivery',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'studydate_telegram_cron_secret'
      )
    ),
    timeout_milliseconds := 25000
  );
  $$
);
