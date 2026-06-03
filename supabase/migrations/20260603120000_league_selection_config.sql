-- ================================================================
-- League Selection, Config and Auto-Draw
-- feat: league selection, config and auto-draw
-- ================================================================

-- 1. Extend competitions table with league configuration columns
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS max_teams       int  NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS host_slots      int  NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS visitor_slots   int  NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS starts_at       date,
  ADD COLUMN IF NOT EXISTS full_notified_at timestamptz;

-- Rename existing 'registration' status value to 'open' is a breaking change;
-- instead we add a CHECK-compatible approach using a new column:
-- registration_status: open | closed | draw_ready | active | finished
-- We keep the existing 'status' for competition lifecycle (group_stage etc.)
-- and add registration_status to control inscription window.
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'open'
  CHECK (registration_status IN ('open','closed','draw_ready','active','finished'));

-- 2. Link teams to a competition at inscription time
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_competition ON public.teams(competition_id);

-- 3. Function: count approved teams per competition
CREATE OR REPLACE FUNCTION public.competition_approved_count(_competition_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.teams
  WHERE competition_id = _competition_id
    AND status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION public.competition_approved_count(uuid) TO authenticated, anon;

-- 4. Trigger: when a team is approved and linked to a competition,
--    check if the competition has reached max_teams.
--    If so: set registration_status = 'draw_ready' and record full_notified_at.
CREATE OR REPLACE FUNCTION public.check_competition_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competition_id uuid;
  v_max_teams      int;
  v_current_count  int;
  v_reg_status     text;
BEGIN
  -- Only act when a team transitions to approved and has a competition_id
  IF TG_OP = 'UPDATE'
    AND NEW.status = 'approved'
    AND (OLD.status IS DISTINCT FROM 'approved')
    AND NEW.competition_id IS NOT NULL
  THEN
    v_competition_id := NEW.competition_id;

    SELECT max_teams, registration_status
      INTO v_max_teams, v_reg_status
      FROM public.competitions
     WHERE id = v_competition_id;

    IF v_reg_status NOT IN ('open') THEN
      RETURN NEW;
    END IF;

    SELECT count(*)::int INTO v_current_count
      FROM public.teams
     WHERE competition_id = v_competition_id
       AND status = 'approved';

    IF v_current_count >= v_max_teams THEN
      UPDATE public.competitions
         SET registration_status  = 'draw_ready',
             full_notified_at     = now()
       WHERE id = v_competition_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_competition_capacity() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_competition_capacity ON public.teams;
CREATE TRIGGER trg_check_competition_capacity
  AFTER UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.check_competition_capacity();

-- 5. Function: block new team INSERT into a full or closed competition
CREATE OR REPLACE FUNCTION public.block_inscription_if_full()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg_status text;
  v_max_teams  int;
  v_approved   int;
BEGIN
  IF NEW.competition_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT registration_status, max_teams
    INTO v_reg_status, v_max_teams
    FROM public.competitions
   WHERE id = NEW.competition_id;

  IF v_reg_status NOT IN ('open') THEN
    RAISE EXCEPTION 'Inscricoes encerradas para esta liga (status: %)', v_reg_status
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::int INTO v_approved
    FROM public.teams
   WHERE competition_id = NEW.competition_id
     AND status = 'approved';

  IF v_approved >= v_max_teams THEN
    RAISE EXCEPTION 'Liga lotada. Numero maximo de equipes atingido (%)', v_max_teams
      USING ERRCODE = 'P0002';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.block_inscription_if_full() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_block_inscription_if_full ON public.teams;
CREATE TRIGGER trg_block_inscription_if_full
  BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.block_inscription_if_full();

-- 6. Update executeDraw: also set competition registration_status = 'active' after draw
--    (handled in application layer via draw.functions.ts update)

-- 7. RLS: allow anon/authenticated to read competition registration_status and config
--    (already covered by existing "competitions public read" policy)

-- 8. Admin helper: get competition fill stats
CREATE OR REPLACE FUNCTION public.competition_fill_stats(_competition_id uuid)
RETURNS TABLE (
  total_approved     int,
  host_a_approved    int,
  host_b_approved    int,
  visitor_a_approved int,
  visitor_b_approved int,
  max_teams          int,
  host_slots         int,
  visitor_slots      int,
  is_full            boolean,
  registration_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(t.id)::int                                                       AS total_approved,
    count(t.id) FILTER (WHERE t.registration_type='host'    AND t.lado='A')::int AS host_a_approved,
    count(t.id) FILTER (WHERE t.registration_type='host'    AND t.lado='B')::int AS host_b_approved,
    count(t.id) FILTER (WHERE t.registration_type='visitor' AND t.lado='A')::int AS visitor_a_approved,
    count(t.id) FILTER (WHERE t.registration_type='visitor' AND t.lado='B')::int AS visitor_b_approved,
    c.max_teams,
    c.host_slots,
    c.visitor_slots,
    (count(t.id) >= c.max_teams)                                           AS is_full,
    c.registration_status
  FROM public.competitions c
  LEFT JOIN public.teams t
    ON t.competition_id = c.id AND t.status = 'approved'
  WHERE c.id = _competition_id
  GROUP BY c.max_teams, c.host_slots, c.visitor_slots, c.registration_status;
$$;

GRANT EXECUTE ON FUNCTION public.competition_fill_stats(uuid) TO authenticated;
