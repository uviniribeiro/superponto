#!/bin/sh
# Prepara o banco da v2 (Supabase ou VPS): migrações, papel de login da API e seed.
#   MIGRATION_DATABASE_URL=... API_DB_PASSWORD=... [SEED_ADMIN_EMAIL=...] ./scripts/db-setup.sh
set -e

# Cliente PostgreSQL 17: usa o local se for 17+, senão um contêiner postgres:17-alpine (precisa de Docker).
pg_major=$(pg_dump --version 2>/dev/null | sed -E 's/.* ([0-9]+)\..*/\1/')
if [ -n "$pg_major" ] && [ "$pg_major" -ge 17 ] 2>/dev/null; then
  PGRUN=""
else
  command -v docker >/dev/null 2>&1 || { echo "Instale o cliente PostgreSQL 17 ou o Docker." >&2; exit 1; }
  PGRUN="docker run --rm -i --network host -u $(id -u):$(id -g) -v $PWD:/w -w /w postgres:17-alpine"
fi
psql() { $PGRUN psql "$@"; }
pg_dump() { $PGRUN pg_dump "$@"; }
pg_restore() { $PGRUN pg_restore "$@"; }
: "${MIGRATION_DATABASE_URL:?defina MIGRATION_DATABASE_URL (papel dono, com ?schema=superponto)}"
: "${API_DB_PASSWORD:?defina API_DB_PASSWORD (senha do papel superponto_api)}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA=$(node -e "console.log(new URL(process.argv[1]).searchParams.get('schema') || 'superponto')" "$MIGRATION_DATABASE_URL")
PLAIN_URL=$(node -e "const u=new URL(process.argv[1]);u.searchParams.delete('schema');console.log(u.toString())" "$MIGRATION_DATABASE_URL")

echo "==> Migrações (esquema $SCHEMA)"
(cd "$DIR/packages/database" && DATABASE_URL="$MIGRATION_DATABASE_URL" npx prisma migrate deploy)

echo "==> Papel de login da API (sujeito à RLS)"
psql "$PLAIN_URL" -v ON_ERROR_STOP=1 -q -v pw="$API_DB_PASSWORD" -v schema="$SCHEMA" <<'SQL'
SELECT format('CREATE ROLE superponto_api LOGIN PASSWORD %L IN ROLE superponto_app', :'pw')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superponto_api') \gexec
SELECT format('ALTER ROLE superponto_api WITH LOGIN PASSWORD %L', :'pw') \gexec
SELECT format('ALTER ROLE superponto_api SET search_path = %I, public', :'schema') \gexec
SQL

echo "==> Seed (permissões e perfis${SEED_ADMIN_EMAIL:+, SuperAdmin $SEED_ADMIN_EMAIL})"
DATABASE_URL="$MIGRATION_DATABASE_URL" node "$DIR/apps/api/dist/seed.js"
echo "Pronto. A API conecta como superponto_api."
