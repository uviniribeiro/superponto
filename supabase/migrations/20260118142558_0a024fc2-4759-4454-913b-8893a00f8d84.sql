-- Add new module flags to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS doctor_module_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payroll_module_enabled boolean DEFAULT false;

-- Add comments
COMMENT ON COLUMN public.companies.doctor_module_enabled IS 'Habilita módulo de gestão médica para a empresa';
COMMENT ON COLUMN public.companies.payroll_module_enabled IS 'Habilita módulo de folha de pagamento para a empresa';

-- =====================================================
-- MÓDULO MÉDICO - Tabelas
-- =====================================================

-- Configurações de plantões médicos
CREATE TABLE public.medical_shift_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_hours INTEGER NOT NULL DEFAULT 12,
  hourly_rate NUMERIC(10,2),
  night_shift_start TIME DEFAULT '19:00',
  night_shift_end TIME DEFAULT '07:00',
  night_shift_rate_multiplier NUMERIC(4,2) DEFAULT 1.5,
  weekend_rate_multiplier NUMERIC(4,2) DEFAULT 1.5,
  holiday_rate_multiplier NUMERIC(4,2) DEFAULT 2.0,
  on_call_rate_multiplier NUMERIC(4,2) DEFAULT 0.5,
  max_consecutive_hours INTEGER DEFAULT 24,
  min_rest_hours INTEGER DEFAULT 11,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_shift_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company medical shift configs"
ON public.medical_shift_configurations FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage medical shift configs"
ON public.medical_shift_configurations FOR ALL
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Atribuições de médicos
CREATE TABLE public.doctor_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_configuration_id UUID NOT NULL REFERENCES public.medical_shift_configurations(id) ON DELETE CASCADE,
  specialty TEXT,
  crm TEXT,
  crm_state CHAR(2),
  contract_type TEXT DEFAULT 'hourly',
  contract_weekly_hours NUMERIC(5,2),
  contract_monthly_hours NUMERIC(6,2),
  work_schedule_id UUID REFERENCES public.work_schedules(id),
  health_unit TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company doctor assignments"
ON public.doctor_assignments FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage doctor assignments"
ON public.doctor_assignments FOR ALL
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Registros de plantões médicos
CREATE TABLE public.medical_shift_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shift_configuration_id UUID NOT NULL REFERENCES public.medical_shift_configurations(id),
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_hours NUMERIC(5,2) NOT NULL,
  shift_type TEXT DEFAULT 'regular',
  health_unit TEXT,
  notes TEXT,
  is_night_shift BOOLEAN DEFAULT false,
  is_weekend BOOLEAN DEFAULT false,
  is_holiday BOOLEAN DEFAULT false,
  is_on_call BOOLEAN DEFAULT false,
  transaction_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_shift_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company shift records"
ON public.medical_shift_records FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage shift records"
ON public.medical_shift_records FOR ALL
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Quadro de plantões (slots de horário)
CREATE TABLE public.doctor_schedule_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.doctor_assignments(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  shift_number INTEGER NOT NULL DEFAULT 1,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  health_unit TEXT,
  sector TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, day_of_week, shift_number, is_active)
);

ALTER TABLE public.doctor_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company schedule slots"
ON public.doctor_schedule_slots FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage schedule slots"
ON public.doctor_schedule_slots FOR ALL
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- MÓDULO FOLHA DE PAGAMENTO - Tabelas
-- =====================================================

-- Rubricas de folha (eventos de pagamento/desconto)
CREATE TABLE public.payroll_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('earning', 'deduction', 'informative')),
  calculation_type TEXT DEFAULT 'fixed',
  default_value NUMERIC(12,2),
  percentage NUMERIC(6,4),
  affects_inss BOOLEAN DEFAULT true,
  affects_irrf BOOLEAN DEFAULT true,
  affects_fgts BOOLEAN DEFAULT true,
  is_mandatory BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company payroll items"
ON public.payroll_items FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage payroll items"
ON public.payroll_items FOR ALL
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Folhas de pagamento (períodos)
CREATE TABLE public.payrolls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_month INTEGER NOT NULL CHECK (reference_month >= 1 AND reference_month <= 12),
  reference_year INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payment_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'calculated', 'approved', 'paid', 'cancelled')),
  total_earnings NUMERIC(14,2) DEFAULT 0,
  total_deductions NUMERIC(14,2) DEFAULT 0,
  total_net NUMERIC(14,2) DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  notes TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, reference_month, reference_year)
);

ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company payrolls"
ON public.payrolls FOR SELECT
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage payrolls"
ON public.payrolls FOR ALL
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Holerites (contra-cheques individuais)
CREATE TABLE public.payslips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  payroll_id UUID NOT NULL REFERENCES public.payrolls(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_salary NUMERIC(12,2) NOT NULL,
  total_earnings NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_salary NUMERIC(12,2) DEFAULT 0,
  inss_base NUMERIC(12,2) DEFAULT 0,
  inss_value NUMERIC(12,2) DEFAULT 0,
  irrf_base NUMERIC(12,2) DEFAULT 0,
  irrf_value NUMERIC(12,2) DEFAULT 0,
  fgts_base NUMERIC(12,2) DEFAULT 0,
  fgts_value NUMERIC(12,2) DEFAULT 0,
  worked_days INTEGER DEFAULT 30,
  worked_hours NUMERIC(8,2) DEFAULT 0,
  overtime_hours NUMERIC(8,2) DEFAULT 0,
  absence_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'approved', 'sent', 'viewed')),
  sent_at TIMESTAMPTZ,
  sent_via TEXT,
  viewed_at TIMESTAMPTZ,
  pdf_url TEXT,
  transaction_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payroll_id, profile_id)
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payslips"
ON public.payslips FOR SELECT
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage payslips"
ON public.payslips FOR ALL
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Itens do holerite (detalhamento)
CREATE TABLE public.payslip_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  payroll_item_id UUID REFERENCES public.payroll_items(id),
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('earning', 'deduction', 'informative')),
  reference TEXT,
  quantity NUMERIC(10,4),
  unit_value NUMERIC(12,4),
  total_value NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payslip items"
ON public.payslip_items FOR SELECT
USING (
  payslip_id IN (
    SELECT id FROM payslips 
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Admins can manage payslip items"
ON public.payslip_items FOR ALL
USING (
  payslip_id IN (
    SELECT id FROM payslips 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Histórico de envio de holerites
CREATE TABLE public.payslip_delivery_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  delivery_method TEXT NOT NULL,
  recipient TEXT,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payslip_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their delivery logs"
ON public.payslip_delivery_log FOR SELECT
USING (
  payslip_id IN (
    SELECT id FROM payslips 
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Admins can manage delivery logs"
ON public.payslip_delivery_log FOR ALL
USING (
  payslip_id IN (
    SELECT id FROM payslips 
    WHERE company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Tabela INSS (faixas de contribuição)
CREATE TABLE public.inss_brackets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  min_salary NUMERIC(12,2) NOT NULL,
  max_salary NUMERIC(12,2),
  rate NUMERIC(5,4) NOT NULL,
  deduction_value NUMERIC(12,2) DEFAULT 0,
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inss_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inss brackets"
ON public.inss_brackets FOR SELECT
USING (company_id IS NULL OR company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage inss brackets"
ON public.inss_brackets FOR ALL
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Tabela IRRF (faixas de imposto de renda)
CREATE TABLE public.irrf_brackets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  min_salary NUMERIC(12,2) NOT NULL,
  max_salary NUMERIC(12,2),
  rate NUMERIC(5,4) NOT NULL,
  deduction_value NUMERIC(12,2) DEFAULT 0,
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.irrf_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view irrf brackets"
ON public.irrf_brackets FOR SELECT
USING (company_id IS NULL OR company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage irrf brackets"
ON public.irrf_brackets FOR ALL
USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Triggers para updated_at
CREATE TRIGGER update_medical_shift_configurations_updated_at
BEFORE UPDATE ON public.medical_shift_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctor_assignments_updated_at
BEFORE UPDATE ON public.doctor_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medical_shift_records_updated_at
BEFORE UPDATE ON public.medical_shift_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_items_updated_at
BEFORE UPDATE ON public.payroll_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payrolls_updated_at
BEFORE UPDATE ON public.payrolls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payslips_updated_at
BEFORE UPDATE ON public.payslips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_doctor_assignments_company ON public.doctor_assignments(company_id);
CREATE INDEX idx_doctor_assignments_profile ON public.doctor_assignments(profile_id);
CREATE INDEX idx_medical_shift_records_company ON public.medical_shift_records(company_id);
CREATE INDEX idx_medical_shift_records_profile ON public.medical_shift_records(profile_id);
CREATE INDEX idx_medical_shift_records_date ON public.medical_shift_records(shift_date);
CREATE INDEX idx_doctor_schedule_slots_profile ON public.doctor_schedule_slots(profile_id);
CREATE INDEX idx_payrolls_company ON public.payrolls(company_id);
CREATE INDEX idx_payrolls_period ON public.payrolls(reference_year, reference_month);
CREATE INDEX idx_payslips_payroll ON public.payslips(payroll_id);
CREATE INDEX idx_payslips_profile ON public.payslips(profile_id);
CREATE INDEX idx_payslip_items_payslip ON public.payslip_items(payslip_id);