CREATE TABLE public.kiosk_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Terminal de Ponto',
  device_token text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_kiosk_terminals_company ON public.kiosk_terminals(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_terminals TO authenticated;
GRANT ALL ON public.kiosk_terminals TO service_role;

ALTER TABLE public.kiosk_terminals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers manage company terminals"
ON public.kiosk_terminals FOR ALL
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
  AND (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()))
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.is_super_admin(auth.uid()))
  AND (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()))
);

CREATE TRIGGER update_kiosk_terminals_updated_at
BEFORE UPDATE ON public.kiosk_terminals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();