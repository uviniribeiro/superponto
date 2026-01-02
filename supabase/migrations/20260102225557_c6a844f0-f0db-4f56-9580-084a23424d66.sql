-- Add Portaria compliance fields to time_clock_equipment table
ALTER TABLE public.time_clock_equipment 
ADD COLUMN IF NOT EXISTS portaria_compliance text DEFAULT 'portaria_671',
ADD COLUMN IF NOT EXISTS rep_number text;

-- Add comment for documentation
COMMENT ON COLUMN public.time_clock_equipment.portaria_compliance IS 'Compliance with MTE Portaria: portaria_671, portaria_1510, or portaria_373';
COMMENT ON COLUMN public.time_clock_equipment.rep_number IS 'REP registration number from MTE (17 digits)';

-- Create index for better query performance on pending records
CREATE INDEX IF NOT EXISTS idx_equipment_pending_records_identifier 
ON public.equipment_pending_records(employee_identifier);

CREATE INDEX IF NOT EXISTS idx_equipment_pending_records_processed 
ON public.equipment_pending_records(is_processed);

-- Add index for profile lookups by registration_number, pis, cpf (for faster employee matching)
CREATE INDEX IF NOT EXISTS idx_profiles_registration_number 
ON public.profiles(registration_number) WHERE registration_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_pis 
ON public.profiles(pis) WHERE pis IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_cpf 
ON public.profiles(cpf) WHERE cpf IS NOT NULL;