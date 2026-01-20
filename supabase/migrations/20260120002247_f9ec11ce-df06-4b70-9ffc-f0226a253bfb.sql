-- Adicionar coluna room na doctor_schedule_slots se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'doctor_schedule_slots' 
                 AND column_name = 'room') THEN
    ALTER TABLE doctor_schedule_slots ADD COLUMN room TEXT;
  END IF;
END $$;