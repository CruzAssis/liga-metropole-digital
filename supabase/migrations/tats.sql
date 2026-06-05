-- ================================================================
-- Atleta Profile: statistics view for /atletas/:id public page
-- feat: public player profile with QR code
-- ================================================================

-- View: aggregate stats per athlete from confirmed matches
CREATE OR REPLACE VIEW public.atleta_stats AS
SELECT
  a.id AS athlete_id,

  -- Jogos: distinct matches where athlete has an event
  (
    SELECT COUNT(DISTINCT me.match_id)
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    WHERE me.athlete_id = a.id
      AND m.status IN ('confirmed', 'wo', 'finished')
  ) AS jogos,

  -- Gols
  (
    SELECT COUNT(*)
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    WHERE me.athlete_id = a.id
      AND me.kind = 'goal'
      AND m.status IN ('confirmed', 'wo', 'finished')
  ) AS gols,

  -- Assistências
  (
    SELECT COUNT(*)
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    WHERE me.athlete_id = a.id
      AND me.kind = 'assist'
      AND m.status IN ('confirmed', 'wo', 'finished')
  ) AS assistencias,

  -- Vezes eleito destaque (match_destaques_publicados via jersey_number match is unreliable;
  -- use match_best_opponent_votes where opponent_athlete_id = athlete)
  (
    SELECT COUNT(*)
    FROM public.match_best_opponent_votes mbov
    WHERE mbov.opponent_athlete_id = a.id
  ) AS vezes_destaque,

  -- Média de nota (from match_best_opponent_votes)
  (
    SELECT ROUND(AVG(mbov.rating)::numeric, 2)
    FROM public.match_best_opponent_votes mbov
    WHERE mbov.opponent_athlete_id = a.id
  ) AS media_nota

FROM public.athletes a;

-- RLS: view inherits athletes public read
GRANT SELECT ON public.atleta_stats TO anon, authenticated;

-- Index to speed up team_members lookup for multi-team display
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_athlete_id ON public.team_members(team_id);
