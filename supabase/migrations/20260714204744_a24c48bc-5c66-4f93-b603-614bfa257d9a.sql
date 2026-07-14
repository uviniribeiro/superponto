
REVOKE EXECUTE ON FUNCTION public.validate_qrcode_identifier(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_qrcode_identifier(TEXT) TO authenticated, service_role;
