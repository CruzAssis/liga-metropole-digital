
-- 1) team_supporters: hide user_id from anon role (keep counts/team_id readable)
REVOKE SELECT (user_id) ON public.team_supporters FROM anon;

-- 2) notification_log: let users read their own entries
CREATE POLICY "notification_log self read"
ON public.notification_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3) teams: prevent non-admin updates from changing manager_id
CREATE OR REPLACE FUNCTION public.prevent_team_manager_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.manager_id IS DISTINCT FROM OLD.manager_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change a team manager';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_team_manager_change ON public.teams;
CREATE TRIGGER prevent_team_manager_change
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.prevent_team_manager_change();
