-- Tipo matriz/filial
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'company_unit_type') THEN
    CREATE TYPE public.company_unit_type AS ENUM ('matriz', 'filial');
  END IF;
END;
$do$;

CREATE TABLE IF NOT EXISTS public.company_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_name text NOT NULL,
  trade_name text,
  cnpj text NOT NULL,
  unit_type public.company_unit_type NOT NULL DEFAULT 'filial',
  parent_unit_id uuid REFERENCES public.company_units(id) ON DELETE SET NULL,
  cei text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_units TO authenticated;
GRANT ALL ON public.company_units TO service_role;

ALTER TABLE public.company_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view units of their company" ON public.company_units;
CREATE POLICY "Users view units of their company"
ON public.company_units FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Admins manage units of their company" ON public.company_units;
CREATE POLICY "Admins manage units of their company"
ON public.company_units FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Uma matriz por base e CNPJ único por base
CREATE UNIQUE INDEX IF NOT EXISTS company_units_one_hq_per_company
  ON public.company_units (company_id) WHERE unit_type = 'matriz';
CREATE UNIQUE INDEX IF NOT EXISTS company_units_unique_cnpj_per_company
  ON public.company_units (company_id, cnpj);
CREATE INDEX IF NOT EXISTS idx_company_units_company ON public.company_units (company_id);
CREATE INDEX IF NOT EXISTS idx_company_units_parent ON public.company_units (parent_unit_id);

DROP TRIGGER IF EXISTS update_company_units_updated_at ON public.company_units;
CREATE TRIGGER update_company_units_updated_at
BEFORE UPDATE ON public.company_units
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coerência matriz/filial
CREATE OR REPLACE FUNCTION public.validate_company_unit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.unit_type = 'matriz' THEN
    NEW.parent_unit_id := NULL;
  ELSIF NEW.parent_unit_id IS NULL THEN
    SELECT id INTO NEW.parent_unit_id
    FROM public.company_units
    WHERE company_id = NEW.company_id AND unit_type = 'matriz'
    LIMIT 1;
  END IF;

  IF NEW.parent_unit_id IS NOT NULL AND NEW.parent_unit_id = NEW.id THEN
    RAISE EXCEPTION 'Uma filial não pode ser vinculada a ela mesma';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.validate_company_unit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_company_unit ON public.company_units;
CREATE TRIGGER trg_validate_company_unit
BEFORE INSERT OR UPDATE ON public.company_units
FOR EACH ROW EXECUTE FUNCTION public.validate_company_unit();

-- Campo matriz/filial no cadastro de empresas
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS unit_type public.company_unit_type NOT NULL DEFAULT 'matriz';

-- Vínculo do funcionário com a unidade
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_unit_id uuid REFERENCES public.company_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_company_unit ON public.profiles (company_unit_id);
