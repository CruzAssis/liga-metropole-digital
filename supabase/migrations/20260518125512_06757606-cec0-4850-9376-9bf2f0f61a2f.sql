
-- =====================================================
-- Athletes (ID Metropole)
-- =====================================================
CREATE TABLE public.athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  full_name text,
  nickname text,
  position text,
  photo_url text,
  cpf_hash text NOT NULL UNIQUE,
  cpf_last4 text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  whatsapp text,
  instagram_handle text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_athletes_team_id ON public.athletes(team_id);
CREATE INDEX idx_athletes_cpf_last4 ON public.athletes(cpf_last4);
CREATE INDEX idx_athletes_verified ON public.athletes(verified);
CREATE INDEX idx_athletes_user_id ON public.athletes(user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_athletes_updated_at
BEFORE UPDATE ON public.athletes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

-- Public read (cpf_hash is not exposed via PostgREST select clauses we use; clients should select only safe columns)
CREATE POLICY "athletes public read"
ON public.athletes
FOR SELECT
TO anon, authenticated
USING (true);

-- Team manager can insert athletes for their own team
CREATE POLICY "athletes team manager insert"
ON public.athletes
FOR INSERT
TO authenticated
WITH CHECK (
  team_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = athletes.team_id AND t.manager_id = auth.uid()
  )
);

-- Team manager can update athletes of their team
CREATE POLICY "athletes team manager update"
ON public.athletes
FOR UPDATE
TO authenticated
USING (
  team_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = athletes.team_id AND t.manager_id = auth.uid()
  )
);

-- Athlete (after verification) can update own row
CREATE POLICY "athletes self update"
ON public.athletes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin full access
CREATE POLICY "athletes admin all"
ON public.athletes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- Storage bucket: athlete-photos
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('athlete-photos', 'athlete-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "athlete-photos public read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'athlete-photos');

-- Authenticated users can upload (path validated server-side; first folder must equal athlete_id owned by user or by team manager)
CREATE POLICY "athlete-photos authenticated upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'athlete-photos');

CREATE POLICY "athlete-photos authenticated update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'athlete-photos');

CREATE POLICY "athlete-photos authenticated delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'athlete-photos');
