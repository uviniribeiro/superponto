
-- Tabela de Agrupamentos
CREATE TABLE IF NOT EXISTS public.groupings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20),
  description VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Tabela de Especialidades
CREATE TABLE IF NOT EXISTS public.specialties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20),
  description VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Tabela de Centro de Custo
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20),
  description VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Tabela de Seções
CREATE TABLE IF NOT EXISTS public.sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20),
  description VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Tabela de Sindicatos
CREATE TABLE IF NOT EXISTS public.unions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  description VARCHAR(100),
  cnpj VARCHAR(18) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  website VARCHAR(100),
  entity_type VARCHAR(20) DEFAULT 'sindicato',
  union_type VARCHAR(30) DEFAULT 'empregados',
  street VARCHAR(100),
  number VARCHAR(10),
  complement VARCHAR(30),
  neighborhood VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code),
  UNIQUE(company_id, name),
  UNIQUE(company_id, abbreviation)
);

-- Tabela de Tipos de Funcionário
CREATE TABLE IF NOT EXISTS public.employee_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(9),
  description VARCHAR(40) NOT NULL,
  validate_pis BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Tabela de Funções
CREATE TABLE IF NOT EXISTS public.job_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20),
  description VARCHAR(50) NOT NULL,
  exempt_from_time_clock BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Tabela de Locais de Trabalho
CREATE TABLE IF NOT EXISTS public.work_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20),
  description VARCHAR(50) NOT NULL,
  parent_id UUID REFERENCES public.work_locations(id),
  current_employees INTEGER DEFAULT 0,
  max_employees INTEGER,
  anti_passback_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Tabela de Locais Georreferenciados
CREATE TABLE IF NOT EXISTS public.georeferenced_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  description VARCHAR(150) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  radius_meters INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Vínculo Funcionário-Local Georreferenciado
CREATE TABLE IF NOT EXISTS public.employee_georeferenced_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.georeferenced_locations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, location_id)
);

-- Tabela de Competências (Períodos)
CREATE TABLE IF NOT EXISTS public.competency_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  description VARCHAR(60) NOT NULL,
  reference_month_year DATE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Tabela de Justificativas
CREATE TABLE IF NOT EXISTS public.justifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(5),
  description VARCHAR(50) NOT NULL,
  justify_type VARCHAR(20) DEFAULT 'absence',
  deduct_hours BOOLEAN DEFAULT false,
  generate_extra BOOLEAN DEFAULT false,
  payroll_code VARCHAR(20),
  absence_days INTEGER,
  usage_limit INTEGER,
  usage_limit_period_months INTEGER,
  visible_to_employees BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Tabela de Percentuais de Extra
CREATE TABLE IF NOT EXISTS public.overtime_percentages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  description VARCHAR(20),
  percentage_value DECIMAL(6, 2) NOT NULL,
  external_code VARCHAR(20),
  is_night BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, percentage_value)
);

-- Tabela de Hora In Itinere
CREATE TABLE IF NOT EXISTS public.in_itinere_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  description VARCHAR(50) NOT NULL,
  time_going TIME,
  time_returning TIME,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Políticas de Aprovação
CREATE TABLE IF NOT EXISTS public.approval_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name VARCHAR(50) NOT NULL,
  level_type VARCHAR(20) DEFAULT 'hierarchy',
  hierarchy_levels INTEGER DEFAULT 1,
  specific_user_id UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Escalas Fixas
CREATE TABLE IF NOT EXISTS public.fixed_scales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20),
  description VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  calculate_dsr BOOLEAN DEFAULT false,
  consider_holiday BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Ciclos da Escala Fixa
CREATE TABLE IF NOT EXISTS public.fixed_scale_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixed_scale_id UUID NOT NULL REFERENCES public.fixed_scales(id) ON DELETE CASCADE,
  work_schedule_id UUID REFERENCES public.work_schedules(id),
  work_days INTEGER NOT NULL CHECK (work_days BETWEEN 1 AND 99),
  off_days INTEGER NOT NULL CHECK (off_days BETWEEN 1 AND 99),
  cycle_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vínculo Funcionário-Escala Fixa
CREATE TABLE IF NOT EXISTS public.employee_fixed_scales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fixed_scale_id UUID NOT NULL REFERENCES public.fixed_scales(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, fixed_scale_id, start_date)
);

-- Tabela de Escalas Agendadas
CREATE TABLE IF NOT EXISTS public.scheduled_scales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scale_date DATE NOT NULL,
  is_work_day BOOLEAN DEFAULT true,
  work_schedule_id UUID REFERENCES public.work_schedules(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, scale_date)
);

-- Tabela de Mobilidade de Intervalo
CREATE TABLE IF NOT EXISTS public.interval_mobility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  description VARCHAR(50) NOT NULL,
  work_schedule_id UUID NOT NULL REFERENCES public.work_schedules(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, description)
);

-- Dias da Mobilidade de Intervalo
CREATE TABLE IF NOT EXISTS public.interval_mobility_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interval_mobility_id UUID NOT NULL REFERENCES public.interval_mobility(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  entry_start TIME,
  entry_end TIME,
  exit_start TIME,
  exit_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Abonos em Lote
CREATE TABLE IF NOT EXISTS public.batch_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  description VARCHAR(100) NOT NULL,
  justification_id UUID REFERENCES public.justifications(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  allow_absences BOOLEAN DEFAULT false,
  allow_delays BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vínculo Funcionário-Abono em Lote
CREATE TABLE IF NOT EXISTS public.batch_allowance_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_allowance_id UUID NOT NULL REFERENCES public.batch_allowances(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_allowance_id, profile_id)
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.groupings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.georeferenced_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_georeferenced_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_percentages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_itinere_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_scale_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_fixed_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interval_mobility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interval_mobility_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_allowance_employees ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para todas as tabelas (apenas usuários autenticados da mesma empresa)
CREATE POLICY "Users can manage their company groupings" ON public.groupings FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company specialties" ON public.specialties FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company cost_centers" ON public.cost_centers FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company sections" ON public.sections FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company unions" ON public.unions FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company employee_types" ON public.employee_types FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company job_functions" ON public.job_functions FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company work_locations" ON public.work_locations FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company georeferenced_locations" ON public.georeferenced_locations FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company employee_georeferenced_locations" ON public.employee_georeferenced_locations FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company competency_periods" ON public.competency_periods FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company justifications" ON public.justifications FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company overtime_percentages" ON public.overtime_percentages FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company in_itinere_hours" ON public.in_itinere_hours FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company approval_policies" ON public.approval_policies FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company fixed_scales" ON public.fixed_scales FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage fixed_scale_cycles" ON public.fixed_scale_cycles FOR ALL USING (fixed_scale_id IN (SELECT id FROM public.fixed_scales WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Users can manage their company employee_fixed_scales" ON public.employee_fixed_scales FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company scheduled_scales" ON public.scheduled_scales FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage their company interval_mobility" ON public.interval_mobility FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage interval_mobility_days" ON public.interval_mobility_days FOR ALL USING (interval_mobility_id IN (SELECT id FROM public.interval_mobility WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Users can manage their company batch_allowances" ON public.batch_allowances FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage batch_allowance_employees" ON public.batch_allowance_employees FOR ALL USING (batch_allowance_id IN (SELECT id FROM public.batch_allowances WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_groupings_updated_at BEFORE UPDATE ON public.groupings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_specialties_updated_at BEFORE UPDATE ON public.specialties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cost_centers_updated_at BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_unions_updated_at BEFORE UPDATE ON public.unions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employee_types_updated_at BEFORE UPDATE ON public.employee_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_functions_updated_at BEFORE UPDATE ON public.job_functions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_locations_updated_at BEFORE UPDATE ON public.work_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_georeferenced_locations_updated_at BEFORE UPDATE ON public.georeferenced_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_competency_periods_updated_at BEFORE UPDATE ON public.competency_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_justifications_updated_at BEFORE UPDATE ON public.justifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_overtime_percentages_updated_at BEFORE UPDATE ON public.overtime_percentages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_in_itinere_hours_updated_at BEFORE UPDATE ON public.in_itinere_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_approval_policies_updated_at BEFORE UPDATE ON public.approval_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fixed_scales_updated_at BEFORE UPDATE ON public.fixed_scales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scheduled_scales_updated_at BEFORE UPDATE ON public.scheduled_scales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_interval_mobility_updated_at BEFORE UPDATE ON public.interval_mobility FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_batch_allowances_updated_at BEFORE UPDATE ON public.batch_allowances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
