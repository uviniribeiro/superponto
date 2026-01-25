-- Tabela de períodos de homologação
CREATE TABLE public.homologation_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'extended')),
  extended_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, reference_month)
);

-- Tabela de homologações individuais de ponto
CREATE TABLE public.point_homologations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_id UUID REFERENCES public.homologation_periods(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'blocked', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, reference_month)
);

-- Tabela de pendências que bloqueiam homologação
CREATE TABLE public.point_pendencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  homologation_id UUID REFERENCES public.point_homologations(id) ON DELETE CASCADE,
  reference_date DATE NOT NULL,
  pendency_type TEXT NOT NULL CHECK (pendency_type IN ('missing_entry', 'missing_exit', 'missing_break', 'unjustified_absence', 'incomplete_record', 'excessive_overtime', 'missing_justification', 'other')),
  description TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de ocorrências registradas
CREATE TABLE public.point_occurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  occurrence_type TEXT NOT NULL CHECK (occurrence_type IN ('late_arrival', 'early_departure', 'absence', 'overtime', 'schedule_change', 'external_work', 'training', 'medical', 'personal', 'other')),
  description TEXT NOT NULL,
  justification_id UUID REFERENCES public.justifications(id),
  document_url TEXT,
  registered_by UUID NOT NULL REFERENCES public.profiles(id),
  is_approved BOOLEAN,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de cartões de ponto gerados
CREATE TABLE public.point_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  file_url TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID NOT NULL REFERENCES public.profiles(id),
  sent_for_signature BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  signed BOOLEAN NOT NULL DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_url TEXT,
  returned_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, reference_month)
);

-- Enable RLS
ALTER TABLE public.homologation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_homologations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_pendencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for homologation_periods
CREATE POLICY "Admins can manage homologation periods"
  ON public.homologation_periods FOR ALL
  USING (has_role(auth.uid(), 'admin') AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can view their company homologation periods"
  ON public.homologation_periods FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

-- RLS Policies for point_homologations
CREATE POLICY "Admins and managers can manage homologations"
  ON public.point_homologations FOR ALL
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can view their own homologation status"
  ON public.point_homologations FOR SELECT
  USING (profile_id = get_profile_id(auth.uid()));

-- RLS Policies for point_pendencies
CREATE POLICY "Admins and managers can manage pendencies"
  ON public.point_pendencies FOR ALL
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can view their own pendencies"
  ON public.point_pendencies FOR SELECT
  USING (profile_id = get_profile_id(auth.uid()));

-- RLS Policies for point_occurrences
CREATE POLICY "Admins and managers can manage all occurrences"
  ON public.point_occurrences FOR ALL
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create their own occurrences"
  ON public.point_occurrences FOR INSERT
  WITH CHECK (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Users can view their own occurrences"
  ON public.point_occurrences FOR SELECT
  USING (profile_id = get_profile_id(auth.uid()));

CREATE POLICY "Users can update their own pending occurrences"
  ON public.point_occurrences FOR UPDATE
  USING (profile_id = get_profile_id(auth.uid()) AND is_approved IS NULL);

-- RLS Policies for point_cards
CREATE POLICY "Admins and managers can manage point cards"
  ON public.point_cards FOR ALL
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can view their own point cards"
  ON public.point_cards FOR SELECT
  USING (profile_id = get_profile_id(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_homologation_periods_updated_at
  BEFORE UPDATE ON public.homologation_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_point_homologations_updated_at
  BEFORE UPDATE ON public.point_homologations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_point_pendencies_updated_at
  BEFORE UPDATE ON public.point_pendencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_point_occurrences_updated_at
  BEFORE UPDATE ON public.point_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_point_cards_updated_at
  BEFORE UPDATE ON public.point_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();