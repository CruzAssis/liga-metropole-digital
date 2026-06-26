
-- Fix 1: Revoke public SELECT on sensitive financial/operational columns of competitions
REVOKE SELECT (wo_fine_brl, monthly_fee_brl, wo_tolerance_minutes, sumula_confirm_window_hours)
  ON public.competitions FROM anon, authenticated;

-- Fix 2: Restrict team_members self-update to non-sensitive columns only.
-- Drop UPDATE privilege on sensitive columns from authenticated; keep only accepted_at updatable.
REVOKE UPDATE ON public.team_members FROM authenticated;
GRANT UPDATE (accepted_at) ON public.team_members TO authenticated;
