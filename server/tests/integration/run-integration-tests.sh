#!/bin/bash

# Script para executar testes de integração
# Gerencia automaticamente os containers Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.test.yml"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Iniciando testes de integração...${NC}"

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não encontrado. Instale o Docker primeiro.${NC}"
    exit 1
fi

# Verificar se docker-compose está disponível
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose não encontrado.${NC}"
    exit 1
fi

# Função para docker-compose (compatibilidade v1 e v2)
docker_compose() {
    if command -v docker-compose &> /dev/null; then
        docker-compose "$@"
    else
        docker compose "$@"
    fi
}

# Parar containers existentes
echo -e "${YELLOW}🛑 Parando containers existentes...${NC}"
docker_compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true

# Iniciar containers
echo -e "${YELLOW}🐳 Iniciando containers de teste...${NC}"
docker_compose -f "$COMPOSE_FILE" up -d

# Aguardar containers ficarem saudáveis
echo -e "${YELLOW}⏳ Aguardando containers...${NC}"
sleep 5

# Verificar se PostgreSQL está pronto
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker_compose -f "$COMPOSE_FILE" exec -T postgres-test pg_isready -U test_user -d superponto_test > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL pronto!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Aguardando PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Timeout aguardando PostgreSQL${NC}"
    docker_compose -f "$COMPOSE_FILE" logs postgres-test
    docker_compose -f "$COMPOSE_FILE" down -v
    exit 1
fi

# Executar testes
echo -e "${YELLOW}🧪 Executando testes...${NC}"
cd "$(dirname "$SCRIPT_DIR")/.."

# Definir variáveis de ambiente para testes
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5433
export TEST_DB_NAME=superponto_test
export TEST_DB_USER=test_user
export TEST_DB_PASSWORD=test_password

# Executar testes com vitest
if npx vitest run --config vitest.config.integration.ts; then
    echo -e "${GREEN}✅ Todos os testes passaram!${NC}"
    TEST_RESULT=0
else
    echo -e "${RED}❌ Alguns testes falharam${NC}"
    TEST_RESULT=1
fi

# Parar containers (opcional - comentar para debug)
echo -e "${YELLOW}🛑 Parando containers...${NC}"
docker_compose -f "$COMPOSE_FILE" down -v

exit $TEST_RESULT
