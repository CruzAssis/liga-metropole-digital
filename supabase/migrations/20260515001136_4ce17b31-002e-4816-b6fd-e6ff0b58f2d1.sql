
-- Enum for roles
create type public.app_role as enum ('admin', 'team_manager', 'athlete');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  cpf text unique not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles: users read own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Profiles: users insert own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "Profiles: users update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "User roles: users read own"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

create policy "User roles: admins manage"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Admin policies on profiles
create policy "Profiles: admins read all"
  on public.profiles for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Profiles: admins update all"
  on public.profiles for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- teams
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  logo_url text,
  manager_id uuid not null references public.profiles(id) on delete restrict,
  registration_type text not null check (registration_type in ('host','visitor')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','waitlist')),
  rejected_reason text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create index idx_teams_status on public.teams(status);
create index idx_teams_registration_type on public.teams(registration_type);
create unique index idx_teams_one_per_manager on public.teams(manager_id);

alter table public.teams enable row level security;

create policy "Teams: public read approved"
  on public.teams for select
  to anon, authenticated
  using (status = 'approved');

create policy "Teams: manager reads own"
  on public.teams for select
  to authenticated
  using (manager_id = auth.uid());

create policy "Teams: manager inserts own"
  on public.teams for insert
  to authenticated
  with check (manager_id = auth.uid());

create policy "Teams: manager updates own"
  on public.teams for update
  to authenticated
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());

create policy "Teams: admins all"
  on public.teams for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- handle_new_user trigger: create profile + default role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, cpf)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'cpf', '')
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'team_manager');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for team logos
insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true);

create policy "Team logos: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'team-logos');

create policy "Team logos: owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Team logos: owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Team logos: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
