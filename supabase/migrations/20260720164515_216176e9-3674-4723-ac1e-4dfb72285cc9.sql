-- Add missing columns to teams for full director onboarding
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS subprefeitura text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS maps_link text;

CREATE INDEX IF NOT EXISTS teams_subprefeitura_idx ON public.teams (subprefeitura);

-- Backfill missing team_members (director) for teams whose manager has no membership yet
INSERT INTO public.team_members (team_id, user_id, role, accepted_at)
SELECT t.id, t.manager_id, 'director', now()
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.team_id = t.id AND tm.user_id = t.manager_id
)
ON CONFLICT DO NOTHING;

-- Backfill missing user_roles (director) for team managers
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT t.manager_id, 'director'::app_role
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = t.manager_id AND ur.role = 'director'
)
ON CONFLICT DO NOTHING;