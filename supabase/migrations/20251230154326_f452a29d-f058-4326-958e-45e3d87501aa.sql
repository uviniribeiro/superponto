-- Create companies table for multi-tenancy
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  company_code TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Add company_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Add company_id to company_settings (rename to be per-company)
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Add company_id to all relevant tables
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.work_schedules ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.overtime_alerts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.adjustment_requests ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.employee_schedules ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.role_change_history ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Create function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for companies table
CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
USING (id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can update their company"
ON public.companies
FOR UPDATE
USING (id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Allow public to view companies for login (to validate company code)
CREATE POLICY "Anyone can view company by code for login"
ON public.companies
FOR SELECT
USING (true);

-- Update RLS policies for profiles to include company isolation
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and managers can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins and managers can view company profiles"
ON public.profiles
FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND company_id = get_user_company_id(auth.uid())
);

-- Update time_records RLS for company isolation
DROP POLICY IF EXISTS "Admins and managers can view all time records" ON public.time_records;

CREATE POLICY "Admins and managers can view company time records"
ON public.time_records
FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND company_id = get_user_company_id(auth.uid())
);

-- Update work_schedules RLS for company isolation
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON public.work_schedules;

CREATE POLICY "Users can view company schedules"
ON public.work_schedules
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

DROP POLICY IF EXISTS "Admins can manage schedules" ON public.work_schedules;

CREATE POLICY "Admins can manage company schedules"
ON public.work_schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

-- Update holidays RLS for company isolation
DROP POLICY IF EXISTS "Authenticated users can view holidays" ON public.holidays;

CREATE POLICY "Users can view company holidays"
ON public.holidays
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;

CREATE POLICY "Admins can manage company holidays"
ON public.holidays
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

-- Update company_settings RLS for company isolation  
DROP POLICY IF EXISTS "Authenticated users can view company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admins can manage company settings" ON public.company_settings;

CREATE POLICY "Users can view their company settings"
ON public.company_settings
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

CREATE POLICY "Admins can manage their company settings"
ON public.company_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

-- Trigger to update updated_at
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();