
-- 1. Teams: revoke invite_code column access from anon/authenticated
REVOKE SELECT (invite_code) ON public.teams FROM anon, authenticated;

-- Function to fetch own team invite code
CREATE OR REPLACE FUNCTION public.get_my_team_invite_code(_team_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT invite_code
  FROM public.teams
  WHERE id = _team_id
    AND (manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.is_team_director(auth.uid(), id))
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_team_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_invite_code(uuid) TO authenticated;

-- 2. team_supporters: remove public read; restrict to self + admin + team director. Expose counts via RPC.
DROP POLICY IF EXISTS "team_supporters public read" ON public.team_supporters;

CREATE POLICY "team_supporters self read"
ON public.team_supporters
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.is_team_director(auth.uid(), team_id));

CREATE OR REPLACE FUNCTION public.get_team_supporter_counts()
RETURNS TABLE(team_id uuid, supporter_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id, COUNT(*)::int
  FROM public.team_supporters
  GROUP BY team_id;
$$;
REVOKE EXECUTE ON FUNCTION public.get_team_supporter_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_supporter_counts() TO anon, authenticated;

-- 3. system_settings: restrict read to admins only
DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.system_settings;

CREATE POLICY "Only admins can read settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Expose public flags via SECURITY DEFINER function for signup/registration flows
CREATE OR REPLACE FUNCTION public.get_public_registration_flags()
RETURNS TABLE(master_registration_open boolean, host_slots_limit integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT master_registration_open, host_slots_limit
  FROM public.system_settings
  WHERE id = true
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_registration_flags() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_registration_flags() TO authenticated;

-- 4. Revoke EXECUTE from anon on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_team_by_invite_code(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registration_dashboard_stats() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_waitlist_for_type(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_director(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_team_invite_code() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registration_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_director(uuid, uuid) TO authenticated;
