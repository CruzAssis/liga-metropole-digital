
-- Simplify: use column-level GRANTs to hide sensitive athlete columns
DROP POLICY IF EXISTS "athletes self read" ON public.athletes;

-- Reinstate a permissive row-level SELECT (columns are now the gate)
CREATE POLICY "athletes public read" ON public.athletes
  FOR SELECT TO anon, authenticated
  USING (true);

-- Revoke broad SELECT and grant only safe columns to anon/authenticated
REVOKE SELECT ON public.athletes FROM anon, authenticated;
GRANT SELECT
  (id, team_id, full_name, nickname, position, photo_url, verified,
   verified_at, user_id, created_at, updated_at)
  ON public.athletes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.athletes TO authenticated;
GRANT ALL ON public.athletes TO service_role;

-- Drop the previous view (was flagged as SECURITY DEFINER view)
DROP VIEW IF EXISTS public.athletes_public;
