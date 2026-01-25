-- Fix overly permissive RLS policy on notification_logs
DROP POLICY IF EXISTS "System can insert notification logs" ON public.notification_logs;

-- Replace with proper policy that checks company context
CREATE POLICY "Authenticated users can insert notification logs" ON public.notification_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
  );