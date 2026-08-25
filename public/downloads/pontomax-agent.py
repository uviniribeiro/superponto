#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ponto Max - Robo de Comunicacao (Agente Local)
==============================================
Instalado na maquina/servidor local do cliente. Responsavel por:

  * Descobrir automaticamente os relogios de ponto (REP) na rede local
  * Identificar o fabricante/modelo pelo fingerprint de portas e protocolos
  * Adotar o equipamento no sistema (sem cadastro manual)
  * Detectar troca de IP por DHCP (casa por MAC/numero de serie) e atualizar o sistema
  * Enviar o cadastro de funcionarios do sistema para o relogio (inclusao/alteracao/exclusao)
  * Coletar as marcacoes (AFD/NSR) do relogio e enviar ao sistema
  * Executar comandos remotos (sincronizar hora, reiniciar, testar conexao, coletar, enviar)

Protocolos suportados (drivers em PROTOCOLS):
  henry      - Henry Hexa/Prisma/Orion (TCP ASCII com STX/ETX + checksum XOR) - porta 3000
  control_id - Control iD iDClass/iDFlex/REP iDX (REST JSON /login, /load_objects...) - porta 80/443
  zkteco     - ZKTeco/Rep iX (protocolo UDP/TCP 4370) - porta 4370
  topdata    - Topdata Inner Rep (TCP binario com STX/ETX) - porta 3570
  dimep      - Dimep PrintPoint/MiniPrint (TCP ASCII) - porta 3000
  madis      - Madis MD/Rep (TCP ASCII compativel Henry) - porta 3000
  generic    - Descoberta HTTP generica (fallback)

Uso:
    python pontomax-agent.py --configure     assistente de configuracao
    python pontomax-agent.py                 executa em primeiro plano
    python pontomax-agent.py --daemon        executa em loop (servico)
    python pontomax-agent.py --scan          apenas varre a rede e mostra o resultado
    python pontomax-agent.py --version
"""

import argparse
import hashlib
import shutil

import concurrent.futures
import ipaddress
import json
import os
import platform
import re
import socket
import ssl
import struct
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

AGENT_VERSION = "3.1.0"
DEFAULT_GATEWAY = "https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/agent-gateway"

if platform.system() == "Windows":
    CONFIG_DIR = os.path.join(os.environ.get("PROGRAMDATA", "C:\\ProgramData"), "PontoMaxAgent")
else:
    CONFIG_DIR = "/etc/pontomax-agent"

CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")
LOG_PATH = os.path.join(CONFIG_DIR, "agent.log")
UPDATE_DIR = os.path.join(CONFIG_DIR, "updates")
UPDATE_STATE_PATH = os.path.join(UPDATE_DIR, "update_state.json")


DEFAULT_CONFIG = {
    "gateway_url": DEFAULT_GATEWAY,
    "agent_token": "",
    "discovery_ranges": [],
    "sync_interval_seconds": 60,
    "discovery_interval_seconds": 900,
    "auto_update": True,
    "verify_ssl": True,
}


# --------------------------------------------------------------------------- #
# Infra basica
# --------------------------------------------------------------------------- #
def log(message, level="INFO"):
    line = "[%s] %s %s" % (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), level, message)
    print(line, flush=True)
    try:
        os.makedirs(CONFIG_DIR, exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


def load_config():
    cfg = dict(DEFAULT_CONFIG)
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
                cfg.update(json.load(fh))
        except Exception as exc:
            log("Falha ao ler configuracao: %s" % exc, "ERROR")
    # Variaveis de ambiente sobrescrevem (util em container/servico)
    cfg["gateway_url"] = os.environ.get("PONTOMAX_GATEWAY", cfg["gateway_url"])
    cfg["agent_token"] = os.environ.get("PONTOMAX_TOKEN", cfg["agent_token"])
    return cfg


def save_config(cfg):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, indent=2, ensure_ascii=False)
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except Exception:
        pass


def utcnow():
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------------- #
# Cliente do gateway
# --------------------------------------------------------------------------- #
class Gateway:
    def __init__(self, cfg):
        self.cfg = cfg
        self.url = cfg["gateway_url"]
        self.token = cfg["agent_token"]
        self.verify_ssl = cfg.get("verify_ssl", True)

    def adopt_token(self, new_token):
        """Rotacao de token: salva o novo token e passa a usa-lo.

        O token antigo continua aceito ate a primeira autenticacao bem-sucedida
        com o novo (validacao no servidor), sem interromper a comunicacao.
        """
        if not new_token or new_token == self.token:
            return
        self.token = new_token
        self.cfg["agent_token"] = new_token
        try:
            save_config(self.cfg)
            log("Token rotacionado com sucesso.")
        except Exception as exc:
            log("Falha ao salvar novo token: %s" % exc, "ERROR")

    def call(self, action, **payload):
        body = dict(payload)
        body["action"] = action
        body.setdefault("agent_version", AGENT_VERSION)
        body.setdefault("hostname", socket.gethostname())
        body.setdefault("os_info", "%s %s" % (platform.system(), platform.release()))
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            self.url,
            data=data,
            headers={"Content-Type": "application/json", "x-agent-token": self.token},
            method="POST",
        )
        ctx = None
        if not self.verify_ssl:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        try:
            with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "ignore")
            log("Gateway %s -> HTTP %s %s" % (action, exc.code, detail), "ERROR")
        except Exception as exc:
            log("Gateway %s -> %s" % (action, exc), "ERROR")
        return None


# --------------------------------------------------------------------------- #
# Drivers de protocolo
# --------------------------------------------------------------------------- #
class BaseDriver:
    """Contrato comum de todos os fabricantes."""

    name = "generic"
    default_port = 80
    probe_ports = (80,)

    def __init__(self, ip, port=None, username="", password="", timeout=6):
        self.ip = ip
        self.port = int(port or self.default_port)
        self.username = username or "admin"
        self.password = password or ""
        self.timeout = timeout

    # --- utilitarios TCP ---------------------------------------------------
    def _tcp(self, payload, read_size=8192):
        with socket.create_connection((self.ip, self.port), timeout=self.timeout) as sock:
            sock.settimeout(self.timeout)
            sock.sendall(payload)
            chunks = b""
            try:
                while True:
                    part = sock.recv(read_size)
                    if not part:
                        break
                    chunks += part
                    if len(part) < read_size:
                        break
            except socket.timeout:
                pass
            return chunks

    def _http(self, path, body=None, method=None, headers=None):
        scheme = "https" if self.port == 443 else "http"
        url = "%s://%s:%s%s" % (scheme, self.ip, self.port, path)
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            url,
            data=data,
            method=method or ("POST" if data else "GET"),
            headers=headers or {"Content-Type": "application/json"},
        )
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=self.timeout, context=ctx) as resp:
            raw = resp.read().decode("utf-8", "ignore")
        try:
            return json.loads(raw)
        except ValueError:
            return {"raw": raw}

    # --- API do driver -----------------------------------------------------
    def identify(self):
        """Retorna dict com model/serial/firmware ou None se nao for deste fabricante."""
        raise NotImplementedError

    def test(self):
        return bool(self.identify())

    def sync_time(self):
        return False

    def collect_records(self, since_nsr=0):
        return []

    def push_employee(self, employee):
        return None

    def remove_employee(self, employee):
        return False

    def reboot(self):
        return False


class HenryDriver(BaseDriver):
    """Henry Hexa/Prisma/Orion - TCP ASCII: STX + tamanho + comando + ETX + checksum XOR."""

    name = "henry"
    default_port = 3000
    probe_ports = (3000,)

    @staticmethod
    def _checksum(payload):
        chk = 0
        for byte in payload:
            chk ^= byte
        return bytes([chk])

    def frame(self, command):
        body = ("%s]%s" % (len(command) + 2, command)).encode("latin-1")
        return b"\x02" + body + b"\x03" + self._checksum(body + b"\x03")

    def send(self, command):
        raw = self._tcp(self.frame(command))
        return raw.decode("latin-1", "ignore").strip("\x02\x03")

    def identify(self):
        try:
            resp = self.send("RH+00+PROTOCOLO]00]")
            if not resp:
                resp = self.send("EH+00+RI]")
            if not resp:
                return None
            serial = None
            match = re.search(r"(\d{6,})", resp)
            if match:
                serial = match.group(1)
            return {
                "manufacturer": "henry",
                "model": "Henry REP",
                "serial_number": serial,
                "protocol": "tcp_henry",
                "firmware_version": None,
                "details": {"banner": resp[:200]},
            }
        except Exception:
            return None

    def sync_time(self):
        now = datetime.now()
        cmd = "EH+00+RD]" + now.strftime("%d/%m/%Y]%H:%M:%S]")
        return bool(self.send(cmd))

    def collect_records(self, since_nsr=0):
        resp = self.send("RH+00+RP]%d]" % max(int(since_nsr or 0), 0))
        records = []
        for line in resp.splitlines():
            match = re.search(r"(\d+)\]?(\d{2}/\d{2}/\d{4})\s?(\d{2}:\d{2}:\d{2})\]?(\w+)", line)
            if not match:
                continue
            nsr, day, hour, ident = match.groups()
            try:
                dt = datetime.strptime("%s %s" % (day, hour), "%d/%m/%Y %H:%M:%S")
            except ValueError:
                continue
            records.append({
                "identifier": ident,
                "recorded_at": dt.astimezone().isoformat(),
                "nsr": int(nsr),
                "raw": {"line": line[:200]},
            })
        return records

    def push_employee(self, employee):
        pis = (employee.get("pis") or employee.get("registration_number") or "").strip()
        name = (employee.get("name") or "")[:32]
        if not pis:
            return None
        cmd = "EH+00+RC]%s]%s]" % (pis, name)
        self.send(cmd)
        return pis

    def remove_employee(self, employee):
        pis = (employee.get("device_user_id") or employee.get("pis") or "").strip()
        if not pis:
            return False
        self.send("EH+00+RX]%s]" % pis)
        return True

    def reboot(self):
        return bool(self.send("EH+00+RR]"))


class ControlIdDriver(BaseDriver):
    """Control iD iDClass/iDFlex/REP iDX - REST JSON com sessao."""

    name = "control_id"
    default_port = 80
    probe_ports = (80, 443)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.session = None

    def login(self):
        if self.session:
            return self.session
        data = self._http("/login.fcgi", {"login": self.username, "password": self.password})
        self.session = data.get("session")
        return self.session

    def api(self, path, body=None):
        session = self.login()
        sep = "&" if "?" in path else "?"
        return self._http("%s%ssession=%s" % (path, sep, session), body if body is not None else {})

    def identify(self):
        try:
            info = self._http("/system_information.fcgi", {})
            if not isinstance(info, dict) or "raw" in info and len(info) == 1:
                info = self.api("/system_information.fcgi", {})
            if not isinstance(info, dict):
                return None
            return {
                "manufacturer": "control_id",
                "model": info.get("model") or "Control iD",
                "serial_number": info.get("serial") or info.get("device_id"),
                "firmware_version": info.get("version") or info.get("firmware"),
                "protocol": "rest_controlid",
                "details": {k: v for k, v in list(info.items())[:10]},
            }
        except Exception:
            return None

    def sync_time(self):
        try:
            self.api("/set_system_time.fcgi", {"timestamp": int(time.time())})
            return True
        except Exception:
            return False

    def collect_records(self, since_nsr=0):
        try:
            data = self.api("/load_objects.fcgi", {
                "object": "access_logs",
                "order": ["id"],
                "where": {"access_logs": {">id": int(since_nsr or 0)}},
            })
        except Exception:
            return []
        out = []
        for row in (data or {}).get("access_logs", []) or []:
            ts = row.get("time")
            if not ts:
                continue
            dt = datetime.fromtimestamp(int(ts)).astimezone()
            out.append({
                "identifier": str(row.get("user_id") or row.get("identifier") or ""),
                "recorded_at": dt.isoformat(),
                "nsr": int(row.get("id") or 0),
                "raw": {"event": row.get("event")},
            })
        return [r for r in out if r["identifier"]]

    def push_employee(self, employee):
        payload = {
            "object": "users",
            "values": [{
                "name": employee.get("name") or "",
                "registration": employee.get("registration_number") or employee.get("pis") or "",
            }],
        }
        try:
            if employee.get("device_user_id"):
                self.api("/modify_objects.fcgi", {
                    "object": "users",
                    "values": payload["values"][0],
                    "where": {"users": {"id": int(employee["device_user_id"])}},
                })
                return employee["device_user_id"]
            data = self.api("/create_objects.fcgi", payload)
            ids = (data or {}).get("ids") or []
            return str(ids[0]) if ids else None
        except Exception:
            return None

    def remove_employee(self, employee):
        device_id = employee.get("device_user_id")
        if not device_id:
            return False
        try:
            self.api("/destroy_objects.fcgi", {
                "object": "users",
                "where": {"users": {"id": int(device_id)}},
            })
            return True
        except Exception:
            return False

    def reboot(self):
        try:
            self.api("/reboot.fcgi", {})
            return True
        except Exception:
            return False


class ZKTecoDriver(BaseDriver):
    """ZKTeco / Rep iX - protocolo binario 4370 (comandos essenciais)."""

    name = "zkteco"
    default_port = 4370
    probe_ports = (4370,)

    CMD_CONNECT = 1000
    CMD_EXIT = 1001
    CMD_DEVICE = 11
    CMD_SET_TIME = 202
    CMD_RESTART = 1004

    @staticmethod
    def _checksum(buf):
        if len(buf) % 2 == 1:
            buf += b"\x00"
        total = 0
        for i in range(0, len(buf), 2):
            total += struct.unpack("<H", buf[i:i + 2])[0]
        total = (total & 0xFFFF) + (total >> 16)
        return struct.pack("<H", ~total & 0xFFFF)

    def _packet(self, command, session_id=0, reply_id=0, data=b""):
        buf = struct.pack("<HHHH", command, 0, session_id, reply_id) + data
        chk = self._checksum(buf)
        buf = struct.pack("<HH", command, struct.unpack("<H", chk)[0]) + \
            struct.pack("<HH", session_id, reply_id) + data
        return b"\x50\x50\x82\x7d" + struct.pack("<I", len(buf)) + buf

    def identify(self):
        try:
            with socket.create_connection((self.ip, self.port), timeout=self.timeout) as sock:
                sock.settimeout(self.timeout)
                sock.sendall(self._packet(self.CMD_CONNECT))
                resp = sock.recv(1024)
                if not resp or len(resp) < 8:
                    return None
                return {
                    "manufacturer": "zkteco",
                    "model": "ZKTeco / Rep iX",
                    "serial_number": None,
                    "firmware_version": None,
                    "protocol": "zk_4370",
                    "details": {"handshake": resp[:16].hex()},
                }
        except Exception:
            return None

    def sync_time(self):
        try:
            with socket.create_connection((self.ip, self.port), timeout=self.timeout) as sock:
                sock.sendall(self._packet(self.CMD_CONNECT))
                sock.recv(1024)
                now = datetime.now()
                encoded = (((now.year % 100) * 12 * 31 + ((now.month - 1) * 31) + now.day - 1) * 24 * 60 * 60) + \
                    ((now.hour * 60 + now.minute) * 60) + now.second
                sock.sendall(self._packet(self.CMD_SET_TIME, data=struct.pack("<I", encoded)))
                sock.recv(1024)
                return True
        except Exception:
            return False

    def reboot(self):
        try:
            with socket.create_connection((self.ip, self.port), timeout=self.timeout) as sock:
                sock.sendall(self._packet(self.CMD_CONNECT))
                sock.recv(1024)
                sock.sendall(self._packet(self.CMD_RESTART))
                return True
        except Exception:
            return False


class TopdataDriver(BaseDriver):
    """Topdata Inner Rep - TCP binario com STX/ETX."""

    name = "topdata"
    default_port = 3570
    probe_ports = (3570,)

    def identify(self):
        try:
            raw = self._tcp(b"\x02" + b"00" + b"\x03")
            if not raw:
                return None
            return {
                "manufacturer": "topdata",
                "model": "Topdata Inner Rep",
                "serial_number": None,
                "firmware_version": None,
                "protocol": "tcp_topdata",
                "details": {"banner": raw[:32].hex()},
            }
        except Exception:
            return None


class DimepDriver(HenryDriver):
    """Dimep PrintPoint - ASCII proximo do padrao Henry."""

    name = "dimep"
    default_port = 3000
    probe_ports = (3000,)

    def identify(self):
        base = super().identify()
        if not base:
            return None
        banner = str(base.get("details", {}).get("banner", "")).lower()
        if "dimep" not in banner:
            return None
        base["manufacturer"] = "dimep"
        base["model"] = "Dimep PrintPoint"
        return base


class MadisDriver(HenryDriver):
    name = "madis"
    default_port = 3000
    probe_ports = (3000,)

    def identify(self):
        base = super().identify()
        if not base:
            return None
        banner = str(base.get("details", {}).get("banner", "")).lower()
        if "madis" not in banner and "md-" not in banner:
            return None
        base["manufacturer"] = "madis"
        base["model"] = "Madis MD REP"
        return base


class GenericHttpDriver(BaseDriver):
    name = "generic"
    default_port = 80
    probe_ports = (80, 8080)

    def identify(self):
        try:
            scheme = "http"
            url = "%s://%s:%s/" % (scheme, self.ip, self.port)
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read(2048).decode("utf-8", "ignore")
                server = resp.headers.get("Server", "")
            lowered = (body + server).lower()
            vendor = "generic"
            for key in ("henry", "control id", "controlid", "zkteco", "topdata", "dimep", "madis"):
                if key in lowered:
                    vendor = key.replace(" ", "_")
                    break
            return {
                "manufacturer": vendor,
                "model": server or "Dispositivo HTTP",
                "serial_number": None,
                "firmware_version": None,
                "protocol": "http",
                "details": {"server": server},
            }
        except Exception:
            return None


PROTOCOLS = {
    "henry": HenryDriver,
    "control_id": ControlIdDriver,
    "zkteco": ZKTecoDriver,
    "topdata": TopdataDriver,
    "dimep": DimepDriver,
    "madis": MadisDriver,
    "generic": GenericHttpDriver,
}

# Ordem de tentativa na identificacao automatica
PROBE_ORDER = ["henry", "dimep", "madis", "control_id", "zkteco", "topdata", "generic"]
PROBE_PORTS = [3000, 80, 4370, 3570, 443, 8080]


def build_driver(manufacturer, ip, port=None, username="", password=""):
    cls = PROTOCOLS.get((manufacturer or "generic").lower(), GenericHttpDriver)
    return cls(ip, port, username, password)


# --------------------------------------------------------------------------- #
# Descoberta de rede
# --------------------------------------------------------------------------- #
def local_networks():
    nets = []
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        nets.append(str(ipaddress.ip_network(ip + "/24", strict=False)))
    except Exception:
        pass
    return nets or ["192.168.0.0/24"]


def arp_table():
    """Mapa ip -> mac, usado para acompanhar troca de IP por DHCP."""
    table = {}
    try:
        cmd = ["arp", "-a"] if platform.system() == "Windows" else ["arp", "-an"]
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=15).stdout
        for line in out.splitlines():
            ip_match = re.search(r"(\d+\.\d+\.\d+\.\d+)", line)
            mac_match = re.search(r"([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}", line)
            if ip_match and mac_match:
                table[ip_match.group(1)] = mac_match.group(0).replace("-", ":").lower()
    except Exception:
        pass
    return table


def port_open(ip, port, timeout=0.6):
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except Exception:
        return False


def fingerprint(ip, macs):
    open_ports = [p for p in PROBE_PORTS if port_open(ip, p)]
    if not open_ports:
        return None
    for key in PROBE_ORDER:
        cls = PROTOCOLS[key]
        for port in cls.probe_ports:
            if port not in open_ports:
                continue
            info = cls(ip, port).identify()
            if info:
                info.update({
                    "ip_address": ip,
                    "port": port,
                    "mac_address": macs.get(ip),
                    "reachable": True,
                    "device_name": info.get("model"),
                })
                info.setdefault("details", {})["open_ports"] = open_ports
                return info
    return None


def scan_network(ranges=None, workers=64):
    targets = []
    for cidr in (ranges or local_networks()):
        try:
            targets.extend([str(h) for h in ipaddress.ip_network(cidr, strict=False).hosts()])
        except Exception:
            log("Faixa invalida ignorada: %s" % cidr, "WARN")
    macs = arp_table()
    found = []
    log("Varrendo %d enderecos..." % len(targets))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for result in pool.map(lambda ip: fingerprint(ip, macs), targets):
            if result:
                log("Relogio encontrado: %s (%s)" % (result["ip_address"], result["manufacturer"]))
                found.append(result)
    return found


# --------------------------------------------------------------------------- #
# Loop do agente
# --------------------------------------------------------------------------- #
class Agent:
    def __init__(self, cfg):
        self.cfg = cfg
        self.gw = Gateway(cfg)
        self.remote = {}
        self.equipment = []
        self.nsr_state = {}
        self.stop_event = threading.Event()

    # -- helpers -----------------------------------------------------------
    def driver_for(self, equipment):
        return build_driver(
            equipment.get("manufacturer"),
            equipment.get("ip_address") or equipment.get("host"),
            equipment.get("port"),
        )

    def handshake(self):
        data = self.gw.call("handshake", local_ip=self._local_ip())
        if not data or not data.get("success"):
            log("Handshake recusado. Verifique o token do agente.", "ERROR")
            return False
        self.remote = data.get("agent") or {}
        rotation = self.remote.get("token_rotation") or {}
        if rotation.get("new_token"):
            self.gw.adopt_token(rotation["new_token"])
            # Revalida imediatamente com o token novo para efetivar a troca.
            check = self.gw.call("handshake", local_ip=self._local_ip())
            if not check or not check.get("success"):
                log("Falha ao validar token rotacionado.", "ERROR")
                return False
            self.remote = check.get("agent") or self.remote
        log("Conectado ao sistema como agente '%s'" % self.remote.get("name"))
        return True

    @staticmethod
    def _local_ip():
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            sock.close()
            return ip
        except Exception:
            return "127.0.0.1"

    # -- ciclos ------------------------------------------------------------
    def run_discovery(self):
        ranges = self.cfg.get("discovery_ranges") or self.remote.get("discovery_ranges") or []
        devices = scan_network(ranges)
        if devices:
            self.gw.call("discovery", devices=devices, local_ip=self._local_ip())
        else:
            log("Nenhum relogio encontrado na varredura.")
        return devices

    def refresh_equipment(self):
        data = self.gw.call("equipment")
        self.equipment = (data or {}).get("equipment") or []
        return self.equipment

    def collect_all(self):
        for eq in self.equipment:
            if not eq.get("is_active") or not eq.get("ip_address"):
                continue
            driver = self.driver_for(eq)
            try:
                since = self.nsr_state.get(eq["id"], 0)
                records = driver.collect_records(since)
                if records:
                    self.nsr_state[eq["id"]] = max(r.get("nsr") or 0 for r in records)
                    self.gw.call("records", equipment_id=eq["id"], records=records)
                    log("%d marcacao(oes) enviadas de %s" % (len(records), eq.get("name")))
                else:
                    self.gw.call("log", equipment_id=eq["id"], success=True,
                                 message="Coleta sem novas marcacoes")
            except Exception as exc:
                self.gw.call("log", equipment_id=eq["id"], success=False,
                             error_message="Falha na coleta: %s" % exc)

    def push_employees(self):
        data = self.gw.call("employees", limit=100)
        employees = (data or {}).get("employees") or []
        if not employees:
            return
        by_equipment = {}
        for emp in employees:
            by_equipment.setdefault(emp.get("equipment_id"), []).append(emp)

        equipment_index = {e["id"]: e for e in self.equipment}
        for equipment_id, items in by_equipment.items():
            eq = equipment_index.get(equipment_id)
            if not eq:
                for emp in items:
                    self.gw.call("employee_result", sync_id=emp["sync_id"], success=False,
                                 error_message="Equipamento nao encontrado no agente")
                continue
            driver = self.driver_for(eq)
            for emp in items:
                try:
                    if emp.get("operation") == "delete":
                        ok = driver.remove_employee(emp)
                        self.gw.call("employee_result", sync_id=emp["sync_id"], success=bool(ok))
                    else:
                        device_user_id = driver.push_employee(emp)
                        self.gw.call("employee_result", sync_id=emp["sync_id"],
                                     success=device_user_id is not None,
                                     device_user_id=device_user_id or None,
                                     error_message=None if device_user_id else "Relogio recusou o cadastro")
                except Exception as exc:
                    self.gw.call("employee_result", sync_id=emp["sync_id"], success=False,
                                 error_message=str(exc)[:400])
        log("%d funcionario(s) processados para os relogios" % len(employees))

    def run_commands(self):
        data = self.gw.call("pull_commands", limit=20)
        commands = (data or {}).get("commands") or []
        equipment_index = {e["id"]: e for e in self.equipment}
        for cmd in commands:
            name = cmd.get("command")
            eq = equipment_index.get(cmd.get("equipment_id"))
            try:
                if name == "discover":
                    devices = self.run_discovery()
                    self.gw.call("command_result", command_id=cmd["id"], success=True,
                                 result={"devices": len(devices)})
                    continue
                if not eq:
                    raise RuntimeError("Equipamento nao encontrado")
                driver = self.driver_for(eq)
                if name == "test_connection":
                    ok = bool(driver.identify())
                elif name == "sync_time":
                    ok = driver.sync_time()
                elif name == "collect_records":
                    records = driver.collect_records(self.nsr_state.get(eq["id"], 0))
                    if records:
                        self.gw.call("records", equipment_id=eq["id"], records=records)
                    ok = True
                elif name == "push_employees":
                    self.push_employees()
                    ok = True
                elif name == "reboot":
                    ok = driver.reboot()
                else:
                    raise RuntimeError("Comando desconhecido: %s" % name)
                self.gw.call("command_result", command_id=cmd["id"], success=bool(ok),
                             error_message=None if ok else "Relogio nao respondeu")
            except Exception as exc:
                self.gw.call("command_result", command_id=cmd["id"], success=False,
                             error_message=str(exc)[:400])

    def loop(self):
        if not self.handshake():
            return 1
        interval = int(self.remote.get("sync_interval_seconds")
                       or self.cfg.get("sync_interval_seconds") or 60)
        discovery_every = int(self.cfg.get("discovery_interval_seconds") or 900)
        last_discovery = 0

        while not self.stop_event.is_set():
            cycle_started = time.time()
            try:
                self.gw.call("heartbeat", local_ip=self._local_ip())
                self.refresh_equipment()
                if self.remote.get("auto_discovery", True) and \
                        time.time() - last_discovery > discovery_every:
                    self.run_discovery()
                    last_discovery = time.time()
                self.run_commands()
                self.push_employees()
                self.collect_all()
            except Exception as exc:
                log("Erro no ciclo: %s" % exc, "ERROR")
            wait = max(5, interval - int(time.time() - cycle_started))
            self.stop_event.wait(wait)
        return 0


# --------------------------------------------------------------------------- #
# Configuracao assistida
# --------------------------------------------------------------------------- #
def configure():
    cfg = load_config()
    print("=" * 62)
    print(" Ponto Max - Configuracao do Robo de Comunicacao v%s" % AGENT_VERSION)
    print("=" * 62)
    token = input("Token do agente (gerado no sistema): ").strip() or cfg.get("agent_token", "")
    gateway = input("URL do gateway [%s]: " % cfg["gateway_url"]).strip() or cfg["gateway_url"]
    detected = ", ".join(local_networks())
    ranges = input("Faixas de rede para varredura [%s]: " % detected).strip() or detected
    interval = input("Intervalo de sincronizacao em segundos [60]: ").strip() or "60"

    cfg.update({
        "agent_token": token,
        "gateway_url": gateway,
        "discovery_ranges": [r.strip() for r in ranges.split(",") if r.strip()],
        "sync_interval_seconds": int(interval),
    })
    save_config(cfg)
    print("\nConfiguracao salva em %s" % CONFIG_PATH)

    gw = Gateway(cfg)
    data = gw.call("handshake", local_ip=Agent._local_ip())
    if data and data.get("success"):
        print("Conexao validada. Agente: %s" % (data.get("agent") or {}).get("name"))
        print("Executando varredura inicial da rede...")
        devices = scan_network(cfg["discovery_ranges"])
        if devices:
            gw.call("discovery", devices=devices)
            print("%d relogio(s) enviados ao sistema." % len(devices))
        else:
            print("Nenhum relogio encontrado agora - a varredura roda novamente automaticamente.")
        return 0
    print("Nao foi possivel validar o token. Revise os dados e rode novamente com --configure.")
    return 1


def main():
    parser = argparse.ArgumentParser(description="Ponto Max - Robo de Comunicacao")
    parser.add_argument("--configure", action="store_true", help="assistente de configuracao")
    parser.add_argument("--daemon", action="store_true", help="executa em loop continuo")
    parser.add_argument("--service", action="store_true", help="alias de --daemon (servico)")
    parser.add_argument("--scan", nargs="?", const="", help="varre a rede (opcional: CIDR)")
    parser.add_argument("--version", action="store_true")
    args = parser.parse_args()

    if args.version:
        print("Ponto Max Agent %s" % AGENT_VERSION)
        return 0
    if args.configure:
        return configure()

    cfg = load_config()
    if args.scan is not None:
        ranges = [args.scan] if args.scan else (cfg.get("discovery_ranges") or local_networks())
        for device in scan_network(ranges):
            print(json.dumps(device, ensure_ascii=False))
        return 0

    if not cfg.get("agent_token"):
        log("Agente sem token. Execute: pontomax-agent --configure", "ERROR")
        return 1

    agent = Agent(cfg)
    if args.daemon or args.service:
        try:
            return agent.loop()
        except KeyboardInterrupt:
            agent.stop_event.set()
            return 0
    return agent.loop()


if __name__ == "__main__":
    sys.exit(main())
