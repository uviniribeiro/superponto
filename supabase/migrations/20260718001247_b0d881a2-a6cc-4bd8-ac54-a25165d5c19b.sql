DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'identification_validation_attempts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.identification_validation_attempts;
  END IF;
END $$;

ALTER TABLE public.identification_validation_attempts REPLICA IDENTITY FULL;