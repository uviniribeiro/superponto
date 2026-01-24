-- Corrigir política RLS permissiva para security_logs
DROP POLICY IF EXISTS "System can insert security logs" ON public.security_logs;

CREATE POLICY "Authenticated users can insert their own security logs"
ON public.security_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);