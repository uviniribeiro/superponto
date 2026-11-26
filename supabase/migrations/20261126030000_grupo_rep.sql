-- Grupo de relógios (REP): um comando enviado ao grupo vale para todos os equipamentos dele.
ALTER TABLE public.time_clock_equipment ADD COLUMN IF NOT EXISTS group_name text;
CREATE INDEX IF NOT EXISTS idx_equipment_group ON public.time_clock_equipment(company_id, group_name) WHERE group_name IS NOT NULL;
