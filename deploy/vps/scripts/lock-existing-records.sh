#!/bin/sh
# Protege (snapshot-lock) os e-mails/usuários e as empresas que existem agora no banco,
# conforme a regra do projeto. Rode UMA vez, depois de importar os dados do Cloud.
# Aplica drizzle/migrations/0000_snapshot_lock... e reaplica as permissões de RLS que ele revoga.
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$DIR/../.."
DB="${DB_CONTAINER:-supabase-db}"
psql_db() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$DB" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }

exists=$(psql_db -At -c "SELECT to_regclass('private.locked_profile_logins') IS NOT NULL")
if [ "$exists" = t ]; then
  echo "Cadastros já protegidos anteriormente; nada a fazer."
else
  echo "Protegendo cadastros e empresas existentes..."
  psql_db --single-transaction < "$ROOT/drizzle/migrations/0000_snapshot_lock_existing_profiles_and_companies.sql"
fi
# A migração acima revoga o esquema private; as políticas RLS precisam executar as funções dele.
psql_db --single-transaction < "$ROOT/supabase/migrations/20261111000000_restore_rls_helper_execute.sql"
psql_db -At -c "SELECT (SELECT count(*) FROM private.locked_profile_logins) || ' perfis e ' || (SELECT count(*) FROM private.locked_companies) || ' empresas protegidos.'"
