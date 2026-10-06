#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║     SUPERPONTO COMMUNICATOR - Robô de Comunicação de Equipamentos           ║
║                                                                              ║
║  Comunicação online via nuvem com todos os relógios de ponto.               ║
║  Funciona como serviço Windows, sincronizando automaticamente.              ║
║                                                                              ║
║  Versão: 2.0.0                                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

Requisitos:
    pip install requests pywin32

Uso:
    python superponto-communicator.py install    - Instala como serviço Windows
    python superponto-communicator.py start      - Inicia o serviço
    python superponto-communicator.py stop       - Para o serviço
    python superponto-communicator.py remove     - Remove o serviço
    python superponto-communicator.py debug      - Executa em modo console
    python superponto-communicator.py configure  - Assistente de configuração
"""

import sys
import os
import time
import json
import socket
import struct
import threading
import logging
import hashlib
import ssl
import ipaddress
from datetime import datetime, timedelta
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ══════════════════════════════════════════════════════════════════════════════

VERSION = "2.0.0"
SERVICE_NAME = "SuperPontoCommunicator"
SERVICE_DISPLAY = "SuperPonto - Comunicador de Equipamentos"
SERVICE_DESCRIPTION = "Serviço de comunicação online com relógios de ponto via nuvem SuperPonto"

# Diretórios
DATA_DIR = Path(os.environ.get('PROGRAMDATA', 'C:\\ProgramData')) / 'SuperPontoCommunicator'
LOG_DIR = DATA_DIR / 'logs'
CONFIG_FILE = DATA_DIR / 'config.json'
STATE_FILE = DATA_DIR / 'state.json'
CACHE_DIR = DATA_DIR / 'cache'

# Criar diretórios
for d in [DATA_DIR, LOG_DIR, CACHE_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Logging
LOG_FILE = LOG_DIR / f'communicator_{datetime.now().strftime("%Y%m%d")}.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('SuperPontoCommunicator')

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO PADRÃO
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_CONFIG = {
    'version': VERSION,
    'cloud': {
        'api_url': os.environ.get('PONTOMAX_EQUIPMENT_SYNC_URL', '').strip(),
        'anon_key': os.environ.get('PONTOMAX_SUPABASE_ANON_KEY', '').strip(),
    },
    'server': {
        'ip': '',  # IPv4 do servidor onde o comunicador está rodando
        'port': 8899,  # Porta do dashboard local
    },
    'company': {
        'code': '',
        'id': '',
        'name': '',
    },
    'sync': {
        'interval_seconds': 60,
        'retry_interval_seconds': 30,
        'max_retries': 3,
        'batch_size': 100,
        'collect_interval_seconds': 300,  # Intervalo de coleta dos equipamentos
    },
    'network': {
        'scan_enabled': True,
        'scan_interval_seconds': 3600,  # Scan a cada 1 hora
        'scan_ranges': [],  # Preenchido automaticamente
        'scan_timeout': 1,
        'max_threads': 100,
    },
    'equipment': [],  # Lista de equipamentos configurados manualmente
    'dashboard': {
        'enabled': True,
        'port': 8899,
        'auth_token': '',  # Gerado na instalação
    },
}

# ══════════════════════════════════════════════════════════════════════════════
# CATÁLOGO DE FABRICANTES E PROTOCOLOS
# ══════════════════════════════════════════════════════════════════════════════

MANUFACTURER_PROTOCOLS = {
    'henry': {
        'ports': [80, 443, 3000, 8080],
        'protocol': 'soap',
        'signatures': ['Henry', 'Prisma', 'Orion', 'Hexa', 'Primme', 'iDClass'],
        'endpoints': {
            'records': '/iDClass/SyncDataService.svc',
            'info': '/api/system/info',
            'employees': '/iDClass/SyncDataService.svc',
        },
    },
    'dimep': {
        'ports': [80, 443, 4370],
        'protocol': 'rest',
        'signatures': ['Dimep', 'PrintPoint', 'Smart Print', 'FacePlus', 'BioPoint'],
        'endpoints': {
            'records': '/api/v1/records',
            'info': '/api/info',
            'employees': '/api/v1/employees',
        },
    },
    'controlid': {
        'ports': [80, 443, 8080],
        'protocol': 'rest',
        'signatures': ['Control iD', 'iDClass', 'iDFace', 'iDBox', 'iDFlex'],
        'endpoints': {
            'records': '/api/v1/afd',
            'info': '/api/system/information',
            'employees': '/api/v1/users',
        },
    },
    'zkteco': {
        'ports': [80, 4370, 8080],
        'protocol': 'push',
        'signatures': ['ZKTeco', 'ZK', 'SpeedFace', 'K40', 'K50', 'MB10', 'UFace'],
        'endpoints': {
            'records': '/iclock/cdata',
            'info': '/iclock/getinfo',
            'employees': '/iclock/cdata',
        },
    },
    'topdata': {
        'ports': [80, 3000],
        'protocol': 'rest',
        'signatures': ['Topdata', 'Inner Rep', 'Inner Bio'],
        'endpoints': {
            'records': '/inner/api',
            'info': '/inner/api/info',
            'employees': '/inner/api/users',
        },
    },
    'madis': {
        'ports': [80, 443],
        'protocol': 'rest',
        'signatures': ['Madis', 'MD 6705', 'MD 6710', 'FaceID'],
        'endpoints': {
            'records': '/api/records',
            'info': '/api/info',
            'employees': '/api/employees',
        },
    },
    'secullum': {
        'ports': [80, 3000],
        'protocol': 'soap',
        'signatures': ['Secullum', 'REP 4', 'REP Bio', 'REP Facial'],
        'endpoints': {
            'records': '/webservice/ponto',
            'info': '/webservice/info',
            'employees': '/webservice/ponto',
        },
    },
    'anviz': {
        'ports': [80, 5010],
        'protocol': 'rest',
        'signatures': ['Anviz', 'C2 Pro', 'FacePass', 'W2 Pro'],
        'endpoints': {
            'records': '/api/transaction',
            'info': '/api/info',
            'employees': '/api/users',
        },
    },
    'suprema': {
        'ports': [443, 80],
        'protocol': 'rest',
        'signatures': ['Suprema', 'BioStar', 'BioStation', 'BioEntry', 'FaceLite'],
        'endpoints': {
            'records': '/api/v2/events',
            'info': '/api/v2/devices',
            'employees': '/api/v2/users',
        },
    },
    'hikvision': {
        'ports': [80, 443, 8000],
        'protocol': 'isapi',
        'signatures': ['Hikvision', 'DS-K1T', 'DS-K1'],
        'endpoints': {
            'records': '/ISAPI/AccessControl/AcsEvent',
            'info': '/ISAPI/System/deviceInfo',
            'employees': '/ISAPI/AccessControl/UserInfo/Search',
        },
    },
    'intelbras': {
        'ports': [80, 443],
        'protocol': 'rest',
        'signatures': ['Intelbras', 'SS 411', 'SS 611'],
        'endpoints': {
            'records': '/api/records',
            'info': '/api/info',
            'employees': '/api/users',
        },
    },
    'trix': {
        'ports': [80, 3000],
        'protocol': 'rest',
        'signatures': ['Trix', 'SS 710', 'SS 810'],
        'endpoints': {
            'records': '/api/v1/marcacoes',
            'info': '/api/v1/info',
            'employees': '/api/v1/users',
        },
    },
    'rwtech': {
        'ports': [80, 443],
        'protocol': 'rest',
        'signatures': ['RWTech', 'RW Bio', 'RW Facial'],
        'endpoints': {
            'records': '/api/records',
            'info': '/api/info',
            'employees': '/api/users',
        },
    },
    'biomtech': {
        'ports': [443, 80, 8443],
        'protocol': 'rest',
        'signatures': ['Biomtech', 'faceSchool', 'faceJus', 'facePoint', 'faceCorp', 'facePass'],
        'endpoints': {
            'records': '/api/v1/attendance',
            'info': '/api/v1/device/info',
            'employees': '/api/v1/persons',
        },
    },
}

# ══════════════════════════════════════════════════════════════════════════════
# GERENCIAMENTO DE CONFIGURAÇÃO
# ══════════════════════════════════════════════════════════════════════════════

class ConfigManager:
    def __init__(self):
        self.config = DEFAULT_CONFIG.copy()
        self.load()

    def load(self):
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    saved = json.load(f)
                self._deep_update(self.config, saved)
        except Exception as e:
            logger.error(f"Erro ao carregar config: {e}")

    def save(self):
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar config: {e}")

    def get(self, *keys):
        val = self.config
        for k in keys:
            val = val.get(k, None) if isinstance(val, dict) else None
            if val is None:
                return None
        return val

    def set(self, *args):
        keys = args[:-1]
        value = args[-1]
        d = self.config
        for k in keys[:-1]:
            d = d.setdefault(k, {})
        d[keys[-1]] = value
        self.save()

    def _deep_update(self, base, update):
        for k, v in update.items():
            if isinstance(v, dict) and isinstance(base.get(k), dict):
                self._deep_update(base[k], v)
            else:
                base[k] = v

# ══════════════════════════════════════════════════════════════════════════════
# ESTADO DO SERVIÇO
# ══════════════════════════════════════════════════════════════════════════════

class StateManager:
    def __init__(self):
        self.state = {
            'equipment_status': {},
            'last_sync': {},
            'sync_history': [],
            'errors': [],
            'stats': {
                'total_syncs': 0,
                'total_records': 0,
                'total_errors': 0,
                'uptime_start': datetime.now().isoformat(),
            }
        }
        self.load()

    def load(self):
        try:
            if STATE_FILE.exists():
                with open(STATE_FILE, 'r', encoding='utf-8') as f:
                    self.state.update(json.load(f))
        except:
            pass

    def save(self):
        try:
            # Keep only recent history
            self.state['sync_history'] = self.state['sync_history'][-500:]
            self.state['errors'] = self.state['errors'][-200:]
            with open(STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.state, f, ensure_ascii=False, indent=2, default=str)
        except:
            pass

    def add_sync(self, equipment_id, equipment_name, status, message='', records=0):
        entry = {
            'timestamp': datetime.now().isoformat(),
            'equipment_id': equipment_id,
            'equipment_name': equipment_name,
            'status': status,
            'message': message,
            'records': records,
        }
        self.state['sync_history'].append(entry)
        self.state['last_sync'][equipment_id] = entry
        if status == 'success':
            self.state['stats']['total_syncs'] += 1
            self.state['stats']['total_records'] += records
        else:
            self.state['stats']['total_errors'] += 1
            self.state['errors'].append(entry)
        self.save()

    def set_equipment_status(self, eq_id, online, info=None):
        self.state['equipment_status'][eq_id] = {
            'online': online,
            'last_check': datetime.now().isoformat(),
            'info': info or {},
        }
        self.save()

# ══════════════════════════════════════════════════════════════════════════════
# COMUNICAÇÃO COM EQUIPAMENTOS
# ══════════════════════════════════════════════════════════════════════════════

class EquipmentCommunicator:
    """Comunicação direta com os relógios de ponto via rede local"""

    def __init__(self, config, state):
        self.config = config
        self.state = state

    def _http_request(self, url, method='GET', headers=None, body=None, timeout=10):
        """Requisição HTTP sem dependência de requests"""
        try:
            req = Request(url, data=body.encode('utf-8') if body else None, method=method)
            if headers:
                for k, v in headers.items():
                    req.add_header(k, v)
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with urlopen(req, timeout=timeout, context=ctx) as resp:
                return resp.status, resp.read().decode('utf-8', errors='replace')
        except HTTPError as e:
            return e.code, e.read().decode('utf-8', errors='replace')
        except Exception as e:
            return 0, str(e)

    def check_port(self, ip, port, timeout=1):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((ip, port))
            sock.close()
            return result == 0
        except:
            return False

    def identify_manufacturer(self, ip, port):
        """Identifica o fabricante do equipamento"""
        for proto in ['http', 'https']:
            try:
                status, body = self._http_request(f"{proto}://{ip}:{port}/", timeout=3)
                if status > 0:
                    body_lower = body.lower()
                    for mfr, info in MANUFACTURER_PROTOCOLS.items():
                        for sig in info['signatures']:
                            if sig.lower() in body_lower:
                                return mfr, proto
            except:
                pass
        return 'generic', 'http'

    def collect_records(self, equipment):
        """Coleta registros de um equipamento"""
        ip = equipment.get('ip_address') or equipment.get('ip', '')
        port = equipment.get('port', 80)
        manufacturer = equipment.get('manufacturer', 'generic').lower()
        protocol = equipment.get('protocol', 'http')
        username = equipment.get('username', '')
        password = equipment.get('password', '')
        api_endpoint = equipment.get('api_endpoint', '')

        mfr_info = MANUFACTURER_PROTOCOLS.get(manufacturer, {})
        endpoint = api_endpoint or mfr_info.get('endpoints', {}).get('records', '/')
        url = f"{protocol}://{ip}:{port}{endpoint}"

        headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}

        # Auth
        if username and password:
            import base64
            creds = base64.b64encode(f"{username}:{password}".encode()).decode()
            headers['Authorization'] = f'Basic {creds}'
        elif password:
            headers['Authorization'] = f'Bearer {password}'
            headers['X-API-Key'] = password

        try:
            if manufacturer == 'henry':
                # SOAP
                soap_body = '''<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <GetRecords xmlns="http://tempuri.org/"><lastNSR>0</lastNSR></GetRecords>
  </soap12:Body>
</soap12:Envelope>'''
                headers['Content-Type'] = 'application/soap+xml; charset=utf-8'
                status, body = self._http_request(url, 'POST', headers, soap_body, timeout=15)
            elif manufacturer == 'secullum':
                soap_body = f'''<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <BuscarMarcacoes xmlns="http://secullum.com.br/">
      <usuario>{username}</usuario><senha>{password}</senha>
    </BuscarMarcacoes>
  </soap:Body>
</soap:Envelope>'''
                headers['Content-Type'] = 'application/soap+xml; charset=utf-8'
                status, body = self._http_request(url, 'POST', headers, soap_body, timeout=15)
            elif manufacturer == 'controlid':
                login_body = json.dumps({'login': username, 'password': password})
                status, body = self._http_request(url, 'POST', headers, login_body, timeout=15)
            elif manufacturer == 'hikvision':
                status, body = self._http_request(url, 'POST', headers, '{}', timeout=15)
            else:
                status, body = self._http_request(url, 'GET', headers, timeout=15)

            if status >= 200 and status < 300:
                return {'online': True, 'status': status, 'data': body, 'records_count': self._count_records(body)}
            else:
                return {'online': status > 0, 'status': status, 'error': body[:500], 'records_count': 0}
        except Exception as e:
            return {'online': False, 'status': 0, 'error': str(e), 'records_count': 0}

    def _count_records(self, body):
        """Estimativa de registros no retorno"""
        try:
            data = json.loads(body)
            if isinstance(data, list):
                return len(data)
            if isinstance(data, dict):
                for key in ['records', 'data', 'events', 'AcsEvent', 'rows']:
                    if key in data and isinstance(data[key], list):
                        return len(data[key])
            return 0
        except:
            # Count XML records
            return body.count('<Record>') or body.count('<Marcacao>') or body.count('\n')

    def test_connection(self, ip, port, protocol='http'):
        """Testa conexão com equipamento"""
        if not self.check_port(ip, port):
            return False, 'Porta fechada'
        try:
            status, body = self._http_request(f"{protocol}://{ip}:{port}/", timeout=5)
            return status > 0, f'HTTP {status}'
        except Exception as e:
            return False, str(e)

# ══════════════════════════════════════════════════════════════════════════════
# COMUNICAÇÃO COM A NUVEM
# ══════════════════════════════════════════════════════════════════════════════

class CloudSync:
    """Sincroniza dados com o SuperPonto Cloud"""

    def __init__(self, config, state):
        self.config = config
        self.state = state

    def _cloud_request(self, payload, timeout=30):
        """Envia dados para a nuvem"""
        url = self.config.get('cloud', 'api_url')
        anon_key = self.config.get('cloud', 'anon_key')

        headers = {
            'Content-Type': 'application/json',
            'apikey': anon_key,
            'Authorization': f'Bearer {anon_key}',
        }

        body = json.dumps(payload)
        req = Request(url, data=body.encode('utf-8'), method='POST')
        for k, v in headers.items():
            req.add_header(k, v)

        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with urlopen(req, timeout=timeout, context=ctx) as resp:
                return resp.status, json.loads(resp.read().decode('utf-8'))
        except HTTPError as e:
            return e.code, {'error': e.read().decode('utf-8', errors='replace')}
        except Exception as e:
            return 0, {'error': str(e)}

    def fetch_equipment_list(self, company_id):
        """Busca lista de equipamentos cadastrados na nuvem"""
        status, data = self._cloud_request({
            'action': 'list_equipment',
            'companyId': company_id,
        })
        if status == 200:
            return data.get('equipment', [])
        return []

    def send_records(self, equipment_id, records_data, company_id):
        """Envia registros coletados para a nuvem"""
        status, data = self._cloud_request({
            'action': 'receive_records',
            'equipmentId': equipment_id,
            'companyId': company_id,
            'records': records_data,
            'timestamp': datetime.now().isoformat(),
            'agent_version': VERSION,
        })
        return status == 200, data

    def heartbeat(self, server_ip, company_id, equipment_statuses):
        """Envia heartbeat para a nuvem"""
        status, data = self._cloud_request({
            'action': 'agent_heartbeat',
            'companyId': company_id,
            'serverIp': server_ip,
            'agentVersion': VERSION,
            'equipmentStatuses': equipment_statuses,
            'timestamp': datetime.now().isoformat(),
        })
        return status == 200

    def update_equipment_status(self, equipment_id, online, message=''):
        """Atualiza status do equipamento na nuvem"""
        status, data = self._cloud_request({
            'action': 'update_status',
            'equipmentId': equipment_id,
            'online': online,
            'message': message,
            'timestamp': datetime.now().isoformat(),
        })
        return status == 200

# ══════════════════════════════════════════════════════════════════════════════
# SCANNER DE REDE
# ══════════════════════════════════════════════════════════════════════════════

class NetworkScanner:
    def __init__(self, config, state):
        self.config = config
        self.state = state
        self.communicator = EquipmentCommunicator(config, state)

    def get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "192.168.1.1"

    def get_scan_ranges(self):
        ranges = self.config.get('network', 'scan_ranges')
        if ranges:
            return ranges
        local_ip = self.get_local_ip()
        parts = local_ip.split('.')
        return [f"{'.'.join(parts[:3])}.0/24"]

    def scan_host(self, ip):
        all_ports = set()
        for info in MANUFACTURER_PROTOCOLS.values():
            all_ports.update(info['ports'])
        for port in sorted(all_ports):
            if self.communicator.check_port(ip, port, timeout=self.config.get('network', 'scan_timeout') or 1):
                mfr, proto = self.communicator.identify_manufacturer(ip, port)
                return {
                    'ip': ip, 'port': port, 'manufacturer': mfr,
                    'protocol': proto, 'discovered_at': datetime.now().isoformat(),
                }
        return None

    def scan_network(self, callback=None):
        found = []
        ranges = self.get_scan_ranges()
        max_threads = self.config.get('network', 'max_threads') or 100

        for net_range in ranges:
            try:
                network = ipaddress.ip_network(net_range, strict=False)
                hosts = list(network.hosts())
                logger.info(f"Escaneando {net_range} ({len(hosts)} hosts)...")

                with ThreadPoolExecutor(max_workers=max_threads) as executor:
                    futures = {executor.submit(self.scan_host, str(ip)): str(ip) for ip in hosts}
                    for future in as_completed(futures):
                        result = future.result()
                        if result:
                            found.append(result)
                            logger.info(f"Equipamento encontrado: {result['ip']}:{result['port']} ({result['manufacturer']})")
                            if callback:
                                callback(result)
            except Exception as e:
                logger.error(f"Erro no scan {net_range}: {e}")

        return found

# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD WEB LOCAL
# ══════════════════════════════════════════════════════════════════════════════

class DashboardServer:
    """Dashboard web local para monitoramento"""

    DASHBOARD_HTML = '''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SuperPonto Communicator</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.container{max-width:1400px;margin:0 auto;padding:20px}
header{background:linear-gradient(135deg,#1e293b,#334155);padding:24px;border-radius:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;border:1px solid #334155}
h1{color:#22c55e;font-size:24px;display:flex;align-items:center;gap:12px}
h1 span{font-size:28px}
.badge{padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600}
.badge-ok{background:#166534;color:#4ade80}
.badge-err{background:#7f1d1d;color:#fca5a5}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px}
.card{background:#1e293b;padding:20px;border-radius:12px;border:1px solid #334155}
.card-val{font-size:36px;font-weight:700;color:#22c55e}
.card-label{font-size:13px;color:#64748b;margin-top:4px}
.section{background:#1e293b;padding:20px;border-radius:12px;margin-bottom:20px;border:1px solid #334155}
.section h2{font-size:17px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #334155;color:#94a3b8}
table{width:100%;border-collapse:collapse}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #1e293b;font-size:13px}
th{color:#64748b;font-weight:500}
tr:hover{background:#334155}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
.dot-green{background:#22c55e}
.dot-red{background:#ef4444}
.dot-yellow{background:#eab308}
.btn{padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;transition:all .2s}
.btn-primary{background:#22c55e;color:#0f172a}
.btn-primary:hover{background:#16a34a}
.btn-sm{padding:4px 10px;font-size:12px}
.info{font-size:12px;color:#475569;margin-top:8px}
</style>
</head>
<body>
<div class="container">
<header>
<div><h1><span>🕐</span> SuperPonto Communicator</h1><p class="info">v''' + VERSION + ''' | Atualiza automaticamente a cada 10s</p></div>
<span class="badge badge-ok" id="svc-status">● Ativo</span>
</header>
<div class="grid" id="stats-grid"></div>
<div class="section">
<h2>📡 Equipamentos Monitorados</h2>
<table><thead><tr><th>Status</th><th>Nome/IP</th><th>Fabricante</th><th>Porta</th><th>Última Sinc.</th><th>Registros</th><th>Ação</th></tr></thead>
<tbody id="eq-body"></tbody></table>
</div>
<div class="section">
<h2>📋 Histórico Recente</h2>
<table><thead><tr><th>Data/Hora</th><th>Equipamento</th><th>Status</th><th>Mensagem</th><th>Registros</th></tr></thead>
<tbody id="hist-body"></tbody></table>
</div>
</div>
<script>
async function refresh(){
  try{
    const r=await fetch('/api/status');
    const d=await r.json();
    document.getElementById('stats-grid').innerHTML=`
      <div class="card"><div class="card-val">${d.stats.total_syncs||0}</div><div class="card-label">Total Sincronizações</div></div>
      <div class="card"><div class="card-val">${d.stats.total_records||0}</div><div class="card-label">Total Registros</div></div>
      <div class="card"><div class="card-val">${Object.keys(d.equipment_status||{}).length}</div><div class="card-label">Equipamentos</div></div>
      <div class="card"><div class="card-val">${d.stats.total_errors||0}</div><div class="card-label">Erros</div></div>`;
    const eqs=Object.entries(d.equipment_status||{});
    document.getElementById('eq-body').innerHTML=eqs.map(([id,eq])=>{
      const on=eq.online;
      const ls=d.last_sync[id];
      return`<tr><td><span class="dot ${on?'dot-green':'dot-red'}"></span>${on?'Online':'Offline'}</td>
      <td>${eq.info?.name||id}</td><td>${eq.info?.manufacturer||'-'}</td><td>${eq.info?.port||'-'}</td>
      <td>${ls?new Date(ls.timestamp).toLocaleString('pt-BR'):'-'}</td>
      <td>${ls?.records||0}</td>
      <td><button class="btn btn-primary btn-sm" onclick="syncOne('${id}')">Sincronizar</button></td></tr>`;
    }).join('');
    const hist=(d.sync_history||[]).slice(-20).reverse();
    document.getElementById('hist-body').innerHTML=hist.map(h=>`<tr>
      <td>${new Date(h.timestamp).toLocaleString('pt-BR')}</td>
      <td>${h.equipment_name||h.equipment_id||'-'}</td>
      <td><span class="badge ${h.status==='success'?'badge-ok':'badge-err'}">${h.status}</span></td>
      <td>${h.message||''}</td><td>${h.records||0}</td></tr>`).join('');
  }catch(e){console.error(e)}
}
async function syncOne(id){try{await fetch('/api/sync?id='+id,{method:'POST'})}catch(e){}}
refresh();setInterval(refresh,10000);
</script>
</body></html>'''

    def __init__(self, config, state, sync_engine):
        self.config = config
        self.state = state
        self.sync_engine = sync_engine
        self.server = None

    def start(self):
        port = self.config.get('dashboard', 'port') or 8899
        thread = threading.Thread(target=self._run_server, args=(port,), daemon=True)
        thread.start()
        logger.info(f"Dashboard disponível em http://localhost:{port}")

    def _run_server(self, port):
        from http.server import HTTPServer, BaseHTTPRequestHandler
        state = self.state
        sync_engine = self.sync_engine

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a): pass

            def do_GET(self):
                if self.path == '/api/status':
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(state.state, default=str).encode())
                else:
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(DashboardServer.DASHBOARD_HTML.encode('utf-8'))

            def do_POST(self):
                if self.path.startswith('/api/sync'):
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"ok":true}')
                    # Trigger sync in background
                    if sync_engine:
                        threading.Thread(target=sync_engine.sync_cycle, daemon=True).start()
                else:
                    self.send_response(404)
                    self.end_headers()

        server = HTTPServer(('0.0.0.0', port), Handler)
        server.serve_forever()

# ══════════════════════════════════════════════════════════════════════════════
# MOTOR DE SINCRONIZAÇÃO
# ══════════════════════════════════════════════════════════════════════════════

class SyncEngine:
    """Motor principal de sincronização"""

    def __init__(self, config, state):
        self.config = config
        self.state = state
        self.communicator = EquipmentCommunicator(config, state)
        self.cloud = CloudSync(config, state)
        self.scanner = NetworkScanner(config, state)
        self.running = False

    def get_equipment_list(self):
        """Obtém lista de equipamentos (cloud + local config)"""
        company_id = self.config.get('company', 'id')
        equipment = []

        # Da nuvem
        if company_id:
            try:
                cloud_equipment = self.cloud.fetch_equipment_list(company_id)
                equipment.extend(cloud_equipment)
            except Exception as e:
                logger.warning(f"Erro ao buscar equipamentos da nuvem: {e}")

        # Configurados localmente
        local_equipment = self.config.get('equipment') or []
        for eq in local_equipment:
            if not any(e.get('ip_address') == eq.get('ip_address') for e in equipment):
                equipment.append(eq)

        return equipment

    def sync_equipment(self, equipment):
        """Sincroniza um equipamento: coleta local + envia para nuvem"""
        eq_id = equipment.get('id', equipment.get('ip_address', 'unknown'))
        eq_name = equipment.get('name', eq_id)

        try:
            # 1. Coleta registros do equipamento
            result = self.communicator.collect_records(equipment)
            online = result.get('online', False)

            # Atualiza status
            self.state.set_equipment_status(eq_id, online, {
                'name': eq_name,
                'manufacturer': equipment.get('manufacturer', ''),
                'port': equipment.get('port', 80),
                'ip': equipment.get('ip_address', equipment.get('ip', '')),
            })

            # Atualiza na nuvem
            self.cloud.update_equipment_status(eq_id, online,
                result.get('error', 'OK') if not online else 'Comunicação OK')

            if not online:
                self.state.add_sync(eq_id, eq_name, 'error',
                    f"Offline: {result.get('error', 'Sem resposta')}")
                return False

            # 2. Envia registros para a nuvem
            records_count = result.get('records_count', 0)
            if records_count > 0:
                company_id = self.config.get('company', 'id')
                success, cloud_result = self.cloud.send_records(eq_id, result.get('data', ''), company_id)
                if success:
                    self.state.add_sync(eq_id, eq_name, 'success',
                        f'{records_count} registros enviados', records_count)
                    logger.info(f"✓ {eq_name}: {records_count} registros sincronizados")
                else:
                    self.state.add_sync(eq_id, eq_name, 'error',
                        f"Erro cloud: {cloud_result.get('error', 'desconhecido')}")
            else:
                self.state.add_sync(eq_id, eq_name, 'success', 'Sem novos registros', 0)
                logger.info(f"✓ {eq_name}: sem novos registros")

            return True

        except Exception as e:
            self.state.add_sync(eq_id, eq_name, 'error', str(e))
            logger.error(f"✗ Erro sincronizando {eq_name}: {e}")
            return False

    def sync_cycle(self):
        """Executa um ciclo completo de sincronização"""
        equipment_list = self.get_equipment_list()
        if not equipment_list:
            logger.warning("Nenhum equipamento para sincronizar")
            return

        logger.info(f"Iniciando ciclo: {len(equipment_list)} equipamentos")
        for eq in equipment_list:
            if eq.get('is_active', True):
                self.sync_equipment(eq)

        # Heartbeat
        server_ip = self.scanner.get_local_ip()
        company_id = self.config.get('company', 'id')
        self.cloud.heartbeat(server_ip, company_id, self.state.state.get('equipment_status', {}))

    def run(self):
        """Loop principal do serviço"""
        self.running = True
        interval = self.config.get('sync', 'interval_seconds') or 60
        scan_interval = self.config.get('network', 'scan_interval_seconds') or 3600
        last_scan = 0

        logger.info(f"Motor de sincronização iniciado (intervalo: {interval}s)")

        while self.running:
            try:
                # Scan de rede periódico
                now = time.time()
                if self.config.get('network', 'scan_enabled') and (now - last_scan) > scan_interval:
                    logger.info("Executando scan de rede...")
                    found = self.scanner.scan_network()
                    if found:
                        logger.info(f"Scan: {len(found)} equipamentos encontrados")
                    last_scan = now

                # Ciclo de sincronização
                self.sync_cycle()

            except Exception as e:
                logger.error(f"Erro no ciclo: {e}")

            # Aguardar
            for _ in range(interval):
                if not self.running:
                    break
                time.sleep(1)

    def stop(self):
        self.running = False

# ══════════════════════════════════════════════════════════════════════════════
# SERVIÇO WINDOWS
# ══════════════════════════════════════════════════════════════════════════════

def run_as_service():
    """Executa como serviço Windows"""
    try:
        import win32serviceutil
        import win32service
        import win32event
        import servicemanager
    except ImportError:
        logger.error("pywin32 não instalado. Execute: pip install pywin32")
        sys.exit(1)

    class SuperPontoService(win32serviceutil.ServiceFramework):
        _svc_name_ = SERVICE_NAME
        _svc_display_name_ = SERVICE_DISPLAY
        _svc_description_ = SERVICE_DESCRIPTION

        def __init__(self, args):
            win32serviceutil.ServiceFramework.__init__(self, args)
            self.stop_event = win32event.CreateEvent(None, 0, 0, None)
            self.sync_engine = None

        def SvcStop(self):
            self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
            win32event.SetEvent(self.stop_event)
            if self.sync_engine:
                self.sync_engine.stop()

        def SvcDoRun(self):
            servicemanager.LogMsg(
                servicemanager.EVENTLOG_INFORMATION_TYPE,
                servicemanager.PYS_SERVICE_STARTED,
                (self._svc_name_, '')
            )
            self.main()

        def main(self):
            config = ConfigManager()
            state = StateManager()
            self.sync_engine = SyncEngine(config, state)

            # Dashboard
            if config.get('dashboard', 'enabled'):
                dashboard = DashboardServer(config, state, self.sync_engine)
                dashboard.start()

            # Run sync
            self.sync_engine.run()

    # Handle service commands
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(SuperPontoService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(SuperPontoService)

# ══════════════════════════════════════════════════════════════════════════════
# MODO CONSOLE / DEBUG
# ══════════════════════════════════════════════════════════════════════════════

def run_console():
    """Executa em modo console (debug)"""
    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║  🕐 SuperPonto Communicator v{VERSION}                             ║
║  Modo Console - Pressione Ctrl+C para parar                    ║
╚══════════════════════════════════════════════════════════════════╝
""")

    config = ConfigManager()
    state = StateManager()
    engine = SyncEngine(config, state)

    # Dashboard
    if config.get('dashboard', 'enabled'):
        dashboard = DashboardServer(config, state, engine)
        dashboard.start()
        port = config.get('dashboard', 'port') or 8899
        print(f"  Dashboard: http://localhost:{port}")

    server_ip = engine.scanner.get_local_ip()
    print(f"  IP do Servidor: {server_ip}")
    print(f"  Empresa: {config.get('company', 'name') or config.get('company', 'code') or 'Não configurada'}")
    print(f"  Intervalo: {config.get('sync', 'interval_seconds')}s")
    print()

    try:
        engine.run()
    except KeyboardInterrupt:
        print("\n\nServiço encerrado pelo usuário.")
        engine.stop()

# ══════════════════════════════════════════════════════════════════════════════
# ASSISTENTE DE CONFIGURAÇÃO
# ══════════════════════════════════════════════════════════════════════════════

def run_configure():
    """Assistente de configuração interativo"""
    print(f"""
╔══════════════════════════════════════════════════════════════════╗
║  ⚙️ SuperPonto Communicator - Configuração                      ║
╚══════════════════════════════════════════════════════════════════╝
""")

    config = ConfigManager()

    # Código da empresa
    current = config.get('company', 'code') or ''
    code = input(f"  Código da empresa [{current}]: ").strip() or current
    config.set('company', 'code', code)

    # ID da empresa
    current = config.get('company', 'id') or ''
    cid = input(f"  ID da empresa (UUID) [{current}]: ").strip() or current
    config.set('company', 'id', cid)

    # Nome
    current = config.get('company', 'name') or ''
    name = input(f"  Nome da empresa [{current}]: ").strip() or current
    config.set('company', 'name', name)

    # IP do servidor
    scanner = NetworkScanner(config, StateManager())
    detected_ip = scanner.get_local_ip()
    current = config.get('server', 'ip') or detected_ip
    ip = input(f"  IP do servidor (IPv4) [{current}]: ").strip() or current
    config.set('server', 'ip', ip)

    # Porta dashboard
    current = config.get('dashboard', 'port') or 8899
    port = input(f"  Porta do dashboard [{current}]: ").strip() or str(current)
    config.set('dashboard', 'port', int(port))

    # Intervalo de sincronização
    current = config.get('sync', 'interval_seconds') or 60
    interval = input(f"  Intervalo de sincronização em segundos [{current}]: ").strip() or str(current)
    config.set('sync', 'interval_seconds', int(interval))

    # Faixa de rede
    net_range = f"{'.'.join(ip.split('.')[:3])}.0/24"
    current = config.get('network', 'scan_ranges') or [net_range]
    ranges = input(f"  Faixa de rede para scan [{','.join(current)}]: ").strip()
    if ranges:
        config.set('network', 'scan_ranges', [r.strip() for r in ranges.split(',')])
    else:
        config.set('network', 'scan_ranges', current)

    # Token de autenticação
    import secrets as sec_module
    if not config.get('dashboard', 'auth_token'):
        config.set('dashboard', 'auth_token', sec_module.token_hex(16))

    config.save()

    print(f"""
  ✅ Configuração salva em: {CONFIG_FILE}

  Para instalar como serviço Windows:
    python superponto-communicator.py install

  Para executar em modo console:
    python superponto-communicator.py debug
""")

# ══════════════════════════════════════════════════════════════════════════════
# PONTO DE ENTRADA
# ══════════════════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print(f"""
SuperPonto Communicator v{VERSION}

Uso:
  python {sys.argv[0]} <comando>

Comandos:
  configure  - Assistente de configuração
  install    - Instalar como serviço Windows
  start      - Iniciar o serviço
  stop       - Parar o serviço
  remove     - Remover o serviço
  restart    - Reiniciar o serviço
  debug      - Executar em modo console (debug)
  scan       - Escanear rede por equipamentos
  test <ip>  - Testar conexão com equipamento
""")
        return

    command = sys.argv[1].lower()

    if command == 'configure':
        run_configure()
    elif command == 'debug':
        run_console()
    elif command == 'scan':
        config = ConfigManager()
        state = StateManager()
        scanner = NetworkScanner(config, state)
        found = scanner.scan_network()
        print(f"\n{'='*50}")
        print(f"Encontrados: {len(found)} equipamentos")
        for eq in found:
            print(f"  {eq['ip']}:{eq['port']} - {eq['manufacturer']}")
    elif command == 'test':
        if len(sys.argv) < 3:
            print("Uso: python superponto-communicator.py test <ip> [porta]")
            return
        ip = sys.argv[2]
        port = int(sys.argv[3]) if len(sys.argv) > 3 else 80
        config = ConfigManager()
        state = StateManager()
        comm = EquipmentCommunicator(config, state)
        ok, msg = comm.test_connection(ip, port)
        print(f"{'✓ Online' if ok else '✗ Offline'}: {msg}")
        if ok:
            mfr, proto = comm.identify_manufacturer(ip, port)
            print(f"  Fabricante: {mfr}")
            print(f"  Protocolo: {proto}")
    elif command in ('install', 'start', 'stop', 'remove', 'restart'):
        run_as_service()
    else:
        print(f"Comando desconhecido: {command}")

if __name__ == '__main__':
    main()
