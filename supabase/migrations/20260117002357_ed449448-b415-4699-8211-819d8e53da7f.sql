-- Drop and recreate the profiles_secure view with proper email protection
DROP VIEW IF EXISTS public.profiles_secure CASCADE;

-- Recreate with SECURITY INVOKER and proper PII field-level protection
CREATE VIEW public.profiles_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  full_name,
  -- Hide email for non-admins/non-owners
  CASE 
    WHEN auth.uid() = user_id THEN email
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN email
    WHEN public.is_super_admin(auth.uid()) THEN email
    ELSE NULL 
  END AS email,
  -- Hide phone for non-admins/non-owners
  CASE 
    WHEN auth.uid() = user_id THEN phone
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN phone
    WHEN public.is_super_admin(auth.uid()) THEN phone
    ELSE NULL 
  END AS phone,
  -- Hide CPF for non-admins/non-owners
  CASE 
    WHEN auth.uid() = user_id THEN cpf
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN cpf
    WHEN public.is_super_admin(auth.uid()) THEN cpf
    ELSE NULL 
  END AS cpf,
  -- Hide PIS for non-admins/non-owners
  CASE 
    WHEN auth.uid() = user_id THEN pis
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN pis
    WHEN public.is_super_admin(auth.uid()) THEN pis
    ELSE NULL 
  END AS pis,
  registration_number,  -- Non-sensitive internal ID
  "position",
  department,
  company_id,
  photo_url,  -- OK for identification purposes
  hire_date,
  is_active,
  -- Hide must_change_password for non-admins/non-owners
  CASE 
    WHEN auth.uid() = user_id THEN must_change_password
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN must_change_password
    WHEN public.is_super_admin(auth.uid()) THEN must_change_password
    ELSE NULL 
  END AS must_change_password,
  created_at,
  updated_at
FROM public.profiles p;

-- Grant SELECT on the secure view
GRANT SELECT ON public.profiles_secure TO authenticated;

-- Add explanatory comment
COMMENT ON VIEW public.profiles_secure IS 'Secure view for profiles. Hides sensitive PII (email, CPF, PIS, phone) for non-admin users. Admins, super admins, and users viewing their own profile see all fields.';