-- Add workload_type enum for daily, weekly, monthly workload configurations
CREATE TYPE public.workload_type AS ENUM ('daily', 'weekly', 'monthly');

-- Add new columns to work_schedules to unify with scale_configurations
ALTER TABLE public.work_schedules 
ADD COLUMN IF NOT EXISTS scale_type public.scale_type DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS workload_type public.workload_type DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS work_days integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS off_days integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS work_hours_per_day numeric DEFAULT 8,
ADD COLUMN IF NOT EXISTS weekly_hours numeric DEFAULT 44,
ADD COLUMN IF NOT EXISTS monthly_hours numeric DEFAULT 220,
ADD COLUMN IF NOT EXISTS holiday_treatment public.holiday_treatment DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS night_shift_start time DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS night_shift_end time DEFAULT '05:00',
ADD COLUMN IF NOT EXISTS night_shift_reduction_percent numeric DEFAULT 14.28,
ADD COLUMN IF NOT EXISTS overtime_50_percent_limit numeric DEFAULT 2,
ADD COLUMN IF NOT EXISTS overtime_100_percent_limit numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS interjornada_hours numeric DEFAULT 11,
ADD COLUMN IF NOT EXISTS intrajornada_minutes integer DEFAULT 60;

-- Add comments for documentation (Portarias 1510 e 671)
COMMENT ON COLUMN public.work_schedules.workload_type IS 'Tipo de carga horária: daily (diária), weekly (semanal 44h CLT), monthly (mensal 220h)';
COMMENT ON COLUMN public.work_schedules.weekly_hours IS 'Carga horária semanal - CLT: máximo 44h (Art. 58 CLT / Portaria 671)';
COMMENT ON COLUMN public.work_schedules.monthly_hours IS 'Carga horária mensal - CLT: máximo 220h (44h x 5 semanas)';
COMMENT ON COLUMN public.work_schedules.night_shift_start IS 'Início do adicional noturno - CLT: 22h (Art. 73 CLT)';
COMMENT ON COLUMN public.work_schedules.night_shift_end IS 'Fim do adicional noturno - CLT: 05h (Art. 73 CLT)';
COMMENT ON COLUMN public.work_schedules.night_shift_reduction_percent IS 'Redução hora noturna - CLT: 52min30s = 14.28% (Art. 73 §1º CLT)';
COMMENT ON COLUMN public.work_schedules.overtime_50_percent_limit IS 'Limite horas extras 50% por dia (Portaria 671)';
COMMENT ON COLUMN public.work_schedules.overtime_100_percent_limit IS 'Horas extras 100% - domingos/feriados';
COMMENT ON COLUMN public.work_schedules.interjornada_hours IS 'Intervalo entre jornadas - CLT: mínimo 11h (Art. 66 CLT)';
COMMENT ON COLUMN public.work_schedules.intrajornada_minutes IS 'Intervalo intrajornada - CLT: mínimo 1h para jornada >6h (Art. 71 CLT)';