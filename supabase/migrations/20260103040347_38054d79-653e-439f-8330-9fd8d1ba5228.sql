-- Drop the SECURITY DEFINER view and recreate with SECURITY INVOKER
-- This is safer as it uses the querying user's permissions

DROP VIEW IF EXISTS public.profiles_secure;

-- Create the secure view with SECURITY INVOKER (default, but explicit for clarity)
CREATE VIEW public.profiles_secure 
WITH (security_invoker = true)
AS
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

-- Add comment to document the security model
COMMENT ON VIEW public.profiles_secure IS 'Secure view of profiles that masks sensitive fields (phone, cpf, pis, must_change_password) for managers. Only admins and profile owners can see all fields. Uses SECURITY INVOKER for proper RLS enforcement.';