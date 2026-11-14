#!/bin/sh
# Chama uma Edge Function com a chave de serviço (rede interna, sem passar pela internet).
# Uso: run-function.sh <nome-da-funcao> [json]
name="$1"
body="${2:-{\}}"
echo "$(date '+%F %T') -> $name"
wget -q -O - -T 300 \
  --header="Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  --header="apikey: ${SERVICE_ROLE_KEY}" \
  --header="Content-Type: application/json" \
  --post-data="$body" \
  "${API_URL}/functions/v1/${name}" || echo "$(date '+%F %T') !! falha em $name"
echo
