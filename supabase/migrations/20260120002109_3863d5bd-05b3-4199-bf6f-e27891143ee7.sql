-- Adicionar coluna updated_at na doctor_schedule_slots se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'doctor_schedule_slots' 
                 AND column_name = 'updated_at') THEN
    ALTER TABLE doctor_schedule_slots ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Adicionar coluna school na teacher_schedule_slots se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'teacher_schedule_slots' 
                 AND column_name = 'school') THEN
    ALTER TABLE teacher_schedule_slots ADD COLUMN school TEXT;
  END IF;
END $$;

-- Trigger para atualizar updated_at automaticamente em doctor_schedule_slots
CREATE OR REPLACE FUNCTION update_doctor_schedule_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_doctor_schedule_slots_updated_at_trigger ON doctor_schedule_slots;
CREATE TRIGGER update_doctor_schedule_slots_updated_at_trigger
  BEFORE UPDATE ON doctor_schedule_slots
  FOR EACH ROW EXECUTE FUNCTION update_doctor_schedule_slots_updated_at();