-- Check if profiles references auth.users with CASCADE
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Check forecasts table
ALTER TABLE public.forecasts
DROP CONSTRAINT IF EXISTS forecasts_store_id_fkey;

ALTER TABLE public.forecasts
ADD CONSTRAINT forecasts_store_id_fkey
FOREIGN KEY (store_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Also handle any other tables that might reference profiles
-- (insights already has it since I added it today)
