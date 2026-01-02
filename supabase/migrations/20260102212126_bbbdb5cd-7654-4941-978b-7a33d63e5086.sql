-- Remove the overly permissive public read policy
DROP POLICY IF EXISTS "Allow public read for login validation" ON public.companies;

-- Create a more restrictive policy that only allows authenticated users to see their own company
-- The edge function validate-company-login uses service role key and bypasses RLS
CREATE POLICY "Users can view their own company" 
ON public.companies 
FOR SELECT 
TO authenticated
USING (id = get_user_company_id(auth.uid()));

-- Super admins can see all companies (already exists but ensuring it's there)
DROP POLICY IF EXISTS "Super admins can manage all companies" ON public.companies;
CREATE POLICY "Super admins can manage all companies" 
ON public.companies 
FOR ALL 
TO authenticated
USING (is_super_admin(auth.uid()));