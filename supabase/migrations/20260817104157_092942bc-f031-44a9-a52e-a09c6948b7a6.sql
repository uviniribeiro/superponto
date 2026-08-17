ALTER TABLE public.communication_servers
  ADD COLUMN IF NOT EXISTS connection_mode text NOT NULL DEFAULT 'tcp',
  ADD COLUMN IF NOT EXISTS api_base_url text,
  ADD COLUMN IF NOT EXISTS api_username text,
  ADD COLUMN IF NOT EXISTS api_password text,
  ADD COLUMN IF NOT EXISTS cloud_token text,
  ADD COLUMN IF NOT EXISTS cloud_organization_id text,
  ADD COLUMN IF NOT EXISTS use_https boolean NOT NULL DEFAULT false;

ALTER TABLE public.time_clock_equipment
  ADD COLUMN IF NOT EXISTS cloud_device_id text;

CREATE OR REPLACE FUNCTION public.encrypt_communication_server_secrets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := coalesce(current_setting('app.equipment_encryption_key', true), 'lovable_equipment_secure_key_2024');

  IF NEW.api_password IS NOT NULL AND NEW.api_password <> '' THEN
    IF NOT (NEW.api_password LIKE 'ww%' OR length(NEW.api_password) > 100) THEN
      NEW.api_password := encode(extensions.pgp_sym_encrypt(NEW.api_password, encryption_key), 'base64');
    END IF;
  END IF;

  IF NEW.cloud_token IS NOT NULL AND NEW.cloud_token <> '' THEN
    IF NOT (NEW.cloud_token LIKE 'ww%' OR length(NEW.cloud_token) > 200) THEN
      NEW.cloud_token := encode(extensions.pgp_sym_encrypt(NEW.cloud_token, encryption_key), 'base64');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS encrypt_communication_server_secrets_trg ON public.communication_servers;
CREATE TRIGGER encrypt_communication_server_secrets_trg
  BEFORE INSERT OR UPDATE ON public.communication_servers
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_communication_server_secrets();

CREATE OR REPLACE FUNCTION public.get_communication_server_secrets(_server_id uuid)
RETURNS TABLE(api_password text, cloud_token text)
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
    CASE WHEN s.api_password IS NOT NULL AND s.api_password <> ''
      THEN extensions.pgp_sym_decrypt(decode(s.api_password, 'base64'), encryption_key) ELSE NULL END,
    CASE WHEN s.cloud_token IS NOT NULL AND s.cloud_token <> ''
      THEN extensions.pgp_sym_decrypt(decode(s.cloud_token, 'base64'), encryption_key) ELSE NULL END
  FROM public.communication_servers s
  WHERE s.id = _server_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_communication_server_secrets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_communication_server_secrets(uuid) TO service_role;