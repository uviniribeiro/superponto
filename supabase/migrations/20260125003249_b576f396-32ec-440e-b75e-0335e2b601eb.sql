-- Fix remaining security issues - drop existing policies first

-- Drop remaining policies that might exist on profiles
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

-- Recreate super admin policy for profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_super_admin(auth.uid()));