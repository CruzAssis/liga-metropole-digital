
-- 1) Athletes: revoke sensitive contact column access from public roles.
-- Public reads now go through server functions (supabaseAdmin) which can
-- still see all columns; client-side queries are restricted to safe cols.
REVOKE SELECT (whatsapp, instagram_handle) ON public.athletes FROM anon, authenticated;

-- 2) Storage: athlete-photos — restrict writes to team directors only.
-- Convention: file path is "<team_id>/<filename>".
DROP POLICY IF EXISTS "athlete-photos authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "athlete-photos authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "athlete-photos authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "athlete-photos public read" ON storage.objects;

-- Public read via storage API (kept for in-app rendering). Files are also
-- served via the bucket public URL regardless of this policy.
CREATE POLICY "athlete-photos public read individual"
ON storage.objects FOR SELECT
USING (bucket_id = 'athlete-photos');

CREATE POLICY "athlete-photos director insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'athlete-photos'
  AND (
    public.is_team_director(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "athlete-photos director update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'athlete-photos'
  AND (
    public.is_team_director(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "athlete-photos director delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'athlete-photos'
  AND (
    public.is_team_director(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 3) team-logos: drop redundant restrictive SELECT policy. The bucket is
-- public and "team-logos public read" already grants list/get access.
DROP POLICY IF EXISTS "Team logos: owner select" ON storage.objects;
DROP POLICY IF EXISTS "Team logos: owner insert" ON storage.objects;
DROP POLICY IF EXISTS "Team logos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Team logos: owner delete" ON storage.objects;

-- 4) Realtime: teams table is in supabase_realtime publication. Remove it
-- so anonymous/authenticated subscribers cannot stream row changes. Reads
-- still work via the normal REST API with existing RLS.
ALTER PUBLICATION supabase_realtime DROP TABLE public.teams;

-- 5) SECURITY DEFINER functions: revoke EXECUTE on internal triggers/helpers
-- from authenticated/anon. Trigger functions are invoked by Postgres itself
-- and do not need API access. RLS helper functions (has_role,
-- is_team_director, is_team_member) MUST remain executable by authenticated
-- so RLS policies can evaluate them under the caller's session.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_team_slot_freed() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.promote_waitlist_for_type(text) FROM anon, authenticated, public;
