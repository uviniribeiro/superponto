#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agente de Sincronização de Relógios de Ponto
Este script detecta e configura automaticamente relógios de ponto na rede local.

Requisitos:
    pip install requests

Uso:
    python equipment-agent.py

Autor: Sistema de Ponto
Versão: 1.0.0
"""

import socket
import struct
import threading
import time
import json
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

try:
    import requests
except ImportError:
    print("Instalando dependência 'requests'...")
    os.system(f"{sys.executable} -m pip install requests")
    import requests

# Configuração do servidor cloud
CLOUD_ENDPOINT = "https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/equipment-sync"

# Portas comuns de relógios de ponto por fabricante
EQUIPMENT_PORTS = {
    'henry': [80, 443, 3000, 8080],
    'dimep': [80, 443, 4370],
    'controlid': [80, 443, 8080],
    'zkteco': [80, 4370, 8080],
    'topdata': [80, 3000],
    'madis': [80, 443],
    'hikvision': [80, 443, 8000],
    'intelbras': [80, 443],
    'trix': [80, 3000],
    'rwtech': [80, 443],
    'secullum': [80, 3000],
    'anviz': [80, 5010]
}

# Assinaturas para identificação de fabricantes
MANUFACTURER_SIGNATURES = {
    'henry': ['Henry', 'Prisma', 'Orion', 'Hexa'],
    'dimep': ['Dimep', 'PrintPoint', 'Smart Print'],
    'controlid': ['Control iD', 'iDClass', 'iDFace'],
    'zkteco': ['ZKTeco', 'ZK', 'SpeedFace', 'K40'],
    'topdata': ['Topdata', 'Inner Rep'],
    'madis': ['Madis', 'MD 6705', 'FaceID'],
    'hikvision': ['Hikvision', 'DS-'],
    'intelbras': ['Intelbras', 'SS 411', 'SS 611'],
    'trix': ['Trix', 'SS 710', 'SS 810'],
    'rwtech': ['RWTech'],
    'secullum': ['Secullum', 'REP'],
    'anviz': ['Anviz', 'C2 Pro', 'FacePass']
}

class Colors:
    """Cores para terminal"""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_banner():
    """Exibe o banner do programa"""
    banner = f"""
{Colors.CYAN}╔══════════════════════════════════════════════════════════════╗
║                                                                  ║
║   {Colors.BOLD}🕐 AGENTE DE SINCRONIZAÇÃO DE RELÓGIOS DE PONTO{Colors.END}{Colors.CYAN}             ║
║                                                                  ║
║   Detecta e configura automaticamente equipamentos na rede      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝{Colors.END}
"""
    print(banner)

def get_local_ip():
    """Obtém o IP local da máquina"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "192.168.1.1"

def get_network_range(local_ip):
    """Calcula o range de IPs da rede local"""
    parts = local_ip.split('.')
    base = '.'.join(parts[:3])
    return [f"{base}.{i}" for i in range(1, 255)]

def check_port(ip, port, timeout=1):
    """Verifica se uma porta está aberta em um IP"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        return result == 0
    except:
        return False

def identify_manufacturer(ip, port):
    """Tenta identificar o fabricante do equipamento"""
    try:
        response = requests.get(f"http://{ip}:{port}/", timeout=3, verify=False)
        content = response.text.lower()
        
        for manufacturer, signatures in MANUFACTURER_SIGNATURES.items():
            for sig in signatures:
                if sig.lower() in content:
                    return manufacturer
        
        # Tenta endpoint de API comum
        try:
            api_response = requests.get(f"http://{ip}:{port}/api/info", timeout=2, verify=False)
            if api_response.status_code == 200:
                data = api_response.json()
                for manufacturer, signatures in MANUFACTURER_SIGNATURES.items():
                    for sig in signatures:
                        if sig.lower() in str(data).lower():
                            return manufacturer
        except:
            pass
            
        return 'unknown'
    except:
        return 'unknown'

def get_equipment_info(ip, port, manufacturer):
    """Obtém informações detalhadas do equipamento"""
    info = {
        'ip': ip,
        'port': port,
        'manufacturer': manufacturer,
        'model': 'Unknown',
        'serial': None,
        'firmware': None
    }
    
    endpoints = {
        'henry': ['/api/system/info', '/cgi-bin/info.cgi'],
        'dimep': ['/api/info', '/status'],
        'controlid': ['/api/system/information', '/info.fcgi'],
        'zkteco': ['/api/info', '/iclock/getinfo'],
        'default': ['/api/info', '/info', '/status', '/system']
    }
    
    try:
        paths = endpoints.get(manufacturer, endpoints['default'])
        for path in paths:
            try:
                response = requests.get(f"http://{ip}:{port}{path}", timeout=3, verify=False)
                if response.status_code == 200:
                    try:
                        data = response.json()
                        info['model'] = data.get('model', data.get('Model', 'Unknown'))
                        info['serial'] = data.get('serial', data.get('SerialNumber', None))
                        info['firmware'] = data.get('firmware', data.get('FirmwareVersion', None))
                        break
                    except:
                        pass
            except:
                continue
    except:
        pass
    
    return info

def scan_ip(ip):
    """Escaneia um IP em busca de equipamentos"""
    found_equipment = []
    all_ports = set()
    for ports in EQUIPMENT_PORTS.values():
        all_ports.update(ports)
    
    for port in all_ports:
        if check_port(ip, port):
            manufacturer = identify_manufacturer(ip, port)
            info = get_equipment_info(ip, port, manufacturer)
            found_equipment.append(info)
            break  # Apenas uma porta por IP
    
    return found_equipment

def scan_network(progress_callback=None):
    """Escaneia toda a rede local em busca de equipamentos"""
    local_ip = get_local_ip()
    ip_range = get_network_range(local_ip)
    
    print(f"\n{Colors.BLUE}📡 IP Local: {local_ip}{Colors.END}")
    print(f"{Colors.BLUE}🔍 Escaneando {len(ip_range)} endereços...{Colors.END}\n")
    
    all_equipment = []
    scanned = 0
    
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = {executor.submit(scan_ip, ip): ip for ip in ip_range}
        
        for future in as_completed(futures):
            scanned += 1
            if progress_callback:
                progress_callback(scanned, len(ip_range))
            
            result = future.result()
            if result:
                all_equipment.extend(result)
                for eq in result:
                    print(f"{Colors.GREEN}✓ Encontrado: {eq['ip']}:{eq['port']} - {eq['manufacturer'].upper()}{Colors.END}")
    
    return all_equipment

def register_equipment(equipment):
    """Registra o equipamento no servidor cloud"""
    try:
        payload = {
            'action': 'register_device',
            'device': {
                'ip_address': equipment['ip'],
                'port': equipment['port'],
                'manufacturer': equipment['manufacturer'],
                'model': equipment['model'],
                'serial_number': equipment['serial'],
                'firmware_version': equipment['firmware'],
                'name': f"{equipment['manufacturer'].upper()} - {equipment['ip']}"
            }
        }
        
        response = requests.post(CLOUD_ENDPOINT, json=payload, timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"{Colors.FAIL}Erro ao registrar: {e}{Colors.END}")
        return False

def test_cloud_connection():
    """Testa a conexão com o servidor cloud"""
    try:
        response = requests.post(
            CLOUD_ENDPOINT,
            json={'action': 'test_connection'},
            timeout=10
        )
        return response.status_code in [200, 401, 403]  # Qualquer resposta válida
    except:
        return False

def sync_equipment_data(equipment):
    """Sincroniza dados do equipamento com o servidor"""
    try:
        payload = {
            'action': 'sync_single',
            'equipment_ip': equipment['ip'],
            'equipment_port': equipment['port'],
            'manufacturer': equipment['manufacturer']
        }
        
        response = requests.post(CLOUD_ENDPOINT, json=payload, timeout=30)
        return response.status_code == 200
    except:
        return False

def run_sync_daemon(equipment_list, interval=60):
    """Executa sincronização contínua em background"""
    print(f"\n{Colors.CYAN}🔄 Iniciando sincronização automática (intervalo: {interval}s)...{Colors.END}")
    print(f"{Colors.WARNING}Pressione Ctrl+C para parar{Colors.END}\n")
    
    try:
        while True:
            timestamp = datetime.now().strftime('%H:%M:%S')
            print(f"[{timestamp}] Sincronizando {len(equipment_list)} equipamentos...")
            
            for eq in equipment_list:
                success = sync_equipment_data(eq)
                status = f"{Colors.GREEN}✓{Colors.END}" if success else f"{Colors.FAIL}✗{Colors.END}"
                print(f"  {status} {eq['ip']}:{eq['port']}")
            
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Sincronização interrompida pelo usuário{Colors.END}")

def save_config(equipment_list):
    """Salva a configuração dos equipamentos encontrados"""
    config = {
        'last_scan': datetime.now().isoformat(),
        'cloud_endpoint': CLOUD_ENDPOINT,
        'equipment': equipment_list
    }
    
    config_path = os.path.join(os.path.dirname(__file__), 'equipment_config.json')
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print(f"\n{Colors.GREEN}💾 Configuração salva em: {config_path}{Colors.END}")
    return config_path

def load_config():
    """Carrega configuração salva anteriormente"""
    config_path = os.path.join(os.path.dirname(__file__), 'equipment_config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def main():
    """Função principal"""
    print_banner()
    
    # Testa conexão com o cloud
    print(f"{Colors.BLUE}🌐 Testando conexão com o servidor...{Colors.END}")
    if test_cloud_connection():
        print(f"{Colors.GREEN}✓ Conexão com o servidor estabelecida!{Colors.END}")
    else:
        print(f"{Colors.WARNING}⚠ Não foi possível conectar ao servidor cloud{Colors.END}")
        print(f"  Endpoint: {CLOUD_ENDPOINT}")
    
    # Menu principal
    while True:
        print(f"\n{Colors.BOLD}═══ MENU PRINCIPAL ═══{Colors.END}")
        print("1. 🔍 Escanear rede e detectar equipamentos")
        print("2. 📋 Carregar configuração salva")
        print("3. 🔄 Iniciar sincronização automática")
        print("4. 📤 Registrar equipamentos no cloud")
        print("5. 🧪 Testar conexão com equipamento")
        print("6. ❌ Sair")
        
        try:
            choice = input(f"\n{Colors.CYAN}Escolha uma opção: {Colors.END}").strip()
        except KeyboardInterrupt:
            print(f"\n{Colors.WARNING}Programa encerrado{Colors.END}")
            break
        
        if choice == '1':
            def progress(current, total):
                pct = (current / total) * 100
                bar = '█' * int(pct / 5) + '░' * (20 - int(pct / 5))
                print(f"\r  [{bar}] {pct:.0f}% ({current}/{total})", end='', flush=True)
            
            equipment_list = scan_network(progress)
            
            print(f"\n\n{Colors.BOLD}═══ RESULTADOS ═══{Colors.END}")
            print(f"Equipamentos encontrados: {len(equipment_list)}")
            
            for i, eq in enumerate(equipment_list, 1):
                print(f"\n{Colors.CYAN}[{i}] {eq['manufacturer'].upper()}{Colors.END}")
                print(f"    IP: {eq['ip']}:{eq['port']}")
                print(f"    Modelo: {eq['model']}")
                if eq['serial']:
                    print(f"    Serial: {eq['serial']}")
            
            if equipment_list:
                save = input(f"\n{Colors.CYAN}Salvar configuração? (s/n): {Colors.END}").strip().lower()
                if save == 's':
                    save_config(equipment_list)
        
        elif choice == '2':
            config = load_config()
            if config:
                print(f"\n{Colors.GREEN}✓ Configuração carregada!{Colors.END}")
                print(f"  Último scan: {config['last_scan']}")
                print(f"  Equipamentos: {len(config['equipment'])}")
                
                for eq in config['equipment']:
                    print(f"    - {eq['ip']}:{eq['port']} ({eq['manufacturer']})")
            else:
                print(f"{Colors.WARNING}Nenhuma configuração encontrada{Colors.END}")
        
        elif choice == '3':
            config = load_config()
            if config and config['equipment']:
                try:
                    interval = int(input(f"{Colors.CYAN}Intervalo de sincronização (segundos, padrão 60): {Colors.END}").strip() or "60")
                except:
                    interval = 60
                run_sync_daemon(config['equipment'], interval)
            else:
                print(f"{Colors.WARNING}Primeiro escaneie a rede (opção 1){Colors.END}")
        
        elif choice == '4':
            config = load_config()
            if config and config['equipment']:
                print(f"\n{Colors.BLUE}📤 Registrando equipamentos...{Colors.END}")
                for eq in config['equipment']:
                    success = register_equipment(eq)
                    status = f"{Colors.GREEN}✓{Colors.END}" if success else f"{Colors.FAIL}✗{Colors.END}"
                    print(f"  {status} {eq['ip']}")
            else:
                print(f"{Colors.WARNING}Primeiro escaneie a rede (opção 1){Colors.END}")
        
        elif choice == '5':
            ip = input(f"{Colors.CYAN}Digite o IP do equipamento: {Colors.END}").strip()
            port = input(f"{Colors.CYAN}Digite a porta (padrão 80): {Colors.END}").strip() or "80"
            
            try:
                port = int(port)
                print(f"\n{Colors.BLUE}Testando {ip}:{port}...{Colors.END}")
                
                if check_port(ip, port):
                    manufacturer = identify_manufacturer(ip, port)
                    info = get_equipment_info(ip, port, manufacturer)
                    
                    print(f"{Colors.GREEN}✓ Equipamento encontrado!{Colors.END}")
                    print(f"  Fabricante: {info['manufacturer'].upper()}")
                    print(f"  Modelo: {info['model']}")
                    if info['serial']:
                        print(f"  Serial: {info['serial']}")
                else:
                    print(f"{Colors.FAIL}✗ Equipamento não responde{Colors.END}")
            except Exception as e:
                print(f"{Colors.FAIL}Erro: {e}{Colors.END}")
        
        elif choice == '6':
            print(f"\n{Colors.CYAN}Até logo! 👋{Colors.END}")
            break

if __name__ == "__main__":
    main()
