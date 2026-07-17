
ALTER TABLE public.profiles ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS club_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS director_role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_type text;

ALTER TABLE public.athletes ALTER COLUMN cpf_hash DROP NOT NULL;
ALTER TABLE public.athletes ALTER COLUMN cpf_last4 DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, whatsapp, nickname, date_of_birth, position, club_name, director_role, profile_type)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'whatsapp',
    NEW.raw_user_meta_data->>'whatsapp',
    NEW.raw_user_meta_data->>'nickname',
    nullif(NEW.raw_user_meta_data->>'date_of_birth','')::date,
    NEW.raw_user_meta_data->>'position',
    NEW.raw_user_meta_data->>'club_name',
    NEW.raw_user_meta_data->>'director_role',
    NEW.raw_user_meta_data->>'profile_type'
  );
  RETURN NEW;
END;
$function$;
