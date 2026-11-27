-- QR Code do funcionário: o conteúdo é sempre um hash SHA-256 exclusivo por cadastro, gerado no banco.
-- Um QR por funcionário (índice único profile_id+method_type já existe); gerar de novo troca o hash
-- e invalida o anterior na hora.
CREATE OR REPLACE FUNCTION private.employee_qr_hash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.method_type = 'qrcode' AND (TG_OP = 'INSERT' OR NEW.identifier IS DISTINCT FROM OLD.identifier) THEN
    NEW.identifier := 'SPQR1.' || encode(extensions.digest(
      NEW.profile_id::text || '|' || NEW.company_id::text || '|' || gen_random_uuid()::text || '|' || clock_timestamp()::text,
      'sha256'), 'hex');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS employee_qr_hash ON public.employee_identification_methods;
CREATE TRIGGER employee_qr_hash BEFORE INSERT OR UPDATE ON public.employee_identification_methods
  FOR EACH ROW EXECUTE FUNCTION private.employee_qr_hash();

-- Converte os QR Codes existentes para o formato hash.
UPDATE public.employee_identification_methods SET identifier = coalesce(identifier, '') || '#rehash'
  WHERE method_type = 'qrcode' AND identifier NOT LIKE 'SPQR1.%';

CREATE UNIQUE INDEX IF NOT EXISTS employee_identification_methods_qr_unique
  ON public.employee_identification_methods (identifier) WHERE method_type = 'qrcode';
