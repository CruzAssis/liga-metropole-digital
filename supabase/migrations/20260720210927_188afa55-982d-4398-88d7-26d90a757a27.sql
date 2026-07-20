
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS double_round boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS points_win integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS points_draw integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS points_loss integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiebreakers text[] NOT NULL DEFAULT ARRAY['points','gd','gf','head_to_head','name']::text[],
  ADD COLUMN IF NOT EXISTS min_teams integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS matches_per_opponent integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS knockout_leg_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS regulation_notes text;
