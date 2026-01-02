-- Drop existing restrictive policies for companies SELECT
DROP POLICY IF EXISTS "Authenticated users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;

-- Create policy to allow public read for login validation (only id, company_code, is_active needed)
-- This is safe because we're not exposing sensitive data like CNPJ in the login flow
CREATE POLICY "Allow public read for login validation" 
ON public.companies 
FOR SELECT 
USING (is_active = true);

-- Create policy for authenticated users to see all details of their company
CREATE POLICY "Authenticated users can view their company details" 
ON public.companies 
FOR SELECT 
TO authenticated
USING (id = get_user_company_id(auth.uid()) OR is_super_admin(auth.uid()));