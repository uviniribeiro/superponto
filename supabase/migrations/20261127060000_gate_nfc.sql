-- Portaria (controle de acesso com catraca) e cartão NFC (MIFARE) no terminal.
ALTER TABLE public.kiosk_terminals DROP CONSTRAINT IF EXISTS kiosk_terminals_purpose_check;
ALTER TABLE public.kiosk_terminals ADD CONSTRAINT kiosk_terminals_purpose_check CHECK (purpose IN ('punch', 'meal', 'gate'));
ALTER TABLE public.kiosk_terminals
  ADD COLUMN IF NOT EXISTS gate_direction text NOT NULL DEFAULT 'auto' CHECK (gate_direction IN ('auto', 'in', 'out')),
  ADD COLUMN IF NOT EXISTS card_without_face boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.gate_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  terminal_id uuid REFERENCES public.kiosk_terminals(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  verification text,
  transaction_hash text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gate_access_logs_company_date_idx ON public.gate_access_logs(company_id, recorded_at);
CREATE INDEX IF NOT EXISTS gate_access_logs_profile_idx ON public.gate_access_logs(profile_id, recorded_at);
ALTER TABLE public.gate_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers view gate logs" ON public.gate_access_logs FOR SELECT
  USING (company_id = private.get_user_company_id(auth.uid())
    AND (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'manager'::public.app_role)));
CREATE POLICY "Employees view own gate logs" ON public.gate_access_logs FOR SELECT
  USING (profile_id = private.get_profile_id(auth.uid()));
