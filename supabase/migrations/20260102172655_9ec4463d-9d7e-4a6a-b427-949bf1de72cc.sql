-- Fix companies table RLS to only allow minimal data for login verification
-- Remove the overly permissive policy

DROP POLICY IF EXISTS "Users can view companies for login verification" ON public.companies;

-- Create a more restrictive policy that only allows authenticated users to see their own company
-- For login, the application will use a specific query that doesn't expose all data

-- Keep existing policies for users to view their own company
-- The login flow should validate company_code differently

-- Policy for authenticated users to see their company
CREATE POLICY "Authenticated users can view their company"
ON public.companies
FOR SELECT
TO authenticated
USING (
  id = get_user_company_id(auth.uid())
);

-- Super admins can still see all for management
-- (Already exists from before, no need to recreate)