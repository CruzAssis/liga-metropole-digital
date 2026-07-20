SELECT cron.schedule(
  'close-voting-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://liga-metropole-digital.lovable.app/api/public/hooks/close-voting',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);