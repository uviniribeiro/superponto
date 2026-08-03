CREATE TABLE public.attendance_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Regra padrão',
  is_default BOOLEAN NOT NULL DEFAULT true,

  -- Tolerâncias (8.14, 8.18)
  entry_tolerance_minutes INTEGER NOT NULL DEFAULT 5,
  exit_tolerance_minutes INTEGER NOT NULL DEFAULT 5,
  daily_tolerance_minutes INTEGER NOT NULL DEFAULT 10,
  per_punch_tolerance_minutes INTEGER NOT NULL DEFAULT 0,

  -- Arredondamento (8.23)
  rounding_minutes INTEGER NOT NULL DEFAULT 0,
  rounding_mode TEXT NOT NULL DEFAULT 'nearest',

  -- Horas extras (8.10, 8.11, 8.12)
  overtime_normal_percent NUMERIC NOT NULL DEFAULT 50,
  overtime_night_percent NUMERIC NOT NULL DEFAULT 50,
  overtime_rest_day_percent NUMERIC NOT NULL DEFAULT 100,
  overtime_holiday_percent NUMERIC NOT NULL DEFAULT 100,
  overtime_break_percent NUMERIC NOT NULL DEFAULT 50,
  count_break_overtime BOOLEAN NOT NULL DEFAULT true,
  daily_overtime_limit_minutes INTEGER NOT NULL DEFAULT 120,

  -- Adicional noturno (8.13)
  night_start TIME NOT NULL DEFAULT '22:00',
  night_end TIME NOT NULL DEFAULT '05:00',
  night_percent NUMERIC NOT NULL DEFAULT 20,
  use_reduced_night_hour BOOLEAN NOT NULL DEFAULT true,

  -- Intrajornada (8.17)
  min_break_minutes INTEGER NOT NULL DEFAULT 60,
  auto_deduct_break BOOLEAN NOT NULL DEFAULT true,

  -- Compensação (8.24)
  auto_compensation BOOLEAN NOT NULL DEFAULT true,
  compensation_deadline_days INTEGER NOT NULL DEFAULT 30,
  max_occurrences_per_month INTEGER NOT NULL DEFAULT 5,
  max_compensation_minutes_per_month INTEGER NOT NULL DEFAULT 600,

  -- Regras de jornada (8.19, 8.20, 8.25, 8.15, 8.27)
  journey_day_reference TEXT NOT NULL DEFAULT 'entry',
  occurrence_allocation TEXT NOT NULL DEFAULT 'journey_day',
  single_punch_balance BOOLEAN NOT NULL DEFAULT true,
  require_manager_approval_early BOOLEAN NOT NULL DEFAULT true,
  auto_discount_absences BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_rules TO authenticated;
GRANT ALL ON public.attendance_rules TO service_role;

ALTER TABLE public.attendance_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver regras da sua empresa"
ON public.attendance_rules FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins e gestores podem criar regras"
ON public.attendance_rules FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Admins e gestores podem alterar regras"
ON public.attendance_rules FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
)
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins podem excluir regras"
ON public.attendance_rules FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER update_attendance_rules_updated_at
BEFORE UPDATE ON public.attendance_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX attendance_rules_company_default_idx
ON public.attendance_rules (company_id) WHERE is_default;