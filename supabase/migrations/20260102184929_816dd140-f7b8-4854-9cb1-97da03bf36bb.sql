-- Fix user_roles policies - drop existing first
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view company roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage company roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Users can always view their own roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Super admins can view all roles
CREATE POLICY "Super admins can view all roles" ON public.user_roles
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Super admins can manage all roles
CREATE POLICY "Super admins can manage all roles" ON public.user_roles
  FOR ALL USING (is_super_admin(auth.uid()));

-- Admins can view roles from their company
CREATE POLICY "Admins can view company roles" ON public.user_roles
  FOR SELECT USING (
    has_role(auth.uid(), 'admin')
    AND user_id IN (
      SELECT p.user_id FROM profiles p 
      WHERE p.company_id = get_user_company_id(auth.uid())
    )
  );

-- Admins can manage roles from their company (not super_admin role)
CREATE POLICY "Admins can manage company roles" ON public.user_roles
  FOR ALL USING (
    has_role(auth.uid(), 'admin')
    AND role != 'super_admin'
    AND user_id IN (
      SELECT p.user_id FROM profiles p 
      WHERE p.company_id = get_user_company_id(auth.uid())
    )
  );

-- Fix companies policies
DROP POLICY IF EXISTS "Authenticated users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Super admins can manage all companies" ON public.companies;

-- Authenticated users can view their own company
CREATE POLICY "Authenticated users can view their company" ON public.companies
  FOR SELECT USING (id = get_user_company_id(auth.uid()));

-- Super admins can view and manage all companies
CREATE POLICY "Super admins can manage all companies" ON public.companies
  FOR ALL USING (is_super_admin(auth.uid()));