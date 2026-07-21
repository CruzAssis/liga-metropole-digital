
-- Referees
CREATE TABLE public.referees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  nickname text,
  whatsapp text,
  city text,
  photo_url text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referees TO anon, authenticated;
GRANT ALL ON public.referees TO service_role;
ALTER TABLE public.referees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active referees"
  ON public.referees FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage referees"
  ON public.referees FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_referees_updated
  BEFORE UPDATE ON public.referees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Match referees (assignments)
CREATE TABLE public.match_referees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.referees(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'principal' CHECK (role IN ('principal','assistente_1','assistente_2','mesa','reserva')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, role),
  UNIQUE (match_id, referee_id)
);
GRANT SELECT ON public.match_referees TO anon, authenticated;
GRANT ALL ON public.match_referees TO service_role;
ALTER TABLE public.match_referees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads match referees"
  ON public.match_referees FOR SELECT USING (true);
CREATE POLICY "Admins manage match referees"
  ON public.match_referees FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Referee ratings
CREATE TABLE public.referee_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.referees(id) ON DELETE CASCADE,
  rater_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, referee_id, rater_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referee_ratings TO authenticated;
GRANT ALL ON public.referee_ratings TO service_role;
ALTER TABLE public.referee_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rater sees own; admin sees all"
  ON public.referee_ratings FOR SELECT
  USING (rater_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Director of match team can rate"
  ON public.referee_ratings FOR INSERT
  WITH CHECK (
    rater_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (
          public.is_team_director(auth.uid(), m.host_team_id)
          OR public.is_team_director(auth.uid(), m.visitor_team_id)
        )
    )
  );

CREATE POLICY "Rater updates own rating"
  ON public.referee_ratings FOR UPDATE
  USING (rater_user_id = auth.uid())
  WITH CHECK (rater_user_id = auth.uid());

CREATE POLICY "Rater or admin deletes rating"
  ON public.referee_ratings FOR DELETE
  USING (rater_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_referee_ratings_updated
  BEFORE UPDATE ON public.referee_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Aggregated stats function (public)
CREATE OR REPLACE FUNCTION public.get_referee_stats(_referee_id uuid)
RETURNS TABLE(total_matches int, total_ratings int, avg_rating numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::int FROM public.match_referees WHERE referee_id = _referee_id),
    (SELECT COUNT(*)::int FROM public.referee_ratings WHERE referee_id = _referee_id),
    (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) FROM public.referee_ratings WHERE referee_id = _referee_id);
$$;

REVOKE EXECUTE ON FUNCTION public.get_referee_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referee_stats(uuid) TO authenticated, service_role;
