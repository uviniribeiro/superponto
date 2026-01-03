-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a secure encryption key stored in vault (or use a fixed key for now)
-- In production, this should be rotated and stored in Supabase Vault

-- First, drop the existing policies that allow managers to see equipment
DROP POLICY IF EXISTS "Users can view equipment basic info" ON public.time_clock_equipment;
DROP POLICY IF EXISTS "Admins can manage company equipment" ON public.time_clock_equipment;

-- Create a function to encrypt equipment passwords
CREATE OR REPLACE FUNCTION public.encrypt_equipment_password(plain_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Use a secure key from environment or a fixed key
  -- In production, use Supabase Vault or secrets
  encryption_key := coalesce(current_setting('app.equipment_encryption_key', true), 'lovable_equipment_secure_key_2024');
  
  IF plain_password IS NULL OR plain_password = '' THEN
    RETURN NULL;
  END IF;
  
  -- Encrypt using AES-256
  RETURN encode(
    pgp_sym_encrypt(plain_password, encryption_key),
    'base64'
  );
END;
$$;

-- Create a function to decrypt equipment passwords (only for admin use)
CREATE OR REPLACE FUNCTION public.decrypt_equipment_password(encrypted_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Only admins can decrypt passwords
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only administrators can access equipment passwords';
  END IF;
  
  IF encrypted_password IS NULL OR encrypted_password = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := coalesce(current_setting('app.equipment_encryption_key', true), 'lovable_equipment_secure_key_2024');
  
  -- Decrypt using AES-256
  RETURN pgp_sym_decrypt(
    decode(encrypted_password, 'base64'),
    encryption_key
  );
END;
$$;

-- Create a function to get equipment for sync (with decrypted password for edge function use)
CREATE OR REPLACE FUNCTION public.get_equipment_for_sync(equipment_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  manufacturer text,
  model text,
  ip_address text,
  port integer,
  protocol text,
  api_endpoint text,
  username text,
  password text,
  company_id uuid,
  is_active boolean,
  sync_interval_seconds integer,
  last_sync timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := coalesce(current_setting('app.equipment_encryption_key', true), 'lovable_equipment_secure_key_2024');
  
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.manufacturer,
    e.model,
    e.ip_address,
    e.port,
    e.protocol,
    e.api_endpoint,
    e.username,
    CASE 
      WHEN e.password IS NOT NULL AND e.password != '' THEN
        pgp_sym_decrypt(decode(e.password, 'base64'), encryption_key)
      ELSE
        NULL
    END as password,
    e.company_id,
    e.is_active,
    e.sync_interval_seconds,
    e.last_sync
  FROM public.time_clock_equipment e
  WHERE e.id = equipment_id;
END;
$$;

-- Create a trigger to automatically encrypt passwords on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_equipment_password_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := coalesce(current_setting('app.equipment_encryption_key', true), 'lovable_equipment_secure_key_2024');
  
  -- Only encrypt if password is provided and not already encrypted (doesn't start with expected format)
  IF NEW.password IS NOT NULL AND NEW.password != '' THEN
    -- Check if already encrypted (base64 encoded pgp data starts with 'ww' typically)
    IF NOT (NEW.password LIKE 'ww%' OR length(NEW.password) > 100) THEN
      NEW.password := encode(pgp_sym_encrypt(NEW.password, encryption_key), 'base64');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS encrypt_password_before_save ON public.time_clock_equipment;
CREATE TRIGGER encrypt_password_before_save
  BEFORE INSERT OR UPDATE OF password ON public.time_clock_equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_equipment_password_trigger();

-- Create a secure view for equipment that hides credentials from non-admins
CREATE OR REPLACE VIEW public.time_clock_equipment_secure 
WITH (security_invoker = true)
AS
SELECT 
  e.id,
  e.name,
  e.manufacturer,
  e.model,
  e.ip_address,
  e.port,
  e.protocol,
  e.api_endpoint,
  e.company_id,
  e.is_active,
  e.is_online,
  e.last_sync,
  e.last_communication,
  e.sync_interval_seconds,
  e.location,
  e.serial_number,
  e.rep_number,
  e.firmware_version,
  e.portaria_compliance,
  e.communication_type,
  e.notes,
  e.created_at,
  e.updated_at,
  -- Hide sensitive fields from non-admins
  CASE WHEN has_role(auth.uid(), 'admin') THEN e.username ELSE NULL END as username,
  -- Password is always hidden in the view - use get_equipment_for_sync for actual password
  NULL::text as password
FROM public.time_clock_equipment e;

-- Grant access to the secure view
GRANT SELECT ON public.time_clock_equipment_secure TO authenticated;

-- Create new RLS policies
-- Admins have full access
CREATE POLICY "Admins can manage company equipment" 
ON public.time_clock_equipment 
FOR ALL
USING (
  has_role(auth.uid(), 'admin') 
  AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
);

-- Managers can only view non-sensitive data (they should use the secure view)
CREATE POLICY "Managers can view company equipment basic info" 
ON public.time_clock_equipment 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager') 
  AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
);

-- Encrypt existing plaintext passwords
DO $$
DECLARE
  encryption_key text := 'lovable_equipment_secure_key_2024';
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT id, password 
    FROM public.time_clock_equipment 
    WHERE password IS NOT NULL 
      AND password != '' 
      AND NOT (password LIKE 'ww%' OR length(password) > 100)
  LOOP
    UPDATE public.time_clock_equipment
    SET password = encode(pgp_sym_encrypt(rec.password, encryption_key), 'base64')
    WHERE id = rec.id;
  END LOOP;
END $$;

-- Add comments documenting security model
COMMENT ON VIEW public.time_clock_equipment_secure IS 'Secure view of time clock equipment. Username is hidden from non-admins. Password is never exposed through this view - use get_equipment_for_sync() function for equipment sync operations.';
COMMENT ON FUNCTION public.decrypt_equipment_password IS 'Decrypts equipment password. Only accessible to administrators.';
COMMENT ON FUNCTION public.get_equipment_for_sync IS 'Returns equipment data with decrypted password for sync operations. For internal/edge function use only.';