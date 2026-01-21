-- Create table for schools (escolas) linked to city halls
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  inep_code TEXT,
  school_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for health units (unidades de saúde) linked to city halls
CREATE TABLE IF NOT EXISTS public.health_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  cnes_code TEXT,
  unit_type TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for class groups (turmas)
CREATE TABLE IF NOT EXISTS public.class_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  grade TEXT,
  shift TEXT,
  year INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for lesson plans (planos de aula)
CREATE TABLE IF NOT EXISTS public.lesson_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  class_group_id UUID REFERENCES public.class_groups(id) ON DELETE SET NULL,
  class_date DATE NOT NULL,
  subject TEXT,
  topic TEXT NOT NULL,
  objectives TEXT,
  content TEXT,
  methodology TEXT,
  resources TEXT,
  evaluation TEXT,
  observations TEXT,
  number_of_classes INTEGER DEFAULT 1,
  total_minutes INTEGER,
  status TEXT DEFAULT 'planned',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for schools
CREATE POLICY "Users can view schools from their company" ON public.schools
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()) OR company_id IN (
    SELECT id FROM public.companies WHERE parent_organization_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Admins can manage schools" ON public.schools
  FOR ALL USING (has_role(auth.uid(), 'admin') AND (company_id = get_user_company_id(auth.uid()) OR company_id IN (
    SELECT id FROM public.companies WHERE parent_organization_id = get_user_company_id(auth.uid())
  )));

-- RLS policies for health_units
CREATE POLICY "Users can view health units from their company" ON public.health_units
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()) OR company_id IN (
    SELECT id FROM public.companies WHERE parent_organization_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Admins can manage health units" ON public.health_units
  FOR ALL USING (has_role(auth.uid(), 'admin') AND (company_id = get_user_company_id(auth.uid()) OR company_id IN (
    SELECT id FROM public.companies WHERE parent_organization_id = get_user_company_id(auth.uid())
  )));

-- RLS policies for class_groups
CREATE POLICY "Users can view class groups from their company" ON public.class_groups
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()) OR company_id IN (
    SELECT id FROM public.companies WHERE parent_organization_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Admins can manage class groups" ON public.class_groups
  FOR ALL USING (has_role(auth.uid(), 'admin') AND (company_id = get_user_company_id(auth.uid()) OR company_id IN (
    SELECT id FROM public.companies WHERE parent_organization_id = get_user_company_id(auth.uid())
  )));

-- RLS policies for lesson_plans
CREATE POLICY "Users can view their own lesson plans" ON public.lesson_plans
  FOR SELECT USING (
    profile_id = get_profile_id(auth.uid()) OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Users can create lesson plans" ON public.lesson_plans
  FOR INSERT WITH CHECK (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Users can update their own lesson plans" ON public.lesson_plans
  FOR UPDATE USING (profile_id = get_profile_id(auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete lesson plans" ON public.lesson_plans
  FOR DELETE USING (has_role(auth.uid(), 'admin') OR profile_id = get_profile_id(auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_units_updated_at
  BEFORE UPDATE ON public.health_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_groups_updated_at
  BEFORE UPDATE ON public.class_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_plans_updated_at
  BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();