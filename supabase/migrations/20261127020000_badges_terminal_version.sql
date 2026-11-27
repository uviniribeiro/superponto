-- 1) Código de barras do sistema: numérico (13 dígitos, Code 128), gerado no banco e único.
-- 2) Crachá antigo (badge_legacy): código já impresso, vinculado ao funcionário como alternativa.
-- 3) Identificador único por empresa (o terminal acha uma só pessoa por código).
-- 4) kiosk_system_version(cnpj): o app de terminal único descobre se o cliente usa a v1 ou a v2.
CREATE OR REPLACE FUNCTION private.employee_qr_hash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE code text; tries int := 0;
BEGIN
  IF NEW.method_type = 'qrcode' AND (TG_OP = 'INSERT' OR NEW.identifier IS DISTINCT FROM OLD.identifier) THEN
    NEW.identifier := 'SPQR1.' || encode(extensions.digest(
      NEW.profile_id::text || '|' || NEW.company_id::text || '|' || gen_random_uuid()::text || '|' || clock_timestamp()::text,
      'sha256'), 'hex');
  ELSIF NEW.method_type = 'barcode' AND (TG_OP = 'INSERT' OR NEW.identifier IS DISTINCT FROM OLD.identifier) THEN
    LOOP
      code := '2' || lpad((('x' || substr(encode(extensions.digest(NEW.profile_id::text || gen_random_uuid()::text, 'sha256'), 'hex'), 1, 15))::bit(60)::bigint % 1000000000000)::text, 12, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employee_identification_methods WHERE identifier = code) OR tries > 20;
      tries := tries + 1;
    END LOOP;
    NEW.identifier := code;
  ELSIF NEW.method_type = 'badge_legacy' THEN
    NEW.identifier := btrim(NEW.identifier);
  END IF;
  RETURN NEW;
END $$;

-- Códigos de barras antigos aleatórios passam ao formato do sistema.
UPDATE public.employee_identification_methods SET identifier = identifier || '#'
  WHERE method_type = 'barcode' AND identifier !~ '^2[0-9]{12}$';

CREATE UNIQUE INDEX IF NOT EXISTS employee_identification_methods_company_identifier_key
  ON public.employee_identification_methods (company_id, identifier) WHERE identifier IS NOT NULL;

CREATE OR REPLACE FUNCTION public.kiosk_system_version(p_cnpj text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'); v text;
BEGIN
  IF length(d) <> 14 THEN RETURN NULL; END IF;
  SELECT c.system_version INTO v FROM public.companies c WHERE regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g') = d LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  IF EXISTS (SELECT 1 FROM superponto.companies sc WHERE regexp_replace(coalesce(sc.cnpj, ''), '\D', '', 'g') = d AND sc.deleted_at IS NULL) THEN
    RETURN 'v2';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.kiosk_system_version(text) FROM public;
GRANT EXECUTE ON FUNCTION public.kiosk_system_version(text) TO anon, authenticated;
