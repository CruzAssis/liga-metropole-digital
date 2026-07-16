
CREATE TABLE public.system_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  master_registration_open boolean NOT NULL DEFAULT false,
  host_slots_limit int NOT NULL DEFAULT 20,
  prospected_count int NOT NULL DEFAULT 33,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update settings"
  ON public.system_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert settings"
  ON public.system_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed the single row
INSERT INTO public.system_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Dashboard stats function
CREATE OR REPLACE FUNCTION public.registration_dashboard_stats()
RETURNS TABLE(
  master_open boolean,
  host_limit int,
  prospected int,
  approved_hosts int,
  pending_hosts int,
  waitlist_hosts int,
  total_teams int,
  slots_remaining int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.master_registration_open,
    s.host_slots_limit,
    s.prospected_count,
    COALESCE(SUM(CASE WHEN t.registration_type='host' AND t.status='approved' THEN 1 ELSE 0 END),0)::int,
    COALESCE(SUM(CASE WHEN t.registration_type='host' AND t.status='pending'  THEN 1 ELSE 0 END),0)::int,
    COALESCE(SUM(CASE WHEN t.registration_type='host' AND t.status='waitlist' THEN 1 ELSE 0 END),0)::int,
    COALESCE(COUNT(t.id),0)::int,
    GREATEST(0, s.host_slots_limit - COALESCE(SUM(CASE WHEN t.registration_type='host' AND t.status='approved' THEN 1 ELSE 0 END),0))::int
  FROM public.system_settings s
  LEFT JOIN public.teams t ON true
  WHERE s.id = true
  GROUP BY s.master_registration_open, s.host_slots_limit, s.prospected_count;
$$;

GRANT EXECUTE ON FUNCTION public.registration_dashboard_stats() TO authenticated;
