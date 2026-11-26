-- Recursos que faltavam na v1 (comparação com o manual do sistema de ponto analisado).
-- Funções de acesso ficam no esquema private (has_role, get_user_company_id, get_profile_id).

-- Aniversariantes: data de nascimento do funcionário.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- Mobilidade de intervalo: início previsto do intervalo e tolerância (janela) em minutos.
ALTER TABLE public.work_schedules
  ADD COLUMN IF NOT EXISTS break_start time,
  ADD COLUMN IF NOT EXISTS break_mobility_minutes integer NOT NULL DEFAULT 0 CHECK (break_mobility_minutes BETWEEN 0 AND 240);

-- Banco de horas com lançamentos (zerar em lote, pagamento, ajuste e saldo transportado).
CREATE TABLE IF NOT EXISTS public.time_bank_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  minutes integer NOT NULL CHECK (minutes <> 0),
  kind text NOT NULL CHECK (kind IN ('reset', 'payment', 'manual', 'carry')),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_bank_entries_profile ON public.time_bank_entries(profile_id, entry_date);
ALTER TABLE public.time_bank_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lançam no banco de horas" ON public.time_bank_entries FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.get_user_company_id(auth.uid()))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.get_user_company_id(auth.uid()));
CREATE POLICY "Gestor vê lançamentos da empresa" ON public.time_bank_entries FOR SELECT
  USING (private.has_role(auth.uid(), 'manager'::public.app_role) AND company_id = private.get_user_company_id(auth.uid()));
CREATE POLICY "Funcionário vê os próprios lançamentos" ON public.time_bank_entries FOR SELECT
  USING (profile_id = private.get_profile_id(auth.uid()));

-- Troca de escala / folga entre funcionários, com aprovação do gestor.
CREATE TABLE IF NOT EXISTS public.schedule_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('swap', 'day_off')),
  swap_date date NOT NULL,
  target_date date,
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schedule_swap_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores tratam trocas da empresa" ON public.schedule_swap_requests FOR ALL
  USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'manager'::public.app_role)) AND company_id = private.get_user_company_id(auth.uid()))
  WITH CHECK ((private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'manager'::public.app_role)) AND company_id = private.get_user_company_id(auth.uid()));
CREATE POLICY "Funcionário vê as trocas em que participa" ON public.schedule_swap_requests FOR SELECT
  USING (requester_id = private.get_profile_id(auth.uid()) OR target_id = private.get_profile_id(auth.uid()));
CREATE POLICY "Funcionário pede troca" ON public.schedule_swap_requests FOR INSERT
  WITH CHECK (requester_id = private.get_profile_id(auth.uid()) AND company_id = private.get_user_company_id(auth.uid()) AND status = 'pending');

-- Política de aprovação em níveis (ajustes de ponto e outras solicitações).
CREATE TABLE IF NOT EXISTS public.approval_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  module text NOT NULL CHECK (module IN ('adjustments', 'schedule_swaps')),
  levels integer NOT NULL DEFAULT 1 CHECK (levels BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, module)
);
ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins definem a política de aprovação" ON public.approval_policies FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.get_user_company_id(auth.uid()))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.get_user_company_id(auth.uid()));
CREATE POLICY "Gestores leem a política de aprovação" ON public.approval_policies FOR SELECT
  USING (company_id = private.get_user_company_id(auth.uid()));
ALTER TABLE public.adjustment_requests ADD COLUMN IF NOT EXISTS approvals jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.schedule_swap_requests ADD COLUMN IF NOT EXISTS approvals jsonb NOT NULL DEFAULT '[]'::jsonb;

-- E-mails agendados com as ocorrências do dia anterior (atrasos, faltas, marcações incompletas).
CREATE TABLE IF NOT EXISTS public.notification_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  emails text[] NOT NULL CHECK (cardinality(emails) BETWEEN 1 AND 20),
  occurrences text[] NOT NULL CHECK (cardinality(occurrences) >= 1),
  send_hour integer NOT NULL DEFAULT 7 CHECK (send_hour BETWEEN 6 AND 20),
  weekdays integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam e-mails agendados" ON public.notification_schedules FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.get_user_company_id(auth.uid()))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.get_user_company_id(auth.uid()));
