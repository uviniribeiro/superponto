-- 1. Agentes (robôs) instalados em máquinas locais
CREATE TABLE public.communication_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  hostname text,
  os_info text,
  agent_version text,
  local_ip text,
  public_ip text,
  mac_address text,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  last_heartbeat timestamptz,
  auto_discovery boolean NOT NULL DEFAULT true,
  discovery_ranges text[] NOT NULL DEFAULT '{}',
  auto_adopt boolean NOT NULL DEFAULT false,
  sync_interval_seconds integer NOT NULL DEFAULT 60,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_agents TO authenticated;
GRANT ALL ON public.communication_agents TO service_role;
ALTER TABLE public.communication_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agents of their company"
  ON public.communication_agents FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_communication_agents_updated_at BEFORE UPDATE ON public.communication_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Dispositivos descobertos na rede pelo agente
CREATE TABLE public.discovered_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  agent_id uuid REFERENCES public.communication_agents(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES public.time_clock_equipment(id) ON DELETE SET NULL,
  ip_address text NOT NULL,
  port integer,
  mac_address text,
  manufacturer text,
  model text,
  serial_number text,
  firmware_version text,
  protocol text,
  device_name text,
  status text NOT NULL DEFAULT 'new',
  reachable boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX discovered_devices_unique_key ON public.discovered_devices (company_id, coalesce(mac_address, serial_number, ip_address));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovered_devices TO authenticated;
GRANT ALL ON public.discovered_devices TO service_role;
ALTER TABLE public.discovered_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company staff manage discovered devices"
  ON public.discovered_devices FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_discovered_devices_updated_at BEFORE UPDATE ON public.discovered_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Fila de comandos enviados do sistema para o agente/equipamento
CREATE TABLE public.device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  agent_id uuid REFERENCES public.communication_agents(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES public.time_clock_equipment(id) ON DELETE CASCADE,
  command text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  result jsonb,
  error_message text,
  created_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_commands_queue_idx ON public.device_commands (agent_id, status, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_commands TO authenticated;
GRANT ALL ON public.device_commands TO service_role;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company staff manage device commands"
  ON public.device_commands FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_device_commands_updated_at BEFORE UPDATE ON public.device_commands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Estado da sincronização de funcionários por equipamento
CREATE TABLE public.employee_device_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.time_clock_equipment(id) ON DELETE CASCADE,
  device_user_id text,
  operation text NOT NULL DEFAULT 'upsert',
  status text NOT NULL DEFAULT 'pending',
  templates_synced boolean NOT NULL DEFAULT false,
  error_message text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, equipment_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_device_sync TO authenticated;
GRANT ALL ON public.employee_device_sync TO service_role;
ALTER TABLE public.employee_device_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company staff manage employee device sync"
  ON public.employee_device_sync FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_employee_device_sync_updated_at BEFORE UPDATE ON public.employee_device_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Campos de rede/DHCP no cadastro de equipamentos
ALTER TABLE public.time_clock_equipment
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.communication_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mac_address text,
  ADD COLUMN IF NOT EXISTS dhcp_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_ip_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS ip_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_employee_sync boolean NOT NULL DEFAULT true;