
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS questionamento_arbitragem text;

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_status_check
  CHECK (status = ANY (ARRAY[
    'scheduled'::text,
    'live'::text,
    'pending_confirm'::text,
    'awaiting_confirmation'::text,
    'confirmed'::text,
    'closed'::text,
    'wo'::text,
    'wo_host'::text,
    'wo_visitor'::text,
    'disputed'::text,
    'cancelled'::text
  ]));

CREATE INDEX IF NOT EXISTS idx_matches_status_awaiting
  ON public.matches (status)
  WHERE status IN ('awaiting_confirmation','disputed','confirmed','closed');
