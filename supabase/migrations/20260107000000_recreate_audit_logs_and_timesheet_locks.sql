-- Reconstrói duas tabelas que existiam no banco do Supabase Cloud mas cuja criação nunca
-- entrou no histórico de migrações (as migrações seguintes já as alteram). Definição derivada
-- de src/integrations/supabase/types.ts. IF NOT EXISTS: não faz nada onde elas já existem.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  description text,
  menu_section text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  transaction_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON public.audit_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs (user_id);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.timesheet_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  is_locked boolean NOT NULL DEFAULT true,
  locked_at timestamptz DEFAULT now(),
  locked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  unlocked_at timestamptz,
  unlocked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  calculated_worked_minutes integer,
  calculated_overtime_minutes integer,
  calculated_absence_minutes integer,
  notes text,
  transaction_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, year, month)
);
ALTER TABLE public.timesheet_locks ENABLE ROW LEVEL SECURITY;
