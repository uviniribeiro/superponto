ALTER TABLE public.op_vehicles
  ADD COLUMN IF NOT EXISTS tracker_id text,
  ADD COLUMN IF NOT EXISTS telemetry_provider text,
  ADD COLUMN IF NOT EXISTS tracking_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.op_gps_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid REFERENCES public.op_vehicles(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES public.op_schedules(id) ON DELETE SET NULL,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  speed_kmh numeric(6,2),
  heading numeric(5,2),
  accuracy_m numeric(6,2),
  source text NOT NULL DEFAULT 'tracker',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_gps_positions TO authenticated;
GRANT ALL ON public.op_gps_positions TO service_role;
ALTER TABLE public.op_gps_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_gps_select" ON public.op_gps_positions
  FOR SELECT TO authenticated
  USING (company_id = public.op_company_id() AND public.op_can('reports'));
CREATE POLICY "op_gps_write" ON public.op_gps_positions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.op_company_id()
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "op_gps_delete" ON public.op_gps_positions
  FOR DELETE TO authenticated
  USING (company_id = public.op_company_id()
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));

CREATE TABLE IF NOT EXISTS public.op_telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vehicle_id uuid REFERENCES public.op_vehicles(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES public.op_schedules(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  value numeric,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_telemetry_events TO authenticated;
GRANT ALL ON public.op_telemetry_events TO service_role;
ALTER TABLE public.op_telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_telemetry_select" ON public.op_telemetry_events
  FOR SELECT TO authenticated
  USING (company_id = public.op_company_id() AND public.op_can('reports'));
CREATE POLICY "op_telemetry_write" ON public.op_telemetry_events
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.op_company_id()
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "op_telemetry_delete" ON public.op_telemetry_events
  FOR DELETE TO authenticated
  USING (company_id = public.op_company_id()
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)));

CREATE INDEX IF NOT EXISTS idx_op_gps_company_time ON public.op_gps_positions (company_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_gps_vehicle_time ON public.op_gps_positions (vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_gps_schedule ON public.op_gps_positions (schedule_id);
CREATE INDEX IF NOT EXISTS idx_op_tel_company_time ON public.op_telemetry_events (company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_tel_vehicle_time ON public.op_telemetry_events (vehicle_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_tel_schedule ON public.op_telemetry_events (schedule_id);