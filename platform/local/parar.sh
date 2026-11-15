#!/usr/bin/env bash
# Para a versão local (os dados ficam guardados). Para apagar tudo: docker compose --env-file .env down -v
cd "$(dirname "$0")" && docker compose --env-file .env down
