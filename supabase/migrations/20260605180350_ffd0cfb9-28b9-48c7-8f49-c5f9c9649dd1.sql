
-- 1) Hide sensitive athlete columns from anon/authenticated SELECT
REVOKE SELECT (cpf_hash, cpf_last4, whatsapp) ON public.athletes FROM anon, authenticated;
-- Keep service_role full access (default)
GRANT SELECT (cpf_hash, cpf_last4, whatsapp) ON public.athletes TO service_role;

-- 2) Prevent role escalation via team_members self update
CREATE OR REPLACE FUNCTION public.prevent_team_member_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.is_team_director(auth.uid(), OLD.team_id) THEN
    RAISE EXCEPTION 'Only admins or team directors can change a team member role';
  END IF;
  IF NEW.team_id IS DISTINCT FROM OLD.team_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change a team member team_id';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change the user of a team member';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_team_member_role_escalation ON public.team_members;
CREATE TRIGGER trg_prevent_team_member_role_escalation
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_team_member_role_escalation();

-- 3) Revoke EXECUTE on SECURITY DEFINER functions from anon (and PUBLIC)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_director(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_waitlist_for_type(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.competition_fill_stats(uuid) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_team_director(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.promote_waitlist_for_type(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.competition_fill_stats(uuid) TO authenticated, service_role;
