
-- driver fields on existing profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_driver boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cnh text,
  ADD COLUMN IF NOT EXISTS cnh_category text,
  ADD COLUMN IF NOT EXISTS cnh_expiry date;

CREATE OR REPLACE FUNCTION public.op_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE TABLE IF NOT EXISTS public.op_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  role_label text,
  can_create_schedules boolean NOT NULL DEFAULT false,
  can_swap_drivers boolean NOT NULL DEFAULT false,
  can_edit_occurrences boolean NOT NULL DEFAULT false,
  can_view_reports boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_user_permissions TO authenticated;
GRANT ALL ON public.op_user_permissions TO service_role;
ALTER TABLE public.op_user_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.op_can(_flag text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.op_user_permissions p
        WHERE p.user_id = auth.uid()
          AND ((_flag = 'schedules' AND p.can_create_schedules)
            OR (_flag = 'swaps' AND p.can_swap_drivers)
            OR (_flag = 'occurrences' AND p.can_edit_occurrences)
            OR (_flag = 'reports' AND p.can_view_reports))
      )
$$;

CREATE POLICY "op_perm_select" ON public.op_user_permissions FOR SELECT TO authenticated
  USING (company_id = public.op_company_id());
CREATE POLICY "op_perm_admin_write" ON public.op_user_permissions FOR ALL TO authenticated
  USING (company_id = public.op_company_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (company_id = public.op_company_id() AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.op_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  origin text,
  destination text,
  km numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_lines TO authenticated;
GRANT ALL ON public.op_lines TO service_role;
ALTER TABLE public.op_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_lines_select" ON public.op_lines FOR SELECT TO authenticated USING (company_id = public.op_company_id());
CREATE POLICY "op_lines_write" ON public.op_lines FOR ALL TO authenticated
  USING (company_id = public.op_company_id() AND public.op_can('schedules'))
  WITH CHECK (company_id = public.op_company_id() AND public.op_can('schedules'));

CREATE TABLE IF NOT EXISTS public.op_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  plate text NOT NULL,
  number text,
  model text,
  capacity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'operando',
  garage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_vehicles TO authenticated;
GRANT ALL ON public.op_vehicles TO service_role;
ALTER TABLE public.op_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_vehicles_select" ON public.op_vehicles FOR SELECT TO authenticated USING (company_id = public.op_company_id());
CREATE POLICY "op_vehicles_write" ON public.op_vehicles FOR ALL TO authenticated
  USING (company_id = public.op_company_id() AND public.op_can('schedules'))
  WITH CHECK (company_id = public.op_company_id() AND public.op_can('schedules'));

CREATE TABLE IF NOT EXISTS public.op_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  line_id uuid REFERENCES public.op_lines(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text,
  start_time time NOT NULL DEFAULT '00:00',
  end_time time NOT NULL DEFAULT '00:00',
  trips integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_services TO authenticated;
GRANT ALL ON public.op_services TO service_role;
ALTER TABLE public.op_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_services_select" ON public.op_services FOR SELECT TO authenticated USING (company_id = public.op_company_id());
CREATE POLICY "op_services_write" ON public.op_services FOR ALL TO authenticated
  USING (company_id = public.op_company_id() AND public.op_can('schedules'))
  WITH CHECK (company_id = public.op_company_id() AND public.op_can('schedules'));

CREATE TABLE IF NOT EXISTS public.op_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.op_vehicles(id) ON DELETE SET NULL,
  line_id uuid REFERENCES public.op_lines(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.op_services(id) ON DELETE SET NULL,
  start_time time NOT NULL DEFAULT '00:00',
  end_time time NOT NULL DEFAULT '00:00',
  status text NOT NULL DEFAULT 'planejada',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_schedules TO authenticated;
GRANT ALL ON public.op_schedules TO service_role;
ALTER TABLE public.op_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_schedules_select" ON public.op_schedules FOR SELECT TO authenticated USING (company_id = public.op_company_id());
CREATE POLICY "op_schedules_insert" ON public.op_schedules FOR INSERT TO authenticated
  WITH CHECK (company_id = public.op_company_id() AND public.op_can('schedules'));
CREATE POLICY "op_schedules_update" ON public.op_schedules FOR UPDATE TO authenticated
  USING (company_id = public.op_company_id() AND (public.op_can('schedules') OR public.op_can('swaps')))
  WITH CHECK (company_id = public.op_company_id() AND (public.op_can('schedules') OR public.op_can('swaps')));
CREATE POLICY "op_schedules_delete" ON public.op_schedules FOR DELETE TO authenticated
  USING (company_id = public.op_company_id() AND public.op_can('schedules'));

CREATE TABLE IF NOT EXISTS public.op_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  schedule_id uuid REFERENCES public.op_schedules(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.op_vehicles(id) ON DELETE SET NULL,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'media',
  description text,
  resolved boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_occurrences TO authenticated;
GRANT ALL ON public.op_occurrences TO service_role;
ALTER TABLE public.op_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_occ_select" ON public.op_occurrences FOR SELECT TO authenticated USING (company_id = public.op_company_id());
CREATE POLICY "op_occ_write" ON public.op_occurrences FOR ALL TO authenticated
  USING (company_id = public.op_company_id() AND public.op_can('occurrences'))
  WITH CHECK (company_id = public.op_company_id() AND public.op_can('occurrences'));

CREATE TRIGGER op_lines_updated BEFORE UPDATE ON public.op_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER op_vehicles_updated BEFORE UPDATE ON public.op_vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER op_services_updated BEFORE UPDATE ON public.op_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER op_schedules_updated BEFORE UPDATE ON public.op_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER op_occurrences_updated BEFORE UPDATE ON public.op_occurrences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER op_perms_updated BEFORE UPDATE ON public.op_user_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_op_schedules_company_date ON public.op_schedules(company_id, work_date);
CREATE INDEX IF NOT EXISTS idx_op_occ_company_date ON public.op_occurrences(company_id, occurred_on);
