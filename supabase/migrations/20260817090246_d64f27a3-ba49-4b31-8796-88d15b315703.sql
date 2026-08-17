-- Harden identity helper functions: only answer about the calling user
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
  END
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
  END
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN NULL::uuid
    ELSE (SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  END
$$;

CREATE OR REPLACE FUNCTION public.get_profile_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN NULL::uuid
    ELSE (SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  END
$$;

-- adjustment_requests
DROP POLICY IF EXISTS "Admins and managers can view all adjustment requests" ON public.adjustment_requests;
CREATE POLICY "Admins and managers can view company adjustment requests"
ON public.adjustment_requests FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

DROP POLICY IF EXISTS "Admins and managers can update adjustment requests" ON public.adjustment_requests;
CREATE POLICY "Admins and managers can update company adjustment requests"
ON public.adjustment_requests FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())))
WITH CHECK (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- class_records
DROP POLICY IF EXISTS "Admins and managers can view all class records" ON public.class_records;
CREATE POLICY "Admins and managers can view company class records"
ON public.class_records FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- employee_class_hour_assignments
DROP POLICY IF EXISTS "Admins and managers can view all class hour assignments" ON public.employee_class_hour_assignments;
CREATE POLICY "Admins and managers can view company class hour assignments"
ON public.employee_class_hour_assignments FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- employee_off_days
DROP POLICY IF EXISTS "Admins and managers can view all off days" ON public.employee_off_days;
CREATE POLICY "Admins and managers can view company off days"
ON public.employee_off_days FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- employee_scale_assignments
DROP POLICY IF EXISTS "Admins and managers can view all scale assignments" ON public.employee_scale_assignments;
CREATE POLICY "Admins and managers can view company scale assignments"
ON public.employee_scale_assignments FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- employee_schedules
DROP POLICY IF EXISTS "Admins and managers can view all employee schedules" ON public.employee_schedules;
CREATE POLICY "Admins and managers can view company employee schedules"
ON public.employee_schedules FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage employee schedules" ON public.employee_schedules;
CREATE POLICY "Admins can manage company employee schedules"
ON public.employee_schedules FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.has_role(auth.uid(),'admin') AND (company_id = public.get_user_company_id(auth.uid()) OR company_id IS NULL)))
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.has_role(auth.uid(),'admin') AND (company_id = public.get_user_company_id(auth.uid()) OR company_id IS NULL)));

-- employee_work_stations
DROP POLICY IF EXISTS "Admins and managers can view all work station assignments" ON public.employee_work_stations;
CREATE POLICY "Admins and managers can view company work station assignments"
ON public.employee_work_stations FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage work station assignments" ON public.employee_work_stations;
CREATE POLICY "Admins can manage company work station assignments"
ON public.employee_work_stations FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.has_role(auth.uid(),'admin') AND (company_id = public.get_user_company_id(auth.uid()) OR company_id IS NULL)))
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.has_role(auth.uid(),'admin') AND (company_id = public.get_user_company_id(auth.uid()) OR company_id IS NULL)));

-- overtime_alerts
DROP POLICY IF EXISTS "Admins and managers can view all alerts" ON public.overtime_alerts;
CREATE POLICY "Admins and managers can view company alerts"
ON public.overtime_alerts FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- point_occurrences (add explicit WITH CHECK on the manage-all policy)
DROP POLICY IF EXISTS "Admins and managers can manage all occurrences" ON public.point_occurrences;
CREATE POLICY "Admins and managers can manage company occurrences"
ON public.point_occurrences FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())))
WITH CHECK (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- teacher_schedule_slots
DROP POLICY IF EXISTS "Admins and managers can view all schedule slots" ON public.teacher_schedule_slots;
CREATE POLICY "Admins and managers can view company schedule slots"
ON public.teacher_schedule_slots FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- timesheet_locks
DROP POLICY IF EXISTS "Admins and managers can view all timesheet locks" ON public.timesheet_locks;
CREATE POLICY "Admins and managers can view company timesheet locks"
ON public.timesheet_locks FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- vacation_periods
DROP POLICY IF EXISTS "Admins and managers can view all vacation periods" ON public.vacation_periods;
CREATE POLICY "Admins and managers can view company vacation periods"
ON public.vacation_periods FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

-- vacation_requests
DROP POLICY IF EXISTS "Admins and managers can view all vacation requests" ON public.vacation_requests;
CREATE POLICY "Admins and managers can view company vacation requests"
ON public.vacation_requests FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));

DROP POLICY IF EXISTS "Admins and managers can update vacation requests" ON public.vacation_requests;
CREATE POLICY "Admins and managers can update company vacation requests"
ON public.vacation_requests FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())))
WITH CHECK (public.is_super_admin(auth.uid()) OR ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND company_id = public.get_user_company_id(auth.uid())));