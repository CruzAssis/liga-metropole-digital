
-- Block 3: Venues CRUD and public league config
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  subprefeitura TEXT,
  bairro TEXT,
  lado TEXT CHECK (lado IN ('A','B')),
  maps_link TEXT,
  photo_url TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.venues TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active venues"
  ON public.venues FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage venues"
  ON public.venues FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER venues_set_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend system_settings with public-facing league config
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS public_league_name TEXT,
  ADD COLUMN IF NOT EXISTS public_tagline TEXT,
  ADD COLUMN IF NOT EXISTS public_season TEXT,
  ADD COLUMN IF NOT EXISTS public_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS public_rules_url TEXT,
  ADD COLUMN IF NOT EXISTS public_format_description TEXT,
  ADD COLUMN IF NOT EXISTS public_instagram TEXT,
  ADD COLUMN IF NOT EXISTS public_contact_email TEXT;

-- RPC to expose public league config to anon
CREATE OR REPLACE FUNCTION public.get_public_league_config()
RETURNS TABLE(
  league_name TEXT,
  tagline TEXT,
  season TEXT,
  whatsapp TEXT,
  rules_url TEXT,
  format_description TEXT,
  instagram TEXT,
  contact_email TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public_league_name, public_tagline, public_season, public_whatsapp,
         public_rules_url, public_format_description, public_instagram, public_contact_email
  FROM public.system_settings WHERE id = true LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_league_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_league_config() TO anon, authenticated;
