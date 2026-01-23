#!/bin/bash
# ============================================
# SuperPonto - Instalador Linux/macOS
# Criação automática de banco de dados local
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║   SuperPonto - Instalador Linux/macOS                         ║"
    echo "║   Sistema de Ponto Eletrônico                                 ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Verificar dependências
check_dependencies() {
    local missing=()
    
    if ! command -v python3 &> /dev/null; then
        missing+=("python3")
    fi
    
    if ! command -v node &> /dev/null; then
        missing+=("nodejs")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing+=("npm")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        print_warning "Dependências faltando: ${missing[*]}"
        install_dependencies "${missing[@]}"
    fi
}

install_dependencies() {
    local deps=("$@")
    
    # Detectar sistema operacional e gerenciador de pacotes
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if ! command -v brew &> /dev/null; then
            print_info "Instalando Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        for dep in "${deps[@]}"; do
            brew install "$dep"
        done
        
    elif command -v apt &> /dev/null; then
        # Debian/Ubuntu
        sudo apt update
        for dep in "${deps[@]}"; do
            sudo apt install -y "$dep"
        done
        
    elif command -v dnf &> /dev/null; then
        # Fedora/RHEL
        for dep in "${deps[@]}"; do
            sudo dnf install -y "$dep"
        done
        
    elif command -v pacman &> /dev/null; then
        # Arch Linux
        for dep in "${deps[@]}"; do
            sudo pacman -S --noconfirm "$dep"
        done
        
    else
        print_error "Gerenciador de pacotes não suportado"
        exit 1
    fi
}

# Menu de seleção
select_database() {
    echo ""
    echo "Selecione o banco de dados:"
    echo "[1] PostgreSQL (Recomendado)"
    echo "[2] Microsoft SQL Server"
    echo "[3] Oracle Database"
    echo ""
    read -p "Opção: " DB_CHOICE
    
    case $DB_CHOICE in
        1)
            DB_TYPE="postgresql"
            DEFAULT_PORT=5432
            ;;
        2)
            DB_TYPE="sqlserver"
            DEFAULT_PORT=1433
            ;;
        3)
            DB_TYPE="oracle"
            DEFAULT_PORT=1521
            ;;
        *)
            print_error "Opção inválida"
            exit 1
            ;;
    esac
}

# Configurações do banco
get_config() {
    echo ""
    echo "Configurações do banco de dados:"
    
    read -p "Host [localhost]: " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    
    read -p "Porta [$DEFAULT_PORT]: " DB_PORT
    DB_PORT=${DB_PORT:-$DEFAULT_PORT}
    
    read -p "Usuário [superponto]: " DB_USER
    DB_USER=${DB_USER:-superponto}
    
    read -p "Senha [SuperPonto@2024]: " DB_PASS
    DB_PASS=${DB_PASS:-SuperPonto@2024}
    
    read -p "Banco [superponto]: " DB_NAME
    DB_NAME=${DB_NAME:-superponto}
}

# Main
main() {
    print_header
    
    check_dependencies
    select_database
    get_config
    
    echo ""
    print_info "Executando instalação..."
    
    python3 scripts/install-database.py \
        --db "$DB_TYPE" \
        --host "$DB_HOST" \
        --port "$DB_PORT" \
        --user "$DB_USER" \
        --password "$DB_PASS" \
        --database "$DB_NAME"
    
    if [ $? -ne 0 ]; then
        print_error "Falha na instalação do banco de dados"
        exit 1
    fi
    
    echo ""
    read -p "Instalar dependências do projeto? [S/n]: " INSTALL_DEPS
    INSTALL_DEPS=${INSTALL_DEPS:-S}
    
    if [[ "$INSTALL_DEPS" =~ ^[Ss]$ ]]; then
        echo ""
        print_info "Instalando dependências do frontend..."
        npm install --legacy-peer-deps
        
        echo ""
        print_info "Instalando dependências do backend..."
        cd server && npm install && cd ..
    fi
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  INSTALAÇÃO CONCLUÍDA!                        ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Para iniciar o sistema:"
    echo ""
    echo "1. Backend: cd server && npm run dev"
    echo "2. Frontend: npm run dev"
    echo ""
    echo "Acesse: http://localhost:5173"
    echo ""
}

main "$@"
