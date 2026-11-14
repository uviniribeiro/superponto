#!/bin/sh
# =====================================================================
# Importa os dados de um backup do Supabase Cloud/Lovable Cloud para a VPS.
#
#   ./scripts/import-cloud-backup.sh backup.dump      formato custom (pg_dump -Fc)
#   ./scripts/import-cloud-backup.sh dados.sql        SQL só de dados (supabase db dump --data-only)
#
# Importa: todos os dados do esquema public e as contas de login (auth.users/identities),
# preservando e-mails, senhas (hash) e permissões. Os arquivos (fotos, logos) são copiados
# à parte com ./scripts/copy-cloud-storage.py.
#
# Deve ser feito numa instalação nova, ANTES de cadastrar empresas/usuários na VPS.
# Use --force para importar mesmo com dados já presentes (pode gerar conflitos).
# =====================================================================
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
FILE="$1"; FORCE="$2"
DB="${DB_CONTAINER:-supabase-db}"
[ -f "$FILE" ] || { sed -n 2,16p "$0"; exit 1; }

as_admin() { docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$DB" "$@"; }
. ./.env

users=$(docker exec "$DB" psql -U postgres -At -c "SELECT count(*) FROM auth.users")
companies=$(docker exec "$DB" psql -U postgres -At -c "SELECT count(*) FROM public.companies")
if [ "$FORCE" != "--force" ] && { [ "$users" != 0 ] || [ "$companies" != 0 ]; }; then
  echo "O banco já tem $users usuário(s) e $companies empresa(s). Importe numa instalação nova ou use --force." >&2
  exit 1
fi

echo "==> Backup de segurança do estado atual"
docker exec "$DB" pg_dump -U postgres -Fc -f /tmp/antes-da-importacao.dump postgres
SAFETY="backups/antes-da-importacao-$(date +%Y%m%d-%H%M).dump"
docker cp "$DB":/tmp/antes-da-importacao.dump "$SAFETY" && chmod 600 "$SAFETY"

echo "==> Limpando dados iniciais da instalação (o backup passa a ser a referência)"
docker exec -i "$DB" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DO $$
DECLARE t text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO t
  FROM pg_tables WHERE schemaname = 'public';
  IF t IS NOT NULL THEN EXECUTE 'TRUNCATE ' || t || ' RESTART IDENTITY CASCADE'; END IF;
END $$;
SQL

docker cp "$FILE" "$DB":/tmp/import.src
if head -c 5 "$FILE" | grep -q PGDMP; then
  echo "==> Formato custom detectado (pg_restore)"
  # supabase_admin é superusuário: permite desligar gatilhos e checagens durante a carga.
  as_admin pg_restore -U supabase_admin -d postgres --data-only --no-owner --disable-triggers \
    --schema=auth -t users -t identities /tmp/import.src
  as_admin pg_restore -U supabase_admin -d postgres --data-only --no-owner --disable-triggers \
    --schema=public /tmp/import.src
else
  echo "==> SQL detectado (psql)"
  { echo "SET session_replication_role = replica;"; cat "$FILE"; echo "SET session_replication_role = origin;"; } | \
    as_admin psql -X -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres
fi
docker exec "$DB" rm -f /tmp/import.src /tmp/antes-da-importacao.dump

echo "==> Conferência"
docker exec "$DB" psql -U postgres -At -c "
  SELECT 'usuários: ' || (SELECT count(*) FROM auth.users)
   || ' | perfis: ' || (SELECT count(*) FROM public.profiles)
   || ' | empresas: ' || (SELECT count(*) FROM public.companies)
   || ' | marcações: ' || (SELECT count(*) FROM public.time_records);"

echo "==> Protegendo os cadastros importados"
./scripts/lock-existing-records.sh
docker exec "$DB" psql -U postgres -q -c "NOTIFY pgrst, 'reload schema';"
echo "Importação concluída. Próximo passo: ./scripts/copy-cloud-storage.py (fotos e logos)."
