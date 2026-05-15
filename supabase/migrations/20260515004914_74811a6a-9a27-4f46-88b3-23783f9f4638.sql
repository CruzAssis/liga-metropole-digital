
-- Restrict listing on team-logos bucket. Files remain accessible via public URL.
DROP POLICY IF EXISTS "Team logos: public read" ON storage.objects;

CREATE POLICY "Team logos: owner select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- Revoke EXECUTE on SECURITY DEFINER helpers that should not be callable by clients.
REVOKE EXECUTE ON FUNCTION public.promote_waitlist_for_type(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_team_slot_freed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
