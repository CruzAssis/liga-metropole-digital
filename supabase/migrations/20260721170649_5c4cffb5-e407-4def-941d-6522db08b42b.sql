
-- === 1. Athletes: restrict full row access; expose safe columns via view ===
DROP POLICY IF EXISTS "athletes public read" ON public.athletes;

CREATE POLICY "athletes self read" ON public.athletes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND public.is_team_director(auth.uid(), team_id))
    OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE OR REPLACE VIEW public.athletes_public
WITH (security_invoker = false)
AS
SELECT id, team_id, full_name, nickname, position, photo_url, verified, created_at
FROM public.athletes;

GRANT SELECT ON public.athletes_public TO anon, authenticated;

-- === 2. Public league config: switch to SECURITY INVOKER + narrow anon read ===
-- Allow anon to read only the public_* columns of system_settings
GRANT SELECT
  (id, public_league_name, public_tagline, public_season, public_whatsapp,
   public_rules_url, public_format_description, public_instagram,
   public_contact_email, master_registration_open, host_slots_limit)
  ON public.system_settings TO anon, authenticated;

DROP POLICY IF EXISTS "system_settings public flags read" ON public.system_settings;
CREATE POLICY "system_settings public flags read" ON public.system_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.get_public_league_config()
 RETURNS TABLE(league_name text, tagline text, season text, whatsapp text, rules_url text, format_description text, instagram text, contact_email text)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT public_league_name, public_tagline, public_season, public_whatsapp,
         public_rules_url, public_format_description, public_instagram, public_contact_email
  FROM public.system_settings WHERE id = true LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_registration_flags()
 RETURNS TABLE(master_registration_open boolean, host_slots_limit integer)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT master_registration_open, host_slots_limit
  FROM public.system_settings
  WHERE id = true
  LIMIT 1;
$function$;

-- === 3. Revoke anon/public EXECUTE from remaining SECURITY DEFINER helpers ===
REVOKE EXECUTE ON FUNCTION public.get_supporter_mvp(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_voting_open(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_athlete_stats(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_athlete_discipline(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ranking_craques(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_referee_stats(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_team_suspensions(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_team_supporter_counts() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_team_by_invite_code(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_team_invite_code(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registration_dashboard_stats() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_director(uuid, uuid) FROM anon, PUBLIC;

-- The two intentionally public info functions are now SECURITY INVOKER,
-- so they no longer trip the anon-executable SECURITY DEFINER linter.
