DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'op_gps_positions'
      AND policyname = 'Driver can insert own gps position'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Driver can insert own gps position"
      ON public.op_gps_positions
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = public.op_company_id()
        AND profile_id IN (
          SELECT id FROM public.profiles WHERE user_id = auth.uid()
        )
      )
    $policy$;
  END IF;
END $$;
