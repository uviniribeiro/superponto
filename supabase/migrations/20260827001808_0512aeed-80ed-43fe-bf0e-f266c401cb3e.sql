ALTER TABLE public.communication_agents
  ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS token_max_age_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS token_renew_before_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS token_expired_at timestamp with time zone;

UPDATE public.communication_agents
SET token_expires_at = COALESCE(token_rotated_at, created_at) + (token_max_age_days || ' days')::interval
WHERE token_expires_at IS NULL;