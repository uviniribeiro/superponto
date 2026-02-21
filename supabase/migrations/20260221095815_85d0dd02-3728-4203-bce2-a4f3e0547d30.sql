
-- Allow admins and managers to insert adjustment_requests for any employee in their company
CREATE POLICY "Admins and managers can create adjustment requests"
ON public.adjustment_requests
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  AND company_id = get_user_company_id(auth.uid())
);

-- Allow admins and managers to insert time_records for any employee in their company
CREATE POLICY "Admins and managers can insert company time records"
ON public.time_records
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  AND company_id = get_user_company_id(auth.uid())
);

-- Allow admins and managers to delete time_records for any employee in their company
CREATE POLICY "Admins and managers can delete company time records"
ON public.time_records
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  AND company_id = get_user_company_id(auth.uid())
);
