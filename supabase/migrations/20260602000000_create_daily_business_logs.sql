CREATE TABLE IF NOT EXISTS public.daily_business_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  total_sales_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_sales_amount >= 0),
  customer_count INTEGER NOT NULL DEFAULT 0 CHECK (customer_count >= 0),
  weather TEXT NOT NULL DEFAULT '맑음' CHECK (weather IN ('맑음', '흐림', '비', '눈', '폭염', '한파')),
  special_event_memo TEXT,
  business_memo TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'pos', 'card_import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, log_date)
);

ALTER TABLE public.daily_business_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_business_logs'
      AND policyname = 'Owners can read their daily business logs'
  ) THEN
    CREATE POLICY "Owners can read their daily business logs"
      ON public.daily_business_logs
      FOR SELECT
      USING (auth.uid() = store_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_business_logs'
      AND policyname = 'Owners can insert their daily business logs'
  ) THEN
    CREATE POLICY "Owners can insert their daily business logs"
      ON public.daily_business_logs
      FOR INSERT
      WITH CHECK (auth.uid() = store_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_business_logs'
      AND policyname = 'Owners can update their daily business logs'
  ) THEN
    CREATE POLICY "Owners can update their daily business logs"
      ON public.daily_business_logs
      FOR UPDATE
      USING (auth.uid() = store_id)
      WITH CHECK (auth.uid() = store_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_daily_business_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_daily_business_logs_updated_at ON public.daily_business_logs;
CREATE TRIGGER set_daily_business_logs_updated_at
  BEFORE UPDATE ON public.daily_business_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_daily_business_logs_updated_at();
