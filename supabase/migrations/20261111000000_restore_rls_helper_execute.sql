-- Corrige 20260915004045: as funções auxiliares de RLS foram movidas para o esquema "private"
-- e perderam EXECUTE para anon/authenticated. As políticas RLS são avaliadas com o papel de quem
-- consulta, então toda consulta autenticada passou a falhar com
-- "permission denied for function get_user_company_id".
--
-- O esquema "private" não está em PGRST_DB_SCHEMAS, portanto as funções continuam sem rota na
-- API (não podem ser chamadas via /rest/v1/rpc); apenas as políticas conseguem executá-las.
-- As tabelas do esquema private seguem sem privilégios para esses papéis.

GRANT USAGE ON SCHEMA private TO anon, authenticated;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_user_company_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_profile_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.op_company_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.op_can(text) TO anon, authenticated;
