
-- Slug para perfil público
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Backfill: slug a partir de short_name (ou name como fallback)
UPDATE public.teams
SET slug = lower(regexp_replace(coalesce(nullif(short_name, ''), name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Garante unicidade adicionando sufixo numérico em duplicatas
WITH dups AS (
    SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
    FROM public.teams
  )
UPDATE public.teams t
SET slug = t.slug || '-' || dups.rn
FROM dups
WHERE t.id = dups.id AND dups.rn > 1;

-- Log de notificações (evita duplicatas)
CREATE TABLE IF NOT EXISTS public.notification_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    sent_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(match_id, user_id, kind)
  );

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_log admin read" ON public.notification_log;
CREATE POLICY "notification_log admin read"
ON public.notification_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
