
-- 1) Add discipline rules to competitions
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS yellows_for_suspension int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS red_suspension_games int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS direct_red_suspension_games int NOT NULL DEFAULT 2;

-- 2) Suspensions table
CREATE TABLE IF NOT EXISTS public.disciplinary_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  origin_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('accum_yellow','red_card','direct_red','manual')),
  games_total int NOT NULL DEFAULT 1,
  games_remaining int NOT NULL DEFAULT 1,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.disciplinary_suspensions TO authenticated;
GRANT ALL ON public.disciplinary_suspensions TO service_role;

ALTER TABLE public.disciplinary_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suspensions readable by team members and admins"
  ON public.disciplinary_suspensions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_team_member(auth.uid(), team_id)
  );

CREATE POLICY "Admins manage suspensions"
  ON public.disciplinary_suspensions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_suspensions_athlete_active
  ON public.disciplinary_suspensions(athlete_id, active);
CREATE INDEX IF NOT EXISTS idx_suspensions_team_active
  ON public.disciplinary_suspensions(team_id, active);

CREATE TRIGGER trg_suspensions_updated_at
  BEFORE UPDATE ON public.disciplinary_suspensions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Stats function per athlete per competition
CREATE OR REPLACE FUNCTION public.get_athlete_discipline(_athlete_id uuid, _competition_id uuid DEFAULT NULL)
RETURNS TABLE(
  yellows int, reds int, direct_reds int,
  active_suspension_games int, has_active_suspension boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ev AS (
    SELECT e.kind
    FROM public.match_events e
    JOIN public.matches m ON m.id = e.match_id
    WHERE e.athlete_id = _athlete_id
      AND m.status IN ('confirmed','closed')
      AND (_competition_id IS NULL OR m.competition_id = _competition_id)
  ),
  susp AS (
    SELECT COALESCE(SUM(games_remaining),0)::int AS games
    FROM public.disciplinary_suspensions
    WHERE athlete_id = _athlete_id
      AND active = true
      AND (_competition_id IS NULL OR competition_id = _competition_id)
  )
  SELECT
    COALESCE(SUM(CASE WHEN ev.kind='yellow_card' THEN 1 ELSE 0 END),0)::int,
    COALESCE(SUM(CASE WHEN ev.kind='red_card' THEN 1 ELSE 0 END),0)::int,
    COALESCE(SUM(CASE WHEN ev.kind='direct_red' THEN 1 ELSE 0 END),0)::int,
    (SELECT games FROM susp),
    (SELECT games FROM susp) > 0
  FROM ev;
$$;

REVOKE ALL ON FUNCTION public.get_athlete_discipline(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_athlete_discipline(uuid, uuid) TO authenticated, service_role;

-- 4) List of currently-suspended athletes for a team
CREATE OR REPLACE FUNCTION public.get_team_suspensions(_team_id uuid)
RETURNS TABLE(
  athlete_id uuid, full_name text, nickname text,
  reason text, games_remaining int, origin_match_id uuid, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.athlete_id, a.full_name, a.nickname,
         s.reason, s.games_remaining, s.origin_match_id, s.created_at
  FROM public.disciplinary_suspensions s
  JOIN public.athletes a ON a.id = s.athlete_id
  WHERE s.team_id = _team_id AND s.active = true
  ORDER BY s.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_team_suspensions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_suspensions(uuid) TO authenticated, service_role;
