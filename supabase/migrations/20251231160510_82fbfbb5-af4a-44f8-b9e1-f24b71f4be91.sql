-- Criar enum para tipos de escala
CREATE TYPE public.scale_type AS ENUM ('standard', '5x1', '6x1', '12x36');

-- Criar enum para tratamento de feriado
CREATE TYPE public.holiday_treatment AS ENUM ('normal', 'overtime', 'off');

-- Tabela de tipos de escala configuráveis
CREATE TABLE public.scale_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scale_type scale_type NOT NULL DEFAULT 'standard',
  work_days INTEGER NOT NULL DEFAULT 5,
  off_days INTEGER NOT NULL DEFAULT 1,
  work_hours_per_day NUMERIC(4,2) DEFAULT 8,
  holiday_treatment holiday_treatment NOT NULL DEFAULT 'normal',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de vínculo funcionário-escala
CREATE TABLE public.employee_scale_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scale_configuration_id UUID NOT NULL REFERENCES public.scale_configurations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  scale_start_day DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de folgas personalizadas (ajustes manuais)
CREATE TABLE public.employee_off_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  off_date DATE NOT NULL,
  reason TEXT,
  is_manual_override BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configuração de hora aula
CREATE TABLE public.class_hour_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 50,
  hourly_rate NUMERIC(10,2),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de vínculo funcionário-hora aula
CREATE TABLE public.employee_class_hour_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_hour_configuration_id UUID NOT NULL REFERENCES public.class_hour_configurations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de registro de aulas ministradas
CREATE TABLE public.class_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_hour_configuration_id UUID NOT NULL REFERENCES public.class_hour_configurations(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  number_of_classes INTEGER NOT NULL DEFAULT 1,
  total_minutes INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.scale_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_scale_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_off_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_hour_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_class_hour_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_records ENABLE ROW LEVEL SECURITY;

-- Policies para scale_configurations
CREATE POLICY "Admins can manage company scale configurations"
ON public.scale_configurations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

CREATE POLICY "Users can view company scale configurations"
ON public.scale_configurations FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

-- Policies para employee_scale_assignments
CREATE POLICY "Admins can manage employee scale assignments"
ON public.employee_scale_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

CREATE POLICY "Users can view own scale assignments"
ON public.employee_scale_assignments FOR SELECT
USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Admins and managers can view all scale assignments"
ON public.employee_scale_assignments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Policies para employee_off_days
CREATE POLICY "Admins can manage employee off days"
ON public.employee_off_days FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

CREATE POLICY "Users can view own off days"
ON public.employee_off_days FOR SELECT
USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Admins and managers can view all off days"
ON public.employee_off_days FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Policies para class_hour_configurations
CREATE POLICY "Admins can manage company class hour configurations"
ON public.class_hour_configurations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

CREATE POLICY "Users can view company class hour configurations"
ON public.class_hour_configurations FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

-- Policies para employee_class_hour_assignments
CREATE POLICY "Admins can manage employee class hour assignments"
ON public.employee_class_hour_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

CREATE POLICY "Users can view own class hour assignments"
ON public.employee_class_hour_assignments FOR SELECT
USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Admins and managers can view all class hour assignments"
ON public.employee_class_hour_assignments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Policies para class_records
CREATE POLICY "Users can insert own class records"
ON public.class_records FOR INSERT
WITH CHECK (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Users can view own class records"
ON public.class_records FOR SELECT
USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Admins and managers can view all class records"
ON public.class_records FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can manage all class records"
ON public.class_records FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

-- Triggers para updated_at
CREATE TRIGGER update_scale_configurations_updated_at
BEFORE UPDATE ON public.scale_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_scale_assignments_updated_at
BEFORE UPDATE ON public.employee_scale_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_hour_configurations_updated_at
BEFORE UPDATE ON public.class_hour_configurations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_class_hour_assignments_updated_at
BEFORE UPDATE ON public.employee_class_hour_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_records_updated_at
BEFORE UPDATE ON public.class_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();