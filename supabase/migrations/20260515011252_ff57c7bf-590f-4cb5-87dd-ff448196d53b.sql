-- competitions: align columns and status values
ALTER TABLE public.competitions
  DROP CONSTRAINT IF EXISTS competitions_status_check;

-- migrate existing status values to new vocabulary
UPDATE public.competitions SET status = 'enrollment' WHERE status = 'registration';
UPDATE public.competitions SET status = 'playoffs' WHERE status = 'knockout';

ALTER TABLE public.competitions
  ALTER COLUMN status SET DEFAULT 'enrollment';

ALTER TABLE public.competitions
  ADD CONSTRAINT competitions_status_check
  CHECK (status IN ('enrollment','group_stage','playoffs','finished'));

-- season: text -> int (NOT NULL). Convert existing values when possible.
ALTER TABLE public.competitions
  ALTER COLUMN season TYPE int USING NULLIF(regexp_replace(coalesce(season, ''), '\D', '', 'g'), '')::int;

UPDATE public.competitions SET season = EXTRACT(YEAR FROM now())::int WHERE season IS NULL;

ALTER TABLE public.competitions
  ALTER COLUMN season SET NOT NULL;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS monthly_fee_brl numeric(10,2) DEFAULT 150.00,
  ADD COLUMN IF NOT EXISTS wo_fine_brl numeric(10,2) DEFAULT 300.00,
  ADD COLUMN IF NOT EXISTS wo_tolerance_minutes int DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sumula_confirm_window_hours int DEFAULT 48;

-- groups: add constraints and FK cascade
ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_label_check,
  DROP CONSTRAINT IF EXISTS groups_team_role_check,
  DROP CONSTRAINT IF EXISTS groups_competition_id_label_team_role_key,
  DROP CONSTRAINT IF EXISTS groups_competition_id_fkey;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_label_check CHECK (label IN ('A','B','C','D','E','F','G','H')),
  ADD CONSTRAINT groups_team_role_check CHECK (team_role IN ('host','visitor')),
  ADD CONSTRAINT groups_competition_id_label_team_role_key UNIQUE (competition_id, label, team_role),
  ADD CONSTRAINT groups_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE CASCADE;

-- group_teams: composite PK + cascading FKs
ALTER TABLE public.group_teams
  DROP CONSTRAINT IF EXISTS group_teams_pkey,
  DROP CONSTRAINT IF EXISTS group_teams_group_id_fkey,
  DROP CONSTRAINT IF EXISTS group_teams_team_id_fkey;

ALTER TABLE public.group_teams DROP COLUMN IF EXISTS id;

ALTER TABLE public.group_teams
  ADD CONSTRAINT group_teams_pkey PRIMARY KEY (group_id, team_id),
  ADD CONSTRAINT group_teams_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE,
  ADD CONSTRAINT group_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- matches: extend stage/status, add knockout/W.O. fields, FKs, indexes
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_stage_check,
  DROP CONSTRAINT IF EXISTS matches_status_check,
  DROP CONSTRAINT IF EXISTS matches_competition_id_fkey,
  DROP CONSTRAINT IF EXISTS matches_host_team_id_fkey,
  DROP CONSTRAINT IF EXISTS matches_visitor_team_id_fkey,
  DROP CONSTRAINT IF EXISTS matches_parent_match_id_fkey;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS host_filled_at timestamptz,
  ADD COLUMN IF NOT EXISTS visitor_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bracket_position int,
  ADD COLUMN IF NOT EXISTS parent_match_id uuid;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_stage_check CHECK (stage IN ('group','round_of_16','quarter','semi','final')),
  ADD CONSTRAINT matches_status_check CHECK (status IN ('scheduled','live','pending_confirm','confirmed','wo_host','wo_visitor','disputed','cancelled')),
  ADD CONSTRAINT matches_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE CASCADE,
  ADD CONSTRAINT matches_host_team_id_fkey FOREIGN KEY (host_team_id) REFERENCES public.teams(id),
  ADD CONSTRAINT matches_visitor_team_id_fkey FOREIGN KEY (visitor_team_id) REFERENCES public.teams(id),
  ADD CONSTRAINT matches_parent_match_id_fkey FOREIGN KEY (parent_match_id) REFERENCES public.matches(id);

CREATE INDEX IF NOT EXISTS idx_matches_competition_round ON public.matches(competition_id, round);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
