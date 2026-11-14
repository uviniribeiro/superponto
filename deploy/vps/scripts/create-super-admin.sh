#!/bin/sh
# Cria um Super Admin (acesso total ao sistema). Uso:
#   ./scripts/create-super-admin.sh                       interativo
#   ./scripts/create-super-admin.sh "Nome" email@x.com    gera uma senha forte e mostra uma vez
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
. ./.env

NAME="$1"; EMAIL="$2"; PASSWORD="${3:-}"
if [ -z "$NAME" ]; then printf 'Nome completo: '; read -r NAME; fi
if [ -z "$EMAIL" ]; then printf 'E-mail: '; read -r EMAIL; fi
EMAIL=$(printf '%s' "$EMAIL" | tr 'A-Z' 'a-z' | tr -d ' ')
[ -n "$NAME" ] && [ -n "$EMAIL" ] || { echo "Nome e e-mail são obrigatórios." >&2; exit 1; }
GENERATED=0
if [ -z "$PASSWORD" ]; then
  PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)Aa1!"
  GENERATED=1
fi

API="http://127.0.0.1:${API_GW_HTTP_PORT:-8000}"
json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
response=$(curl -sS -X POST "$API/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$(json_escape "$EMAIL")\",\"password\":\"$(json_escape "$PASSWORD")\",\"email_confirm\":true}")
USER_ID=$(printf '%s' "$response" | sed -n 's/.*"id":"\([0-9a-f-]\{36\}\)".*/\1/p' | head -1)
[ -n "$USER_ID" ] || { echo "Falha ao criar o usuário: $response" >&2; exit 1; }

docker exec -i supabase-db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -v uid="$USER_ID" -v email="$EMAIL" -v name="$NAME" <<'SQL'
INSERT INTO public.profiles (user_id, email, full_name, is_active)
VALUES (:'uid', :'email', :'name', true)
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) VALUES (:'uid', 'super_admin')
ON CONFLICT DO NOTHING;
SQL

echo ""
echo "Super Admin criado: $EMAIL"
[ "$GENERATED" = 1 ] && echo "Senha inicial (anote agora, não será exibida de novo): $PASSWORD"
echo "Acesse: https://${APP_DOMAIN}/super-admin-auth"
