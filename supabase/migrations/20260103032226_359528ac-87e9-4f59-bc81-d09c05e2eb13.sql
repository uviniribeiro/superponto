-- Create employee transfer history table
CREATE TABLE public.employee_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  from_company_id UUID NOT NULL,
  to_company_id UUID NOT NULL,
  transferred_by UUID NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_transfers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Super admins can manage all transfers"
ON public.employee_transfers
FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view transfers in their company"
ON public.employee_transfers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') AND 
  (from_company_id = get_user_company_id(auth.uid()) OR to_company_id = get_user_company_id(auth.uid()))
);

-- Create index for better performance
CREATE INDEX idx_employee_transfers_profile_id ON public.employee_transfers(profile_id);
CREATE INDEX idx_employee_transfers_from_company ON public.employee_transfers(from_company_id);
CREATE INDEX idx_employee_transfers_to_company ON public.employee_transfers(to_company_id);