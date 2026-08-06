-- ============ Terminais ============
ALTER TABLE public.kiosk_terminals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS allow_all_employees boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activation_code text;

UPDATE public.kiosk_terminals SET status = 'approved' WHERE status = 'pending' AND created_at < now();

CREATE TABLE IF NOT EXISTS public.kiosk_terminal_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id uuid NOT NULL REFERENCES public.kiosk_terminals(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (terminal_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_terminal_employees TO authenticated;
GRANT ALL ON public.kiosk_terminal_employees TO service_role;
ALTER TABLE public.kiosk_terminal_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage terminal employees"
ON public.kiosk_terminal_employees FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.is_super_admin(auth.uid()))
  AND (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()))
)
WITH CHECK (
  (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.is_super_admin(auth.uid()))
  AND (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()))
);

-- ============ Manutenção ============
CREATE TABLE IF NOT EXISTS public.system_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  job text,
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expected_end_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_maintenance TO authenticated, anon;
GRANT ALL ON public.system_maintenance TO service_role;
ALTER TABLE public.system_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read maintenance status"
ON public.system_maintenance FOR SELECT TO authenticated, anon USING (true);

-- ============ Diagnósticos ============
CREATE TABLE IF NOT EXISTS public.system_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  code text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  user_message text NOT NULL DEFAULT 'Ocorreu um erro. Nossa equipe já foi avisada.',
  technical_detail text,
  entity_table text,
  entity_id text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_fixable boolean NOT NULL DEFAULT false,
  fix_action text,
  status text NOT NULL DEFAULT 'open',
  occurrences integer NOT NULL DEFAULT 1,
  detected_at timestamptz NOT NULL DEFAULT now(),
  fixed_at timestamptz,
  fixed_by uuid,
  fix_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_diagnostics_status ON public.system_diagnostics(status, detected_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_diagnostics TO authenticated;
GRANT ALL ON public.system_diagnostics TO service_role;
ALTER TABLE public.system_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read diagnostics"
ON public.system_diagnostics FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "Anyone authenticated can report an error"
ON public.system_diagnostics FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins update diagnostics"
ON public.system_diagnostics FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_system_diagnostics_updated_at
BEFORE UPDATE ON public.system_diagnostics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Reconhecimento facial ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS face_descriptor jsonb,
  ADD COLUMN IF NOT EXISTS face_enrolled_at timestamptz;