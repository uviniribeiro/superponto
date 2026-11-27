-- Catraca ligada ao terminal: configuração (fabricante, endereço na rede local, credenciais, sentido)
-- e o último estado informado pelo terminal (online/offline).
ALTER TABLE public.kiosk_terminals
  ADD COLUMN IF NOT EXISTS turnstile jsonb,
  ADD COLUMN IF NOT EXISTS turnstile_online boolean,
  ADD COLUMN IF NOT EXISTS turnstile_seen_at timestamptz;
