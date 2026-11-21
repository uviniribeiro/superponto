-- As funções e gatilhos da v2 usam nomes sem esquema (users, roles, is_protected_admin…). Elas
-- funcionavam só em conexões já apontadas para o esquema da v2 (a API). Fixa o search_path de todas
-- as funções do esquema, para valerem também no editor SQL do Supabase, em scripts e em backups.
DO $$
DECLARE
  s text := current_schema();
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = s::regnamespace
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = %I, public', f.sig, s);
  END LOOP;
END $$;
