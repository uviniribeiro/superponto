#!/bin/bash
# =============================================================================
# Script para criar pacote .rpm do Agente de Sincronização de Equipamentos
# Para sistemas Red Hat, CentOS, Fedora, Rocky Linux, AlmaLinux, etc.
# =============================================================================

set -e

# Configurações
PACKAGE_NAME="equipment-sync-agent"
VERSION="1.0.0"
RELEASE="1"
ARCHITECTURE="noarch"

echo "=============================================="
echo "  Criando pacote .rpm - Equipment Sync Agent"
echo "=============================================="
echo ""

# Verificar se rpmbuild está instalado
if ! command -v rpmbuild &> /dev/null; then
    echo "ERRO: rpmbuild não encontrado!"
    echo ""
    echo "Instale com:"
    echo "  Fedora/RHEL 8+: sudo dnf install rpm-build"
    echo "  CentOS 7:       sudo yum install rpm-build"
    echo ""
    exit 1
fi

# Diretórios de trabalho
BUILD_ROOT="$HOME/rpmbuild"

echo "[1/5] Preparando diretórios..."
mkdir -p "$BUILD_ROOT"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
mkdir -p "$BUILD_ROOT/SOURCES/$PACKAGE_NAME-$VERSION"

# Criar código fonte
echo "[2/5] Criando código fonte..."
cat > "$BUILD_ROOT/SOURCES/$PACKAGE_NAME-$VERSION/equipment-agent-linux.py" << 'PYTHON_EOF'
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agente de Sincronização de Equipamentos de Ponto - Versão Linux
Serviço systemd com dashboard web integrado
"""

import os
import sys
import json
import time
import socket
import logging
import threading
import signal
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# Configuração de logging
LOG_DIR = Path("/var/log/equipment-sync")
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / "agent.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configurações
CONFIG_FILE = Path("/opt/equipment-sync-agent/config.json")
DATA_DIR = Path("/var/lib/equipment-sync")
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_CONFIG = {
    "cloud_endpoint": "https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/equipment-sync",
    "company_code": "",
    "scan_interval": 300,
    "dashboard_port": 8765,
    "network_ranges": ["192.168.0.0/24", "192.168.1.0/24", "10.0.0.0/24"],
    "equipment_ports": [80, 443, 4370, 5005, 8080, 9922]
}

# Estado global
state = {
    "running": True,
    "last_scan": None,
    "equipment_found": [],
    "sync_history": [],
    "errors": [],
    "stats": {
        "total_scans": 0,
        "total_syncs": 0,
        "successful_syncs": 0,
        "failed_syncs": 0
    }
}

def load_config():
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                return {**DEFAULT_CONFIG, **config}
        except Exception as e:
            logger.error(f"Erro ao carregar config: {e}")
    return DEFAULT_CONFIG.copy()

def save_config(config):
    try:
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        logger.error(f"Erro ao salvar config: {e}")

def save_state():
    try:
        state_file = DATA_DIR / "state.json"
        with open(state_file, 'w') as f:
            json.dump({
                "last_scan": state["last_scan"],
                "equipment_found": state["equipment_found"][-50:],
                "sync_history": state["sync_history"][-100:],
                "errors": state["errors"][-50:],
                "stats": state["stats"]
            }, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Erro ao salvar estado: {e}")

def load_state():
    try:
        state_file = DATA_DIR / "state.json"
        if state_file.exists():
            with open(state_file, 'r') as f:
                saved = json.load(f)
                state.update(saved)
    except Exception as e:
        logger.error(f"Erro ao carregar estado: {e}")

def scan_network(config):
    import ipaddress
    found = []
    
    for network in config.get("network_ranges", []):
        try:
            net = ipaddress.ip_network(network, strict=False)
            for ip in net.hosts():
                ip_str = str(ip)
                for port in config.get("equipment_ports", []):
                    try:
                        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        sock.settimeout(0.5)
                        result = sock.connect_ex((ip_str, port))
                        sock.close()
                        
                        if result == 0:
                            equipment = {
                                "ip": ip_str,
                                "port": port,
                                "discovered_at": datetime.now().isoformat(),
                                "status": "online"
                            }
                            found.append(equipment)
                            logger.info(f"Equipamento encontrado: {ip_str}:{port}")
                    except:
                        pass
        except Exception as e:
            logger.error(f"Erro ao escanear rede {network}: {e}")
    
    return found

def sync_with_cloud(config, equipment_list):
    try:
        import requests
        
        endpoint = config.get("cloud_endpoint")
        company_code = config.get("company_code")
        
        if not company_code:
            logger.warning("Código da empresa não configurado")
            return False
        
        payload = {
            "action": "register_equipment",
            "company_code": company_code,
            "equipment": equipment_list,
            "agent_version": "1.0.0",
            "timestamp": datetime.now().isoformat()
        }
        
        response = requests.post(endpoint, json=payload, timeout=30)
        
        if response.status_code == 200:
            state["stats"]["successful_syncs"] += 1
            state["sync_history"].append({
                "timestamp": datetime.now().isoformat(),
                "status": "success",
                "equipment_count": len(equipment_list)
            })
            logger.info(f"Sincronização bem-sucedida: {len(equipment_list)} equipamentos")
            return True
        else:
            raise Exception(f"HTTP {response.status_code}")
            
    except Exception as e:
        state["stats"]["failed_syncs"] += 1
        state["errors"].append({
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "type": "sync_error"
        })
        logger.error(f"Erro na sincronização: {e}")
        return False

class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    
    def do_GET(self):
        if self.path == "/" or self.path == "/dashboard":
            self.send_dashboard()
        elif self.path == "/api/status":
            self.send_json(state)
        elif self.path == "/api/config":
            self.send_json(load_config())
        else:
            self.send_error(404)
    
    def do_POST(self):
        if self.path == "/api/config":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                new_config = json.loads(body)
                current_config = load_config()
                current_config.update(new_config)
                save_config(current_config)
                self.send_json({"status": "ok"})
            except Exception as e:
                self.send_json({"error": str(e)}, 400)
        elif self.path == "/api/scan":
            config = load_config()
            equipment = scan_network(config)
            state["equipment_found"] = equipment
            state["last_scan"] = datetime.now().isoformat()
            state["stats"]["total_scans"] += 1
            save_state()
            self.send_json({"status": "ok", "found": len(equipment)})
        else:
            self.send_error(404)
    
    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())
    
    def send_dashboard(self):
        html = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Equipment Sync Agent - Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding: 20px; background: #1e293b; border-radius: 12px; }
        .header h1 { font-size: 1.5rem; color: #38bdf8; }
        .status-badge { padding: 8px 16px; border-radius: 20px; font-size: 0.875rem; font-weight: 600; }
        .status-online { background: #065f46; color: #34d399; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; text-align: center; }
        .stat-value { font-size: 2rem; font-weight: bold; color: #38bdf8; }
        .stat-label { color: #94a3b8; margin-top: 5px; }
        .card { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .card-title { font-size: 1.1rem; margin-bottom: 15px; color: #f1f5f9; }
        .btn { padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-success { background: #10b981; color: white; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
        .table th { color: #94a3b8; font-weight: 600; }
        .input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; margin-bottom: 10px; }
        .success { color: #34d399; }
        .error { color: #f87171; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Equipment Sync Agent</h1>
            <span class="status-badge status-online" id="status">Online</span>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" id="totalScans">0</div><div class="stat-label">Escaneamentos</div></div>
            <div class="stat-card"><div class="stat-value" id="equipmentCount">0</div><div class="stat-label">Equipamentos</div></div>
            <div class="stat-card"><div class="stat-value" id="successfulSyncs">0</div><div class="stat-label">Sync OK</div></div>
            <div class="stat-card"><div class="stat-value" id="failedSyncs">0</div><div class="stat-label">Falhas</div></div>
        </div>
        <div class="card">
            <div class="card-title">Configuracao</div>
            <input type="text" class="input" id="companyCode" placeholder="Codigo da Empresa">
            <input type="text" class="input" id="cloudEndpoint" placeholder="Endpoint">
            <input type="number" class="input" id="scanInterval" placeholder="Intervalo (segundos)">
            <button class="btn btn-primary" onclick="saveConfig()">Salvar</button>
            <button class="btn btn-success" onclick="manualScan()" style="margin-left: 10px;">Escanear</button>
        </div>
        <div class="card">
            <div class="card-title">Equipamentos</div>
            <table class="table">
                <thead><tr><th>IP</th><th>Porta</th><th>Status</th><th>Descoberto</th></tr></thead>
                <tbody id="equipmentList"></tbody>
            </table>
        </div>
    </div>
    <script>
        async function loadData() {
            const [statusRes, configRes] = await Promise.all([fetch('/api/status'), fetch('/api/config')]);
            const status = await statusRes.json();
            const config = await configRes.json();
            document.getElementById('totalScans').textContent = status.stats?.total_scans || 0;
            document.getElementById('equipmentCount').textContent = status.equipment_found?.length || 0;
            document.getElementById('successfulSyncs').textContent = status.stats?.successful_syncs || 0;
            document.getElementById('failedSyncs').textContent = status.stats?.failed_syncs || 0;
            document.getElementById('companyCode').value = config.company_code || '';
            document.getElementById('cloudEndpoint').value = config.cloud_endpoint || '';
            document.getElementById('scanInterval').value = config.scan_interval || 300;
            const html = (status.equipment_found || []).map(eq => 
                `<tr><td>${eq.ip}</td><td>${eq.port}</td><td class="success">Online</td><td>${eq.discovered_at || '-'}</td></tr>`
            ).join('') || '<tr><td colspan="4">Nenhum equipamento</td></tr>';
            document.getElementById('equipmentList').innerHTML = html;
        }
        async function saveConfig() {
            await fetch('/api/config', { method: 'POST', body: JSON.stringify({
                company_code: document.getElementById('companyCode').value,
                cloud_endpoint: document.getElementById('cloudEndpoint').value,
                scan_interval: parseInt(document.getElementById('scanInterval').value) || 300
            })});
            alert('Salvo!');
        }
        async function manualScan() { await fetch('/api/scan', { method: 'POST' }); loadData(); }
        loadData();
        setInterval(loadData, 10000);
    </script>
</body>
</html>"""
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode())

def run_dashboard(port):
    server = HTTPServer(('0.0.0.0', port), DashboardHandler)
    logger.info(f"Dashboard em http://localhost:{port}")
    server.serve_forever()

def main_loop(config):
    while state["running"]:
        try:
            logger.info("Escaneando rede...")
            equipment = scan_network(config)
            state["equipment_found"] = equipment
            state["last_scan"] = datetime.now().isoformat()
            state["stats"]["total_scans"] += 1
            if equipment:
                state["stats"]["total_syncs"] += 1
                sync_with_cloud(config, equipment)
            save_state()
            time.sleep(config.get("scan_interval", 300))
        except Exception as e:
            logger.error(f"Erro: {e}")
            time.sleep(60)

def signal_handler(signum, frame):
    logger.info("Encerrando...")
    state["running"] = False
    save_state()
    sys.exit(0)

def main():
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    logger.info("Equipment Sync Agent - Iniciando")
    config = load_config()
    save_config(config)
    load_state()
    threading.Thread(target=run_dashboard, args=(config.get("dashboard_port", 8765),), daemon=True).start()
    main_loop(config)

if __name__ == "__main__":
    main()
PYTHON_EOF

# Criar config.json
cat > "$BUILD_ROOT/SOURCES/$PACKAGE_NAME-$VERSION/config.json" << EOF
{
  "cloud_endpoint": "https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/equipment-sync",
  "company_code": "",
  "scan_interval": 300,
  "dashboard_port": 8765,
  "network_ranges": ["192.168.0.0/24", "192.168.1.0/24", "10.0.0.0/24"],
  "equipment_ports": [80, 443, 4370, 5005, 8080, 9922]
}
EOF

# Criar arquivo de serviço systemd
cat > "$BUILD_ROOT/SOURCES/$PACKAGE_NAME-$VERSION/equipment-sync-agent.service" << EOF
[Unit]
Description=Equipment Sync Agent - Sincronizacao de Relogios de Ponto
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/equipment-sync-agent
ExecStart=/usr/bin/python3 /opt/equipment-sync-agent/equipment-agent-linux.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Criar tarball
echo "[3/5] Criando tarball..."
cd "$BUILD_ROOT/SOURCES"
tar czf "$PACKAGE_NAME-$VERSION.tar.gz" "$PACKAGE_NAME-$VERSION"

# Criar arquivo SPEC
echo "[4/5] Criando arquivo SPEC..."
cat > "$BUILD_ROOT/SPECS/$PACKAGE_NAME.spec" << EOF
Name:           $PACKAGE_NAME
Version:        $VERSION
Release:        $RELEASE%{?dist}
Summary:        Agente de sincronizacao automatica de relogios de ponto

License:        Proprietary
URL:            https://sistema.com
Source0:        %{name}-%{version}.tar.gz

BuildArch:      $ARCHITECTURE
Requires:       python3 >= 3.8
Requires:       python3-pip

%description
Agente local para deteccao automatica e sincronizacao de
relogios de ponto com o sistema de gerenciamento na nuvem.
Inclui dashboard web local para monitoramento.

%prep
%setup -q

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/opt/equipment-sync-agent
mkdir -p %{buildroot}/etc/systemd/system
mkdir -p %{buildroot}/var/log/equipment-sync
mkdir -p %{buildroot}/var/lib/equipment-sync

install -m 755 equipment-agent-linux.py %{buildroot}/opt/equipment-sync-agent/
install -m 644 config.json %{buildroot}/opt/equipment-sync-agent/
install -m 644 equipment-sync-agent.service %{buildroot}/etc/systemd/system/

%post
pip3 install requests psutil --quiet 2>/dev/null || true
systemctl daemon-reload
systemctl enable equipment-sync-agent.service
echo ""
echo "=============================================="
echo "  Instalacao concluida!"
echo "=============================================="
echo ""
echo "Comandos:"
echo "  Iniciar:  sudo systemctl start equipment-sync-agent"
echo "  Status:   sudo systemctl status equipment-sync-agent"
echo "  Logs:     sudo journalctl -u equipment-sync-agent -f"
echo "  Dashboard: http://localhost:8765"
echo ""

%preun
systemctl stop equipment-sync-agent.service 2>/dev/null || true
systemctl disable equipment-sync-agent.service 2>/dev/null || true

%postun
systemctl daemon-reload

%files
%dir /opt/equipment-sync-agent
/opt/equipment-sync-agent/equipment-agent-linux.py
%config(noreplace) /opt/equipment-sync-agent/config.json
/etc/systemd/system/equipment-sync-agent.service
%dir /var/log/equipment-sync
%dir /var/lib/equipment-sync

%changelog
* $(date "+%a %b %d %Y") Sistema de Ponto <suporte@sistema.com> - $VERSION-$RELEASE
- Versao inicial do pacote RPM
EOF

# Construir o pacote
echo "[5/5] Construindo pacote .rpm..."
rpmbuild -bb "$BUILD_ROOT/SPECS/$PACKAGE_NAME.spec"

# Copiar para diretório atual
cp "$BUILD_ROOT/RPMS/$ARCHITECTURE/$PACKAGE_NAME-$VERSION-$RELEASE"*".rpm" ./

echo ""
echo "=============================================="
echo "  Pacote criado com sucesso!"
echo "=============================================="
echo ""
ls -la ./*.rpm 2>/dev/null || echo "Pacote em: $BUILD_ROOT/RPMS/$ARCHITECTURE/"
echo ""
echo "Para instalar:"
echo "  Fedora/RHEL 8+: sudo dnf install ./$PACKAGE_NAME-$VERSION-$RELEASE*.rpm"
echo "  CentOS 7:       sudo yum install ./$PACKAGE_NAME-$VERSION-$RELEASE*.rpm"
echo ""
echo "Para remover:"
echo "  sudo dnf remove $PACKAGE_NAME"
echo "  ou"
echo "  sudo yum remove $PACKAGE_NAME"
echo ""

echo "Concluído!"
