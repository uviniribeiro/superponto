CREATE TABLE IF NOT EXISTS public.agent_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'stable',
  platform TEXT NOT NULL DEFAULT 'windows',
  download_url TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  min_supported_version TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version, channel, platform)
);

GRANT SELECT ON public.agent_releases TO authenticated;
GRANT ALL ON public.agent_releases TO service_role;

ALTER TABLE public.agent_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active releases"
ON public.agent_releases FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Super admins manage releases"
ON public.agent_releases FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.agent_update_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.communication_agents(id) ON DELETE CASCADE,
  release_id UUID REFERENCES public.agent_releases(id) ON DELETE SET NULL,
  from_version TEXT,
  to_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  checksum_ok BOOLEAN,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agent_update_events TO authenticated;
GRANT ALL ON public.agent_update_events TO service_role;

ALTER TABLE public.agent_update_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view agent update events"
ON public.agent_update_events FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_agent_update_events_agent ON public.agent_update_events (agent_id, started_at DESC);

ALTER TABLE public.communication_agents
  ADD COLUMN IF NOT EXISTS auto_update BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS update_channel TEXT NOT NULL DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS target_version TEXT,
  ADD COLUMN IF NOT EXISTS rollback_version TEXT,
  ADD COLUMN IF NOT EXISTS last_update_status TEXT,
  ADD COLUMN IF NOT EXISTS last_update_at TIMESTAMPTZ;

CREATE TRIGGER update_agent_releases_updated_at
BEFORE UPDATE ON public.agent_releases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_update_events_updated_at
BEFORE UPDATE ON public.agent_update_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.agent_update_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_update_events;