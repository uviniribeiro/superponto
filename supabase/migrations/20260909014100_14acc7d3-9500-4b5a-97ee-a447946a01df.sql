REVOKE ALL ON FUNCTION public.op_company_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.op_can(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.op_company_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.op_can(text) TO authenticated, service_role;