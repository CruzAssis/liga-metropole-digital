ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'closed',
  ADD COLUMN IF NOT EXISTS max_teams integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS host_slots integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS visitor_slots integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS full_notified_at timestamptz;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS teams_competition_id_idx ON public.teams(competition_id);

CREATE OR REPLACE FUNCTION public.competition_fill_stats(_competition_id uuid)
 RETURNS TABLE (
   total_approved integer,
   host_a_approved integer,
   host_b_approved integer,
   visitor_a_approved integer,
   visitor_b_approved integer,
   max_teams integer,
   host_slots integer,
   visitor_slots integer,
   is_full boolean,
   registration_status text
 )
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN t.status='approved' AND t.registration_type='host'    AND t.lado='A' THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN t.status='approved' AND t.registration_type='host'    AND t.lado='B' THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN t.status='approved' AND t.registration_type='visitor' AND t.lado='A' THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN t.status='approved' AND t.registration_type='visitor' AND t.lado='B' THEN 1 ELSE 0 END), 0)::int,
    c.max_teams,
    c.host_slots,
    c.visitor_slots,
    (COALESCE(SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END), 0) >= c.max_teams) AS is_full,
    c.registration_status
  FROM public.competitions c
  LEFT JOIN public.teams t ON t.competition_id = c.id
  WHERE c.id = _competition_id
  GROUP BY c.id, c.max_teams, c.host_slots, c.visitor_slots, c.registration_status;
$$;

REVOKE EXECUTE ON FUNCTION public.competition_fill_stats(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.competition_fill_stats(uuid) TO anon, authenticated;