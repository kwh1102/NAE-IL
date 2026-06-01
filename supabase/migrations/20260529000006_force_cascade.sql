DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all foreign keys from public.profiles referencing auth.users
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;

    -- Drop all foreign keys from public.forecasts referencing public.profiles or auth.users
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'forecasts' 
          AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.forecasts DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;

    -- Drop all foreign keys from public.insights referencing public.profiles or auth.users
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'insights' 
          AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.insights DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Now safely add the ON DELETE CASCADE constraints
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.forecasts
ADD CONSTRAINT forecasts_store_id_fkey
FOREIGN KEY (store_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.insights
ADD CONSTRAINT insights_store_id_fkey
FOREIGN KEY (store_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
