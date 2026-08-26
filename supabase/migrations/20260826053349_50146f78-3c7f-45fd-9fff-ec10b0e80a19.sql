ALTER TABLE public.communication_agents
  ADD COLUMN IF NOT EXISTS queue_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS queue_paused_by uuid;

ALTER TABLE public.device_commands
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_by uuid,
  ADD COLUMN IF NOT EXISTS last_action text,
  ADD COLUMN IF NOT EXISTS last_action_at timestamptz;