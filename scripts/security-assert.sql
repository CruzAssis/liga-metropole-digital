-- Security assertions for CI. Fails the build (RAISE EXCEPTION) if any
-- known RLS / PII regression is present. Extend as new invariants land.
--
-- Run with:  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/security-assert.sql

\set ON_ERROR_STOP on
\timing off

------------------------------------------------------------------------
-- 1. Every table in `public` MUST have RLS enabled.
------------------------------------------------------------------------
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO bad
    FROM pg_tables t
    JOIN pg_class c ON c.oid = format('%I.%I', t.schemaname, t.tablename)::regclass
   WHERE t.schemaname = 'public'
     AND c.relrowsecurity = false;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Tables without RLS enabled: %', bad;
  END IF;
END $$;

------------------------------------------------------------------------
-- 2. Every public table MUST have at least one policy (RLS on + no
--    policies = deny-all, usually accidental).
------------------------------------------------------------------------
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(format('%I.%I', t.schemaname, t.tablename), ', ')
    INTO bad
    FROM pg_tables t
    LEFT JOIN pg_policies p
           ON p.schemaname = t.schemaname AND p.tablename = t.tablename
   WHERE t.schemaname = 'public'
   GROUP BY t.schemaname, t.tablename
  HAVING count(p.policyname) = 0;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Public tables with no RLS policies: %', bad;
  END IF;
END $$;

------------------------------------------------------------------------
-- 3. Sensitive tables MUST NOT have wide-open USING(true) policies.
------------------------------------------------------------------------
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(
           format('%s.%s (%s)', schemaname, tablename, policyname), ', '
         )
    INTO bad
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('athletes', 'profiles', 'user_roles', 'system_settings')
     AND (qual = 'true' OR qual ILIKE 'true');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Wide-open USING(true) policies on sensitive tables: %', bad;
  END IF;
END $$;

------------------------------------------------------------------------
-- 4. anon MUST NOT have SELECT on sensitive PII columns.
------------------------------------------------------------------------
DO $$
DECLARE
  rec record;
  bad text := '';
BEGIN
  FOR rec IN
    SELECT table_schema, table_name, column_name
      FROM information_schema.column_privileges
     WHERE grantee = 'anon'
       AND privilege_type = 'SELECT'
       AND table_schema = 'public'
       AND (
             (table_name = 'athletes'  AND column_name IN ('cpf_hash','cpf_last4','whatsapp','instagram_handle'))
          OR (table_name = 'profiles'  AND column_name IN ('phone','whatsapp','date_of_birth'))
          OR (table_name = 'teams'     AND column_name = 'invite_code')
          OR (table_name = 'user_roles')
       )
  LOOP
    bad := bad || format('%s.%s.%s, ', rec.table_schema, rec.table_name, rec.column_name);
  END LOOP;
  IF bad <> '' THEN
    RAISE EXCEPTION 'anon has SELECT on sensitive columns: %', rtrim(bad, ', ');
  END IF;
END $$;

------------------------------------------------------------------------
-- 5. anon / PUBLIC MUST NOT be able to EXECUTE internal SECURITY DEFINER
--    helpers. Whitelist truly public functions here.
------------------------------------------------------------------------
DO $$
DECLARE
  whitelist text[] := ARRAY[
    'get_public_league_config',
    'get_public_registration_flags'
  ];
  bad text := '';
  rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema, p.proname AS name, r.rolname AS grantee
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
      JOIN pg_roles r ON r.oid = a.grantee
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
       AND a.privilege_type = 'EXECUTE'
       AND r.rolname IN ('anon','public','PUBLIC')
       AND NOT (p.proname = ANY(whitelist))
  LOOP
    bad := bad || format('%s.%s (grantee=%s), ', rec.schema, rec.name, rec.grantee);
  END LOOP;
  IF bad <> '' THEN
    RAISE EXCEPTION 'SECURITY DEFINER functions executable by anon/PUBLIC: %', rtrim(bad, ', ');
  END IF;
END $$;

\echo 'security-assert.sql: OK'
