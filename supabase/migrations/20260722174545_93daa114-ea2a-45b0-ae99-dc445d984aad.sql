
-- =========================================================
-- 1) ATHLETES: restrict PII (whatsapp, instagram, cpf) from public
-- =========================================================

DROP POLICY IF EXISTS "athletes public read" ON public.athletes;

-- Explicit safe-columns public read policy (RLS row filter). Column privileges
-- (already scoped) enforce that sensitive columns are unreadable by anon/authenticated.
CREATE POLICY "athletes public safe read"
  ON public.athletes FOR SELECT TO anon, authenticated
  USING (true);

-- Belt-and-suspenders: remove write privileges anon should never need.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.athletes FROM anon;

-- Ensure sensitive columns are readable ONLY via service_role (admin server fns).
REVOKE SELECT (whatsapp, instagram_handle, cpf_hash, cpf_last4)
  ON public.athletes FROM anon, authenticated;
GRANT  SELECT (whatsapp, instagram_handle, cpf_hash, cpf_last4)
  ON public.athletes TO service_role;

-- Make sure authenticated has DML for own-row / director / admin flows (RLS enforces).
GRANT INSERT, UPDATE, DELETE ON public.athletes TO authenticated;
-- Safe SELECT columns for anon/auth (idempotent).
GRANT SELECT (id, user_id, team_id, full_name, nickname, "position",
              photo_url, verified, verified_at, created_at, updated_at)
  ON public.athletes TO anon, authenticated;

-- =========================================================
-- 2) REFEREES: strip whatsapp from public reads
-- =========================================================

DROP POLICY IF EXISTS "Public reads active referees" ON public.referees;

CREATE POLICY "Public reads active referees"
  ON public.referees FOR SELECT TO anon, authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

-- Remove blanket table SELECT so column grants take over.
REVOKE SELECT ON public.referees FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.referees FROM anon;

GRANT SELECT (id, full_name, nickname, city, photo_url, active, notes, created_at, updated_at)
  ON public.referees TO anon, authenticated;

-- whatsapp reachable only via service_role (admin server fns).
GRANT SELECT (whatsapp) ON public.referees TO service_role;

GRANT INSERT, UPDATE, DELETE ON public.referees TO authenticated;

-- =========================================================
-- 3) SECURITY DEFINER functions callable by anon -> switch to INVOKER
--    + narrow anon-visible reads on the underlying tables.
-- =========================================================

-- --- system_settings: expose only the public-facing flags to anon/authenticated (row id=true) ---
CREATE POLICY "system_settings public flags read"
  ON public.system_settings FOR SELECT TO anon, authenticated
  USING (id = true);

GRANT SELECT (
  public_league_name, public_tagline, public_season, public_whatsapp,
  public_rules_url, public_format_description, public_instagram, public_contact_email,
  master_registration_open, host_slots_limit
) ON public.system_settings TO anon, authenticated;

-- --- profiles: allow reading only the display name of managers of approved teams ---
CREATE POLICY "profiles approved team managers name"
  ON public.profiles FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.manager_id = profiles.id AND t.status = 'approved')
  );

GRANT SELECT (id, full_name) ON public.profiles TO anon, authenticated;

-- --- Convert the 3 public functions to SECURITY INVOKER ---

CREATE OR REPLACE FUNCTION public.get_public_league_config()
 RETURNS TABLE(league_name text, tagline text, season text, whatsapp text, rules_url text, format_description text, instagram text, contact_email text)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT public_league_name, public_tagline, public_season, public_whatsapp,
         public_rules_url, public_format_description, public_instagram, public_contact_email
  FROM public.system_settings WHERE id = true LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_registration_flags()
 RETURNS TABLE(master_registration_open boolean, host_slots_limit integer)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT master_registration_open, host_slots_limit
  FROM public.system_settings
  WHERE id = true
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.list_public_teams()
 RETURNS TABLE(id uuid, name text, short_name text, slug text, logo_url text, primary_color text, registration_type text, lado text, subprefeitura text, manager_name text)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT t.id, t.name, t.short_name, t.slug, t.logo_url, t.primary_color,
         t.registration_type, t.lado,
         c.subprefeitura,
         p.full_name
  FROM public.teams t
  LEFT JOIN public.competitions c ON c.id = t.competition_id
  LEFT JOIN public.profiles p ON p.id = t.manager_id
  WHERE t.status = 'approved'
  ORDER BY t.name;
$function$;
