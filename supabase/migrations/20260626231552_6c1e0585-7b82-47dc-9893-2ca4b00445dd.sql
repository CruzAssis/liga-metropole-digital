
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS qualified_count integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS relegated_count integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS use_sides boolean NOT NULL DEFAULT true;
