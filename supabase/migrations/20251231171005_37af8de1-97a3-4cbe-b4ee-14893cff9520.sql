-- Add educator_type to class_hour_configurations for EducaNet compatibility
-- Types based on Brazilian education system standards
ALTER TABLE public.class_hour_configurations 
ADD COLUMN IF NOT EXISTS educator_type TEXT DEFAULT 'PEB_II';

-- Add educator_type to employee_class_hour_assignments for individual teacher classification
ALTER TABLE public.employee_class_hour_assignments
ADD COLUMN IF NOT EXISTS educator_type TEXT DEFAULT 'PEB_II';

-- Add teaching_level to specify education level
ALTER TABLE public.employee_class_hour_assignments
ADD COLUMN IF NOT EXISTS teaching_level TEXT DEFAULT 'fundamental';

-- Add subject/discipline for the schedule board
ALTER TABLE public.employee_class_hour_assignments
ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add class schedule slots for weekly schedule board
CREATE TABLE IF NOT EXISTS public.teacher_schedule_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.employee_class_hour_assignments(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  company_id UUID REFERENCES public.companies(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday, etc
  slot_number INTEGER NOT NULL, -- Period number (1st, 2nd, 3rd class, etc)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject TEXT,
  class_name TEXT, -- e.g., "5º Ano A", "8º Ano B"
  room TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, day_of_week, slot_number)
);

-- Enable RLS
ALTER TABLE public.teacher_schedule_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own schedule slots"
ON public.teacher_schedule_slots
FOR SELECT
USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Admins and managers can view all schedule slots"
ON public.teacher_schedule_slots
FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can manage schedule slots"
ON public.teacher_schedule_slots
FOR ALL
USING (has_role(auth.uid(), 'admin') AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

-- Add comments for documentation
COMMENT ON COLUMN public.class_hour_configurations.educator_type IS 'Tipo de educador conforme EducaNet: PEB_I (Ed. Infantil/Fund. I), PEB_II (Fund. II/Médio), PEB_III (Especialista), PROFESSOR_AUXILIAR, MONITOR, COORDENADOR_PEDAGOGICO';

COMMENT ON COLUMN public.employee_class_hour_assignments.educator_type IS 'Tipo de educador individual do professor';
COMMENT ON COLUMN public.employee_class_hour_assignments.teaching_level IS 'Nível de ensino: infantil, fundamental_1, fundamental_2, medio, eja, tecnico';
COMMENT ON COLUMN public.employee_class_hour_assignments.subject IS 'Disciplina/Componente curricular';

COMMENT ON TABLE public.teacher_schedule_slots IS 'Quadro de horários semanal por professor - compatível EducaNet';