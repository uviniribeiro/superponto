DROP POLICY IF EXISTS "Users can insert own profile on signup" ON public.profiles;

CREATE POLICY "Users can insert own profile on signup"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    company_id IS NULL
    OR EXISTS (SELECT 1 FROM public.pending_company_users pcu WHERE pcu.company_id = profiles.company_id)
    OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id = profiles.company_id)
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert their own security logs" ON public.security_logs;

CREATE POLICY "Authenticated users can insert their own security logs"
ON public.security_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);