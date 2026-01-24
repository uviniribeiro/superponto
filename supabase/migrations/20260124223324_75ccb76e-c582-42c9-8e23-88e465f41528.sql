-- Adicionar configurações de notificação por email ao perfil
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_backup_codes BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_suspicious_login BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_new_device BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notify_password_change BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP WITH TIME ZONE;

-- Função para verificar e bloquear conta após X tentativas
CREATE OR REPLACE FUNCTION public.check_account_lockout(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record RECORD;
  lockout_duration INTERVAL := '15 minutes';
  max_attempts INTEGER := 5;
BEGIN
  SELECT failed_login_attempts, locked_until, last_failed_login
  INTO profile_record
  FROM profiles
  WHERE user_id = _user_id;
  
  IF profile_record IS NULL THEN
    RETURN jsonb_build_object('locked', false, 'attempts', 0);
  END IF;
  
  -- Verificar se está bloqueado
  IF profile_record.locked_until IS NOT NULL AND profile_record.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'locked', true,
      'locked_until', profile_record.locked_until,
      'attempts', profile_record.failed_login_attempts
    );
  END IF;
  
  -- Se o bloqueio expirou, resetar
  IF profile_record.locked_until IS NOT NULL AND profile_record.locked_until <= NOW() THEN
    UPDATE profiles SET 
      failed_login_attempts = 0,
      locked_until = NULL
    WHERE user_id = _user_id;
    
    RETURN jsonb_build_object('locked', false, 'attempts', 0);
  END IF;
  
  RETURN jsonb_build_object(
    'locked', false,
    'attempts', COALESCE(profile_record.failed_login_attempts, 0)
  );
END;
$$;

-- Função para registrar tentativa de login falha
CREATE OR REPLACE FUNCTION public.record_failed_login(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_attempts INTEGER;
  lockout_duration INTERVAL := '15 minutes';
  max_attempts INTEGER := 5;
  should_lock BOOLEAN := FALSE;
  lock_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Incrementar tentativas
  UPDATE profiles 
  SET 
    failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
    last_failed_login = NOW()
  WHERE user_id = _user_id
  RETURNING failed_login_attempts INTO new_attempts;
  
  -- Verificar se deve bloquear
  IF new_attempts >= max_attempts THEN
    lock_time := NOW() + lockout_duration;
    UPDATE profiles SET locked_until = lock_time WHERE user_id = _user_id;
    should_lock := TRUE;
  END IF;
  
  RETURN jsonb_build_object(
    'attempts', new_attempts,
    'locked', should_lock,
    'locked_until', lock_time,
    'max_attempts', max_attempts
  );
END;
$$;

-- Função para resetar tentativas após login bem sucedido
CREATE OR REPLACE FUNCTION public.reset_failed_login(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET 
    failed_login_attempts = 0,
    locked_until = NULL,
    last_failed_login = NULL
  WHERE user_id = _user_id;
END;
$$;