CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_super_admin(uuid) SET SCHEMA private;
ALTER FUNCTION public.get_user_company_id(uuid) SET SCHEMA private;
ALTER FUNCTION public.get_profile_id(uuid) SET SCHEMA private;
ALTER FUNCTION public.op_company_id() SET SCHEMA private;
ALTER FUNCTION public.op_can(text) SET SCHEMA private;

ALTER FUNCTION private.has_role(uuid, public.app_role) SET search_path = public, private;
ALTER FUNCTION private.is_super_admin(uuid) SET search_path = public, private;
ALTER FUNCTION private.get_user_company_id(uuid) SET search_path = public, private;
ALTER FUNCTION private.get_profile_id(uuid) SET search_path = public, private;
ALTER FUNCTION private.op_company_id() SET search_path = public, private;
ALTER FUNCTION private.op_can(text) SET search_path = public, private;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_user_company_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_profile_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.op_company_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.op_can(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.get_user_company_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.get_profile_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.op_company_id() TO service_role;
GRANT EXECUTE ON FUNCTION private.op_can(text) TO service_role;