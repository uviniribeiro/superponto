#!/bin/sh
# Aplica as migrações de supabase/migrations que ainda não foram aplicadas.
# Registra cada uma em supabase_migrations.schema_migrations (mesmo controle do Supabase CLI),
# então pode ser executado quantas vezes for preciso — por exemplo, após cada atualização.
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="$DIR/../../supabase/migrations"
DB="${DB_CONTAINER:-supabase-db}"

psql_db() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$DB" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }

psql_db <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
SQL

applied=$(psql_db -At -c "SELECT version FROM supabase_migrations.schema_migrations")
total=0; new=0
for file in $(ls "$MIGRATIONS"/*.sql | sort); do
  total=$((total + 1))
  base=$(basename "$file" .sql)
  version=${base%%_*}
  echo "$applied" | grep -qx "$version" && continue
  echo "  aplicando $base"
  {
    echo "BEGIN;"
    cat "$file"
    echo ""
    echo "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '${base#*_}');"
    echo "COMMIT;"
  } | psql_db || { echo "Falha na migração $base" >&2; exit 1; }
  new=$((new + 1))
done
echo "Migrações: $new aplicadas agora, $total no total."

# Recarrega o cache de esquema da API
psql_db -c "NOTIFY pgrst, 'reload schema';" >/dev/null
