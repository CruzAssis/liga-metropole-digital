-- Add invite_code to teams for player invitations
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- Generator: 8-char uppercase alphanumeric
CREATE OR REPLACE FUNCTION public.generate_team_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  attempts int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.teams WHERE invite_code = result) THEN
      RETURN result;
    END IF;
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique invite code';
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-fill invite_code on insert
CREATE OR REPLACE FUNCTION public.set_team_invite_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := public.generate_team_invite_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_team_invite_code ON public.teams;
CREATE TRIGGER trg_set_team_invite_code
BEFORE INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_team_invite_code();

-- Backfill existing teams
UPDATE public.teams SET invite_code = public.generate_team_invite_code() WHERE invite_code IS NULL;

-- Allow anyone (including anon) to look up a team by invite_code for the invite landing page.
-- Uses a security-definer RPC that returns only safe columns.
CREATE OR REPLACE FUNCTION public.get_team_by_invite_code(_code text)
RETURNS TABLE(id uuid, name text, short_name text, logo_url text, primary_color text, secondary_color text, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, short_name, logo_url, primary_color, secondary_color, status
  FROM public.teams
  WHERE invite_code = upper(_code)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_by_invite_code(text) TO anon, authenticated;