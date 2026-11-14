#!/bin/sh
# =====================================================================
# Instalador do servidor de comunicação do PontoMax (Ubuntu/Debian)
# Servidor dedicado, com IPv4 público próprio, que conversa com os relógios de ponto
# e envia tudo para a VPS principal por HTTPS.
#
#   sudo ./install.sh --domain ponto.suaempresa.com.br
# =====================================================================
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    -h|--help) sed -n 2,9p "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 1 ;;
  esac
done
[ "$(id -u)" = 0 ] || { echo "Execute como root (sudo)." >&2; exit 1; }
if [ -z "$DOMAIN" ]; then printf 'Domínio da VPS principal (ex.: ponto.suaempresa.com.br): '; read -r DOMAIN; fi
DOMAIN=$(printf '%s' "$DOMAIN" | sed -E 's#^https?://##; s#/.*##')
GATEWAY="https://$DOMAIN/functions/v1/agent-gateway"

echo "==> Instalando dependências"
apt-get update -qq
apt-get install -y -qq python3 curl ca-certificates ufw chrony >/dev/null

echo "==> Relógio do servidor sincronizado (essencial para as marcações)"
systemctl enable --now chrony >/dev/null 2>&1 || true
timedatectl set-timezone America/Sao_Paulo || true

echo "==> Usuário de serviço e arquivos"
id pontomax >/dev/null 2>&1 || useradd --system --home /opt/pontomax-comm --shell /usr/sbin/nologin pontomax
mkdir -p /opt/pontomax-comm /etc/pontomax-agent
REPO_AGENT="$DIR/../../public/downloads/pontomax-agent.py"
if [ -f "$REPO_AGENT" ]; then
  install -m 0755 "$REPO_AGENT" /opt/pontomax-comm/pontomax-agent.py
else
  curl -fsSL "https://$DOMAIN/downloads/pontomax-agent.py" -o /opt/pontomax-comm/pontomax-agent.py
fi
chown -R pontomax:pontomax /opt/pontomax-comm
install -m 0644 "$DIR/pontomax-agent@.service" /etc/systemd/system/pontomax-agent@.service
install -m 0755 "$DIR/pontomax-comm" /usr/local/bin/pontomax-comm
printf 'GATEWAY_URL=%s\n' "$GATEWAY" > /etc/pontomax-comm.conf
systemctl daemon-reload

echo "==> Firewall (apenas SSH de entrada; saída HTTPS para a VPS e acesso aos relógios)"
ufw allow 22/tcp >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw --force enable >/dev/null

echo "==> Testando a conexão com a VPS"
IP=$(curl -s https://api.ipify.org || echo "desconhecido")
pontomax-comm test || true

cat <<MSG

=====================================================================
 Servidor de comunicação instalado.

 IPv4 público deste servidor: $IP
   -> Na VPS principal, coloque este IP em COMM_SERVER_IPS no arquivo .env
      e aplique com:  ./pontomax up -d functions

 Para cada empresa, gere um token no sistema (Equipamentos > Robô de
 Comunicação) e cadastre a instância aqui:
   sudo pontomax-comm add prefeitura-x --token TOKEN --empresa "Prefeitura X"

 Comandos:  pontomax-comm list | status <nome> | logs <nome> | test
=====================================================================
MSG
