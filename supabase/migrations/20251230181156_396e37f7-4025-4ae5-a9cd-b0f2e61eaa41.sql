-- Create licenses table for company license management
CREATE TABLE public.licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL UNIQUE,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL,
  max_employees INTEGER DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS on licenses table
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- RLS Policies for licenses table
-- Super admins can do everything
CREATE POLICY "Super admins can manage all licenses"
ON public.licenses
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Company admins can view their own license
CREATE POLICY "Company admins can view their license"
ON public.licenses
FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

-- Create trigger for updated_at
CREATE TRIGGER update_licenses_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update companies table to track license status
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'active';

-- Update profiles to allow super_admin to view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Super admins can manage all companies
CREATE POLICY "Super admins can manage all companies"
ON public.companies
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Super admins can insert companies
CREATE POLICY "Super admins can insert companies"
ON public.companies
FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));