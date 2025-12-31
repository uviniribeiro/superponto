-- Create table for time clock equipment registration
CREATE TABLE public.time_clock_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT,
  ip_address TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 80,
  protocol TEXT NOT NULL DEFAULT 'http',
  communication_type TEXT NOT NULL DEFAULT 'webservice',
  api_endpoint TEXT,
  username TEXT,
  password TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_communication TIMESTAMP WITH TIME ZONE,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_interval_seconds INTEGER NOT NULL DEFAULT 60,
  firmware_version TEXT,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for communication logs
CREATE TABLE public.equipment_communication_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.time_clock_equipment(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  status TEXT NOT NULL,
  message TEXT,
  request_type TEXT,
  response_data JSONB,
  records_synced INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for pending records from equipment
CREATE TABLE public.equipment_pending_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.time_clock_equipment(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  employee_identifier TEXT NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  record_type TEXT,
  raw_data JSONB,
  is_processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  profile_id UUID REFERENCES public.profiles(id),
  time_record_id UUID REFERENCES public.time_records(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_clock_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_pending_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for time_clock_equipment
CREATE POLICY "Admins can manage company equipment"
ON public.time_clock_equipment
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

CREATE POLICY "Users can view company equipment"
ON public.time_clock_equipment
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

-- RLS policies for equipment_communication_logs
CREATE POLICY "Admins can manage communication logs"
ON public.equipment_communication_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

CREATE POLICY "Users can view communication logs"
ON public.equipment_communication_logs
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

-- RLS policies for equipment_pending_records
CREATE POLICY "Admins can manage pending records"
ON public.equipment_pending_records
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL));

CREATE POLICY "Users can view pending records"
ON public.equipment_pending_records
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL);

-- Triggers for updated_at
CREATE TRIGGER update_time_clock_equipment_updated_at
BEFORE UPDATE ON public.time_clock_equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for communication status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_clock_equipment;
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_communication_logs;