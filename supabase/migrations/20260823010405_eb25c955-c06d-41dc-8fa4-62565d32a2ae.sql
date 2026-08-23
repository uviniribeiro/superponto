ALTER TABLE public.communication_agents
  ADD COLUMN IF NOT EXISTS pending_token_hash text,
  ADD COLUMN IF NOT EXISTS pending_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_token_hash text,
  ADD COLUMN IF NOT EXISTS previous_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_rotation_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS token_rotation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_auto_rotation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS token_rotation_interval_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS next_token_rotation_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_communication_agents_pending_token
  ON public.communication_agents (pending_token_hash);
CREATE INDEX IF NOT EXISTS idx_communication_agents_previous_token
  ON public.communication_agents (previous_token_hash);

CREATE TABLE IF NOT EXISTS public.agent_token_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.communication_agents(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  window_expires_at timestamptz,
  validated_at timestamptz,
  finished_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.agent_token_rotations TO authenticated;
GRANT ALL ON public.agent_token_rotations TO service_role;

ALTER TABLE public.agent_token_rotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e gestores veem rotacoes da sua empresa"
ON public.agent_token_rotations FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Admins e gestores criam rotacoes da sua empresa"
ON public.agent_token_rotations FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Admins e gestores atualizam rotacoes da sua empresa"
ON public.agent_token_rotations FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
)
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE TRIGGER update_agent_token_rotations_updated_at
BEFORE UPDATE ON public.agent_token_rotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.communication_agents REPLICA IDENTITY FULL;
ALTER TABLE public.discovered_devices REPLICA IDENTITY FULL;
ALTER TABLE public.device_commands REPLICA IDENTITY FULL;
ALTER TABLE public.employee_device_sync REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_agents; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.discovered_devices; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.device_commands; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_device_sync; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;