-- Create system_announcements table for admin popups/broadcasts
CREATE TABLE public.system_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  announcement_type TEXT NOT NULL DEFAULT 'info', -- info, warning, urgent
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track which users have dismissed announcements
CREATE TABLE public.announcement_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.system_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Create employee_absences table for leave management
CREATE TABLE public.employee_absences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  absence_type TEXT NOT NULL, -- vacation, medical_leave, maternity, paternity, personal, other
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  reason TEXT,
  medical_certificate_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employee_identification_methods table
CREATE TABLE public.employee_identification_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL, -- facial, qrcode, rfid, pin
  identifier TEXT, -- encrypted PIN, RFID card number, QR code hash
  facial_data TEXT, -- facial encoding data if applicable
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, method_type)
);

-- Create payroll_exports table to track export history
CREATE TABLE public.payroll_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL, -- esocial, timesheet, custom
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'processing', -- processing, completed, failed
  employee_count INTEGER,
  total_hours NUMERIC,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_identification_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_exports ENABLE ROW LEVEL SECURITY;

-- RLS policies for system_announcements
CREATE POLICY "Users can view active announcements for their company" 
ON public.system_announcements FOR SELECT 
USING (
  company_id = public.get_user_company_id(auth.uid()) 
  AND is_active = true 
  AND starts_at <= now() 
  AND (expires_at IS NULL OR expires_at > now())
);

CREATE POLICY "Admins can manage announcements" 
ON public.system_announcements FOR ALL 
USING (
  company_id = public.get_user_company_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Super admins can manage all announcements" 
ON public.system_announcements FOR ALL 
USING (public.is_super_admin(auth.uid()));

-- RLS policies for announcement_dismissals
CREATE POLICY "Users can manage their own dismissals" 
ON public.announcement_dismissals FOR ALL 
USING (user_id = auth.uid());

-- RLS policies for employee_absences
CREATE POLICY "Employees can view their own absences" 
ON public.employee_absences FOR SELECT 
USING (profile_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Admins and managers can manage absences" 
ON public.employee_absences FOR ALL 
USING (
  company_id = public.get_user_company_id(auth.uid()) 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

-- RLS policies for employee_identification_methods
CREATE POLICY "Users can view their own identification methods" 
ON public.employee_identification_methods FOR SELECT 
USING (profile_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Admins can manage identification methods" 
ON public.employee_identification_methods FOR ALL 
USING (
  company_id = public.get_user_company_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'admin')
);

-- RLS policies for payroll_exports
CREATE POLICY "Admins can manage payroll exports" 
ON public.payroll_exports FOR ALL 
USING (
  company_id = public.get_user_company_id(auth.uid()) 
  AND public.has_role(auth.uid(), 'admin')
);

-- Triggers for updated_at
CREATE TRIGGER update_system_announcements_updated_at
  BEFORE UPDATE ON public.system_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_absences_updated_at
  BEFORE UPDATE ON public.employee_absences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_identification_methods_updated_at
  BEFORE UPDATE ON public.employee_identification_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();