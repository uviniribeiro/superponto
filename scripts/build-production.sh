#!/bin/bash

# ============================================
# Script de Build para Produção
# Sistema de Ponto Eletrônico - SuperPonto
# ============================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════╗"
echo "║  SuperPonto - Build de Produção               ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar Node.js
echo -e "${YELLOW}Verificando Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Erro: Node.js não encontrado${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Erro: Node.js 20+ é necessário (atual: $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}Node.js $(node -v) OK${NC}"

# Verificar arquivo de ambiente
echo -e "${YELLOW}Verificando configurações...${NC}"
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    echo -e "${YELLOW}Aviso: Nenhum arquivo .env encontrado${NC}"
    echo "Copiando .env.local.example para .env.local..."
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        echo -e "${YELLOW}Edite o arquivo .env.local com suas configurações${NC}"
    fi
fi

# Limpar builds anteriores
echo -e "${YELLOW}Limpando builds anteriores...${NC}"
rm -rf dist
rm -rf node_modules/.vite

# Instalar dependências
echo -e "${YELLOW}Instalando dependências...${NC}"
npm install --legacy-peer-deps

# Type check
echo -e "${YELLOW}Verificando tipos TypeScript...${NC}"
npm run typecheck 2>/dev/null || echo -e "${YELLOW}Aviso: Alguns erros de tipo (ignorando)${NC}"

# Build
echo -e "${YELLOW}Compilando aplicação...${NC}"
npm run build

# Verificar resultado
if [ ! -d "dist" ]; then
    echo -e "${RED}Erro: Build falhou - pasta dist não encontrada${NC}"
    exit 1
fi

# Estatísticas
echo ""
echo -e "${GREEN}Build concluído com sucesso!${NC}"
echo ""
echo "Estatísticas:"
echo "  Tamanho total: $(du -sh dist | cut -f1)"
echo "  Arquivos JS: $(find dist -name '*.js' | wc -l)"
echo "  Arquivos CSS: $(find dist -name '*.css' | wc -l)"
echo ""

# Build do servidor (se existir)
if [ -d "server" ]; then
    echo -e "${YELLOW}Compilando servidor backend...${NC}"
    cd server
    npm install
    npm run build
    cd ..
    echo -e "${GREEN}Servidor backend compilado!${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Próximos passos:                             ║${NC}"
echo -e "${GREEN}║                                               ║${NC}"
echo -e "${GREEN}║  1. Copie a pasta 'dist' para seu servidor    ║${NC}"
echo -e "${GREEN}║  2. Configure o Nginx/Apache                  ║${NC}"
echo -e "${GREEN}║  3. Se usar Express, copie também 'server'    ║${NC}"
echo -e "${GREEN}║                                               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
