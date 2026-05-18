-- Tabela de eventos da súmula (gols + cartões)
CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('goal','yellow_card','red_card')),
  minute integer CHECK (minute IS NULL OR (minute >= 0 AND minute <= 200)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_events_match ON public.match_events(match_id);
CREATE INDEX idx_match_events_athlete ON public.match_events(athlete_id);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- Leitura pública
CREATE POLICY "match_events public read"
  ON public.match_events FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin pode tudo
CREATE POLICY "match_events admin all"
  ON public.match_events FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Mandante pode escrever enquanto súmula não foi confirmada
-- (escrita real acontece via server fn com supabaseAdmin; policies aqui são backstop)
CREATE POLICY "match_events host manager write"
  ON public.match_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.teams t ON t.id = m.host_team_id
      WHERE m.id = match_events.match_id
        AND t.manager_id = auth.uid()
        AND m.status IN ('scheduled','awaiting_confirmation')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.teams t ON t.id = m.host_team_id
      WHERE m.id = match_events.match_id
        AND t.manager_id = auth.uid()
        AND m.status IN ('scheduled','awaiting_confirmation')
    )
  );