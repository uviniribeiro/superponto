ALTER POLICY "Driver can insert own gps position"
ON public.op_gps_positions
WITH CHECK (
  company_id = public.op_company_id()
  AND profile_id IN (
    SELECT id
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND company_id = public.op_company_id()
  )
  AND (schedule_id IS NULL OR schedule_id IN (
    SELECT id
    FROM public.op_schedules
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
      AND company_id = public.op_company_id()
  ))
  AND (vehicle_id IS NULL OR vehicle_id IN (
    SELECT vehicle_id
    FROM public.op_schedules
    WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
      AND company_id = public.op_company_id()
      AND vehicle_id IS NOT NULL
  ))
);