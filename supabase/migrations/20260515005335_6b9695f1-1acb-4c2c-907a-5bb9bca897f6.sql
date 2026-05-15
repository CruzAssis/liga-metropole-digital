
-- competitions
CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  season text,
  status text NOT NULL DEFAULT 'registration' CHECK (status IN ('registration','group_stage','knockout','finished')),
  draw_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- groups (16 per competition: 8 labels x 2 roles)
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (label IN ('A','B','C','D','E','F','G','H')),
  team_role text NOT NULL CHECK (team_role IN ('host','visitor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, label, team_role)
);
CREATE INDEX idx_groups_competition ON public.groups(competition_id);

-- group_teams (5 teams per group)
CREATE TABLE public.group_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, team_id),
  UNIQUE (team_id) -- a team belongs to exactly one group per draw lifecycle
);
CREATE INDEX idx_group_teams_group ON public.group_teams(group_id);

-- matches
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'group' CHECK (stage IN ('group','knockout')),
  round int NOT NULL,
  group_label text,
  host_team_id uuid NOT NULL REFERENCES public.teams(id),
  visitor_team_id uuid NOT NULL REFERENCES public.teams(id),
  host_score int,
  visitor_score int,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','finished','cancelled')),
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_matches_competition_round ON public.matches(competition_id, round);
CREATE INDEX idx_matches_host ON public.matches(host_team_id);
CREATE INDEX idx_matches_visitor ON public.matches(visitor_team_id);

-- RLS
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Public read (league info)
CREATE POLICY "competitions public read" ON public.competitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "groups public read" ON public.groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "group_teams public read" ON public.group_teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "matches public read" ON public.matches FOR SELECT TO anon, authenticated USING (true);

-- Admin full access
CREATE POLICY "competitions admin all" ON public.competitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "groups admin all" ON public.groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "group_teams admin all" ON public.group_teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "matches admin all" ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
