CREATE TABLE IF NOT EXISTS public.communication_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  manufacturer text NOT NULL DEFAULT 'henry',
  host text NOT NULL,
  port integer NOT NULL DEFAULT 3000,
  timeout_ms integer NOT NULL DEFAULT 8000,
  allow_private_network boolean NOT NULL DEFAULT false,
  command_map jsonb,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_test_at timestamptz,
  last_test_status text,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_servers TO authenticated;
GRANT ALL ON public.communication_servers TO service_role;

ALTER TABLE public.communication_servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comm_servers_select_company" ON public.communication_servers;
CREATE POLICY "comm_servers_select_company"
ON public.communication_servers FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

DROP POLICY IF EXISTS "comm_servers_admin_manage" ON public.communication_servers;
CREATE POLICY "comm_servers_admin_manage"
ON public.communication_servers FOR ALL TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_communication_servers_company ON public.communication_servers(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_servers_default
  ON public.communication_servers(company_id) WHERE is_default;

DROP TRIGGER IF EXISTS trg_communication_servers_updated_at ON public.communication_servers;
CREATE TRIGGER trg_communication_servers_updated_at
BEFORE UPDATE ON public.communication_servers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.time_clock_equipment
  ADD COLUMN IF NOT EXISTS communication_server_id uuid REFERENCES public.communication_servers(id) ON DELETE SET NULL;