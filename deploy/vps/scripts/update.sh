#!/bin/sh
# Atualiza o PontoMax na VPS para a versão mais recente do repositório:
# baixa o código, aplica migrações novas, recompila o app web e reinicia os serviços.
#   ./scripts/update.sh            (rode dentro de deploy/vps)
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
echo "==> Backup antes da atualização"
docker exec pontomax-scheduler /scheduler/backup.sh
echo "==> Baixando o código"
git -C "$DIR/../.." pull --ff-only
echo "==> Migrações do banco"
./scripts/migrate.sh
echo "==> App web"
./pontomax build web
echo "==> Reiniciando serviços"
./pontomax up -d --remove-orphans
docker restart supabase-edge-functions >/dev/null
echo "Atualização concluída."
