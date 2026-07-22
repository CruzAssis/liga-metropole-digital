
CREATE OR REPLACE FUNCTION public.list_public_teams()
RETURNS TABLE(
  id uuid,
  name text,
  short_name text,
  slug text,
  logo_url text,
  primary_color text,
  registration_type text,
  lado text,
  subprefeitura text,
  manager_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.name, t.short_name, t.slug, t.logo_url, t.primary_color,
         t.registration_type, t.lado,
         c.subprefeitura,
         p.full_name
  FROM public.teams t
  LEFT JOIN public.competitions c ON c.id = t.competition_id
  LEFT JOIN public.profiles p ON p.id = t.manager_id
  WHERE t.status = 'approved'
  ORDER BY t.name;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_teams() TO anon, authenticated;
