-- Tabela de votos de "Melhor jogador adversário" por jogo
CREATE TABLE public.match_best_opponent_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL,
  voter_team_id uuid NOT NULL,
  opponent_team_id uuid NOT NULL,
  jersey_number integer NOT NULL CHECK (jersey_number >= 0 AND jersey_number <= 999),
  rating numeric(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
  note text,
  opponent_athlete_id uuid,
  identified_name text,
  identified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (match_id, voter_team_id)
);

CREATE INDEX idx_mbov_match ON public.match_best_opponent_votes(match_id);
CREATE INDEX idx_mbov_opponent ON public.match_best_opponent_votes(opponent_team_id);

ALTER TABLE public.match_best_opponent_votes ENABLE ROW LEVEL SECURITY;

-- Leitura pública (mesma política dos outros dados do jogo)
CREATE POLICY "mbov public read"
ON public.match_best_opponent_votes FOR SELECT
TO anon, authenticated
USING (true);

-- Admin total
CREATE POLICY "mbov admin all"
ON public.match_best_opponent_votes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Voter (manager do voter_team) pode INSERIR enquanto a partida está aberta
CREATE POLICY "mbov voter insert"
ON public.match_best_opponent_votes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = voter_team_id AND t.manager_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND m.status IN ('scheduled','awaiting_confirmation','confirmed')
      AND (m.host_team_id = voter_team_id OR m.visitor_team_id = voter_team_id)
      AND (m.host_team_id = opponent_team_id OR m.visitor_team_id = opponent_team_id)
      AND voter_team_id <> opponent_team_id
  )
);

-- Voter pode atualizar seu próprio voto (jersey/rating/note) enquanto a partida não está encerrada
CREATE POLICY "mbov voter update"
ON public.match_best_opponent_votes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = voter_team_id AND t.manager_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = voter_team_id AND t.manager_id = auth.uid()
  )
);

-- Manager do opponent_team pode atualizar para identificar o jogador (nome/atleta)
CREATE POLICY "mbov opponent identify"
ON public.match_best_opponent_votes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = opponent_team_id AND t.manager_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = opponent_team_id AND t.manager_id = auth.uid()
  )
);

CREATE TRIGGER set_updated_at_mbov
BEFORE UPDATE ON public.match_best_opponent_votes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();