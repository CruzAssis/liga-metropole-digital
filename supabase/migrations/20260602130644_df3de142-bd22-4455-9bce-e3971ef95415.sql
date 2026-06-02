ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS tertiary_color text;