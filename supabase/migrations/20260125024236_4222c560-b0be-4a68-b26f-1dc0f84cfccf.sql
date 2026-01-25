-- Migração simplificada - apenas tabelas novas que ainda não existem

-- 1. FUNÇÕES (job_functions)
CREATE TABLE IF NOT EXISTS public.job_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20),
  description VARCHAR(50) NOT NULL,
  exempted_from_clock BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.job_functions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company job_functions" ON public.job_functions;
CREATE POLICY "Users can manage their company job_functions" ON public.job_functions FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- 2. ESTADOS CIVIS (marital_statuses)
CREATE TABLE IF NOT EXISTS public.marital_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(10),
  description VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.marital_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company marital_statuses" ON public.marital_statuses;
CREATE POLICY "Users can manage their company marital_statuses" ON public.marital_statuses FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- 3. CIDADES (cities)
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  description VARCHAR(80) NOT NULL,
  state VARCHAR(2) NOT NULL,
  abbreviation VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company cities" ON public.cities;
CREATE POLICY "Users can manage their company cities" ON public.cities FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- 4. ESPECIALIDADES (specialties)
CREATE TABLE IF NOT EXISTS public.specialties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  code VARCHAR(20),
  description VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company specialties" ON public.specialties;
CREATE POLICY "Users can manage their company specialties" ON public.specialties FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- 5. HORA IN ITINERE (commute_time_configs)
CREATE TABLE IF NOT EXISTS public.commute_time_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  description VARCHAR(50) NOT NULL,
  entry_period_start TIME NOT NULL,
  entry_period_end TIME NOT NULL,
  exit_period_start TIME NOT NULL,
  exit_period_end TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.commute_time_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company commute_time_configs" ON public.commute_time_configs;
CREATE POLICY "Users can manage their company commute_time_configs" ON public.commute_time_configs FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- 6. FUNCIONÁRIOS VINCULADOS A HORA IN ITINERE
CREATE TABLE IF NOT EXISTS public.commute_time_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commute_time_id UUID NOT NULL REFERENCES public.commute_time_configs(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(commute_time_id, profile_id)
);
ALTER TABLE public.commute_time_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage commute_time_employees" ON public.commute_time_employees;
CREATE POLICY "Users can manage commute_time_employees" ON public.commute_time_employees FOR ALL USING (
  commute_time_id IN (SELECT id FROM commute_time_configs WHERE company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()))
);

-- 7. BANCO DE COMPENSAÇÃO (compensation_banks)
CREATE TABLE IF NOT EXISTS public.compensation_banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  reference_date DATE NOT NULL,
  credit_hours INTERVAL DEFAULT '00:00:00',
  debit_hours INTERVAL DEFAULT '00:00:00',
  balance INTERVAL DEFAULT '00:00:00',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.compensation_banks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage compensation_banks" ON public.compensation_banks;
DROP POLICY IF EXISTS "Users can view own compensation_banks" ON public.compensation_banks;
CREATE POLICY "Admins can manage compensation_banks" ON public.compensation_banks FOR ALL USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can view own compensation_banks" ON public.compensation_banks FOR SELECT USING (profile_id = get_profile_id(auth.uid()));

-- 8. ABONO EM LOTE (batch_absolutions)
CREATE TABLE IF NOT EXISTS public.batch_absolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  justification_id UUID REFERENCES public.justifications(id),
  description VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  absolve_absences BOOLEAN DEFAULT false,
  absolve_delays BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.batch_absolutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company batch_absolutions" ON public.batch_absolutions;
CREATE POLICY "Users can manage their company batch_absolutions" ON public.batch_absolutions FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- 9. FUNCIONÁRIOS DO ABONO EM LOTE
CREATE TABLE IF NOT EXISTS public.batch_absolution_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_absolution_id UUID NOT NULL REFERENCES public.batch_absolutions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(batch_absolution_id, profile_id)
);
ALTER TABLE public.batch_absolution_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage batch_absolution_employees" ON public.batch_absolution_employees;
CREATE POLICY "Users can manage batch_absolution_employees" ON public.batch_absolution_employees FOR ALL USING (
  batch_absolution_id IN (SELECT id FROM batch_absolutions WHERE company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()))
);

-- 10. SOBRE AVISO (on_call_schedules)
CREATE TABLE IF NOT EXISTS public.on_call_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.on_call_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage on_call_schedules" ON public.on_call_schedules;
DROP POLICY IF EXISTS "Users can view own on_call_schedules" ON public.on_call_schedules;
CREATE POLICY "Admins can manage on_call_schedules" ON public.on_call_schedules FOR ALL USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can view own on_call_schedules" ON public.on_call_schedules FOR SELECT USING (profile_id = get_profile_id(auth.uid()));

-- 11. LAYOUT DE EXPORTAÇÃO (export_layouts)
CREATE TABLE IF NOT EXISTS public.export_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  layout_type VARCHAR(50) NOT NULL,
  field_mapping JSONB NOT NULL DEFAULT '{}',
  delimiter VARCHAR(5) DEFAULT ';',
  file_extension VARCHAR(10) DEFAULT 'txt',
  include_header BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.export_layouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company export_layouts" ON public.export_layouts;
CREATE POLICY "Users can manage their company export_layouts" ON public.export_layouts FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- 12. TOKEN MOBILE (mobile_tokens)
CREATE TABLE IF NOT EXISTS public.mobile_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  token VARCHAR(20) NOT NULL UNIQUE,
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.mobile_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage mobile_tokens" ON public.mobile_tokens;
DROP POLICY IF EXISTS "Users can view own mobile_tokens" ON public.mobile_tokens;
CREATE POLICY "Admins can manage mobile_tokens" ON public.mobile_tokens FOR ALL USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can view own mobile_tokens" ON public.mobile_tokens FOR SELECT USING (profile_id = get_profile_id(auth.uid()));

-- 13. MARCAÇÕES DESCONSIDERADAS (disregarded_records)
CREATE TABLE IF NOT EXISTS public.disregarded_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  time_record_id UUID,
  original_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  justification_id UUID REFERENCES public.justifications(id),
  disregarded_by UUID REFERENCES public.profiles(id),
  disregarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status VARCHAR(20) DEFAULT 'disregarded',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.disregarded_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage disregarded_records" ON public.disregarded_records;
DROP POLICY IF EXISTS "Users can view own disregarded_records" ON public.disregarded_records;
CREATE POLICY "Admins can manage disregarded_records" ON public.disregarded_records FOR ALL USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can view own disregarded_records" ON public.disregarded_records FOR SELECT USING (profile_id = get_profile_id(auth.uid()));

-- 14. TEXTOS CUSTOMIZADOS (custom_texts)
CREATE TABLE IF NOT EXISTS public.custom_texts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  text_key VARCHAR(100) NOT NULL,
  text_value TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, text_key)
);
ALTER TABLE public.custom_texts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company custom_texts" ON public.custom_texts;
CREATE POLICY "Users can manage their company custom_texts" ON public.custom_texts FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- 15. AGENDAMENTO DE NOTIFICAÇÕES (notification_schedules)
CREATE TABLE IF NOT EXISTS public.notification_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  notification_type VARCHAR(50) NOT NULL,
  schedule_cron VARCHAR(100),
  schedule_days JSONB,
  schedule_time TIME,
  recipients JSONB,
  template_subject TEXT,
  template_body TEXT,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage notification_schedules" ON public.notification_schedules;
CREATE POLICY "Admins can manage notification_schedules" ON public.notification_schedules FOR ALL USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));

-- 16. SOLICITAÇÕES DO FUNCIONÁRIO (employee_requests)
CREATE TABLE IF NOT EXISTS public.employee_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  request_type VARCHAR(50) NOT NULL,
  request_date DATE NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own requests" ON public.employee_requests;
DROP POLICY IF EXISTS "Managers can view team requests" ON public.employee_requests;
DROP POLICY IF EXISTS "Managers can update team requests" ON public.employee_requests;
CREATE POLICY "Users can manage their own requests" ON public.employee_requests FOR ALL USING (profile_id = get_profile_id(auth.uid()));
CREATE POLICY "Managers can view team requests" ON public.employee_requests FOR SELECT USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND company_id = get_user_company_id(auth.uid())
);
CREATE POLICY "Managers can update team requests" ON public.employee_requests FOR UPDATE USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND company_id = get_user_company_id(auth.uid())
);

-- 17. CONFIGURAÇÕES AVANÇADAS DO SISTEMA (system_configurations)
CREATE TABLE IF NOT EXISTS public.system_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  config_key VARCHAR(100) NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, config_key)
);
ALTER TABLE public.system_configurations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage system_configurations" ON public.system_configurations;
DROP POLICY IF EXISTS "Users can view system_configurations" ON public.system_configurations;
CREATE POLICY "Admins can manage system_configurations" ON public.system_configurations FOR ALL USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can view system_configurations" ON public.system_configurations FOR SELECT USING (company_id = get_user_company_id(auth.uid()));

-- 18. GRUPOS REP (equipment_groups)
CREATE TABLE IF NOT EXISTS public.equipment_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  department_id UUID REFERENCES public.departments(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their company equipment_groups" ON public.equipment_groups;
CREATE POLICY "Users can manage their company equipment_groups" ON public.equipment_groups FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- 19. EQUIPAMENTOS EM GRUPOS
CREATE TABLE IF NOT EXISTS public.equipment_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.equipment_groups(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.time_clock_equipment(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, equipment_id)
);
ALTER TABLE public.equipment_group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage equipment_group_members" ON public.equipment_group_members;
CREATE POLICY "Users can manage equipment_group_members" ON public.equipment_group_members FOR ALL USING (
  group_id IN (SELECT id FROM equipment_groups WHERE company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_job_functions_company ON public.job_functions(company_id);
CREATE INDEX IF NOT EXISTS idx_compensation_banks_profile ON public.compensation_banks(profile_id);
CREATE INDEX IF NOT EXISTS idx_compensation_banks_date ON public.compensation_banks(reference_date);
CREATE INDEX IF NOT EXISTS idx_on_call_schedules_profile ON public.on_call_schedules(profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_profile ON public.employee_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON public.employee_requests(status);