insert into public.user_roles (user_id, role)
values ('e47e2788-9a0b-4759-a5fa-864af84c93fe', 'admin')
on conflict (user_id, role) do nothing;