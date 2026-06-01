ALTER TABLE public.insights ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Delete old dummy data without store_id
DELETE FROM public.insights WHERE store_id IS NULL;
