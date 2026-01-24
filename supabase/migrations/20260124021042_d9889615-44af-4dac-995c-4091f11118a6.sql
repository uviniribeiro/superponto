-- Adicionar colunas para 2FA na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMP WITH TIME ZONE;

-- Criar tabela para tentativas de 2FA (rate limiting)
CREATE TABLE IF NOT EXISTS public.two_factor_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_type VARCHAR(20) NOT NULL, -- 'setup', 'verify', 'backup'
  success BOOLEAN DEFAULT FALSE,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas de rate limiting
CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_time 
ON public.two_factor_attempts(user_id, created_at DESC);

-- Habilitar RLS
ALTER TABLE public.two_factor_attempts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para two_factor_attempts
CREATE POLICY "Users can view own 2FA attempts" 
ON public.two_factor_attempts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert 2FA attempts" 
ON public.two_factor_attempts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Função para verificar rate limit de 2FA
CREATE OR REPLACE FUNCTION public.check_2fa_rate_limit(
  _user_id UUID,
  _attempt_type VARCHAR,
  _max_attempts INTEGER DEFAULT 5,
  _window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.two_factor_attempts
  WHERE user_id = _user_id
    AND attempt_type = _attempt_type
    AND success = FALSE
    AND created_at > NOW() - (_window_minutes || ' minutes')::INTERVAL;
  
  RETURN attempt_count < _max_attempts;
END;
$$;

-- Função para registrar tentativa de 2FA
CREATE OR REPLACE FUNCTION public.log_2fa_attempt(
  _user_id UUID,
  _attempt_type VARCHAR,
  _success BOOLEAN,
  _ip_address VARCHAR DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.two_factor_attempts (user_id, attempt_type, success, ip_address, user_agent)
  VALUES (_user_id, _attempt_type, _success, _ip_address, _user_agent);
END;
$$;