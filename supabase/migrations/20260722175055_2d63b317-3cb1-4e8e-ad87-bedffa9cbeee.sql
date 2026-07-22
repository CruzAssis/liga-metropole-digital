DROP FUNCTION IF EXISTS public.list_public_teams();
CREATE OR REPLACE FUNCTION public.list_public_teams()
 RETURNS TABLE(id uuid, name text, short_name text, slug text, logo_url text, primary_color text, registration_type text, lado text, subprefeitura text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT t.id, t.name, t.short_name, t.slug, t.logo_url, t.primary_color,
         t.registration_type, t.lado,
         c.subprefeitura
  FROM public.teams t
  LEFT JOIN public.competitions c ON c.id = t.competition_id
  WHERE t.status = 'approved'
  ORDER BY t.name;
$function$;