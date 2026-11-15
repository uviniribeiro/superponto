#!/bin/sh
# Move o banco da v2 entre servidores (ex.: Supabase -> VPS) sem perder nada:
#   SOURCE_URL=postgresql://postgres...@supabase/postgres DEST_URL=postgresql://postgres...@vps/superponto ./scripts/db-move.sh
# Passos: congele a escrita (pare a API), rode o script, rode db-setup.sh no destino (papel da API),
# troque DATABASE_URL e suba a API apontando para o novo banco.
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
: "${SOURCE_URL:?defina SOURCE_URL (papel dono do banco de origem, sem ?schema)}"
: "${DEST_URL:?defina DEST_URL (papel dono do banco de destino, sem ?schema)}"
SCHEMA="${SCHEMA:-superponto}"
STAMP=$(date +%Y%m%d-%H%M%S)
DUMP="superponto-$STAMP.dump"
umask 077

echo "==> Exportando o esquema $SCHEMA da origem"
pg_dump "$SOURCE_URL" --schema="$SCHEMA" -Fc --no-owner --no-privileges -f "$DUMP"

echo "==> Preparando o destino (papel superponto_app)"
psql "$DEST_URL" -v ON_ERROR_STOP=1 -q -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='superponto_app') THEN CREATE ROLE superponto_app NOLOGIN; END IF; END \$\$"

echo "==> Restaurando no destino"
pg_restore --dbname="$DEST_URL" --no-owner --no-privileges --exit-on-error "$DUMP"

echo "==> Reaplicando permissões do papel da API"
psql "$DEST_URL" -v ON_ERROR_STOP=1 -q -v s="$SCHEMA" <<'SQL'
SELECT format('GRANT USAGE ON SCHEMA %I TO superponto_app', :'s') \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO superponto_app', :'s') \gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO superponto_app', :'s') \gexec
SELECT format('REVOKE ALL ON %I._prisma_migrations FROM superponto_app', :'s') \gexec
SQL

echo "==> Conferência de contagens"
for t in tenants companies people employment_relationships time_records users audit_logs; do
  a=$(psql "$SOURCE_URL" -At -c "SELECT count(*) FROM $SCHEMA.$t")
  b=$(psql "$DEST_URL" -At -c "SELECT count(*) FROM $SCHEMA.$t")
  printf '  %-26s origem %-8s destino %s\n' "$t" "$a" "$b"
  [ "$a" = "$b" ] || { echo "Divergência em $t" >&2; exit 1; }
done
echo "Banco movido. Cópia guardada em $DUMP."
