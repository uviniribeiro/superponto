-- Fix gap: Admins can update profiles should be restricted to their company
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

-- Fix gap: Admins can insert profiles should be restricted to their company
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

-- Add Super admin policies for cross-company management
CREATE POLICY "Super admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));