ALTER TABLE public.op_schedules
  ADD COLUMN IF NOT EXISTS actual_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by uuid,
  ADD COLUMN IF NOT EXISTS ended_by uuid;

DROP POLICY IF EXISTS "op_schedules_driver_self_update" ON public.op_schedules;
CREATE POLICY "op_schedules_driver_self_update" ON public.op_schedules
  FOR UPDATE TO authenticated
  USING (company_id = public.op_company_id() AND profile_id = public.get_profile_id(auth.uid()))
  WITH CHECK (company_id = public.op_company_id() AND profile_id = public.get_profile_id(auth.uid()));

DROP POLICY IF EXISTS "op_schedules_driver_self_select" ON public.op_schedules;
CREATE POLICY "op_schedules_driver_self_select" ON public.op_schedules
  FOR SELECT TO authenticated
  USING (company_id = public.op_company_id() AND profile_id = public.get_profile_id(auth.uid()));

DROP POLICY IF EXISTS "op_gps_positions_self_select" ON public.op_gps_positions;
CREATE POLICY "op_gps_positions_self_select" ON public.op_gps_positions
  FOR SELECT TO authenticated
  USING (company_id = public.op_company_id() AND profile_id = public.get_profile_id(auth.uid()));

ALTER TABLE public.op_schedules REPLICA IDENTITY FULL;
ALTER TABLE public.op_occurrences REPLICA IDENTITY FULL;
ALTER TABLE public.op_gps_positions REPLICA IDENTITY FULL;
ALTER TABLE public.op_telemetry_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.op_schedules; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.op_occurrences; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.op_gps_positions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.op_telemetry_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;