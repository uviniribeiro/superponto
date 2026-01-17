-- Create a secure storage bucket for payroll exports with proper policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payroll-exports', 
  'payroll-exports', 
  false,  -- Private bucket
  10485760,  -- 10MB limit
  ARRAY['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  file_size_limit = 10485760;

-- Create storage policies for payroll exports bucket
-- Only admins from the same company can access payroll files

-- Policy for viewing/downloading payroll files (SELECT)
CREATE POLICY "Admins can view payroll files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payroll-exports' 
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

-- Policy for uploading payroll files (INSERT)
CREATE POLICY "Admins can upload payroll files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payroll-exports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

-- Policy for updating payroll files (UPDATE)
CREATE POLICY "Admins can update payroll files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payroll-exports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

-- Policy for deleting payroll files (DELETE)
CREATE POLICY "Admins can delete payroll files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payroll-exports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

-- Create a secure view for payroll exports that excludes direct file URLs
-- File access should be done via signed URLs generated on-demand
CREATE VIEW public.payroll_exports_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  company_id,
  export_type,
  period_start,
  period_end,
  -- Hide the direct file URL - clients should request signed URLs via edge function
  CASE 
    WHEN file_url IS NOT NULL THEN 'protected'
    ELSE NULL 
  END AS file_status,
  status,
  employee_count,
  total_hours,
  notes,
  created_by,
  created_at,
  transaction_hash
FROM public.payroll_exports
WHERE company_id = public.get_user_company_id(auth.uid());

-- Grant access to authenticated users (RLS on base table still applies)
GRANT SELECT ON public.payroll_exports_secure TO authenticated;

-- Add comments
COMMENT ON VIEW public.payroll_exports_secure IS 'Secure view for payroll exports. Hides direct file URLs. Use get-payroll-file edge function to get signed URLs.';
COMMENT ON COLUMN public.payroll_exports.file_url IS 'Internal file path. Never expose directly to clients. Use signed URLs via edge function.';