
-- Bloco 9: App do Torcedor - votação de craque pelo torcedor
CREATE TABLE public.supporter_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX supporter_votes_match_idx ON public.supporter_votes(match_id);
CREATE INDEX supporter_votes_athlete_idx ON public.supporter_votes(athlete_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supporter_votes TO authenticated;
GRANT ALL ON public.supporter_votes TO service_role;

ALTER TABLE public.supporter_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own supporter votes"
  ON public.supporter_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER supporter_votes_updated_at
  BEFORE UPDATE ON public.supporter_votes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Aggregate function: torcedor MVP per match
CREATE OR REPLACE FUNCTION public.get_supporter_mvp(_match_id uuid)
RETURNS TABLE(athlete_id uuid, full_name text, nickname text, photo_url text, team_id uuid, avg_rating numeric, total_votes integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.full_name, a.nickname, a.photo_url, a.team_id,
         ROUND(AVG(v.rating)::numeric, 2), COUNT(*)::int
  FROM public.supporter_votes v
  JOIN public.athletes a ON a.id = v.athlete_id
  WHERE v.match_id = _match_id
  GROUP BY a.id
  ORDER BY AVG(v.rating) DESC, COUNT(*) DESC;
$$;

REVOKE ALL ON FUNCTION public.get_supporter_mvp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_supporter_mvp(uuid) TO authenticated, service_role;
