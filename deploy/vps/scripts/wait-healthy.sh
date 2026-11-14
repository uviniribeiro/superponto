#!/bin/sh
# Aguarda um contêiner ficar "healthy". Uso: wait-healthy.sh <contêiner> [segundos]
name="$1"; limit="${2:-120}"; waited=0
while :; do
  status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || echo missing)
  [ "$status" = healthy ] && { echo "$name: pronto"; exit 0; }
  [ "$waited" -ge "$limit" ] && { echo "$name não ficou pronto em ${limit}s (status: $status)" >&2; docker logs --tail 30 "$name" >&2 || true; exit 1; }
  sleep 3; waited=$((waited + 3))
done
