#!/usr/bin/env bash
# SuperPonto — versão local (Mac e Linux). Requer o Docker Desktop aberto.
set -euo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo "Instale e abra o Docker Desktop: https://www.docker.com/products/docker-desktop/"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Abra o Docker Desktop e rode de novo."; exit 1; }

rand() { LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "${1:-32}"; }
key32() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }

if [ ! -f .env ]; then
  read -r -p "E-mail do administrador [admin@superponto.local]: " email; email=${email:-admin@superponto.local}
  while :; do
    read -r -s -p "Senha do administrador (mínimo 8 caracteres): " pass; echo
    [ ${#pass} -ge 8 ] && break; echo "Senha curta demais."
  done
  cat > .env <<ENV
POSTGRES_PASSWORD=$(rand 24)
API_DB_PASSWORD=$(rand 24)
JWT_SECRET=$(rand 48)
MFA_ENCRYPTION_KEY=$(key32)
BIOMETRIC_ENCRYPTION_KEY=$(key32)
SECRETS_ENCRYPTION_KEY=$(key32)
ADMIN_EMAIL=$email
ADMIN_PASSWORD=$pass
ENV
  chmod 600 .env
  echo "Configuração salva em local/.env"
fi
# Instalações antigas: acrescenta chaves novas sem mexer nas existentes.
grep -q '^SECRETS_ENCRYPTION_KEY=' .env || echo "SECRETS_ENCRYPTION_KEY=$(key32)" >> .env

echo "Montando e subindo o SuperPonto (a primeira vez leva alguns minutos)…"
docker compose --env-file .env up -d --build
echo
echo "Pronto!"
echo "  Sistema:          http://localhost:3001"
echo "  E-mails de teste: http://localhost:8025"
echo "  API e documentação: http://localhost:3000/docs"
echo "Para parar: ./parar.sh"
(command -v open >/dev/null && open http://localhost:3001) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3001) || true
