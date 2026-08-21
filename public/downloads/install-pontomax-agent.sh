#!/bin/bash
# =====================================================================
#  Ponto Max - Robo de Comunicacao (Linux)
#  Instala o agente local, configura e registra o servico systemd.
#  Uso: sudo ./install-pontomax-agent.sh
# =====================================================================
set -e

if [ "$EUID" -ne 0 ]; then
  echo "Execute como root: sudo $0"
  exit 1
fi

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="/usr/local/bin/pontomax-agent"
CONF_DIR="/etc/pontomax-agent"

echo "[1/4] Verificando Python 3..."
command -v python3 >/dev/null || { echo "Instale o python3 antes de continuar."; exit 1; }

echo "[2/4] Instalando o agente em $BIN..."
mkdir -p "$CONF_DIR"
install -m 0755 "$SRC_DIR/pontomax-agent.py" "$BIN"

echo "[3/4] Assistente de configuracao (token e faixa de rede)..."
"$BIN" --configure

echo "[4/4] Registrando o servico systemd..."
install -m 0644 "$SRC_DIR/pontomax-agent.service" /etc/systemd/system/pontomax-agent.service
systemctl daemon-reload
systemctl enable pontomax-agent
systemctl restart pontomax-agent

echo
echo "Instalacao concluida."
echo "  Status : systemctl status pontomax-agent"
echo "  Logs   : journalctl -u pontomax-agent -f"
echo "  Varrer : $BIN --scan"
