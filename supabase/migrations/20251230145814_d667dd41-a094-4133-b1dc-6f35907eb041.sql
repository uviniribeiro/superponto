-- Add overtime settings to company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS daily_overtime_limit_hours DECIMAL(4,2) DEFAULT 2,
ADD COLUMN IF NOT EXISTS weekly_overtime_limit_hours DECIMAL(5,2) DEFAULT 10,
ADD COLUMN IF NOT EXISTS monthly_overtime_limit_hours DECIMAL(5,2) DEFAULT 44,
ADD COLUMN IF NOT EXISTS overtime_alert_email TEXT;

-- Create overtime_alerts table to track sent alerts
CREATE TABLE public.overtime_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  hours_worked DECIMAL(6,2) NOT NULL,
  hours_limit DECIMAL(6,2) NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.overtime_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for overtime_alerts
CREATE POLICY "Admins and managers can view all alerts" 
ON public.overtime_alerts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can view own alerts" 
ON public.overtime_alerts 
FOR SELECT 
USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "System can insert alerts" 
ON public.overtime_alerts 
FOR INSERT 
WITH CHECK (true);