-- Allow authenticated users to self-assign non-admin roles (director, player, supporter)
CREATE POLICY "User roles: self assign non-admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role <> 'admin'::app_role
);

-- Allow users to remove their own non-admin role assignments (e.g. opt out of supporter)
CREATE POLICY "User roles: self delete non-admin"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND role <> 'admin'::app_role
);