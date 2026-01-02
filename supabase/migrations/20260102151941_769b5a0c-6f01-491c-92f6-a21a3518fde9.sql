-- Create license_renewals table for renewal history
CREATE TABLE public.license_renewals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  previous_valid_until DATE NOT NULL,
  new_valid_until DATE NOT NULL,
  renewal_type TEXT NOT NULL, -- 'monthly', 'annual', 'lifetime'
  renewed_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.license_renewals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can manage all renewals"
ON public.license_renewals
FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Company admins can view their license renewals"
ON public.license_renewals
FOR SELECT
USING (
  license_id IN (
    SELECT l.id FROM public.licenses l
    WHERE l.company_id = get_user_company_id(auth.uid())
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Add index for performance
CREATE INDEX idx_license_renewals_license_id ON public.license_renewals(license_id);
CREATE INDEX idx_license_renewals_created_at ON public.license_renewals(created_at DESC);