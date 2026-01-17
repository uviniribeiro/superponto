-- Drop the overly permissive manager policy that exposes all profile columns including PII
DROP POLICY IF EXISTS "Managers can view company profiles basic info" ON public.profiles;