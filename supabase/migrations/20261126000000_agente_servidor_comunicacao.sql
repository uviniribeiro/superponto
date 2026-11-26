-- Equipamentos falando com o mesmo servidor de comunicação da v2 (superponto-communication-server):
-- chave por equipamento (só o hash SHA-256 fica no banco), último NSR coletado e fuso do relógio.
ALTER TABLE public.time_clock_equipment
  ADD COLUMN IF NOT EXISTS agent_key_hash text,
  ADD COLUMN IF NOT EXISTS last_nsr bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';
CREATE UNIQUE INDEX IF NOT EXISTS time_clock_equipment_agent_key_hash_key ON public.time_clock_equipment (agent_key_hash) WHERE agent_key_hash IS NOT NULL;
