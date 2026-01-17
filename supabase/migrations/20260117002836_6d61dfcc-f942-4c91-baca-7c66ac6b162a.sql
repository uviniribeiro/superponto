
-- Fix overly permissive RLS policies (WITH CHECK (true))

-- 1. Drop the overly permissive "System can insert audit logs" policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- 2. Drop the overly permissive "System can insert alerts" policy  
DROP POLICY IF EXISTS "System can insert alerts" ON public.overtime_alerts;

-- 3. Create a proper INSERT policy for overtime_alerts
-- Only authenticated users can insert alerts for profiles in their company
CREATE POLICY "Authenticated users can insert alerts for company members"
ON public.overtime_alerts
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_id
    AND p.company_id = get_user_company_id(auth.uid())
  )
);

-- 4. Add policy for admins/managers to insert alerts for their company
CREATE POLICY "Admins and managers can insert company alerts"
ON public.overtime_alerts
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  AND company_id = get_user_company_id(auth.uid())
);
