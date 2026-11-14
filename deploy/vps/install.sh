#!/bin/sh
# =====================================================================
# Instalador da VPS principal do PontoMax (Ubuntu 22.04+/Debian 12+)
#
#   sudo ./install.sh                 instalação interativa
#   sudo ./install.sh --domain ponto.empresa.com.br --email ti@empresa.com.br \
#        --comm-ip 203.0.113.10 -y    instalação sem perguntas
#
# O que faz:
#   1. Instala Docker (se necessário) e configura o firewall (22, 80, 443)
#   2. Gera todos os segredos e cria o arquivo .env
#   3. Compila o app web com o endereço do seu domínio
#   4. Sobe banco, autenticação, API, tempo real, arquivos, funções e HTTPS
#   5. Aplica as migrações do banco
# =====================================================================
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

DOMAIN=""; EMAIL=""; COMM_IP=""; YES=0; SKIP_DOCKER=0; SKIP_FIREWALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --comm-ip) COMM_IP="$2"; shift 2 ;;
    --skip-docker) SKIP_DOCKER=1; shift ;;
    --skip-firewall) SKIP_FIREWALL=1; shift ;;
    -y|--yes) YES=1; shift ;;
    -h|--help) sed -n 2,16p "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 1 ;;
  esac
done

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }
ask() { # ask "pergunta" "padrão"
  if [ "$YES" = 1 ]; then printf '%s' "$2"; return; fi
  printf '%s [%s]: ' "$1" "$2" > /dev/tty; read -r r < /dev/tty; printf '%s' "${r:-$2}"
}

SUDO=""; [ "$(id -u)" = 0 ] || SUDO="sudo"

# ---------- 1. Docker ----------
if [ "$SKIP_DOCKER" = 0 ] && ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 não encontrado."
command -v openssl >/dev/null 2>&1 || { $SUDO apt-get update -qq && $SUDO apt-get install -y -qq openssl; }

if [ "$SKIP_FIREWALL" = 0 ] && command -v ufw >/dev/null 2>&1; then
  log "Configurando firewall (SSH, HTTP, HTTPS)"
  $SUDO ufw allow 22/tcp >/dev/null; $SUDO ufw allow 80/tcp >/dev/null
  $SUDO ufw allow 443/tcp >/dev/null; $SUDO ufw allow 443/udp >/dev/null
  $SUDO ufw --force enable >/dev/null || true
fi

# ---------- 2. Configuração ----------
gen_hex() { openssl rand -hex "$1"; }
gen_b64() { openssl rand -base64 "$1" | tr -d '\n'; }
b64url() { openssl enc -base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() { # jwt <role> <secret>
  h=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)
  iat=$(date +%s); exp=$((iat + 10 * 365 * 24 * 3600))
  p=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$iat" "$exp" | b64url)
  s=$(printf '%s' "$h.$p" | openssl dgst -binary -sha256 -hmac "$2" | b64url)
  printf '%s.%s.%s' "$h" "$p" "$s"
}
setenv() { # setenv CHAVE valor  (substitui ou acrescenta no .env)
  if grep -q "^$1=" .env; then
    esc=$(printf '%s' "$2" | sed 's/[\/&|]/\\&/g')
    sed -i "s|^$1=.*|$1=$esc|" .env
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

if [ -f .env ]; then
  log "Usando .env existente (segredos preservados)"
else
  log "Configurando o servidor"
  [ -n "$DOMAIN" ] || DOMAIN=$(ask "Domínio do sistema (DNS já apontando para esta VPS)" "ponto.suaempresa.com.br")
  [ -n "$EMAIL" ] || EMAIL=$(ask "E-mail para o certificado HTTPS" "ti@${DOMAIN#*.}")
  [ -n "$COMM_IP" ] || COMM_IP=$(ask "IPv4 público do servidor de comunicação (vazio = liberar qualquer IP)" "")

  cp .env.example .env
  chmod 600 .env
  JWT_SECRET=$(gen_b64 40)
  setenv APP_DOMAIN "$DOMAIN"
  setenv ACME_EMAIL "$EMAIL"
  setenv COMM_SERVER_IPS "$COMM_IP"
  [ -n "$SITE_ADDRESS" ] && setenv SITE_ADDRESS "$SITE_ADDRESS"
  setenv POSTGRES_PASSWORD "$(gen_hex 24)"
  setenv JWT_SECRET "$JWT_SECRET"
  setenv ANON_KEY "$(jwt anon "$JWT_SECRET")"
  setenv SERVICE_ROLE_KEY "$(jwt service_role "$JWT_SECRET")"
  setenv SECRET_KEY_BASE "$(gen_b64 48)"
  setenv REALTIME_DB_ENC_KEY "$(gen_hex 8)"
  setenv VAULT_ENC_KEY "$(gen_hex 16)"
  setenv PG_META_CRYPTO_KEY "$(gen_b64 24)"
  setenv LOGFLARE_PUBLIC_ACCESS_TOKEN "$(gen_b64 24)"
  setenv LOGFLARE_PRIVATE_ACCESS_TOKEN "$(gen_b64 24)"
  setenv S3_PROTOCOL_ACCESS_KEY_ID "$(gen_hex 16)"
  setenv S3_PROTOCOL_ACCESS_KEY_SECRET "$(gen_hex 32)"
  setenv MINIO_ROOT_PASSWORD "$(gen_hex 16)"
  setenv DASHBOARD_PASSWORD "$(gen_hex 16)"
  echo "Arquivo .env criado. Edite-o depois para configurar SMTP, IA e WhatsApp."
fi
mkdir -p backups

# ---------- 3/4. Build e subida ----------
log "Compilando o app web e baixando as imagens (pode levar alguns minutos)"
for attempt in 1 2 3; do
  ./pontomax pull --quiet --ignore-buildable && break
  echo "Download das imagens falhou (tentativa $attempt/3); tentando de novo em 20s..."
  sleep 20
done
if [ "${SKIP_WEB_BUILD:-0}" = 1 ]; then echo "(build da interface pulado: SKIP_WEB_BUILD=1)"; else ./pontomax build web; fi

log "Iniciando banco, autenticação e arquivos (eles criam seus próprios esquemas)"
./pontomax up -d db auth rest storage
./scripts/wait-healthy.sh supabase-db 180
./scripts/wait-healthy.sh supabase-auth 180
./scripts/wait-healthy.sh supabase-storage 180

# ---------- 5. Migrações ----------
log "Aplicando migrações do banco"
./scripts/migrate.sh

log "Iniciando todos os serviços"
./pontomax up -d --no-build
./scripts/wait-healthy.sh supabase-auth 180
./scripts/wait-healthy.sh supabase-rest 180

. ./.env
cat <<MSG

=====================================================================
 PontoMax instalado.

 Sistema:            https://${APP_DOMAIN}
 API (apps/agentes): https://${APP_DOMAIN}
 Gateway do robô:    https://${APP_DOMAIN}/functions/v1/agent-gateway

 Próximos passos:
   1. Criar o primeiro Super Admin:  ./scripts/create-super-admin.sh
   2. (Opcional) Importar dados do Cloud: ./scripts/import-cloud-backup.sh <arquivo>
   3. Configurar SMTP/IA/WhatsApp no .env e aplicar: ./pontomax up -d
   4. Instalar o servidor de comunicação: veja deploy/comm/README.md

 Painel do banco (só por túnel SSH):
   ssh -L 8000:127.0.0.1:8000 usuario@esta-vps   e abra http://localhost:8000
   usuário: ${DASHBOARD_USERNAME}  senha: veja DASHBOARD_PASSWORD no .env
=====================================================================
MSG
