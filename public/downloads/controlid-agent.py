#!/usr/bin/env python3
"""
Ponto Max - Robo de Comunicacao Control iD (v1.0)
==================================================
Agente local para equipamentos Control iD (iDClass, iDFace, iDAccess, REP iDX,
iDFlex) instalados em rede interna (192.168.x.x), onde a nuvem nao consegue
alcancar o equipamento diretamente.

O que ele faz:
  * Descobre automaticamente equipamentos Control iD na rede local (porta 80).
  * Autentica na API REST (/login.fcgi) e coleta as marcacoes (access_logs / AFD).
  * Envia as marcacoes para a nuvem Ponto Max (funcao equipment-sync).
  * Sincroniza o relogio dos equipamentos com o horario oficial.
  * Opcionalmente espelha as marcacoes vindas da Control iD Cloud (iD Cloud).
  * Instala-se como servico do Windows automaticamente (--install-service).

Uso:
    python controlid-agent.py --config config.json
    python controlid-agent.py --discover
    python controlid-agent.py --install-service

Requisitos: Python 3.8+ e `pip install requests` (pywin32 apenas para servico).
"""

import argparse
import ipaddress
import json
import logging
import os
import socket
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

try:
    import requests
except ImportError:  # pragma: no cover
    print("Instalando dependencia 'requests'...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

APP_NAME = "PontoMaxControlIDAgent"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "controlid-config.json")
LOG_PATH = os.path.join(BASE_DIR, "controlid-agent.log")
STATE_PATH = os.path.join(BASE_DIR, "controlid-state.json")

DEFAULT_CONFIG = {
    "cloud_url": "https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/equipment-sync",
    "cloud_api_key": "",              # chave do equipamento/empresa gerada no Ponto Max
    "company_id": "",
    "poll_interval_seconds": 60,
    "clock_sync_hours": 12,
    "network_scan": True,
    "network_cidr": "",               # ex.: 192.168.0.0/24 (vazio = detecta sozinho)
    "devices": [
        # {"name": "REP Recepcao", "host": "192.168.0.50", "port": 80,
        #  "username": "admin", "password": "admin", "equipment_id": "",
        #  "use_https": false, "afd_mode": "671"}
    ],
    "idcloud": {
        "enabled": False,
        "base_url": "https://api.idcloud.controlid.com.br",
        "token": "",
        "organization_id": ""
    }
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_PATH, encoding="utf-8"), logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(APP_NAME)


# --------------------------------------------------------------------------- #
# Config / state
# --------------------------------------------------------------------------- #
def load_config(path=CONFIG_PATH):
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(DEFAULT_CONFIG, fh, indent=2, ensure_ascii=False)
        log.warning("Arquivo de configuracao criado em %s — preencha e execute novamente.", path)
        return dict(DEFAULT_CONFIG)
    with open(path, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    merged = dict(DEFAULT_CONFIG)
    merged.update(cfg)
    return merged


def load_state():
    if os.path.exists(STATE_PATH):
        try:
            with open(STATE_PATH, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            pass
    return {}


def save_state(state):
    with open(STATE_PATH, "w", encoding="utf-8") as fh:
        json.dump(state, fh, indent=2)


# --------------------------------------------------------------------------- #
# Control iD local REST client
# --------------------------------------------------------------------------- #
class ControlIdDevice:
    def __init__(self, cfg):
        self.name = cfg.get("name") or cfg["host"]
        self.host = cfg["host"]
        self.port = int(cfg.get("port") or 80)
        self.username = cfg.get("username") or "admin"
        self.password = cfg.get("password") or "admin"
        self.equipment_id = cfg.get("equipment_id") or ""
        self.afd_mode = str(cfg.get("afd_mode") or "671")
        scheme = "https" if cfg.get("use_https") else "http"
        default_port = 443 if cfg.get("use_https") else 80
        host_part = self.host if self.port == default_port else f"{self.host}:{self.port}"
        self.base = f"{scheme}://{host_part}"
        self.session = None

    def login(self):
        res = requests.post(
            f"{self.base}/login.fcgi",
            json={"login": self.username, "password": self.password},
            timeout=10,
            verify=False,
        )
        res.raise_for_status()
        self.session = res.json().get("session")
        if not self.session:
            raise RuntimeError("Equipamento nao retornou sessao")
        return self.session

    def call(self, endpoint, payload=None):
        if not self.session:
            self.login()
        url = f"{self.base}/{endpoint.lstrip('/')}?session={self.session}"
        res = requests.post(url, json=payload or {}, timeout=20, verify=False)
        if res.status_code in (401, 403):  # sessao expirou
            self.login()
            url = f"{self.base}/{endpoint.lstrip('/')}?session={self.session}"
            res = requests.post(url, json=payload or {}, timeout=20, verify=False)
        res.raise_for_status()
        try:
            return res.json()
        except ValueError:
            return {"raw": res.text}

    def info(self):
        return self.call("get_system_information.fcgi")

    def set_time(self, when=None):
        when = when or datetime.now()
        return self.call("set_system_time.fcgi", {"time": int(when.timestamp())})

    def access_logs(self, since_epoch=None):
        payload = {"object": "access_logs"}
        if since_epoch:
            payload["where"] = {"access_logs": {">=": {"time": int(since_epoch)}}}
        data = self.call("load_objects.fcgi", payload)
        return data.get("access_logs", [])

    def afd(self):
        if not self.session:
            self.login()
        url = f"{self.base}/get_afd.fcgi?session={self.session}&mode={self.afd_mode}"
        res = requests.get(url, timeout=60, verify=False)
        res.raise_for_status()
        return res.text


def parse_afd(text, mode="671"):
    """Converte linhas AFD (Portaria 671 ou 1510) em marcacoes normalizadas."""
    records = []
    for line in text.splitlines():
        line = line.strip()
        if len(line) < 34:
            continue
        nsr, tipo = line[:9], line[9:10]
        try:
            if tipo == "3":  # 1510
                d, m, y = int(line[10:12]), int(line[12:14]), int(line[14:18])
                hh, mm = int(line[18:20]), int(line[20:22])
                pis = line[22:34].lstrip("0")
                ts = datetime(y, m, d, hh, mm)
            elif tipo == "7":  # 671
                ts = datetime.fromisoformat(line[10:34])
                pis = line[34:46].lstrip("0")
            else:
                continue
        except Exception:
            continue
        if pis:
            records.append({"identifier": pis, "recorded_at": ts.isoformat(), "nsr": nsr})
    return records


# --------------------------------------------------------------------------- #
# iD Cloud client
# --------------------------------------------------------------------------- #
class IdCloudClient:
    def __init__(self, cfg):
        self.base = (cfg.get("base_url") or "https://api.idcloud.controlid.com.br").rstrip("/")
        self.token = cfg.get("token") or ""
        self.org = cfg.get("organization_id") or ""

    @property
    def headers(self):
        headers = {
            "Authorization": f"Bearer {self.token}",
            "X-Access-Token": self.token,
            "Content-Type": "application/json",
        }
        if self.org:
            headers["X-Organization-Id"] = self.org
        return headers

    def get(self, path, params=None):
        params = dict(params or {})
        if self.org:
            params.setdefault("organization_id", self.org)
        res = requests.get(f"{self.base}/{path.lstrip('/')}", headers=self.headers, params=params, timeout=30)
        res.raise_for_status()
        return res.json()

    def devices(self):
        return self.get("devices")

    def access_logs(self, since=None):
        params = {}
        if since:
            params["start_date"] = since.isoformat()
        payload = self.get("access_logs", params)
        if isinstance(payload, list):
            return payload
        return payload.get("access_logs") or payload.get("data") or []


# --------------------------------------------------------------------------- #
# Cloud upload (Ponto Max)
# --------------------------------------------------------------------------- #
def push_records(cfg, equipment_id, records):
    if not records:
        return 0
    payload = {
        "action": "push_records",
        "equipment_id": equipment_id,
        "company_id": cfg.get("company_id") or None,
        "source": "controlid_agent",
        "records": records,
    }
    headers = {"Content-Type": "application/json"}
    if cfg.get("cloud_api_key"):
        headers["x-api-key"] = cfg["cloud_api_key"]
        headers["Authorization"] = f"Bearer {cfg['cloud_api_key']}"
    res = requests.post(cfg["cloud_url"], json=payload, headers=headers, timeout=60)
    if res.status_code >= 300:
        log.error("Falha ao enviar marcacoes (%s): %s", res.status_code, res.text[:300])
        return 0
    log.info("Enviadas %d marcacoes do equipamento %s", len(records), equipment_id or "-")
    return len(records)


# --------------------------------------------------------------------------- #
# Network discovery
# --------------------------------------------------------------------------- #
def local_cidr():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return f"{ip.rsplit('.', 1)[0]}.0/24"
    except Exception:
        return "192.168.0.0/24"


def probe(ip, timeout=0.6):
    try:
        with socket.create_connection((ip, 80), timeout=timeout):
            pass
    except Exception:
        return None
    try:
        res = requests.post(
            f"http://{ip}/login.fcgi",
            json={"login": "admin", "password": "admin"},
            timeout=3,
        )
        if res.status_code < 500 and ("session" in res.text or "error" in res.text.lower()):
            return {"host": ip, "port": 80, "detected": "control_id"}
    except Exception:
        return None
    return None


def discover(cidr=None):
    network = ipaddress.ip_network(cidr or local_cidr(), strict=False)
    log.info("Varrendo %s em busca de equipamentos Control iD...", network)
    found = []
    with ThreadPoolExecutor(max_workers=64) as pool:
        for result in pool.map(probe, [str(h) for h in network.hosts()]):
            if result:
                log.info("Encontrado Control iD em %s", result["host"])
                found.append(result)
    return found


# --------------------------------------------------------------------------- #
# Main loop
# --------------------------------------------------------------------------- #
def collect_device(cfg, device_cfg, state):
    device = ControlIdDevice(device_cfg)
    key = f"{device.host}:{device.port}"
    last_epoch = state.get(key, {}).get("last_epoch")
    try:
        logs = device.access_logs(last_epoch)
        records = []
        newest = last_epoch or 0
        for entry in logs:
            epoch = int(entry.get("time") or entry.get("timestamp") or 0)
            identifier = str(entry.get("user_id") or entry.get("pis") or "")
            if not identifier or epoch <= 0:
                continue
            newest = max(newest, epoch)
            records.append({
                "identifier": identifier,
                "recorded_at": datetime.fromtimestamp(epoch).isoformat(),
                "nsr": str(entry.get("id") or ""),
            })
        if not records:
            # fallback: AFD completo (REP-P)
            try:
                records = parse_afd(device.afd(), device.afd_mode)
            except Exception:
                pass
        sent = push_records(cfg, device.equipment_id, records)
        state[key] = {"last_epoch": newest, "last_success": datetime.now().isoformat(), "sent": sent}
        log.info("[%s] %d marcacoes coletadas", device.name, len(records))
    except Exception as exc:
        log.error("[%s] erro: %s", device.name, exc)
        state[key] = {**state.get(key, {}), "last_error": str(exc), "last_error_at": datetime.now().isoformat()}
    return device


def collect_cloud(cfg, state):
    cloud_cfg = cfg.get("idcloud") or {}
    if not cloud_cfg.get("enabled") or not cloud_cfg.get("token"):
        return
    client = IdCloudClient(cloud_cfg)
    since_raw = state.get("_idcloud_since")
    since = datetime.fromisoformat(since_raw) if since_raw else datetime.now(timezone.utc) - timedelta(days=1)
    try:
        logs = client.access_logs(since)
        records = []
        for entry in logs:
            raw_time = entry.get("time") or entry.get("timestamp") or entry.get("date_time") or entry.get("created_at")
            if isinstance(raw_time, (int, float)):
                ts = datetime.fromtimestamp(raw_time)
            else:
                try:
                    ts = datetime.fromisoformat(str(raw_time).replace("Z", "+00:00"))
                except Exception:
                    continue
            identifier = str(entry.get("pis") or entry.get("user_id") or entry.get("registration") or "")
            if identifier:
                records.append({"identifier": identifier, "recorded_at": ts.isoformat(),
                                "nsr": str(entry.get("nsr") or "")})
        push_records(cfg, cfg.get("cloud_equipment_id", ""), records)
        state["_idcloud_since"] = datetime.now(timezone.utc).isoformat()
        log.info("[iD Cloud] %d marcacoes espelhadas", len(records))
    except Exception as exc:
        log.error("[iD Cloud] erro: %s", exc)


def run(config_path=CONFIG_PATH, once=False):
    cfg = load_config(config_path)
    state = load_state()
    last_clock_sync = None

    if cfg.get("network_scan") and not cfg.get("devices"):
        for found in discover(cfg.get("network_cidr") or None):
            cfg.setdefault("devices", []).append({
                "name": f"Control iD {found['host']}",
                "host": found["host"], "port": 80,
                "username": "admin", "password": "admin", "equipment_id": "",
            })

    log.info("Agente Control iD iniciado com %d equipamento(s)", len(cfg.get("devices", [])))

    while True:
        devices = []
        for device_cfg in cfg.get("devices", []):
            devices.append(collect_device(cfg, device_cfg, state))
        collect_cloud(cfg, state)

        hours = float(cfg.get("clock_sync_hours") or 12)
        if hours > 0 and (last_clock_sync is None or datetime.now() - last_clock_sync > timedelta(hours=hours)):
            for device in devices:
                try:
                    device.set_time()
                    log.info("[%s] relogio sincronizado", device.name)
                except Exception as exc:
                    log.warning("[%s] falha ao sincronizar relogio: %s", device.name, exc)
            last_clock_sync = datetime.now()

        save_state(state)
        if once:
            return
        time.sleep(int(cfg.get("poll_interval_seconds") or 60))


# --------------------------------------------------------------------------- #
# Windows service installation
# --------------------------------------------------------------------------- #
def install_service():
    if os.name != "nt":
        log.error("Instalacao de servico disponivel apenas no Windows.")
        return
    try:
        import win32serviceutil  # noqa: F401
    except ImportError:
        log.info("Instalando pywin32...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pywin32"])

    python_exe = sys.executable.replace("python.exe", "pythonw.exe")
    script = os.path.abspath(__file__)
    cmd = f'"{python_exe}" "{script}" --config "{CONFIG_PATH}"'
    subprocess.run(["sc", "stop", APP_NAME], capture_output=True)
    subprocess.run(["sc", "delete", APP_NAME], capture_output=True)
    result = subprocess.run(
        ["sc", "create", APP_NAME, f"binPath= {cmd}", "start= auto",
         "DisplayName= Ponto Max - Agente Control iD"],
        capture_output=True, text=True,
    )
    log.info(result.stdout or result.stderr)
    subprocess.run(["sc", "failure", APP_NAME, "reset= 60", "actions= restart/5000/restart/5000/restart/5000"],
                   capture_output=True)
    subprocess.run(["sc", "start", APP_NAME], capture_output=True)
    log.info("Servico '%s' instalado e iniciado.", APP_NAME)


def main():
    parser = argparse.ArgumentParser(description="Ponto Max - Agente Control iD")
    parser.add_argument("--config", default=CONFIG_PATH, help="Caminho do arquivo de configuracao")
    parser.add_argument("--discover", action="store_true", help="Apenas varrer a rede local")
    parser.add_argument("--once", action="store_true", help="Executa um ciclo e encerra")
    parser.add_argument("--install-service", action="store_true", help="Instala como servico do Windows")
    args = parser.parse_args()

    if args.install_service:
        install_service()
        return
    if args.discover:
        print(json.dumps(discover(), indent=2))
        return
    run(args.config, once=args.once)


if __name__ == "__main__":
    try:
        requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]
    except Exception:
        pass
    main()
