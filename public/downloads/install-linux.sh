#!/bin/bash
# Instalador do Agente de Equipamentos REP para Linux
# Execute com: sudo bash install-linux.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     INSTALADOR DO AGENTE DE EQUIPAMENTOS REP - LINUX         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Este script precisa ser executado como root (sudo)${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/7] Verificando dependências...${NC}"

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "Instalando Python3..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y python3 python3-pip
    elif command -v yum &> /dev/null; then
        yum install -y python3 python3-pip
    elif command -v dnf &> /dev/null; then
        dnf install -y python3 python3-pip
    elif command -v pacman &> /dev/null; then
        pacman -Sy --noconfirm python python-pip
    else
        echo -e "${RED}Gerenciador de pacotes não suportado. Instale Python3 manualmente.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Python3 instalado${NC}"

echo -e "${YELLOW}[2/7] Criando usuário do serviço...${NC}"

# Criar usuário do serviço se não existir
if ! id "equipment-agent" &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin equipment-agent
    echo -e "${GREEN}✓ Usuário equipment-agent criado${NC}"
else
    echo -e "${GREEN}✓ Usuário equipment-agent já existe${NC}"
fi

echo -e "${YELLOW}[3/7] Criando diretórios...${NC}"

mkdir -p /etc/equipment-agent
mkdir -p /var/lib/equipment-agent
mkdir -p /var/log/equipment-agent
mkdir -p /usr/local/bin

chown -R equipment-agent:equipment-agent /etc/equipment-agent
chown -R equipment-agent:equipment-agent /var/lib/equipment-agent
chown -R equipment-agent:equipment-agent /var/log/equipment-agent

chmod 750 /etc/equipment-agent
chmod 750 /var/lib/equipment-agent
chmod 750 /var/log/equipment-agent

echo -e "${GREEN}✓ Diretórios criados${NC}"

echo -e "${YELLOW}[4/7] Instalando agente...${NC}"

# Copiar o script principal
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/equipment-agent-linux.py" ]; then
    cp "$SCRIPT_DIR/equipment-agent-linux.py" /usr/local/bin/equipment-agent
else
    echo -e "${YELLOW}Baixando agente da internet...${NC}"
    curl -fsSL "https://seu-dominio.com/downloads/equipment-agent-linux.py" -o /usr/local/bin/equipment-agent
fi

chmod +x /usr/local/bin/equipment-agent

# Adicionar shebang se necessário
if ! head -1 /usr/local/bin/equipment-agent | grep -q "python"; then
    sed -i '1i#!/usr/bin/env python3' /usr/local/bin/equipment-agent
fi

echo -e "${GREEN}✓ Agente instalado em /usr/local/bin/equipment-agent${NC}"

echo -e "${YELLOW}[5/7] Configurando serviço systemd...${NC}"

# Copiar arquivo de serviço
if [ -f "$SCRIPT_DIR/equipment-agent.service" ]; then
    cp "$SCRIPT_DIR/equipment-agent.service" /etc/systemd/system/
else
    cat > /etc/systemd/system/equipment-agent.service << 'EOF'
[Unit]
Description=Agente de Sincronização de Equipamentos REP
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=equipment-agent
Group=equipment-agent
ExecStart=/usr/local/bin/equipment-agent --system --daemon
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/equipment-agent /var/log/equipment-agent /etc/equipment-agent

[Install]
WantedBy=multi-user.target
EOF
fi

systemctl daemon-reload

echo -e "${GREEN}✓ Serviço systemd configurado${NC}"

echo -e "${YELLOW}[6/7] Configurando firewall...${NC}"

# Abrir porta do dashboard
if command -v ufw &> /dev/null; then
    ufw allow 8765/tcp comment "Equipment Agent Dashboard" 2>/dev/null || true
    echo -e "${GREEN}✓ Porta 8765 liberada no UFW${NC}"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=8765/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo -e "${GREEN}✓ Porta 8765 liberada no firewalld${NC}"
else
    echo -e "${YELLOW}⚠ Firewall não detectado. Libere a porta 8765 manualmente se necessário.${NC}"
fi

echo -e "${YELLOW}[7/7] Iniciando serviço...${NC}"

systemctl enable equipment-agent
systemctl start equipment-agent

sleep 2

if systemctl is-active --quiet equipment-agent; then
    echo -e "${GREEN}✓ Serviço iniciado com sucesso!${NC}"
else
    echo -e "${RED}✗ Falha ao iniciar o serviço. Verifique com: journalctl -u equipment-agent${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗"
echo -e "║                    INSTALAÇÃO CONCLUÍDA!                       ║"
echo -e "╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Dashboard: ${YELLOW}http://localhost:8765${NC}"
echo ""
echo "Comandos úteis:"
echo -e "  ${GREEN}systemctl status equipment-agent${NC}  - Ver status"
echo -e "  ${GREEN}systemctl restart equipment-agent${NC} - Reiniciar"
echo -e "  ${GREEN}systemctl stop equipment-agent${NC}    - Parar"
echo -e "  ${GREEN}journalctl -u equipment-agent -f${NC}  - Ver logs"
echo ""
echo "Configuração: /etc/equipment-agent/config.json"
echo ""
