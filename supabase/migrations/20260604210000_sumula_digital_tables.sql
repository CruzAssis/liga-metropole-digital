-- ================================================================
-- Súmula Digital: tabelas de suporte
-- feat: complete digital sumula flow
-- ================================================================

-- 1. Coluna questionamento_arbitragem em matches
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS questionamento_arbitragem text;

-- 2. Destaque próprio: cada time escolhe 1 destaque da PRÓPRIA equipe (Etapa 2)
CREATE TABLE IF NOT EXISTS public.match_best_own_votes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id      uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  athlete_id    uuid REFERENCES public.athletes(id) ON DELETE SET NULL,
  jersey_number int  NOT NULL CHECK (jersey_number BETWEEN 1 AND 99),
  identified_name text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT uq_best_own_vote_per_team UNIQUE (match_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_match_best_own_votes_match ON public.match_best_own_votes(match_id);

-- RLS
ALTER TABLE public.match_best_own_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read match_best_own_votes"
  ON public.match_best_own_votes FOR SELECT USING (true);

CREATE POLICY "Authenticated write match_best_own_votes"
  ON public.match_best_own_votes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Destaques publicados publicamente após Etapa 3 completa
CREATE TABLE IF NOT EXISTS public.match_destaques_publicados (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id      uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  jersey_number int  NOT NULL CHECK (jersey_number BETWEEN 1 AND 99),
  identified_name text,
  rating        int  NOT NULL CHECK (rating BETWEEN 1 AND 10),
  published_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_destaque_publicado_per_team UNIQUE (match_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_match_destaques_match ON public.match_destaques_publicados(match_id);

-- RLS
ALTER TABLE public.match_destaques_publicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read match_destaques_publicados"
  ON public.match_destaques_publicados FOR SELECT USING (true);

CREATE POLICY "Authenticated write match_destaques_publicados"
  ON public.match_destaques_publicados FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
