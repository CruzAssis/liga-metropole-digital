-- Seed admin role for shelderdouglasdacruz@gmail.com
-- This migration grants admin role to the designated admin user.
-- Uses ON CONFLICT DO NOTHING so it is safe to run multiple times.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'shelderdouglasdacruz@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
