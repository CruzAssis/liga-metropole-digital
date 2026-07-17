
CREATE OR REPLACE FUNCTION public.get_athlete_stats(_athlete_id uuid)
RETURNS TABLE(avg_rating numeric, total_evaluations integer, goals integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(ROUND(AVG(v.rating)::numeric, 1), 0)::numeric AS avg_rating,
    COUNT(v.*)::int AS total_evaluations,
    COALESCE((
      SELECT COUNT(*)::int
      FROM public.match_events e
      JOIN public.matches m2 ON m2.id = e.match_id
      WHERE e.kind = 'goal'
        AND e.athlete_id = _athlete_id
        AND m2.status IN ('closed','confirmed')
    ), 0) AS goals
  FROM public.match_best_opponent_votes v
  JOIN public.matches m ON m.id = v.match_id
  WHERE v.opponent_athlete_id = _athlete_id
    AND m.status IN ('closed','confirmed');
$$;

GRANT EXECUTE ON FUNCTION public.get_athlete_stats(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_ranking_craques(_min_evaluations integer DEFAULT 3)
RETURNS TABLE(
  athlete_id uuid,
  full_name text,
  nickname text,
  photo_url text,
  "position" text,
  team_id uuid,
  team_name text,
  team_short_name text,
  team_primary_color text,
  avg_rating numeric,
  total_evaluations integer,
  goals integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ratings AS (
    SELECT v.opponent_athlete_id AS athlete_id,
           ROUND(AVG(v.rating)::numeric, 1) AS avg_rating,
           COUNT(*)::int AS total_evaluations
    FROM public.match_best_opponent_votes v
    JOIN public.matches m ON m.id = v.match_id
    WHERE v.opponent_athlete_id IS NOT NULL
      AND m.status IN ('closed','confirmed')
    GROUP BY v.opponent_athlete_id
  ),
  goals_agg AS (
    SELECT e.athlete_id, COUNT(*)::int AS goals
    FROM public.match_events e
    JOIN public.matches m ON m.id = e.match_id
    WHERE e.kind = 'goal'
      AND e.athlete_id IS NOT NULL
      AND m.status IN ('closed','confirmed')
    GROUP BY e.athlete_id
  )
  SELECT
    a.id, a.full_name, a.nickname, a.photo_url, a."position",
    a.team_id, t.name, t.short_name, t.primary_color,
    r.avg_rating,
    r.total_evaluations,
    COALESCE(g.goals, 0)
  FROM public.athletes a
  JOIN ratings r ON r.athlete_id = a.id
  LEFT JOIN goals_agg g ON g.athlete_id = a.id
  LEFT JOIN public.teams t ON t.id = a.team_id
  WHERE r.total_evaluations >= _min_evaluations
  ORDER BY r.avg_rating DESC NULLS LAST,
           r.total_evaluations DESC,
           COALESCE(g.goals, 0) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking_craques(integer) TO anon, authenticated;
