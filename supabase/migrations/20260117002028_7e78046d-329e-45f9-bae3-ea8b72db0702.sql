-- Drop the insecure SECURITY DEFINER view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.time_clock_equipment_secure CASCADE;

-- Recreate view with SECURITY INVOKER (default, but explicitly set for clarity)
-- This ensures RLS policies of the querying user are enforced
CREATE VIEW public.time_clock_equipment_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  company_id,
  name,
  manufacturer,
  model,
  serial_number,
  -- Hide IP for non-admins
  CASE WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN ip_address ELSE '***.***.***' END AS ip_address,
  port,
  protocol,
  communication_type,
  -- Hide API endpoint for non-admins
  CASE WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN api_endpoint ELSE NULL END AS api_endpoint,
  -- Never expose credentials through view
  NULL::text AS username,
  NULL::text AS password,
  is_active,
  is_online,
  last_communication,
  last_sync,
  sync_interval_seconds,
  firmware_version,
  location,
  notes,
  created_at,
  updated_at,
  portaria_compliance,
  rep_number
FROM public.time_clock_equipment
WHERE 
  company_id = public.get_user_company_id(auth.uid()) OR company_id IS NULL;

-- Grant access to the secure view
GRANT SELECT ON public.time_clock_equipment_secure TO authenticated;

-- Add explanatory comment
COMMENT ON VIEW public.time_clock_equipment_secure IS 'Secure view of equipment data with SECURITY INVOKER. Hides sensitive credentials (username, password, IP for non-admins). Uses underlying table RLS policies.';