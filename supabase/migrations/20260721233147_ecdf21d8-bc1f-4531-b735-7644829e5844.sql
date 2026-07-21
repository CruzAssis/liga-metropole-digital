
-- ============================================================
-- Lock down athlete PII (whatsapp, instagram_handle, cpf_last4, cpf_hash)
-- ============================================================
-- Server functions use supabaseAdmin (service_role) which bypasses these
-- column grants, so director/admin/self reads through server functions
-- continue to work. Browser-side clients (anon/authenticated) can only
-- select the safe public profile columns.

REVOKE SELECT ON public.athletes FROM anon;
REVOKE SELECT ON public.athletes FROM authenticated;

GRANT SELECT (
  id, team_id, full_name, nickname, "position", photo_url,
  verified, verified_at, user_id, created_at, updated_at
) ON public.athletes TO anon;

GRANT SELECT (
  id, team_id, full_name, nickname, "position", photo_url,
  verified, verified_at, user_id, created_at, updated_at
) ON public.athletes TO authenticated;

-- service_role keeps ALL privileges (bypass)
GRANT ALL ON public.athletes TO service_role;

-- ============================================================
-- Lock down system_settings — expose only public_* fields via
-- SECURITY DEFINER functions, drop the broad public SELECT policy.
-- ============================================================
DROP POLICY IF EXISTS "system_settings public flags read" ON public.system_settings;

-- Make public getters SECURITY DEFINER so anon/authenticated can call them
-- without SELECT on the base table.
CREATE OR REPLACE FUNCTION public.get_public_registration_flags()
RETURNS TABLE(master_registration_open boolean, host_slots_limit integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT master_registration_open, host_slots_limit
  FROM public.system_settings
  WHERE id = true
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_league_config()
RETURNS TABLE(league_name text, tagline text, season text, whatsapp text, rules_url text, format_description text, instagram text, contact_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public_league_name, public_tagline, public_season, public_whatsapp,
         public_rules_url, public_format_description, public_instagram, public_contact_email
  FROM public.system_settings WHERE id = true LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_registration_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_registration_flags() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_league_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_league_config() TO anon, authenticated;
