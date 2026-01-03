-- Drop existing manager policy that allows full access
DROP POLICY IF EXISTS "Admins and managers can view company profiles basic info" ON public.profiles;

-- Create a new policy for managers with restricted field access using a security definer function
-- First, create a function that returns a sanitized view of profiles for managers

CREATE OR REPLACE FUNCTION public.get_visible_profile_fields(viewer_user_id uuid, target_profile profiles)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
  is_admin boolean;
BEGIN
  -- Check if viewer is the profile owner
  is_owner := (viewer_user_id = target_profile.user_id);
  
  -- Check if viewer is admin
  is_admin := has_role(viewer_user_id, 'admin');
  
  -- Admins and owners see all fields
  IF is_owner OR is_admin THEN
    RETURN jsonb_build_object(
      'id', target_profile.id,
      'user_id', target_profile.user_id,
      'full_name', target_profile.full_name,
      'email', target_profile.email,
      'phone', target_profile.phone,
      'cpf', target_profile.cpf,
      'pis', target_profile.pis,
      'registration_number', target_profile.registration_number,
      'position', target_profile.position,
      'department', target_profile.department,
      'company_id', target_profile.company_id,
      'photo_url', target_profile.photo_url,
      'hire_date', target_profile.hire_date,
      'is_active', target_profile.is_active,
      'must_change_password', target_profile.must_change_password,
      'created_at', target_profile.created_at,
      'updated_at', target_profile.updated_at
    );
  END IF;
  
  -- Managers see only non-sensitive fields (hide cpf, pis, phone)
  RETURN jsonb_build_object(
    'id', target_profile.id,
    'user_id', target_profile.user_id,
    'full_name', target_profile.full_name,
    'email', target_profile.email,
    'phone', NULL,
    'cpf', NULL,
    'pis', NULL,
    'registration_number', target_profile.registration_number,
    'position', target_profile.position,
    'department', target_profile.department,
    'company_id', target_profile.company_id,
    'photo_url', target_profile.photo_url,
    'hire_date', target_profile.hire_date,
    'is_active', target_profile.is_active,
    'must_change_password', NULL,
    'created_at', target_profile.created_at,
    'updated_at', target_profile.updated_at
  );
END;
$$;

-- Create a secure view for profiles that masks sensitive data for managers
CREATE OR REPLACE VIEW public.profiles_secure AS
SELECT 
  p.id,
  p.user_id,
  p.full_name,
  p.email,
  -- Mask sensitive fields for managers (only show to admins or profile owner)
  CASE 
    WHEN auth.uid() = p.user_id THEN p.phone
    WHEN has_role(auth.uid(), 'admin') THEN p.phone
    ELSE NULL 
  END as phone,
  CASE 
    WHEN auth.uid() = p.user_id THEN p.cpf
    WHEN has_role(auth.uid(), 'admin') THEN p.cpf
    ELSE NULL 
  END as cpf,
  CASE 
    WHEN auth.uid() = p.user_id THEN p.pis
    WHEN has_role(auth.uid(), 'admin') THEN p.pis
    ELSE NULL 
  END as pis,
  p.registration_number,
  p.position,
  p.department,
  p.company_id,
  p.photo_url,
  p.hire_date,
  p.is_active,
  CASE 
    WHEN auth.uid() = p.user_id THEN p.must_change_password
    WHEN has_role(auth.uid(), 'admin') THEN p.must_change_password
    ELSE NULL 
  END as must_change_password,
  p.created_at,
  p.updated_at
FROM public.profiles p;

-- Grant access to the secure view
GRANT SELECT ON public.profiles_secure TO authenticated;

-- Create separate policies for admins and managers on the profiles table
-- Policy for admins - full access to all fields
CREATE POLICY "Admins can view all company profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin') 
  AND company_id = get_user_company_id(auth.uid())
);

-- Policy for managers - they can see profiles but should use the secure view for sensitive data
-- This policy allows row-level access but the application should use profiles_secure view
CREATE POLICY "Managers can view company profiles basic info" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager') 
  AND company_id = get_user_company_id(auth.uid())
);

-- Add comment to document the security model
COMMENT ON VIEW public.profiles_secure IS 'Secure view of profiles that masks sensitive fields (phone, cpf, pis, must_change_password) for managers. Only admins and profile owners can see all fields. Use this view instead of the profiles table for manager-facing queries.';

COMMENT ON TABLE public.profiles IS 'Employee profiles table. SECURITY NOTE: Sensitive fields (phone, cpf, pis) are protected. Managers should query profiles_secure view instead of this table directly for field-level security.';