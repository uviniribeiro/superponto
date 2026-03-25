
-- Fix all functions to use schema-qualified pgcrypto functions

CREATE OR REPLACE FUNCTION public.encrypt_equipment_password_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := coalesce(current_setting('app.equipment_encryption_key', true), 'lovable_equipment_secure_key_2024');
  
  IF NEW.password IS NOT NULL AND NEW.password != '' THEN
    IF NOT (NEW.password LIKE 'ww%' OR length(NEW.password) > 100) THEN
      NEW.password := encode(extensions.pgp_sym_encrypt(NEW.password, encryption_key), 'base64');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.encrypt_equipment_password(plain_password text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := coalesce(current_setting('app.equipment_encryption_key', true), 'lovable_equipment_secure_key_2024');
  
  IF plain_password IS NULL OR plain_password = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN encode(
    extensions.pgp_sym_encrypt(plain_password, encryption_key),
    'base64'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_equipment_password(encrypted_password text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only administrators can access equipment passwords';
  END IF;
  
  IF encrypted_password IS NULL OR encrypted_password = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := coalesce(current_setting('app.equipment_encryption_key', true), 'lovable_equipment_secure_key_2024');
  
  RETURN extensions.pgp_sym_decrypt(
    decode(encrypted_password, 'base64'),
    encryption_key
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_equipment_for_sync(equipment_id uuid)
 RETURNS TABLE(id uuid, name text, manufacturer text, model text, ip_address text, port integer, protocol text, api_endpoint text, username text, password text, company_id uuid, is_active boolean, sync_interval_seconds integer, last_sync timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        extensions.pgp_sym_decrypt(decode(e.password, 'base64'), encryption_key)
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
$function$;
