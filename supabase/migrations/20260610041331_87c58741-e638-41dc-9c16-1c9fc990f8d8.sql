
-- 1) Athletes: revoke SELECT on sensitive columns from anon/authenticated
REVOKE SELECT (whatsapp, cpf_hash, cpf_last4) ON public.athletes FROM anon, authenticated;

-- 2) Competitions: revoke SELECT on financial/operational config columns from anon/authenticated
REVOKE SELECT (wo_fine_brl, monthly_fee_brl, wo_tolerance_minutes, sumula_confirm_window_hours)
  ON public.competitions FROM anon, authenticated;

-- 3) team_members: defense-in-depth — disallow direct UPDATE on identity/role columns
REVOKE UPDATE (role, team_id, user_id) ON public.team_members FROM anon, authenticated;

-- 4) Lock down trigger functions from anon/public EXECUTE
REVOKE EXECUTE ON FUNCTION public.prevent_team_manager_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_team_member_role_escalation() FROM anon, authenticated, PUBLIC;
