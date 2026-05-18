
-- Clean up any prior versions of these policies
DROP POLICY IF EXISTS "team-logos public read" ON storage.objects;
DROP POLICY IF EXISTS "team-logos manager insert" ON storage.objects;
DROP POLICY IF EXISTS "team-logos manager update" ON storage.objects;
DROP POLICY IF EXISTS "team-logos manager delete" ON storage.objects;

-- Public read (bucket is public, but make policy explicit)
CREATE POLICY "team-logos public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'team-logos');

-- INSERT: own user folder OR logos/{team_id} / banners/{team_id} owned by caller
CREATE POLICY "team-logos manager insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-logos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] IN ('logos', 'banners')
      AND EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.manager_id = auth.uid()
      )
    )
  )
);

-- UPDATE: same rule
CREATE POLICY "team-logos manager update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] IN ('logos', 'banners')
      AND EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.manager_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'team-logos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] IN ('logos', 'banners')
      AND EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.manager_id = auth.uid()
      )
    )
  )
);

-- DELETE: same rule
CREATE POLICY "team-logos manager delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] IN ('logos', 'banners')
      AND EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.manager_id = auth.uid()
      )
    )
  )
);
