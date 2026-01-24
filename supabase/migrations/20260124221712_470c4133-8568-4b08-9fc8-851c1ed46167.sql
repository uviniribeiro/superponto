-- Tabela para logs de segurança
CREATE TABLE IF NOT EXISTS public.security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'login', 'login_failed', 'logout', '2fa_enabled', '2fa_disabled', 'password_changed', 'suspicious_activity'
  severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
  ip_address VARCHAR(50),
  user_agent TEXT,
  location TEXT,
  device_fingerprint TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_security_logs_user_time ON public.security_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON public.security_logs(severity, created_at DESC);

-- Habilitar RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own security logs"
ON public.security_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all security logs"
ON public.security_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert security logs"
ON public.security_logs
FOR INSERT
WITH CHECK (true);

-- Tabela para credenciais WebAuthn
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  device_type VARCHAR(50), -- 'platform', 'cross-platform'
  transports TEXT[], -- 'usb', 'ble', 'nfc', 'internal'
  name VARCHAR(100),
  aaguid TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca por credential_id
CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON public.webauthn_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON public.webauthn_credentials(user_id);

-- Habilitar RLS
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can manage own credentials"
ON public.webauthn_credentials
FOR ALL
USING (auth.uid() = user_id);

-- Tabela para desafios WebAuthn temporários
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'register', 'authenticate'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Limpar desafios expirados automaticamente
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON public.webauthn_challenges(expires_at);

-- Habilitar RLS
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Política para desafios
CREATE POLICY "Users can manage own challenges"
ON public.webauthn_challenges
FOR ALL
USING (auth.uid() = user_id OR user_id IS NULL);

-- Função para registrar evento de segurança
CREATE OR REPLACE FUNCTION public.log_security_event(
  _user_id UUID,
  _event_type VARCHAR,
  _severity VARCHAR DEFAULT 'info',
  _ip_address VARCHAR DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _location TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.security_logs (user_id, event_type, severity, ip_address, user_agent, location, metadata)
  VALUES (_user_id, _event_type, _severity, _ip_address, _user_agent, _location, _metadata)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Função para detectar atividade suspeita
CREATE OR REPLACE FUNCTION public.check_suspicious_activity(
  _user_id UUID,
  _ip_address VARCHAR,
  _window_minutes INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_attempts INTEGER;
  unique_ips INTEGER;
  result JSONB;
BEGIN
  -- Contar tentativas falhas recentes
  SELECT COUNT(*) INTO failed_attempts
  FROM public.security_logs
  WHERE user_id = _user_id
    AND event_type = 'login_failed'
    AND created_at > NOW() - (_window_minutes || ' minutes')::INTERVAL;
  
  -- Contar IPs únicos recentes
  SELECT COUNT(DISTINCT ip_address) INTO unique_ips
  FROM public.security_logs
  WHERE user_id = _user_id
    AND event_type IN ('login', 'login_failed')
    AND created_at > NOW() - (_window_minutes || ' minutes')::INTERVAL;
  
  result := jsonb_build_object(
    'failed_attempts', failed_attempts,
    'unique_ips', unique_ips,
    'is_suspicious', (failed_attempts >= 5 OR unique_ips >= 3),
    'risk_level', CASE
      WHEN failed_attempts >= 10 OR unique_ips >= 5 THEN 'critical'
      WHEN failed_attempts >= 5 OR unique_ips >= 3 THEN 'warning'
      ELSE 'normal'
    END
  );
  
  RETURN result;
END;
$$;