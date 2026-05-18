
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS primary_color text;
