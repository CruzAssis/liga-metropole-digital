-- ================================================================
-- Conference System by Subprefeitura
-- feat: conference system by subprefeitura
-- ================================================================

-- 1. Create zona enum
DO $$ BEGIN
CREATE TYPE public.zona_enum AS ENUM ('norte', 'sul', 'leste', 'oeste', 'centro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add conference columns to competitions
ALTER TABLE public.competitions
ADD COLUMN IF NOT EXISTS conference_name text,
ADD COLUMN IF NOT EXISTS subprefeitura text,
ADD COLUMN IF NOT EXISTS zona public.zona_enum,
ADD COLUMN IF NOT EXISTS conference_number int;

-- 3. Index for fast filtering by subprefeitura and zona
CREATE INDEX IF NOT EXISTS idx_competitions_subprefeitura ON public.competitions(subprefeitura);
CREATE INDEX IF NOT EXISTS idx_competitions_zona ON public.competitions(zona);

-- 4. Seed: Conferência Norte 1 — Vila Maria/Vila Guilherme
-- status uses 'enrollment' (valid value per competitions_status_check constraint)
INSERT INTO public.competitions (
    name,
    season,
    status,
    registration_status,
    max_teams,
    host_slots,
    visitor_slots,
    conference_name,
    subprefeitura,
    zona,
    conference_number
  )
VALUES (
    'Liga Metrópole — Conferência Norte 1',
    2026,
    'enrollment',
    'open',
    80,
    40,
    40,
    'Conferência Norte 1',
    'Vila Maria/Vila Guilherme',
    'norte',
    1
  )
ON CONFLICT DO NOTHING;

-- 5. RLS: conference columns are readable by everyone (covered by existing public read policy)
-- No additional RLS needed.
