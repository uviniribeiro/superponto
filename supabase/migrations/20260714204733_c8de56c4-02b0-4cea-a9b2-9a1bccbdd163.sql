
-- 1) QR expiration on identification methods
ALTER TABLE public.employee_identification_methods
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qr_valid_days INTEGER NOT NULL DEFAULT 30;

-- 2) Audit table for validation attempts (facial / qrcode)
CREATE TABLE IF NOT EXISTS public.identification_validation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID,
  company_id UUID,
  method_type TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  reason TEXT,
  identifier_matched TEXT,
  confidence NUMERIC,
  time_record_id UUID,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.identification_validation_attempts TO authenticated;
GRANT ALL ON public.identification_validation_attempts TO service_role;

ALTER TABLE public.identification_validation_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert their own validation attempts" ON public.identification_validation_attempts;
CREATE POLICY "Users insert their own validation attempts"
  ON public.identification_validation_attempts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view their own validation attempts" ON public.identification_validation_attempts;
CREATE POLICY "Users view their own validation attempts"
  ON public.identification_validation_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and managers view company validation attempts" ON public.identification_validation_attempts;
CREATE POLICY "Admins and managers view company validation attempts"
  ON public.identification_validation_attempts
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    AND company_id = public.get_user_company_id(auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_ident_valid_attempts_user ON public.identification_validation_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ident_valid_attempts_company ON public.identification_validation_attempts(company_id, created_at DESC);

-- 3) Server-side QR validation function (used by edge function)
CREATE OR REPLACE FUNCTION public.validate_qrcode_identifier(_identifier TEXT)
RETURNS TABLE(is_valid BOOLEAN, profile_id UUID, company_id UUID, reason TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  method_record RECORD;
BEGIN
  SELECT m.profile_id, m.company_id, m.is_active, m.expires_at
    INTO method_record
    FROM public.employee_identification_methods m
   WHERE m.method_type = 'qrcode'
     AND m.identifier = _identifier
   LIMIT 1;

  IF method_record IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'QR Code não encontrado'::TEXT;
    RETURN;
  END IF;

  IF NOT method_record.is_active THEN
    RETURN QUERY SELECT FALSE, method_record.profile_id, method_record.company_id, 'QR Code inativo'::TEXT;
    RETURN;
  END IF;

  IF method_record.expires_at IS NOT NULL AND method_record.expires_at <= now() THEN
    RETURN QUERY SELECT FALSE, method_record.profile_id, method_record.company_id, 'QR Code expirado. Solicite um novo.'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, method_record.profile_id, method_record.company_id, 'ok'::TEXT;
END;
$$;
