CREATE TABLE IF NOT EXISTS public.recurring_expense_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  billing_day INTEGER NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 31),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  vendor TEXT,
  memo TEXT,
  receipt_status TEXT NOT NULL DEFAULT 'missing' CHECK (receipt_status IN ('missing', 'pending', 'received', 'not_needed')),
  recurring_template_id UUID REFERENCES public.recurring_expense_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.weekly_proof_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  task_title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, week_start, task_title)
);

ALTER TABLE public.recurring_expense_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_proof_checklists ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table_name TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY['recurring_expense_templates', 'expenses', 'weekly_proof_checklists']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table_name
        AND policyname = 'Owners can read own rows'
    ) THEN
      EXECUTE format('CREATE POLICY "Owners can read own rows" ON public.%I FOR SELECT USING (auth.uid() = store_id)', v_table_name);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table_name
        AND policyname = 'Owners can insert own rows'
    ) THEN
      EXECUTE format('CREATE POLICY "Owners can insert own rows" ON public.%I FOR INSERT WITH CHECK (auth.uid() = store_id)', v_table_name);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table_name
        AND policyname = 'Owners can update own rows'
    ) THEN
      EXECUTE format('CREATE POLICY "Owners can update own rows" ON public.%I FOR UPDATE USING (auth.uid() = store_id) WITH CHECK (auth.uid() = store_id)', v_table_name);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_operating_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_recurring_expense_templates_updated_at ON public.recurring_expense_templates;
CREATE TRIGGER set_recurring_expense_templates_updated_at
  BEFORE UPDATE ON public.recurring_expense_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_operating_records_updated_at();

DROP TRIGGER IF EXISTS set_expenses_updated_at ON public.expenses;
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_operating_records_updated_at();

DROP TRIGGER IF EXISTS set_weekly_proof_checklists_updated_at ON public.weekly_proof_checklists;
CREATE TRIGGER set_weekly_proof_checklists_updated_at
  BEFORE UPDATE ON public.weekly_proof_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_operating_records_updated_at();
