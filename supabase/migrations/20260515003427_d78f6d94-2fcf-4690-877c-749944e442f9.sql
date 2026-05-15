
-- Realtime para a tabela teams
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;

-- Função: promove o mais antigo da waitlist do mesmo tipo para pending
CREATE OR REPLACE FUNCTION public.promote_waitlist_for_type(_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  approved_count int;
  next_id uuid;
BEGIN
  SELECT count(*) INTO approved_count
  FROM teams
  WHERE registration_type = _type AND status = 'approved';

  IF approved_count >= 40 THEN
    RETURN;
  END IF;

  SELECT id INTO next_id
  FROM teams
  WHERE registration_type = _type AND status = 'waitlist'
  ORDER BY created_at ASC
  LIMIT 1;

  IF next_id IS NOT NULL THEN
    UPDATE teams SET status = 'pending' WHERE id = next_id;
  END IF;
END;
$$;

-- Trigger: dispara promoção quando vaga aprovada é liberada
CREATE OR REPLACE FUNCTION public.handle_team_slot_freed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' THEN
      PERFORM public.promote_waitlist_for_type(OLD.registration_type);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
      PERFORM public.promote_waitlist_for_type(OLD.registration_type);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_slot_freed ON public.teams;
CREATE TRIGGER trg_team_slot_freed
AFTER UPDATE OR DELETE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.handle_team_slot_freed();
