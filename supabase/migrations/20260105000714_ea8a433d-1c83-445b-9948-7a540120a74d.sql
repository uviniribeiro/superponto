-- Force RLS even for table owner (security best practice)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Drop existing SELECT policies to recreate them with authenticated role
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view company profiles basic info" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

-- Recreate SELECT policies targeting ONLY authenticated users
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all company profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Managers can view company profiles basic info" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Super admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (is_super_admin(auth.uid()));

-- Also update INSERT/UPDATE policies to explicitly target authenticated users
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

CREATE POLICY "Users can insert own profile on signup" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update profiles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));