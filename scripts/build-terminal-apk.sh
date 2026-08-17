#!/usr/bin/env bash
# Gera o APK do "Ponto Max Terminal" (app dedicado ao registro de ponto).
# Requisitos: Node 18+, JDK 17 e Android SDK configurados.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Instalando dependências"
npm install --legacy-peer-deps

echo "==> Build web"
npx vite build

echo "==> Preparando projeto Android do Terminal"
npx cap add android --config capacitor.terminal.config.ts 2>/dev/null || true
npx cap sync android --config capacitor.terminal.config.ts

echo "==> Compilando APK"
cd android
./gradlew assembleRelease

APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK" ]; then
  APK="$ROOT/android/app/build/outputs/apk/release/app-release-unsigned.apk"
fi

mkdir -p "$ROOT/public/downloads"
cp "$APK" "$ROOT/public/downloads/ponto-max-terminal.apk"

echo "==> Pronto: public/downloads/ponto-max-terminal.apk"
echo "    O download já fica disponível na tela 'App do Terminal'."
