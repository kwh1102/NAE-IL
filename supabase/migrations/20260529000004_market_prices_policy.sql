-- Enable read access for everyone on market_prices table
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'market_prices' AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" ON public.market_prices FOR SELECT USING (true);
    END IF;
END $$;
