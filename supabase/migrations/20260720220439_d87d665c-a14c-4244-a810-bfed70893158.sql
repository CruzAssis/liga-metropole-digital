ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS voting_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS voting_closes_at timestamptz;

-- Helper: is voting currently open for a match?
CREATE OR REPLACE FUNCTION public.is_voting_open(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.status IN ('confirmed','closed','wo')
    AND COALESCE(m.voting_open, true)
    AND (m.voting_closes_at IS NULL OR m.voting_closes_at > now())
  FROM public.matches m
  WHERE m.id = _match_id;
$$;

GRANT EXECUTE ON FUNCTION public.is_voting_open(uuid) TO authenticated;