-- Versão do sistema liberada pelo Super Admin para cada cliente: v1 (atual) ou v2 (nova).
-- Com v2, quem entra na v1 é levado para a v2 (mesmo usuário, CNPJ e senha).
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS system_version text NOT NULL DEFAULT 'v1';
DO $$ BEGIN
  ALTER TABLE public.companies ADD CONSTRAINT companies_system_version_check CHECK (system_version IN ('v1', 'v2'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Só o Super Admin muda a versão (o administrador do cliente não consegue trocar sozinho).
CREATE OR REPLACE FUNCTION public.guard_system_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.system_version IS DISTINCT FROM OLD.system_version
     AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND NOT private.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Só o Super Admin pode trocar a versão do sistema' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS companies_guard_system_version ON public.companies;
CREATE TRIGGER companies_guard_system_version BEFORE UPDATE OF system_version ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_system_version();
