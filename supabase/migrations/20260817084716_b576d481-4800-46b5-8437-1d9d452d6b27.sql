-- ============================================================
-- 1) STORAGE POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view time clock photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Company logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;

CREATE POLICY "Employee photos viewable within own company"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Admins upload employee photos in own company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Admins update employee photos in own company"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'employee-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Admins delete employee photos in own company"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Time clock photos viewable within own company"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'time-clock-photos'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Users upload time clock photos in own company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'time-clock-photos'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Admins delete time clock photos in own company"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'time-clock-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Company logos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

CREATE POLICY "Company logo upload scoped to own company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Company logo update scoped to own company"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Company logo delete scoped to own company"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

-- ============================================================
-- 2) LOCATION DATA MINIMIZATION / RETENTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_old_location_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  affected integer;
BEGIN
  UPDATE public.time_records
  SET latitude = NULL,
      longitude = NULL,
      address = NULL,
      ip_address = NULL
  WHERE recorded_at < now() - INTERVAL '5 years'
    AND (latitude IS NOT NULL OR longitude IS NOT NULL OR address IS NOT NULL OR ip_address IS NOT NULL);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$fn$;

UPDATE public.time_records
SET latitude = round(latitude::numeric, 4)::double precision,
    longitude = round(longitude::numeric, 4)::double precision
WHERE latitude IS NOT NULL OR longitude IS NOT NULL;

SELECT public.purge_old_location_data();

-- ============================================================
-- 3) AUDIT AUTOMATIC ADMIN ROLE GRANTS
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_admin_role_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.role = 'admin'::public.app_role AND to_regclass('public.audit_logs') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
      VALUES (
        NEW.user_id,
        'ADMIN_ROLE_GRANTED',
        'user_roles',
        NEW.id,
        jsonb_build_object('granted_to', NEW.user_id, 'granted_at', now(), 'granted_by', auth.uid())
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'admin grant audit failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_audit_admin_role_grant ON public.user_roles;
CREATE TRIGGER trg_audit_admin_role_grant
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_role_grant();

-- ============================================================
-- 4) LOCK DOWN SECURITY DEFINER FUNCTION EXECUTION
-- ============================================================
DO $do$
DECLARE
  fn record;
  keep_authenticated text[] := ARRAY['has_role', 'get_profile_id', 'get_user_company_id', 'is_super_admin'];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn.sig);
    IF fn.proname = ANY (keep_authenticated) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END;
$do$;
