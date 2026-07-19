
-- Suggestions table (user-submitted feedback for admins)
CREATE TABLE public.system_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID,
  category TEXT NOT NULL CHECK (category IN ('improvement','feature','report','bug','other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','planned','in_progress','done','rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_suggestions TO authenticated;
GRANT ALL ON public.system_suggestions TO service_role;

ALTER TABLE public.system_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own suggestions"
  ON public.system_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own suggestions"
  ON public.system_suggestions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all suggestions"
  ON public.system_suggestions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update suggestions"
  ON public.system_suggestions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete suggestions"
  ON public.system_suggestions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_system_suggestions_updated_at
  BEFORE UPDATE ON public.system_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Evidence download audit log
CREATE TABLE public.evidence_download_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_id UUID,
  attempt_ids UUID[],
  download_type TEXT NOT NULL CHECK (download_type IN ('single_pdf','zip_bundle')),
  filename TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.evidence_download_log TO authenticated;
GRANT ALL ON public.evidence_download_log TO service_role;

ALTER TABLE public.evidence_download_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own downloads"
  ON public.evidence_download_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all evidence downloads"
  ON public.evidence_download_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own downloads"
  ON public.evidence_download_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
