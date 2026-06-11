ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS subprefeitura TEXT,
  ADD COLUMN IF NOT EXISTS conference_name TEXT,
  ADD COLUMN IF NOT EXISTS zona TEXT,
  ADD COLUMN IF NOT EXISTS conference_number INTEGER;