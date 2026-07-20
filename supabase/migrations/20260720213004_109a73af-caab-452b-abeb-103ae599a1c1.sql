-- 1. CREATE TABLE
CREATE TABLE public.media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('photo','video','embed')),
  platform text CHECK (platform IN ('upload','youtube','instagram','tiktok','x','other')) DEFAULT 'upload',
  url text NOT NULL,
  thumbnail_url text,
  title text,
  caption text,
  credit text,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  competition_id uuid REFERENCES public.competitions(id) ON DELETE CASCADE,
  round_number integer,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. GRANTS
GRANT SELECT ON public.media_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_items TO authenticated;
GRANT ALL ON public.media_items TO service_role;

-- 3. RLS
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
CREATE POLICY "Public can view published media"
  ON public.media_items FOR SELECT
  TO anon, authenticated
  USING (is_published = true OR public.has_role(auth.uid(),'admin'::app_role)
         OR (team_id IS NOT NULL AND public.is_team_director(auth.uid(), team_id)));

CREATE POLICY "Admins manage all media"
  ON public.media_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Directors insert media for own team"
  ON public.media_items FOR INSERT
  TO authenticated
  WITH CHECK (team_id IS NOT NULL AND public.is_team_director(auth.uid(), team_id));

CREATE POLICY "Directors update own team media"
  ON public.media_items FOR UPDATE
  TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_director(auth.uid(), team_id))
  WITH CHECK (team_id IS NOT NULL AND public.is_team_director(auth.uid(), team_id));

CREATE POLICY "Directors delete own team media"
  ON public.media_items FOR DELETE
  TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_director(auth.uid(), team_id));

-- Trigger updated_at
CREATE TRIGGER media_items_set_updated_at
  BEFORE UPDATE ON public.media_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX media_items_team_idx ON public.media_items(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX media_items_match_idx ON public.media_items(match_id) WHERE match_id IS NOT NULL;
CREATE INDEX media_items_competition_idx ON public.media_items(competition_id) WHERE competition_id IS NOT NULL;
CREATE INDEX media_items_featured_idx ON public.media_items(is_featured, created_at DESC) WHERE is_featured = true AND is_published = true;
CREATE INDEX media_items_published_idx ON public.media_items(is_published, created_at DESC);