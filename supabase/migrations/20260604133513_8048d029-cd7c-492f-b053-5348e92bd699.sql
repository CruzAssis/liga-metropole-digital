REVOKE SELECT (cpf_hash, cpf_last4, whatsapp) ON public.athletes FROM anon;

REVOKE SELECT (user_id) ON public.team_supporters FROM anon;

INSERT INTO public.team_members (team_id, user_id, role, accepted_at)
SELECT t.id, t.manager_id, 'director'::app_role, now()
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.team_id = t.id AND tm.user_id = t.manager_id
    AND tm.role = 'director' AND tm.accepted_at IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.is_team_director(_user_id uuid, _team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
      AND role = 'director' AND accepted_at IS NOT NULL
  );
$function$;

DROP POLICY IF EXISTS "team-logos manager insert" ON storage.objects;
DROP POLICY IF EXISTS "team-logos manager update" ON storage.objects;
DROP POLICY IF EXISTS "team-logos manager delete" ON storage.objects;

CREATE POLICY "team-logos director insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] IN ('logos','banners')
  AND public.is_team_director(auth.uid(), ((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "team-logos director update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] IN ('logos','banners')
  AND public.is_team_director(auth.uid(), ((storage.foldername(name))[2])::uuid)
)
WITH CHECK (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] IN ('logos','banners')
  AND public.is_team_director(auth.uid(), ((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "team-logos director delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (storage.foldername(name))[1] IN ('logos','banners')
  AND public.is_team_director(auth.uid(), ((storage.foldername(name))[2])::uuid)
);