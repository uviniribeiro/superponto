#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agente de Sincronização de Equipamentos REP - Versão Linux
Sistema de ponto eletrônico com suporte a systemd
"""

import os
import sys
import json
import socket
import signal
import logging
import argparse
import threading
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import URLError
from concurrent.futures import ThreadPoolExecutor

# Configurações
CONFIG_DIR = Path("/etc/equipment-agent")
DATA_DIR = Path("/var/lib/equipment-agent")
LOG_DIR = Path("/var/log/equipment-agent")
PID_FILE = Path("/var/run/equipment-agent.pid")

# Para instalação do usuário (sem root)
USER_CONFIG_DIR = Path.home() / ".config" / "equipment-agent"
USER_DATA_DIR = Path.home() / ".local" / "share" / "equipment-agent"
USER_LOG_DIR = Path.home() / ".local" / "share" / "equipment-agent" / "logs"

CLOUD_ENDPOINT = "https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/equipment-sync"
DASHBOARD_PORT = 8765

EQUIPMENT_PORTS = [80, 443, 3000, 4370, 5005, 8080, 8443, 9922]
MANUFACTURER_SIGNATURES = {
    "Henry": ["henry", "orion", "primme"],
    "Control iD": ["controlid", "rep", "idface"],
    "Dimep": ["dimep", "miniprint", "smartpoint"],
    "Madis": ["madis", "md"],
    "TopData": ["topdata", "inner"],
    "Trix": ["trix"],
    "Secullum": ["secullum"]
}

class AgentConfig:
    def __init__(self, use_system_dirs=False):
        if use_system_dirs and os.geteuid() == 0:
            self.config_dir = CONFIG_DIR
            self.data_dir = DATA_DIR
            self.log_dir = LOG_DIR
        else:
            self.config_dir = USER_CONFIG_DIR
            self.data_dir = USER_DATA_DIR
            self.log_dir = USER_LOG_DIR
        
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        self.config_file = self.config_dir / "config.json"
        self.events_file = self.data_dir / "events.json"
        self.equipment_file = self.data_dir / "equipment.json"
        
        self.load_config()
    
    def load_config(self):
        if self.config_file.exists():
            with open(self.config_file) as f:
                self.config = json.load(f)
        else:
            self.config = {
                "cloud_endpoint": CLOUD_ENDPOINT,
                "company_id": "",
                "api_key": "",
                "scan_interval": 300,
                "sync_interval": 60,
                "dashboard_port": DASHBOARD_PORT,
                "network_range": "auto",
                "enabled_manufacturers": list(MANUFACTURER_SIGNATURES.keys())
            }
            self.save_config()
    
    def save_config(self):
        with open(self.config_file, "w") as f:
            json.dump(self.config, f, indent=2)
    
    def get(self, key, default=None):
        return self.config.get(key, default)
    
    def set(self, key, value):
        self.config[key] = value
        self.save_config()

class EventLogger:
    def __init__(self, config: AgentConfig):
        self.config = config
        self.events = []
        self.max_events = 1000
        self.load_events()
    
    def load_events(self):
        if self.config.events_file.exists():
            try:
                with open(self.config.events_file) as f:
                    self.events = json.load(f)
            except:
                self.events = []
    
    def save_events(self):
        with open(self.config.events_file, "w") as f:
            json.dump(self.events[-self.max_events:], f, indent=2)
    
    def log(self, event_type, message, data=None):
        event = {
            "timestamp": datetime.now().isoformat(),
            "type": event_type,
            "message": message,
            "data": data
        }
        self.events.append(event)
        self.save_events()
        
        if event_type == "error":
            logging.error(f"{message} - {data}")
        else:
            logging.info(f"[{event_type}] {message}")

class EquipmentScanner:
    def __init__(self, config: AgentConfig, event_logger: EventLogger):
        self.config = config
        self.logger = event_logger
        self.equipment = []
        self.load_equipment()
    
    def load_equipment(self):
        if self.config.equipment_file.exists():
            try:
                with open(self.config.equipment_file) as f:
                    self.equipment = json.load(f)
            except:
                self.equipment = []
    
    def save_equipment(self):
        with open(self.config.equipment_file, "w") as f:
            json.dump(self.equipment, f, indent=2)
    
    def get_local_network(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            network = ".".join(local_ip.split(".")[:-1])
            return network
        except:
            return "192.168.1"
    
    def scan_host(self, ip):
        for port in EQUIPMENT_PORTS:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex((ip, port))
                sock.close()
                
                if result == 0:
                    return self.identify_equipment(ip, port)
            except:
                continue
        return None
    
    def identify_equipment(self, ip, port):
        try:
            import urllib.request
            url = f"http://{ip}:{port}/"
            req = urllib.request.Request(url, headers={"User-Agent": "EquipmentAgent/1.0"})
            
            with urllib.request.urlopen(req, timeout=3) as response:
                content = response.read().decode("utf-8", errors="ignore").lower()
                headers = dict(response.headers)
                
                for manufacturer, signatures in MANUFACTURER_SIGNATURES.items():
                    for sig in signatures:
                        if sig in content or any(sig in str(v).lower() for v in headers.values()):
                            return {
                                "ip": ip,
                                "port": port,
                                "manufacturer": manufacturer,
                                "detected_at": datetime.now().isoformat(),
                                "online": True,
                                "headers": headers
                            }
        except:
            pass
        
        return {
            "ip": ip,
            "port": port,
            "manufacturer": "Desconhecido",
            "detected_at": datetime.now().isoformat(),
            "online": True
        }
    
    def scan_network(self):
        network_range = self.config.get("network_range", "auto")
        if network_range == "auto":
            network = self.get_local_network()
        else:
            network = network_range
        
        self.logger.log("scan", f"Iniciando varredura na rede {network}.0/24")
        
        ips = [f"{network}.{i}" for i in range(1, 255)]
        found = []
        
        with ThreadPoolExecutor(max_workers=50) as executor:
            results = executor.map(self.scan_host, ips)
            for result in results:
                if result:
                    found.append(result)
        
        for equip in found:
            existing = next((e for e in self.equipment if e["ip"] == equip["ip"]), None)
            if not existing:
                self.equipment.append(equip)
                self.logger.log("discovery", f"Novo equipamento: {equip['manufacturer']} em {equip['ip']}", equip)
        
        self.save_equipment()
        return found

class CloudSync:
    def __init__(self, config: AgentConfig, event_logger: EventLogger, scanner: EquipmentScanner):
        self.config = config
        self.logger = event_logger
        self.scanner = scanner
    
    def sync(self):
        endpoint = self.config.get("cloud_endpoint")
        company_id = self.config.get("company_id")
        api_key = self.config.get("api_key")
        
        if not company_id:
            self.logger.log("warning", "company_id não configurado")
            return False
        
        try:
            data = {
                "action": "sync",
                "company_id": company_id,
                "equipment": self.scanner.equipment,
                "agent_version": "1.0.0-linux",
                "timestamp": datetime.now().isoformat()
            }
            
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "EquipmentAgent/1.0-linux"
            }
            
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            req = Request(
                endpoint,
                data=json.dumps(data).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            
            with urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
                self.logger.log("sync", f"Sincronização concluída: {len(self.scanner.equipment)} equipamentos", result)
                return True
        
        except Exception as e:
            self.logger.log("error", f"Erro na sincronização: {str(e)}")
            return False

class DashboardHandler(BaseHTTPRequestHandler):
    config = None
    logger = None
    scanner = None
    syncer = None
    
    def log_message(self, format, *args):
        pass
    
    def do_GET(self):
        if self.path == "/" or self.path == "/dashboard":
            self.send_dashboard()
        elif self.path == "/api/status":
            self.send_json({
                "status": "running",
                "equipment_count": len(self.scanner.equipment),
                "last_events": self.logger.events[-10:]
            })
        elif self.path == "/api/equipment":
            self.send_json(self.scanner.equipment)
        elif self.path == "/api/events":
            self.send_json(self.logger.events[-100:])
        elif self.path == "/api/config":
            self.send_json(self.config.config)
        else:
            self.send_error(404)
    
    def do_POST(self):
        if self.path == "/api/scan":
            threading.Thread(target=self.scanner.scan_network).start()
            self.send_json({"status": "scan_started"})
        elif self.path == "/api/sync":
            threading.Thread(target=self.syncer.sync).start()
            self.send_json({"status": "sync_started"})
        elif self.path == "/api/config":
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            for key, value in data.items():
                self.config.set(key, value)
            self.send_json({"status": "saved"})
        else:
            self.send_error(404)
    
    def send_json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))
    
    def send_dashboard(self):
        html = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agente de Equipamentos - Linux</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding: 20px; background: #1e293b; border-radius: 12px; }
        .header h1 { font-size: 1.5rem; color: #22c55e; }
        .badge { padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; }
        .badge-success { background: #22c55e20; color: #22c55e; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .card { background: #1e293b; border-radius: 12px; padding: 20px; }
        .card-title { font-size: 1rem; color: #94a3b8; margin-bottom: 15px; }
        .stat { font-size: 2.5rem; font-weight: bold; color: #22c55e; }
        .btn { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; }
        .btn-primary { background: #22c55e; color: white; }
        .btn-primary:hover { background: #16a34a; }
        .btn-secondary { background: #334155; color: #e2e8f0; }
        .events-list { max-height: 400px; overflow-y: auto; }
        .event { padding: 12px; border-bottom: 1px solid #334155; display: flex; gap: 10px; align-items: flex-start; }
        .event:last-child { border-bottom: none; }
        .event-type { font-size: 0.7rem; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; }
        .event-type.scan { background: #3b82f620; color: #3b82f6; }
        .event-type.sync { background: #22c55e20; color: #22c55e; }
        .event-type.discovery { background: #f59e0b20; color: #f59e0b; }
        .event-type.error { background: #ef444420; color: #ef4444; }
        .event-message { flex: 1; font-size: 0.9rem; }
        .event-time { color: #64748b; font-size: 0.75rem; }
        .equipment-item { padding: 15px; background: #334155; border-radius: 8px; margin-bottom: 10px; }
        .equipment-ip { font-family: monospace; color: #22c55e; }
        .config-form { display: flex; flex-direction: column; gap: 15px; }
        .form-group label { display: block; margin-bottom: 5px; color: #94a3b8; font-size: 0.85rem; }
        .form-group input { width: 100%; padding: 10px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #e2e8f0; }
        .linux-badge { background: #f59e0b20; color: #f59e0b; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>🐧 Agente de Equipamentos <span class="linux-badge">Linux</span></h1>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <span class="badge badge-success" id="status">● Online</span>
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <div class="card-title">Equipamentos Detectados</div>
                <div class="stat" id="equipment-count">0</div>
                <button class="btn btn-primary" style="margin-top: 15px;" onclick="scanNetwork()">Escanear Rede</button>
            </div>
            <div class="card">
                <div class="card-title">Sincronizações</div>
                <div class="stat" id="sync-count">0</div>
                <button class="btn btn-primary" style="margin-top: 15px;" onclick="syncNow()">Sincronizar Agora</button>
            </div>
            <div class="card">
                <div class="card-title">Última Atividade</div>
                <div id="last-activity" style="color: #94a3b8;">Aguardando...</div>
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <div class="card-title">Equipamentos</div>
                <div id="equipment-list"></div>
            </div>
            <div class="card">
                <div class="card-title">Eventos Recentes</div>
                <div class="events-list" id="events-list"></div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-title">Configurações</div>
            <form class="config-form" id="config-form">
                <div class="form-group">
                    <label>Company ID</label>
                    <input type="text" id="company_id" placeholder="ID da empresa">
                </div>
                <div class="form-group">
                    <label>API Key</label>
                    <input type="password" id="api_key" placeholder="Chave de API">
                </div>
                <div class="form-group">
                    <label>Intervalo de Varredura (segundos)</label>
                    <input type="number" id="scan_interval" value="300">
                </div>
                <button type="submit" class="btn btn-primary">Salvar Configurações</button>
            </form>
        </div>
    </div>
    
    <script>
        async function fetchData() {
            try {
                const [status, equipment, events] = await Promise.all([
                    fetch('/api/status').then(r => r.json()),
                    fetch('/api/equipment').then(r => r.json()),
                    fetch('/api/events').then(r => r.json())
                ]);
                
                document.getElementById('equipment-count').textContent = status.equipment_count;
                document.getElementById('sync-count').textContent = events.filter(e => e.type === 'sync').length;
                
                if (events.length > 0) {
                    const last = events[events.length - 1];
                    document.getElementById('last-activity').textContent = `${last.type}: ${last.message}`;
                }
                
                const equipList = document.getElementById('equipment-list');
                equipList.innerHTML = equipment.map(e => `
                    <div class="equipment-item">
                        <div><strong>${e.manufacturer}</strong></div>
                        <div class="equipment-ip">${e.ip}:${e.port}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">${e.detected_at}</div>
                    </div>
                `).join('') || '<p style="color: #64748b;">Nenhum equipamento detectado</p>';
                
                const eventsList = document.getElementById('events-list');
                eventsList.innerHTML = events.slice(-20).reverse().map(e => `
                    <div class="event">
                        <span class="event-type ${e.type}">${e.type}</span>
                        <span class="event-message">${e.message}</span>
                        <span class="event-time">${new Date(e.timestamp).toLocaleTimeString()}</span>
                    </div>
                `).join('');
            } catch (err) {
                console.error('Erro ao buscar dados:', err);
            }
        }
        
        async function loadConfig() {
            const config = await fetch('/api/config').then(r => r.json());
            document.getElementById('company_id').value = config.company_id || '';
            document.getElementById('api_key').value = config.api_key || '';
            document.getElementById('scan_interval').value = config.scan_interval || 300;
        }
        
        async function scanNetwork() {
            await fetch('/api/scan', { method: 'POST' });
            alert('Varredura iniciada!');
        }
        
        async function syncNow() {
            await fetch('/api/sync', { method: 'POST' });
            alert('Sincronização iniciada!');
        }
        
        document.getElementById('config-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_id: document.getElementById('company_id').value,
                    api_key: document.getElementById('api_key').value,
                    scan_interval: parseInt(document.getElementById('scan_interval').value)
                })
            });
            alert('Configurações salvas!');
        });
        
        fetchData();
        loadConfig();
        setInterval(fetchData, 5000);
    </script>
</body>
</html>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

class EquipmentAgent:
    def __init__(self, use_system_dirs=False):
        self.running = False
        self.config = AgentConfig(use_system_dirs)
        self.logger = EventLogger(self.config)
        self.scanner = EquipmentScanner(self.config, self.logger)
        self.syncer = CloudSync(self.config, self.logger, self.scanner)
        
        DashboardHandler.config = self.config
        DashboardHandler.logger = self.logger
        DashboardHandler.scanner = self.scanner
        DashboardHandler.syncer = self.syncer
        
        signal.signal(signal.SIGTERM, self.handle_signal)
        signal.signal(signal.SIGINT, self.handle_signal)
    
    def handle_signal(self, signum, frame):
        self.logger.log("info", f"Recebido sinal {signum}, encerrando...")
        self.running = False
    
    def run(self):
        self.running = True
        self.logger.log("info", "Agente iniciado")
        
        dashboard_port = self.config.get("dashboard_port", DASHBOARD_PORT)
        server = HTTPServer(("0.0.0.0", dashboard_port), DashboardHandler)
        server_thread = threading.Thread(target=server.serve_forever)
        server_thread.daemon = True
        server_thread.start()
        self.logger.log("info", f"Dashboard disponível em http://localhost:{dashboard_port}")
        
        scan_interval = self.config.get("scan_interval", 300)
        sync_interval = self.config.get("sync_interval", 60)
        
        last_scan = 0
        last_sync = 0
        
        while self.running:
            now = datetime.now().timestamp()
            
            if now - last_scan >= scan_interval:
                try:
                    self.scanner.scan_network()
                    last_scan = now
                except Exception as e:
                    self.logger.log("error", f"Erro no scan: {str(e)}")
            
            if now - last_sync >= sync_interval:
                try:
                    self.syncer.sync()
                    last_sync = now
                except Exception as e:
                    self.logger.log("error", f"Erro no sync: {str(e)}")
            
            import time
            time.sleep(10)
        
        server.shutdown()
        self.logger.log("info", "Agente encerrado")

def main():
    parser = argparse.ArgumentParser(description="Agente de Sincronização de Equipamentos REP - Linux")
    parser.add_argument("--system", action="store_true", help="Usar diretórios do sistema (/etc, /var)")
    parser.add_argument("--daemon", "-d", action="store_true", help="Executar como daemon")
    args = parser.parse_args()
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler() if not args.daemon else logging.FileHandler("/var/log/equipment-agent/agent.log")
        ]
    )
    
    agent = EquipmentAgent(use_system_dirs=args.system)
    agent.run()

if __name__ == "__main__":
    main()
