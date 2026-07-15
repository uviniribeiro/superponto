
CREATE POLICY "Users can insert own time records"
ON public.time_records
FOR INSERT
TO authenticated
WITH CHECK (
  profile_id = get_profile_id(auth.uid())
  AND company_id = get_user_company_id(auth.uid())
);
