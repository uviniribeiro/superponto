-- Refeitório: tipos de refeição por horário (preço, parte do funcionário, limite por dia), registro
-- no mesmo terminal de ponto (terminal com finalidade "refeitório") e relatório de consumo e custo.
ALTER TABLE public.kiosk_terminals ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'punch'
  CHECK (purpose IN ('punch', 'meal'));

CREATE TABLE IF NOT EXISTS public.meal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  employee_share numeric(5,2) NOT NULL DEFAULT 0 CHECK (employee_share BETWEEN 0 AND 100),
  daily_limit int NOT NULL DEFAULT 1 CHECK (daily_limit BETWEEN 1 AND 10),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meal_types_company_idx ON public.meal_types(company_id);

CREATE TABLE IF NOT EXISTS public.meal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_type_id uuid REFERENCES public.meal_types(id) ON DELETE SET NULL,
  meal_name text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  price numeric(10,2) NOT NULL DEFAULT 0,
  employee_amount numeric(10,2) NOT NULL DEFAULT 0,
  terminal_id uuid REFERENCES public.kiosk_terminals(id) ON DELETE SET NULL,
  verification text,
  transaction_hash text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meal_records_company_date_idx ON public.meal_records(company_id, recorded_at);
CREATE INDEX IF NOT EXISTS meal_records_profile_idx ON public.meal_records(profile_id, recorded_at);

ALTER TABLE public.meal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users view meal types" ON public.meal_types FOR SELECT
  USING (company_id = private.get_user_company_id(auth.uid()));
CREATE POLICY "Admins manage meal types" ON public.meal_types FOR ALL
  USING (company_id = private.get_user_company_id(auth.uid()) AND private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (company_id = private.get_user_company_id(auth.uid()) AND private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Managers view meal records" ON public.meal_records FOR SELECT
  USING (company_id = private.get_user_company_id(auth.uid())
    AND (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'manager'::public.app_role)));
CREATE POLICY "Employees view own meal records" ON public.meal_records FOR SELECT
  USING (profile_id = private.get_profile_id(auth.uid()));
CREATE POLICY "Admins delete meal records" ON public.meal_records FOR DELETE
  USING (company_id = private.get_user_company_id(auth.uid()) AND private.has_role(auth.uid(), 'admin'::public.app_role));
