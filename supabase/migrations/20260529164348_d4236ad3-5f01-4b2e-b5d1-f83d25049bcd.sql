
DO $$ BEGIN
  CREATE TYPE public.team_side AS ENUM ('A', 'B');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.team_serie AS ENUM ('A', 'B');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS lado public.team_side NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS serie public.team_serie NOT NULL DEFAULT 'A';

CREATE INDEX IF NOT EXISTS idx_teams_lado ON public.teams(lado);
CREATE INDEX IF NOT EXISTS idx_teams_serie ON public.teams(serie);
CREATE INDEX IF NOT EXISTS idx_teams_pote ON public.teams(serie, registration_type, lado);
