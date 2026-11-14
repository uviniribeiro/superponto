-- =============================================================================
-- Segurança no banco (defesa em profundidade, além das regras da API)
--  1. Papel da aplicação sem privilégios de dono: as políticas RLS valem para ele.
--  2. RLS por tenant em toda tabela com tenant_id.
--  3. Marcações de ponto e auditoria imutáveis (somente inserção).
-- A API define o tenant por transação: SELECT set_config('app.tenant_id', '<uuid>', true).
-- Operações de plataforma (SuperAdmin, login, ingestão do Communication Server) usam
-- set_config('app.bypass_rls', 'on', true) em código revisado.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superponto_app') THEN
    CREATE ROLE superponto_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO superponto_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO superponto_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO superponto_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO superponto_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO superponto_app;
REVOKE ALL ON public._prisma_migrations FROM superponto_app;

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), '') = 'on'
$$;

DO $$
DECLARE
  t record;
  nullable boolean;
BEGIN
  FOR t IN
    SELECT c.table_name, c.is_nullable
    FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND c.column_name = 'tenant_id' AND tb.table_type = 'BASE TABLE'
  LOOP
    nullable := t.is_nullable = 'YES';
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t.table_name);
    IF nullable THEN
      -- Linhas globais (tenant_id nulo, ex.: perfis de sistema) são legíveis por todos,
      -- mas só alteráveis em modo plataforma.
      EXECUTE format($p$
        CREATE POLICY tenant_isolation ON public.%I
          USING (app_bypass_rls() OR tenant_id = app_tenant_id() OR tenant_id IS NULL)
          WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id())
      $p$, t.table_name);
    ELSE
      EXECUTE format($p$
        CREATE POLICY tenant_isolation ON public.%I
          USING (app_bypass_rls() OR tenant_id = app_tenant_id())
          WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id())
      $p$, t.table_name);
    END IF;
  END LOOP;
END $$;

-- Tenants: cada tenant enxerga apenas o próprio registro.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON public.tenants
  USING (app_bypass_rls() OR id = app_tenant_id())
  WITH CHECK (app_bypass_rls());

-- ---------------------------------------------------------------------------
-- Imutabilidade
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% é somente inserção: registros originais não podem ser alterados ou excluídos', TG_TABLE_NAME
    USING ERRCODE = '42501';
END $$;

CREATE TRIGGER time_records_immutable
  BEFORE UPDATE OR DELETE ON public.time_records
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER device_events_immutable
  BEFORE UPDATE OF payload, occurred_at, nsr, identifier OR DELETE ON public.device_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Vínculos funcionais: exclusão física proibida (usar deleted_at / desligamento).
CREATE OR REPLACE FUNCTION forbid_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Exclusão física não permitida em %: use desligamento ou exclusão lógica', TG_TABLE_NAME
    USING ERRCODE = '42501';
END $$;

CREATE TRIGGER employment_no_delete
  BEFORE DELETE ON public.employment_relationships
  FOR EACH ROW EXECUTE FUNCTION forbid_delete();

CREATE TRIGGER people_no_delete
  BEFORE DELETE ON public.people
  FOR EACH ROW EXECUTE FUNCTION forbid_delete();

-- Fechamento: apuração de período fechado não pode ser alterada.
CREATE OR REPLACE FUNCTION forbid_closed_period() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  emp_company uuid;
  ref date;
BEGIN
  ref := COALESCE(NEW.work_date, OLD.work_date);
  SELECT company_id INTO emp_company FROM public.employment_relationships
   WHERE id = COALESCE(NEW.employment_id, OLD.employment_id);
  IF EXISTS (
    SELECT 1 FROM public.time_closings
     WHERE company_id = emp_company AND status = 'CLOSED'
       AND ref BETWEEN period_start AND period_end
  ) THEN
    RAISE EXCEPTION 'Período fechado: reabra o fechamento para alterar a apuração de %', ref
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER time_calculations_closed_period
  BEFORE INSERT OR UPDATE OR DELETE ON public.time_calculations
  FOR EACH ROW EXECUTE FUNCTION forbid_closed_period();
