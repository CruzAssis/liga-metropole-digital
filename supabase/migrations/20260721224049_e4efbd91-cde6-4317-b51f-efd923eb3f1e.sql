CREATE OR REPLACE FUNCTION public.prevent_team_manager_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.manager_id IS DISTINCT FROM OLD.manager_id
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change a team manager';
  END IF;
  RETURN NEW;
END;
$function$;