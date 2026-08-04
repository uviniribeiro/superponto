-- 1) Função de validação de CNPJ (numérico e alfanumérico - IN RFB 2.229/2024)
CREATE OR REPLACE FUNCTION public.is_valid_cnpj(_cnpj text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  clean text;
  w1 int[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int := 0;
  r int;
  d1 int;
  d2 int;
  i int;
BEGIN
  IF _cnpj IS NULL OR btrim(_cnpj) = '' THEN
    RETURN TRUE; -- vazio é tratado pelas regras de obrigatoriedade da aplicação
  END IF;

  clean := regexp_replace(upper(_cnpj), '[^0-9A-Z]', '', 'g');

  IF length(clean) <> 14 THEN RETURN FALSE; END IF;
  IF clean !~ '^[0-9A-Z]{12}[0-9]{2}$' THEN RETURN FALSE; END IF;
  IF clean ~ '^(.)\1{13}$' THEN RETURN FALSE; END IF;

  FOR i IN 1..12 LOOP
    s := s + (ascii(substr(clean, i, 1)) - 48) * w1[i];
  END LOOP;
  r := s % 11;
  d1 := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  IF d1 <> (ascii(substr(clean, 13, 1)) - 48) THEN RETURN FALSE; END IF;

  s := 0;
  FOR i IN 1..13 LOOP
    s := s + (ascii(substr(clean, i, 1)) - 48) * w2[i];
  END LOOP;
  r := s % 11;
  d2 := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  IF d2 <> (ascii(substr(clean, 14, 1)) - 48) THEN RETURN FALSE; END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_valid_cnpj(text) TO authenticated, anon, service_role;

-- 2) Trigger que bloqueia gravação de CNPJ inválido
CREATE OR REPLACE FUNCTION public.enforce_valid_cnpj()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cnpj IS NOT DISTINCT FROM OLD.cnpj THEN
    RETURN NEW;
  END IF;

  IF NEW.cnpj IS NOT NULL AND btrim(NEW.cnpj) <> '' AND NOT public.is_valid_cnpj(NEW.cnpj) THEN
    RAISE EXCEPTION 'CNPJ inválido: % — informe 14 caracteres (12 alfanuméricos + 2 dígitos verificadores) com dígito verificador correto', NEW.cnpj
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_valid_cnpj_companies ON public.companies;
CREATE TRIGGER enforce_valid_cnpj_companies
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.enforce_valid_cnpj();

DROP TRIGGER IF EXISTS enforce_valid_cnpj_unions ON public.unions;
CREATE TRIGGER enforce_valid_cnpj_unions
BEFORE INSERT OR UPDATE ON public.unions
FOR EACH ROW EXECUTE FUNCTION public.enforce_valid_cnpj();

-- 3) Auditoria de alterações de CNPJ das empresas
CREATE OR REPLACE FUNCTION public.audit_company_cnpj_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_name text;
BEGIN
  IF NEW.cnpj IS NOT DISTINCT FROM OLD.cnpj THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.full_name, p.email) INTO actor_name
  FROM public.profiles p WHERE p.user_id = actor LIMIT 1;

  INSERT INTO public.audit_logs (
    company_id, user_id, user_name, action, table_name, record_id,
    old_data, new_data, menu_section, description
  ) VALUES (
    NEW.id,
    COALESCE(actor, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(actor_name, 'Sistema'),
    'update_cnpj',
    'companies',
    NEW.id::text,
    jsonb_build_object('cnpj', OLD.cnpj, 'company_code', OLD.company_code),
    jsonb_build_object('cnpj', NEW.cnpj, 'company_code', NEW.company_code),
    'Empresa',
    format('CNPJ alterado de %s para %s', COALESCE(OLD.cnpj, '(vazio)'), COALESCE(NEW.cnpj, '(vazio)'))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_company_cnpj_change_trg ON public.companies;
CREATE TRIGGER audit_company_cnpj_change_trg
AFTER UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.audit_company_cnpj_change();