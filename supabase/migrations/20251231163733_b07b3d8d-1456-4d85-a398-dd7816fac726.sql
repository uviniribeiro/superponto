-- Add teacher-specific columns to class_hour_configurations
ALTER TABLE public.class_hour_configurations
ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'hourly',
ADD COLUMN IF NOT EXISTS weekly_class_hours numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS monthly_class_hours numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS min_interval_between_classes integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_consecutive_classes integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS night_class_start time DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS night_class_end time DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS night_class_rate_multiplier numeric DEFAULT 1.2,
ADD COLUMN IF NOT EXISTS activity_hours_percent numeric DEFAULT 33.33,
ADD COLUMN IF NOT EXISTS preparation_minutes_per_class integer DEFAULT 0;

-- Add teacher-specific columns to employee_class_hour_assignments
ALTER TABLE public.employee_class_hour_assignments
ADD COLUMN IF NOT EXISTS contract_weekly_hours numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contract_monthly_hours numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'hourly',
ADD COLUMN IF NOT EXISTS work_schedule_id uuid REFERENCES public.work_schedules(id) DEFAULT NULL;

-- Add comments for documentation (Portarias 1510 e 671)
COMMENT ON COLUMN public.class_hour_configurations.contract_type IS 'Tipo de contrato: hourly (horista), part_time (parcial), full_time (integral) - Art. 318 CLT';
COMMENT ON COLUMN public.class_hour_configurations.weekly_class_hours IS 'Carga horária semanal máxima de aulas';
COMMENT ON COLUMN public.class_hour_configurations.monthly_class_hours IS 'Carga horária mensal máxima de aulas';
COMMENT ON COLUMN public.class_hour_configurations.activity_hours_percent IS 'Percentual de hora atividade - Lei 11.738/2008 (mín 33,33% para preparação)';
COMMENT ON COLUMN public.class_hour_configurations.min_interval_between_classes IS 'Intervalo mínimo entre aulas em minutos - Portaria 671';
COMMENT ON COLUMN public.class_hour_configurations.max_consecutive_classes IS 'Máximo de aulas consecutivas permitidas';
COMMENT ON COLUMN public.class_hour_configurations.night_class_start IS 'Início do período noturno para aulas';
COMMENT ON COLUMN public.class_hour_configurations.night_class_end IS 'Fim do período noturno para aulas';
COMMENT ON COLUMN public.class_hour_configurations.night_class_rate_multiplier IS 'Multiplicador para aulas noturnas (adicional noturno)';