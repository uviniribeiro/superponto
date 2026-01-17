-- Create a helper function for managers to get limited profile info
-- Using quoted identifiers for reserved words like "position"
CREATE OR REPLACE FUNCTION public.get_manager_visible_profiles(_company_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  registration_number text,
  department text,
  "position" text,
  hire_date date,
  is_active boolean,
  photo_url text,
  company_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.registration_number,
    p.department,
    p.position,
    p.hire_date,
    p.is_active,
    p.photo_url,
    p.company_id
  FROM public.profiles p
  WHERE p.company_id = _company_id AND p.is_active = true;
$$;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.get_manager_visible_profiles(uuid) TO authenticated;

-- Add explanatory comments
COMMENT ON VIEW public.profiles_secure IS 'Secure view for profiles. Hides sensitive PII (email, CPF, PIS, phone) for non-admin users. Admins and super admins see all fields. Users always see their own full profile.';
COMMENT ON FUNCTION public.get_manager_visible_profiles(uuid) IS 'Returns limited profile info for managers. Excludes PII like email, CPF, PIS, phone.';