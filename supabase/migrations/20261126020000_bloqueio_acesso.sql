-- Bloqueio de acesso por período (férias, afastamento, desligamento em andamento…): enquanto vigente,
-- o usuário não entra no sistema.
CREATE TABLE IF NOT EXISTS public.access_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_access_blocks_profile ON public.access_blocks(profile_id, starts_at);
ALTER TABLE public.access_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam bloqueios da empresa" ON public.access_blocks FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.get_user_company_id(auth.uid()))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.get_user_company_id(auth.uid()));
CREATE POLICY "Usuário vê os próprios bloqueios" ON public.access_blocks FOR SELECT
  USING (profile_id = private.get_profile_id(auth.uid()));

-- Usado no login: há bloqueio vigente para o usuário atual?
CREATE OR REPLACE FUNCTION public.current_access_block()
RETURNS TABLE (reason text, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT b.reason, b.ends_at FROM public.access_blocks b
  WHERE b.profile_id = private.get_profile_id(auth.uid()) AND b.starts_at <= now() AND (b.ends_at IS NULL OR b.ends_at > now())
  ORDER BY b.starts_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.current_access_block() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_access_block() TO authenticated;
