-- First, drop the existing policy for managers that exposes credentials
DROP POLICY IF EXISTS "Managers can view company equipment basic info" ON public.time_clock_equipment;

-- Drop existing view if it has different structure
DROP VIEW IF EXISTS public.time_clock_equipment_secure CASCADE;

-- Create a secure view that excludes sensitive credentials for all users
-- Admins should access the table directly when they need credentials
CREATE VIEW public.time_clock_equipment_secure AS
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

-- Create a security definer function for managers to get equipment without credentials
CREATE OR REPLACE FUNCTION public.get_equipment_basic_info(_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  name text,
  manufacturer text,
  model text,
  serial_number text,
  is_active boolean,
  is_online boolean,
  last_communication timestamptz,
  last_sync timestamptz,
  sync_interval_seconds integer,
  firmware_version text,
  location text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  portaria_compliance text,
  rep_number text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.company_id,
    t.name,
    t.manufacturer,
    t.model,
    t.serial_number,
    t.is_active,
    t.is_online,
    t.last_communication,
    t.last_sync,
    t.sync_interval_seconds,
    t.firmware_version,
    t.location,
    t.notes,
    t.created_at,
    t.updated_at,
    t.portaria_compliance,
    t.rep_number
  FROM public.time_clock_equipment t
  WHERE t.company_id = _company_id OR t.company_id IS NULL;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_equipment_basic_info(uuid) TO authenticated;

-- Add explanatory comments
COMMENT ON VIEW public.time_clock_equipment_secure IS 'Secure view of equipment data that hides sensitive credentials (username, password, IP address for non-admins)';
COMMENT ON FUNCTION public.get_equipment_basic_info(uuid) IS 'Returns basic equipment info without credentials. Use for managers and regular users.';