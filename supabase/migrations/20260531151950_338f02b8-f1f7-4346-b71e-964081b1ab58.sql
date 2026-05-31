
-- Drop broad SELECT policies that allowed listing every object in public buckets.
-- Files remain accessible via their direct public URLs (CDN); only API listing is removed.
DROP POLICY IF EXISTS "athlete-photos public read individual" ON storage.objects;
DROP POLICY IF EXISTS "team-logos public read" ON storage.objects;
