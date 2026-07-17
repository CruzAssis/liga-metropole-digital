
CREATE TABLE public.manifestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  team_name text NOT NULL,
  logo_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.manifestos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manifestos TO authenticated;
GRANT ALL ON public.manifestos TO service_role;

ALTER TABLE public.manifestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manifestos are publicly readable"
  ON public.manifestos FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert manifestos"
  ON public.manifestos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update manifestos"
  ON public.manifestos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete manifestos"
  ON public.manifestos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER manifestos_set_updated_at
  BEFORE UPDATE ON public.manifestos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX manifestos_created_at_idx ON public.manifestos (created_at DESC);
