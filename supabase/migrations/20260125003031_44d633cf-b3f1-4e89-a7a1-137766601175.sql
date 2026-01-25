-- Fix security vulnerabilities for the 3 views without RLS
-- Add RLS policies to the views to restrict access

-- 1. Drop and recreate profiles_secure view with proper RLS check
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.user_id,
  p.company_id,
  p.hire_date,
  p.is_active,
  p.must_change_password,
  p.created_at,
  p.updated_at,
  p.full_name,
  -- Mask sensitive fields for non-owners and non-admins
  CASE 
    WHEN p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') 
    THEN p.email 
    ELSE NULL 
  END as email,
  CASE 
    WHEN p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') 
    THEN p.phone 
    ELSE NULL 
  END as phone,
  CASE 
    WHEN p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') 
    THEN p.cpf 
    ELSE NULL 
  END as cpf,
  CASE 
    WHEN p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') 
    THEN p.pis 
    ELSE NULL 
  END as pis,
  p.registration_number,
  p.position,
  p.department,
  p.photo_url
FROM public.profiles p
WHERE 
  -- Restrict to same company or super admin
  p.company_id = public.get_user_company_id(auth.uid()) 
  OR public.is_super_admin(auth.uid())
  OR p.user_id = auth.uid();

-- 2. Drop and recreate time_clock_equipment_secure view with proper RLS check
DROP VIEW IF EXISTS public.time_clock_equipment_secure;

CREATE VIEW public.time_clock_equipment_secure WITH (security_invoker = true) AS
SELECT 
  t.id,
  t.company_id,
  t.port,
  t.is_active,
  t.is_online,
  t.last_communication,
  t.last_sync,
  t.sync_interval_seconds,
  t.created_at,
  t.updated_at,
  t.name,
  t.manufacturer,
  t.model,
  t.serial_number,
  t.ip_address,
  t.protocol,
  t.communication_type,
  t.api_endpoint,
  -- ONLY admins can see credentials
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') 
    THEN t.username 
    ELSE NULL 
  END as username,
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') 
    THEN t.password 
    ELSE NULL 
  END as password,
  t.firmware_version,
  t.location,
  t.notes,
  t.portaria_compliance,
  t.rep_number
FROM public.time_clock_equipment t
WHERE 
  -- Only users from the same company or admins
  (t.company_id = public.get_user_company_id(auth.uid()) OR t.company_id IS NULL)
  AND public.has_role(auth.uid(), 'admin');

-- 3. Drop and recreate payroll_exports_secure view with proper RLS check
DROP VIEW IF EXISTS public.payroll_exports_secure;

CREATE VIEW public.payroll_exports_secure WITH (security_invoker = true) AS
SELECT 
  pe.id,
  pe.company_id,
  pe.period_start,
  pe.period_end,
  pe.employee_count,
  pe.total_hours,
  pe.created_by,
  pe.created_at,
  pe.export_type,
  -- Mask file_url from non-admins, only show status
  CASE 
    WHEN public.has_role(auth.uid(), 'admin') 
    THEN 'available' 
    ELSE 'restricted' 
  END as file_status,
  pe.status,
  pe.notes,
  pe.transaction_hash
FROM public.payroll_exports pe
WHERE 
  -- Only admins from the same company can see payroll exports
  pe.company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin');

-- 4. Fix function search_path for security functions
CREATE OR REPLACE FUNCTION public.update_doctor_schedule_slots_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;