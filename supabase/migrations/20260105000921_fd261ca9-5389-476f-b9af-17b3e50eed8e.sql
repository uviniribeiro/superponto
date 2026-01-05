-- Drop and recreate the view with SECURITY INVOKER 
-- This ensures the view respects RLS policies on the underlying profiles table
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure 
WITH (security_invoker = true)
AS
SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.email,
    -- Mask sensitive fields: only owner or admin can see
    CASE 
        WHEN auth.uid() = p.user_id THEN p.phone
        WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.phone
        ELSE NULL 
    END AS phone,
    CASE 
        WHEN auth.uid() = p.user_id THEN p.cpf
        WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.cpf
        ELSE NULL 
    END AS cpf,
    CASE 
        WHEN auth.uid() = p.user_id THEN p.pis
        WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.pis
        ELSE NULL 
    END AS pis,
    p.registration_number,
    p.position,
    p.department,
    p.company_id,
    p.photo_url,
    p.hire_date,
    p.is_active,
    CASE 
        WHEN auth.uid() = p.user_id THEN p.must_change_password
        WHEN has_role(auth.uid(), 'admin'::app_role) THEN p.must_change_password
        ELSE NULL 
    END AS must_change_password,
    p.created_at,
    p.updated_at
FROM public.profiles p;

-- Grant access only to authenticated users
REVOKE ALL ON public.profiles_secure FROM anon;
REVOKE ALL ON public.profiles_secure FROM public;
GRANT SELECT ON public.profiles_secure TO authenticated;

-- Add comment explaining security model
COMMENT ON VIEW public.profiles_secure IS 'Secure view of profiles with field-level masking. Uses SECURITY INVOKER to inherit RLS from profiles table. Only authenticated users can access.';