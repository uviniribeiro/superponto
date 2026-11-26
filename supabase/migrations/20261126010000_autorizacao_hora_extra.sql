-- Autorização prévia de horas extras (por dia ou pelo período), como no "autorizarExtra" do
-- serviço de ponto analisado — feito de forma nativa no SuperPonto.
CREATE TABLE IF NOT EXISTS public.overtime_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  approved_minutes integer NOT NULL CHECK (approved_minutes > 0 AND approved_minutes <= 24 * 60 * 31),
  mode text NOT NULL DEFAULT 'per_day' CHECK (mode IN ('per_day', 'per_period')),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_overtime_auth_profile ON public.overtime_authorizations(profile_id, start_date);
ALTER TABLE public.overtime_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores gerenciam autorizações de extra da empresa" ON public.overtime_authorizations FOR ALL
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND company_id = get_user_company_id(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Funcionário vê as próprias autorizações" ON public.overtime_authorizations FOR SELECT
  USING (profile_id = get_profile_id(auth.uid()));
