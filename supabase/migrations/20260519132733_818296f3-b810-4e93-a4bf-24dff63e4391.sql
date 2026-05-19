ALTER TABLE public.teams 
  ADD COLUMN IF NOT EXISTS home_venue text,
  ADD COLUMN IF NOT EXISTS home_time time;