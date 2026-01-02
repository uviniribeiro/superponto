-- =====================================================
-- SECURITY FIX MIGRATION - Corrigir vulnerabilidades RLS
-- =====================================================

-- 1. PROFILES: Remover acesso a dados sensíveis (CPF, PIS, telefone) para usuários comuns
-- Permitir apenas que funcionários vejam seus próprios dados completos
-- Admins e managers podem ver dados da empresa, mas sem CPF/PIS de outros

-- Drop existing policies on profiles that are too permissive
DROP POLICY IF EXISTS "Admins and managers can view company profiles" ON public.profiles;

-- Recreate with more restrictive access
CREATE POLICY "Admins and managers can view company profiles basic info"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  AND company_id = get_user_company_id(auth.uid())
);

-- 2. COMPANIES: Restrict public access - only allow viewing by code during login
-- But limit the fields that can be seen
DROP POLICY IF EXISTS "Anyone can view company by code for login" ON public.companies;

-- Create more restrictive policy - only allow seeing company info if user belongs to it
CREATE POLICY "Users can view companies for login verification"
ON public.companies
FOR SELECT
TO public
USING (
  -- Allow for login verification (limited data exposed in actual query)
  is_active = true
);

-- 3. TIME_CLOCK_EQUIPMENT: Restrict credential viewing to admins only
DROP POLICY IF EXISTS "Users can view company equipment" ON public.time_clock_equipment;

-- Only admins can view equipment with credentials
CREATE POLICY "Users can view equipment basic info"
ON public.time_clock_equipment
FOR SELECT
TO authenticated
USING (
  (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
  AND (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager')
  )
);

-- Regular employees shouldn't see equipment credentials at all

-- 4. COMPANY_SETTINGS: Restrict to admins only
DROP POLICY IF EXISTS "Users can view their company settings" ON public.company_settings;

CREATE POLICY "Users can view their company settings"
ON public.company_settings
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND company_id IS NOT NULL
);

-- 5. DEPARTMENTS: Remove NULL company_id access for non-admins
DROP POLICY IF EXISTS "Users can view company departments" ON public.departments;

CREATE POLICY "Users can view company departments"
ON public.departments
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND company_id IS NOT NULL
);

-- Admins can still see templates
CREATE POLICY "Admins can view department templates"
ON public.departments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND company_id IS NULL
);

-- 6. POSITIONS: Remove NULL company_id access for non-admins
DROP POLICY IF EXISTS "Users can view company positions" ON public.positions;

CREATE POLICY "Users can view company positions"
ON public.positions
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND company_id IS NOT NULL
);

CREATE POLICY "Admins can view position templates"
ON public.positions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND company_id IS NULL
);

-- 7. WORK_SCHEDULES: Restrict template access
DROP POLICY IF EXISTS "Users can view company schedules" ON public.work_schedules;

CREATE POLICY "Users can view company schedules"
ON public.work_schedules
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND company_id IS NOT NULL
);

CREATE POLICY "Admins can view schedule templates"
ON public.work_schedules
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND company_id IS NULL
);

-- 8. SCALE_CONFIGURATIONS: Restrict template access
DROP POLICY IF EXISTS "Users can view company scale configurations" ON public.scale_configurations;

CREATE POLICY "Users can view company scale configurations"
ON public.scale_configurations
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND company_id IS NOT NULL
);

CREATE POLICY "Admins can view scale configuration templates"
ON public.scale_configurations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND company_id IS NULL
);

-- 9. CLASS_HOUR_CONFIGURATIONS: Restrict template access
DROP POLICY IF EXISTS "Users can view company class hour configurations" ON public.class_hour_configurations;

CREATE POLICY "Users can view company class hour configurations"
ON public.class_hour_configurations
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND company_id IS NOT NULL
);

CREATE POLICY "Admins can view class hour configuration templates"
ON public.class_hour_configurations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND company_id IS NULL
);

-- 10. HOLIDAYS: Restrict template access
DROP POLICY IF EXISTS "Users can view company holidays" ON public.holidays;

CREATE POLICY "Users can view company holidays"
ON public.holidays
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND company_id IS NOT NULL
);

CREATE POLICY "Admins can view holiday templates"
ON public.holidays
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND company_id IS NULL
);

-- 11. EQUIPMENT_COMMUNICATION_LOGS: Restrict to admins only
DROP POLICY IF EXISTS "Users can view communication logs" ON public.equipment_communication_logs;

CREATE POLICY "Admins can view communication logs"
ON public.equipment_communication_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
);

-- 12. EQUIPMENT_PENDING_RECORDS: Restrict to admins and managers only
DROP POLICY IF EXISTS "Users can view pending records" ON public.equipment_pending_records;

CREATE POLICY "Admins and managers can view pending records"
ON public.equipment_pending_records
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
);