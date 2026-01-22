#!/bin/bash

# Script para executar migrações do banco de dados PostgreSQL
# Uso: ./scripts/run-migrations.sh

set -e

# Configurações - ajuste conforme necessário
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-superponto}"
DB_USER="${DB_USER:-superponto_user}"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Sistema de Ponto - Migrações SQL     ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Verificar se psql está instalado
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Erro: psql não encontrado. Instale o PostgreSQL client.${NC}"
    exit 1
fi

# Diretório de migrações
MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}Erro: Diretório de migrações não encontrado: $MIGRATIONS_DIR${NC}"
    exit 1
fi

# Contar migrações
MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)

if [ "$MIGRATION_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}Nenhuma migração encontrada em $MIGRATIONS_DIR${NC}"
    exit 0
fi

echo -e "Encontradas ${GREEN}$MIGRATION_COUNT${NC} migrações"
echo -e "Banco: ${GREEN}$DB_NAME${NC} @ ${GREEN}$DB_HOST:$DB_PORT${NC}"
echo ""

# Solicitar senha se não estiver no ambiente
if [ -z "$PGPASSWORD" ]; then
    echo -n "Senha do banco de dados: "
    read -s PGPASSWORD
    export PGPASSWORD
    echo ""
fi

# Testar conexão
echo -e "${YELLOW}Testando conexão...${NC}"
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}Erro: Não foi possível conectar ao banco de dados${NC}"
    echo "Verifique as credenciais e se o PostgreSQL está rodando."
    exit 1
fi
echo -e "${GREEN}Conexão OK!${NC}"
echo ""

# Criar tabela de controle de migrações se não existir
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q <<EOF
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
EOF

# Executar migrações em ordem
EXECUTED=0
SKIPPED=0
FAILED=0

for migration_file in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
    filename=$(basename "$migration_file")
    
    # Verificar se já foi executada
    ALREADY_EXECUTED=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM _migrations WHERE filename = '$filename'")
    
    if [ "$ALREADY_EXECUTED" -gt 0 ]; then
        echo -e "${YELLOW}[SKIP]${NC} $filename (já executada)"
        ((SKIPPED++))
        continue
    fi
    
    echo -e "${GREEN}[EXEC]${NC} $filename"
    
    # Executar migração
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" > /dev/null 2>&1; then
        # Registrar migração
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q -c "INSERT INTO _migrations (filename) VALUES ('$filename')"
        ((EXECUTED++))
    else
        echo -e "${RED}[FAIL]${NC} Erro ao executar $filename"
        ((FAILED++))
        
        # Perguntar se deve continuar
        echo -n "Continuar com as próximas migrações? (s/n): "
        read CONTINUE
        if [ "$CONTINUE" != "s" ]; then
            break
        fi
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "Resumo:"
echo -e "  Executadas: ${GREEN}$EXECUTED${NC}"
echo -e "  Puladas:    ${YELLOW}$SKIPPED${NC}"
echo -e "  Falhas:     ${RED}$FAILED${NC}"
echo -e "${GREEN}========================================${NC}"

# Limpar senha
unset PGPASSWORD

exit $FAILED
