#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║     SERVIÇO WINDOWS - AGENTE DE SINCRONIZAÇÃO DE RELÓGIOS DE PONTO          ║
║                                                                              ║
║  Este script instala e executa como serviço Windows, iniciando              ║
║  automaticamente com o sistema operacional.                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

Requisitos:
    pip install pywin32 requests flask

Comandos:
    python equipment-service.py install    - Instala o serviço
    python equipment-service.py start      - Inicia o serviço
    python equipment-service.py stop       - Para o serviço
    python equipment-service.py remove     - Remove o serviço
    python equipment-service.py restart    - Reinicia o serviço
    python equipment-service.py debug      - Executa em modo debug (console)
"""

import sys
import os
import time
import json
import socket
import threading
import logging
from datetime import datetime
from pathlib import Path

# Configuração de logging
LOG_DIR = Path(os.environ.get('PROGRAMDATA', 'C:\\ProgramData')) / 'EquipmentSyncAgent'
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'service.log'
SYNC_HISTORY_FILE = LOG_DIR / 'sync_history.json'
CONFIG_FILE = LOG_DIR / 'config.json'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuração padrão
DEFAULT_CONFIG = {
    'cloud_endpoint': os.environ.get('PONTOMAX_EQUIPMENT_SYNC_URL', '').strip(),
    'company_code': '',
    'scan_interval': 300,
    'sync_interval': 60,
    'dashboard_port': 8765,
    'auto_discover': True,
    'network_range': '192.168.1.0/24'
}

class SyncHistory:
    """Gerencia o histórico de sincronizações"""
    
    def __init__(self, max_entries=1000):
        self.max_entries = max_entries
        self.history = []
        self.load()
    
    def load(self):
        try:
            if SYNC_HISTORY_FILE.exists():
                with open(SYNC_HISTORY_FILE, 'r', encoding='utf-8') as f:
                    self.history = json.load(f)
        except Exception as e:
            logger.error(f"Erro ao carregar histórico: {e}")
            self.history = []
    
    def save(self):
        try:
            with open(SYNC_HISTORY_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.history[-self.max_entries:], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar histórico: {e}")
    
    def add(self, event_type, equipment_id=None, equipment_name=None, 
            status='success', message='', records_synced=0, details=None):
        entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type,
            'equipment_id': equipment_id,
            'equipment_name': equipment_name,
            'status': status,
            'message': message,
            'records_synced': records_synced,
            'details': details or {}
        }
        self.history.append(entry)
        self.save()
        return entry
    
    def get_recent(self, count=100, event_type=None, status=None):
        filtered = self.history
        if event_type:
            filtered = [h for h in filtered if h.get('event_type') == event_type]
        if status:
            filtered = [h for h in filtered if h.get('status') == status]
        return filtered[-count:]
    
    def get_stats(self):
        now = datetime.now()
        today = now.date().isoformat()
        
        today_entries = [h for h in self.history if h['timestamp'].startswith(today)]
        
        return {
            'total_syncs': len([h for h in self.history if h['event_type'] == 'sync']),
            'total_errors': len([h for h in self.history if h['status'] == 'error']),
            'today_syncs': len([h for h in today_entries if h['event_type'] == 'sync']),
            'today_errors': len([h for h in today_entries if h['status'] == 'error']),
            'today_records': sum(h.get('records_synced', 0) for h in today_entries),
            'last_sync': next((h['timestamp'] for h in reversed(self.history) 
                              if h['event_type'] == 'sync'), None),
            'last_error': next((h for h in reversed(self.history) 
                               if h['status'] == 'error'), None)
        }


class Config:
    """Gerencia configurações do serviço"""
    
    def __init__(self):
        self.config = DEFAULT_CONFIG.copy()
        self.load()
    
    def load(self):
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    saved = json.load(f)
                    self.config.update(saved)
        except Exception as e:
            logger.error(f"Erro ao carregar configuração: {e}")
    
    def save(self):
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar configuração: {e}")
    
    def get(self, key, default=None):
        return self.config.get(key, default)
    
    def set(self, key, value):
        self.config[key] = value
        self.save()
    
    def update(self, data):
        self.config.update(data)
        self.save()


class EquipmentScanner:
    """Scanner de equipamentos na rede"""
    
    EQUIPMENT_PORTS = [80, 443, 4370, 8080, 9922]
    
    def __init__(self, config, history):
        self.config = config
        self.history = history
        self.discovered_equipment = {}
    
    def scan_host(self, ip, timeout=1):
        """Verifica se um host tem portas de relógio abertas"""
        for port in self.EQUIPMENT_PORTS:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(timeout)
                result = sock.connect_ex((ip, port))
                sock.close()
                if result == 0:
                    return {'ip': ip, 'port': port, 'status': 'online'}
            except:
                pass
        return None
    
    def scan_network(self, network_range=None):
        """Escaneia a rede em busca de equipamentos"""
        import ipaddress
        
        network_range = network_range or self.config.get('network_range', '192.168.1.0/24')
        found = []
        
        try:
            network = ipaddress.ip_network(network_range, strict=False)
            logger.info(f"Escaneando rede {network_range}...")
            
            for ip in network.hosts():
                ip_str = str(ip)
                result = self.scan_host(ip_str)
                if result:
                    found.append(result)
                    logger.info(f"Equipamento encontrado: {ip_str}:{result['port']}")
                    self.history.add(
                        'discovery',
                        equipment_name=ip_str,
                        status='success',
                        message=f"Equipamento detectado na porta {result['port']}"
                    )
            
            logger.info(f"Scan completo. {len(found)} equipamentos encontrados.")
            
        except Exception as e:
            logger.error(f"Erro no scan: {e}")
            self.history.add('discovery', status='error', message=str(e))
        
        return found


class EquipmentSyncer:
    """Sincronizador de equipamentos"""
    
    def __init__(self, config, history):
        self.config = config
        self.history = history
    
    def sync_equipment(self, equipment):
        """Sincroniza um equipamento com a nuvem"""
        import requests
        
        try:
            endpoint = self.config.get('cloud_endpoint')
            company_code = self.config.get('company_code')
            
            if not company_code:
                logger.warning("Código da empresa não configurado")
                return False
            
            # Simula coleta de registros do equipamento
            # Na implementação real, conectaria ao equipamento via SDK
            payload = {
                'action': 'sync',
                'company_code': company_code,
                'equipment_ip': equipment.get('ip'),
                'equipment_port': equipment.get('port'),
                'timestamp': datetime.now().isoformat()
            }
            
            response = requests.post(
                endpoint,
                json=payload,
                timeout=30,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                records = data.get('records_synced', 0)
                
                self.history.add(
                    'sync',
                    equipment_name=equipment.get('ip'),
                    status='success',
                    message='Sincronização concluída',
                    records_synced=records,
                    details={'response': data}
                )
                logger.info(f"Sync OK: {equipment.get('ip')} - {records} registros")
                return True
            else:
                self.history.add(
                    'sync',
                    equipment_name=equipment.get('ip'),
                    status='error',
                    message=f"HTTP {response.status_code}",
                    details={'response': response.text}
                )
                logger.error(f"Sync falhou: {equipment.get('ip')} - HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.history.add(
                'sync',
                equipment_name=equipment.get('ip'),
                status='error',
                message=str(e)
            )
            logger.error(f"Erro sync {equipment.get('ip')}: {e}")
            return False


class DashboardServer:
    """Servidor web do dashboard de monitoramento"""
    
    HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Agente de Sincronização</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            color: #e0e0e0;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        header {
            background: rgba(255,255,255,0.05);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        h1 { color: #4ade80; font-size: 24px; }
        .status-badge {
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
        }
        .status-running { background: #22c55e; color: white; }
        .status-stopped { background: #ef4444; color: white; }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: rgba(255,255,255,0.05);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .stat-value { font-size: 32px; font-weight: 700; color: #4ade80; }
        .stat-label { font-size: 14px; color: #888; margin-top: 4px; }
        
        .section {
            background: rgba(255,255,255,0.05);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
        }
        .section h2 {
            font-size: 18px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .history-table {
            width: 100%;
            border-collapse: collapse;
        }
        .history-table th, .history-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .history-table th { color: #888; font-weight: 500; }
        .history-table tr:hover { background: rgba(255,255,255,0.02); }
        
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-success { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .badge-error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .badge-sync { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .badge-discovery { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
        
        .config-form { display: grid; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 14px; color: #888; }
        .form-group input, .form-group select {
            padding: 10px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(0,0,0,0.2);
            color: white;
            font-size: 14px;
        }
        .form-group input:focus { outline: none; border-color: #4ade80; }
        
        .btn {
            padding: 10px 20px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
        }
        .btn-primary { background: #4ade80; color: #1a1a2e; }
        .btn-primary:hover { background: #22c55e; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-secondary { background: rgba(255,255,255,0.1); color: white; }
        
        .actions { display: flex; gap: 12px; margin-top: 16px; }
        
        .refresh-info { font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>🕐 Agente de Sincronização</h1>
                <p class="refresh-info">Atualização automática a cada 10 segundos</p>
            </div>
            <span class="status-badge status-running" id="status">● Em execução</span>
        </header>
        
        <div class="stats-grid" id="stats">
            <div class="stat-card">
                <div class="stat-value" id="total-syncs">-</div>
                <div class="stat-label">Total de Sincronizações</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="today-syncs">-</div>
                <div class="stat-label">Sincronizações Hoje</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="today-records">-</div>
                <div class="stat-label">Registros Hoje</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-errors">-</div>
                <div class="stat-label">Total de Erros</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📋 Histórico de Eventos</h2>
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Data/Hora</th>
                        <th>Tipo</th>
                        <th>Equipamento</th>
                        <th>Status</th>
                        <th>Mensagem</th>
                        <th>Registros</th>
                    </tr>
                </thead>
                <tbody id="history-body">
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>⚙️ Configurações</h2>
            <form class="config-form" id="config-form">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                    <div class="form-group">
                        <label>Código da Empresa</label>
                        <input type="text" name="company_code" id="company_code" placeholder="ABC123">
                    </div>
                    <div class="form-group">
                        <label>Intervalo de Scan (segundos)</label>
                        <input type="number" name="scan_interval" id="scan_interval" value="300">
                    </div>
                    <div class="form-group">
                        <label>Intervalo de Sync (segundos)</label>
                        <input type="number" name="sync_interval" id="sync_interval" value="60">
                    </div>
                    <div class="form-group">
                        <label>Range de Rede</label>
                        <input type="text" name="network_range" id="network_range" value="192.168.1.0/24">
                    </div>
                </div>
                <div class="actions">
                    <button type="submit" class="btn btn-primary">Salvar Configurações</button>
                    <button type="button" class="btn btn-secondary" onclick="scanNetwork()">Escanear Rede</button>
                    <button type="button" class="btn btn-secondary" onclick="syncNow()">Sincronizar Agora</button>
                </div>
            </form>
        </div>
    </div>
    
    <script>
        async function loadStats() {
            try {
                const res = await fetch('/api/stats');
                const stats = await res.json();
                document.getElementById('total-syncs').textContent = stats.total_syncs || 0;
                document.getElementById('today-syncs').textContent = stats.today_syncs || 0;
                document.getElementById('today-records').textContent = stats.today_records || 0;
                document.getElementById('total-errors').textContent = stats.total_errors || 0;
            } catch (e) {
                console.error('Erro ao carregar stats:', e);
            }
        }
        
        async function loadHistory() {
            try {
                const res = await fetch('/api/history');
                const history = await res.json();
                const tbody = document.getElementById('history-body');
                tbody.innerHTML = history.reverse().slice(0, 50).map(h => `
                    <tr>
                        <td>${new Date(h.timestamp).toLocaleString('pt-BR')}</td>
                        <td><span class="badge badge-${h.event_type}">${h.event_type}</span></td>
                        <td>${h.equipment_name || '-'}</td>
                        <td><span class="badge badge-${h.status}">${h.status}</span></td>
                        <td>${h.message || '-'}</td>
                        <td>${h.records_synced || '-'}</td>
                    </tr>
                `).join('');
            } catch (e) {
                console.error('Erro ao carregar histórico:', e);
            }
        }
        
        async function loadConfig() {
            try {
                const res = await fetch('/api/config');
                const config = await res.json();
                document.getElementById('company_code').value = config.company_code || '';
                document.getElementById('scan_interval').value = config.scan_interval || 300;
                document.getElementById('sync_interval').value = config.sync_interval || 60;
                document.getElementById('network_range').value = config.network_range || '192.168.1.0/24';
            } catch (e) {
                console.error('Erro ao carregar config:', e);
            }
        }
        
        document.getElementById('config-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const config = Object.fromEntries(formData);
            config.scan_interval = parseInt(config.scan_interval);
            config.sync_interval = parseInt(config.sync_interval);
            
            try {
                await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                alert('Configurações salvas!');
            } catch (e) {
                alert('Erro ao salvar: ' + e.message);
            }
        });
        
        async function scanNetwork() {
            try {
                const res = await fetch('/api/scan', { method: 'POST' });
                const result = await res.json();
                alert(`Scan concluído! ${result.found || 0} equipamentos encontrados.`);
                loadHistory();
            } catch (e) {
                alert('Erro no scan: ' + e.message);
            }
        }
        
        async function syncNow() {
            try {
                const res = await fetch('/api/sync', { method: 'POST' });
                const result = await res.json();
                alert('Sincronização iniciada!');
                loadHistory();
            } catch (e) {
                alert('Erro na sincronização: ' + e.message);
            }
        }
        
        // Carregamento inicial
        loadStats();
        loadHistory();
        loadConfig();
        
        // Atualização automática
        setInterval(() => {
            loadStats();
            loadHistory();
        }, 10000);
    </script>
</body>
</html>
'''
    
    def __init__(self, config, history, scanner, syncer):
        self.config = config
        self.history = history
        self.scanner = scanner
        self.syncer = syncer
        self.app = None
        self.server_thread = None
    
    def create_app(self):
        from flask import Flask, jsonify, request, Response
        
        app = Flask(__name__)
        
        @app.route('/')
        def index():
            return Response(self.HTML_TEMPLATE, mimetype='text/html')
        
        @app.route('/api/stats')
        def get_stats():
            return jsonify(self.history.get_stats())
        
        @app.route('/api/history')
        def get_history():
            return jsonify(self.history.get_recent(100))
        
        @app.route('/api/config', methods=['GET', 'POST'])
        def handle_config():
            if request.method == 'POST':
                data = request.get_json()
                self.config.update(data)
                return jsonify({'success': True})
            return jsonify(self.config.config)
        
        @app.route('/api/scan', methods=['POST'])
        def do_scan():
            found = self.scanner.scan_network()
            return jsonify({'found': len(found), 'equipment': found})
        
        @app.route('/api/sync', methods=['POST'])
        def do_sync():
            for eq in self.scanner.discovered_equipment.values():
                self.syncer.sync_equipment(eq)
            return jsonify({'success': True})
        
        return app
    
    def start(self):
        self.app = self.create_app()
        port = self.config.get('dashboard_port', 8765)
        
        def run():
            self.app.run(host='0.0.0.0', port=port, threaded=True, use_reloader=False)
        
        self.server_thread = threading.Thread(target=run, daemon=True)
        self.server_thread.start()
        logger.info(f"Dashboard iniciado em http://localhost:{port}")


class EquipmentSyncService:
    """Classe principal do serviço"""
    
    def __init__(self):
        self.running = False
        self.config = Config()
        self.history = SyncHistory()
        self.scanner = EquipmentScanner(self.config, self.history)
        self.syncer = EquipmentSyncer(self.config, self.history)
        self.dashboard = DashboardServer(self.config, self.history, self.scanner, self.syncer)
    
    def start(self):
        self.running = True
        self.history.add('service', status='success', message='Serviço iniciado')
        logger.info("Serviço iniciado")
        
        # Inicia o dashboard
        self.dashboard.start()
        
        # Loop principal
        last_scan = 0
        last_sync = 0
        
        while self.running:
            now = time.time()
            
            # Scan periódico
            if self.config.get('auto_discover') and now - last_scan > self.config.get('scan_interval', 300):
                self.scanner.scan_network()
                last_scan = now
            
            # Sync periódico
            if now - last_sync > self.config.get('sync_interval', 60):
                for eq in self.scanner.discovered_equipment.values():
                    self.syncer.sync_equipment(eq)
                last_sync = now
            
            time.sleep(1)
    
    def stop(self):
        self.running = False
        self.history.add('service', status='success', message='Serviço parado')
        logger.info("Serviço parado")


# Windows Service usando pywin32
try:
    import win32serviceutil
    import win32service
    import win32event
    import servicemanager
    
    class WindowsService(win32serviceutil.ServiceFramework):
        _svc_name_ = 'EquipmentSyncAgent'
        _svc_display_name_ = 'Agente de Sincronização de Relógios de Ponto'
        _svc_description_ = 'Serviço de sincronização automática de relógios de ponto com a nuvem'
        
        def __init__(self, args):
            win32serviceutil.ServiceFramework.__init__(self, args)
            self.stop_event = win32event.CreateEvent(None, 0, 0, None)
            self.service = EquipmentSyncService()
        
        def SvcStop(self):
            self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
            self.service.stop()
            win32event.SetEvent(self.stop_event)
        
        def SvcDoRun(self):
            servicemanager.LogMsg(
                servicemanager.EVENTLOG_INFORMATION_TYPE,
                servicemanager.PYS_SERVICE_STARTED,
                (self._svc_name_, '')
            )
            self.service.start()
    
    if __name__ == '__main__':
        if len(sys.argv) == 1:
            servicemanager.Initialize()
            servicemanager.PrepareToHostSingle(WindowsService)
            servicemanager.StartServiceCtrlDispatcher()
        else:
            win32serviceutil.HandleCommandLine(WindowsService)

except ImportError:
    # Se pywin32 não estiver instalado, executa em modo standalone
    if __name__ == '__main__':
        print("=" * 60)
        print("  AGENTE DE SINCRONIZAÇÃO - MODO STANDALONE")
        print("=" * 60)
        print()
        print("Para instalar como serviço Windows, execute:")
        print("  pip install pywin32")
        print("  python equipment-service.py install")
        print()
        print("Iniciando em modo debug...")
        print()
        
        service = EquipmentSyncService()
        try:
            service.start()
        except KeyboardInterrupt:
            service.stop()
