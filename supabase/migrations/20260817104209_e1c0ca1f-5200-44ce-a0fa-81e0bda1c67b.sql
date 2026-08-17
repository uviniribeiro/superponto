REVOKE ALL ON FUNCTION public.encrypt_communication_server_secrets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_communication_server_secrets() TO service_role;