-- Tabela para gestão de férias
CREATE TABLE public.vacation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acquisition_period_start DATE NOT NULL,
  acquisition_period_end DATE NOT NULL,
  requested_start_date DATE NOT NULL,
  requested_end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  days_available INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para períodos aquisitivos de férias
CREATE TABLE public.vacation_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  days_entitled INTEGER NOT NULL DEFAULT 30,
  days_taken INTEGER NOT NULL DEFAULT 0,
  days_remaining INTEGER GENERATED ALWAYS AS (days_entitled - days_taken) STORED,
  status TEXT NOT NULL DEFAULT 'acquiring' CHECK (status IN ('acquiring', 'available', 'expired', 'used')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para notificações customizáveis
CREATE TABLE public.custom_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('pending_approval', 'missing_records', 'overtime_alert', 'absence_alert', 'custom')),
  trigger_condition JSONB,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  app_enabled BOOLEAN NOT NULL DEFAULT false,
  recipients JSONB,
  schedule TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para logs de notificações enviadas
CREATE TABLE public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  notification_id UUID REFERENCES public.custom_notifications(id),
  recipient_id UUID REFERENCES public.profiles(id),
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'app', 'sms')),
  subject TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  sent_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para postos de trabalho georreferenciados (central de monitoramento)
CREATE TABLE public.work_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  group_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para associar funcionários a postos de trabalho
CREATE TABLE public.employee_work_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_station_id UUID NOT NULL REFERENCES public.work_stations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, work_station_id, start_date)
);

-- Tabela para métricas de rotatividade
CREATE TABLE public.turnover_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  total_employees INTEGER NOT NULL DEFAULT 0,
  new_hires INTEGER NOT NULL DEFAULT 0,
  terminations INTEGER NOT NULL DEFAULT 0,
  turnover_rate NUMERIC(5,2),
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, period_month, period_year)
);

-- Enable RLS
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_work_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnover_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vacation_requests
CREATE POLICY "Users can view their own vacation requests" ON public.vacation_requests
  FOR SELECT USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Users can create their own vacation requests" ON public.vacation_requests
  FOR INSERT WITH CHECK (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Admins and managers can view all vacation requests" ON public.vacation_requests
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers can update vacation requests" ON public.vacation_requests
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS Policies for vacation_periods
CREATE POLICY "Users can view their own vacation periods" ON public.vacation_periods
  FOR SELECT USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Admins and managers can view all vacation periods" ON public.vacation_periods
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can manage vacation periods" ON public.vacation_periods
  FOR ALL USING (has_role(auth.uid(), 'admin') AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

-- RLS Policies for custom_notifications
CREATE POLICY "Admins can manage custom notifications" ON public.custom_notifications
  FOR ALL USING (has_role(auth.uid(), 'admin') AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

CREATE POLICY "Managers can view custom notifications" ON public.custom_notifications
  FOR SELECT USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company_id(auth.uid()));

-- RLS Policies for notification_logs
CREATE POLICY "Users can view their own notification logs" ON public.notification_logs
  FOR SELECT USING (recipient_id = get_profile_id(auth.uid()));

CREATE POLICY "Admins can view all notification logs" ON public.notification_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "System can insert notification logs" ON public.notification_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for work_stations
CREATE POLICY "Users can view their company work stations" ON public.work_stations
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage work stations" ON public.work_stations
  FOR ALL USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));

-- RLS Policies for employee_work_stations
CREATE POLICY "Users can view their own work station assignments" ON public.employee_work_stations
  FOR SELECT USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Admins and managers can view all work station assignments" ON public.employee_work_stations
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can manage work station assignments" ON public.employee_work_stations
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for turnover_metrics
CREATE POLICY "Admins and managers can view turnover metrics" ON public.turnover_metrics
  FOR SELECT USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage turnover metrics" ON public.turnover_metrics
  FOR ALL USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_vacation_requests_updated_at BEFORE UPDATE ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vacation_periods_updated_at BEFORE UPDATE ON public.vacation_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_notifications_updated_at BEFORE UPDATE ON public.custom_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_stations_updated_at BEFORE UPDATE ON public.work_stations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();