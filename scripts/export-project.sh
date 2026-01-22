#!/bin/bash

# ============================================
# Script de Exportação do Projeto
# Cria um arquivo ZIP com todos os arquivos necessários
# ============================================

set -e

# Nome do arquivo de saída
OUTPUT_NAME="superponto-deploy-$(date +%Y%m%d_%H%M%S)"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════╗"
echo "║  SuperPonto - Exportação do Projeto           ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se zip está instalado
if ! command -v zip &> /dev/null; then
    echo -e "${YELLOW}Aviso: zip não encontrado, usando tar${NC}"
    USE_TAR=true
fi

# Criar diretório temporário
TEMP_DIR=$(mktemp -d)
echo "Diretório temporário: $TEMP_DIR"

# Copiar arquivos essenciais
echo -e "${YELLOW}Copiando arquivos do projeto...${NC}"

# Estrutura do projeto
mkdir -p "$TEMP_DIR/superponto"

# Arquivos de configuração
cp -r package.json "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r tsconfig*.json "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r vite.config.ts "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r tailwind.config.ts "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r postcss.config.js "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r components.json "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r .nvmrc "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r vercel.json "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r index.html "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r eslint.config.js "$TEMP_DIR/superponto/" 2>/dev/null || true

# Copiar diretórios principais
cp -r src "$TEMP_DIR/superponto/"
cp -r public "$TEMP_DIR/superponto/"
cp -r supabase "$TEMP_DIR/superponto/"
cp -r scripts "$TEMP_DIR/superponto/"
cp -r server "$TEMP_DIR/superponto/" 2>/dev/null || true
cp -r docs "$TEMP_DIR/superponto/" 2>/dev/null || true

# Copiar exemplos de configuração
cp -r .env.local.example "$TEMP_DIR/superponto/" 2>/dev/null || true

# Se existir dist, copiar também
if [ -d "dist" ]; then
    cp -r dist "$TEMP_DIR/superponto/"
fi

# Criar arquivo README para o deploy
cat > "$TEMP_DIR/superponto/README-DEPLOY.md" << 'EOF'
# SuperPonto - Deploy Local

## Início Rápido

1. **Configurar Banco de Dados PostgreSQL**
   ```bash
   sudo -u postgres psql -f scripts/setup-database.sql
   ./scripts/run-migrations.sh
   ```

2. **Configurar Ambiente**
   ```bash
   cp .env.local.example .env.local
   # Edite .env.local com suas configurações
   ```

3. **Instalar e Compilar**
   ```bash
   npm install --legacy-peer-deps
   npm run build
   ```

4. **Servir em Produção**
   - Copie a pasta `dist/` para seu servidor web
   - Configure Nginx/Apache (veja docs/LOCAL_DEPLOYMENT.md)

5. **Backend Alternativo (opcional)**
   ```bash
   cd server
   npm install
   npm run start
   ```

## Documentação Completa

Consulte `docs/LOCAL_DEPLOYMENT.md` para instruções detalhadas.

## Credenciais Padrão

- **Super Admin**: superadmin@superponto.local / Super@Admin2024
- **Suporte**: suporte@{company_code}.pontomax.local / Super@26
- **Admin**: admin@{company_code}.pontomax.local / Admin@26
EOF

# Criar arquivo com lista de arquivos
find "$TEMP_DIR/superponto" -type f | sed "s|$TEMP_DIR/superponto/||" | sort > "$TEMP_DIR/superponto/MANIFEST.txt"

# Criar arquivo compactado
cd "$TEMP_DIR"

if [ "$USE_TAR" = true ]; then
    tar -czvf "$OUTPUT_NAME.tar.gz" superponto
    OUTPUT_FILE="$OUTPUT_NAME.tar.gz"
else
    zip -r "$OUTPUT_NAME.zip" superponto
    OUTPUT_FILE="$OUTPUT_NAME.zip"
fi

# Mover para diretório original
cd - > /dev/null
mv "$TEMP_DIR/$OUTPUT_FILE" "./"

# Limpar
rm -rf "$TEMP_DIR"

# Estatísticas
FILE_SIZE=$(du -sh "$OUTPUT_FILE" | cut -f1)
FILE_COUNT=$(unzip -l "$OUTPUT_FILE" 2>/dev/null | tail -n1 | awk '{print $2}' || tar -tzvf "$OUTPUT_FILE" 2>/dev/null | wc -l)

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Exportação concluída!                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo "Arquivo: $OUTPUT_FILE"
echo "Tamanho: $FILE_SIZE"
echo ""
echo "Para baixar, clique com botão direito no arquivo"
echo "no explorador de arquivos e selecione 'Download'"
