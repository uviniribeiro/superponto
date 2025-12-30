-- Create departments table with hierarchy support
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create positions table with hierarchy support
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- RLS policies for departments
CREATE POLICY "Users can view company departments"
ON public.departments FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

CREATE POLICY "Admins can manage company departments"
ON public.departments FOR ALL
USING (has_role(auth.uid(), 'admin') AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

-- RLS policies for positions
CREATE POLICY "Users can view company positions"
ON public.positions FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

CREATE POLICY "Admins can manage company positions"
ON public.positions FOR ALL
USING (has_role(auth.uid(), 'admin') AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

-- Triggers for updated_at
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_positions_updated_at
BEFORE UPDATE ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();