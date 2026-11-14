#!/usr/bin/env bash
# =====================================================================
# Gera os apps Android do PontoMax apontando para a sua VPS.
#
#   scripts/build-mobile.sh funcionario          app do celular do funcionário
#   scripts/build-mobile.sh terminal             app do tablet/terminal da empresa
#
# Opções:
#   --server https://ponto.suaempresa.com.br     endereço da VPS (padrão: APP_DOMAIN de deploy/vps/.env)
#   --key <ANON_KEY>                             chave pública (padrão: ANON_KEY de deploy/vps/.env)
#
# Assinatura para distribuição (Play Store ou instalação em massa) — defina antes de rodar:
#   PONTOMAX_KEYSTORE=/caminho/chave.jks PONTOMAX_KEYSTORE_PASS=... \
#   PONTOMAX_KEY_ALIAS=pontomax PONTOMAX_KEY_PASS=...
# Sem essas variáveis é gerado um APK de teste (debug), instalável manualmente.
#
# Requisitos: Node 22+, JDK 21 e Android SDK (ANDROID_HOME).
# =====================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP="${1:-}"; shift || true
case "$APP" in funcionario|terminal) ;; *) sed -n 3,19p "$0"; exit 1 ;; esac

SERVER=""; KEY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --server) SERVER="$2"; shift 2 ;;
    --key) KEY="$2"; shift 2 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 1 ;;
  esac
done

ENV_FILE="$ROOT/deploy/vps/.env"
if [ -z "$SERVER" ] && [ -f "$ENV_FILE" ]; then SERVER="https://$(grep '^APP_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"; fi
if [ -z "$KEY" ] && [ -f "$ENV_FILE" ]; then KEY="$(grep '^ANON_KEY=' "$ENV_FILE" | cut -d= -f2-)"; fi
[ -n "$SERVER" ] && [ -n "$KEY" ] || { echo "Informe --server e --key (ou rode na VPS, onde deploy/vps/.env existe)." >&2; exit 1; }
SERVER="${SERVER%/}"
case "$SERVER" in https://*) ;; *) echo "O endereço da VPS precisa começar com https://" >&2; exit 1 ;; esac

export PONTOMAX_APP="$APP"
NATIVE="android-$APP"

echo "==> Dependências"
npm ci --legacy-peer-deps --no-audit --no-fund

echo "==> Interface ($APP -> $SERVER)"
VITE_APP_MODE="$APP" VITE_SUPABASE_URL="$SERVER" VITE_SUPABASE_PUBLISHABLE_KEY="$KEY" \
  VITE_SUPABASE_PROJECT_ID=pontomax npx vite build

if [ ! -d "$NATIVE" ]; then
  echo "==> Criando projeto Android ($NATIVE)"
  npx cap add android
fi

echo "==> Permissões do Android"
MANIFEST="$NATIVE/app/src/main/AndroidManifest.xml"
add_perm() {
  grep -q "android.permission.$1\"" "$MANIFEST" || \
    sed -i "s#<uses-permission android:name=\"android.permission.INTERNET\" />#&\n    <uses-permission android:name=\"android.permission.$1\" />#" "$MANIFEST"
}
add_perm CAMERA
if [ "$APP" = funcionario ]; then
  add_perm ACCESS_FINE_LOCATION
  add_perm ACCESS_COARSE_LOCATION
fi
grep -q 'android.hardware.camera"' "$MANIFEST" || \
  sed -i 's#</manifest>#    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>#' "$MANIFEST"

echo "==> Sincronizando"
npx cap sync android

mkdir -p public/downloads
OUT="public/downloads/pontomax-$APP.apk"
if [ -n "${PONTOMAX_KEYSTORE:-}" ]; then
  echo "==> Compilando APK assinado"
  npx cap build android \
    --keystorepath "$PONTOMAX_KEYSTORE" --keystorepass "$PONTOMAX_KEYSTORE_PASS" \
    --keystorealias "$PONTOMAX_KEY_ALIAS" --keystorealiaspass "$PONTOMAX_KEY_PASS" \
    --androidreleasetype APK
  APK=$(ls -t "$NATIVE"/app/build/outputs/apk/release/*.apk | head -1)
else
  echo "==> Compilando APK de teste (sem assinatura de distribuição)"
  (cd "$NATIVE" && ./gradlew assembleDebug)
  APK="$NATIVE/app/build/outputs/apk/debug/app-debug.apk"
fi
cp "$APK" "$OUT"
echo "==> Pronto: $OUT"
echo "    Publicado em $SERVER/downloads/pontomax-$APP.apk após copiar para a VPS."
