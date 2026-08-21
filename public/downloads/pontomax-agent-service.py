#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ponto Max - Wrapper de Servico do Windows para o Robo de Comunicacao
====================================================================
Registra o agente (pontomax-agent.py) como servico do Windows, com
inicializacao automatica junto com o sistema operacional.

Uso (prompt como Administrador):
    python pontomax-agent-service.py install     instala o servico
    python pontomax-agent-service.py start       inicia
    python pontomax-agent-service.py stop        para
    python pontomax-agent-service.py restart     reinicia
    python pontomax-agent-service.py remove      remove o servico

Quando compilado com PyInstaller (PontoMaxAgentSetup.exe), os mesmos
argumentos funcionam: PontoMaxAgentSetup.exe install / start / remove.
"""

import os
import sys
import time
import threading
import subprocess

SERVICE_NAME = "PontoMaxAgent"
SERVICE_DISPLAY = "Ponto Max - Robo de Comunicacao"
SERVICE_DESC = (
    "Descobre relogios de ponto na rede, mantem o IP atualizado (DHCP), "
    "envia o cadastro de funcionarios e coleta as marcacoes para o Ponto Max."
)

BASE_DIR = os.path.dirname(os.path.abspath(sys.argv[0]))
AGENT_SCRIPT = os.path.join(BASE_DIR, "pontomax-agent.py")


def _agent_command():
    """Comando usado para executar o agente em modo daemon."""
    frozen = getattr(sys, "frozen", False)
    if frozen and not os.path.exists(AGENT_SCRIPT):
        # Executavel unico: o proprio binario roda o agente com --daemon
        return [sys.executable, "--daemon"]
    return [sys.executable if not frozen else "python", AGENT_SCRIPT, "--daemon"]


try:
    import win32serviceutil
    import win32service
    import win32event
    import servicemanager

    class PontoMaxAgentService(win32serviceutil.ServiceFramework):
        _svc_name_ = SERVICE_NAME
        _svc_display_name_ = SERVICE_DISPLAY
        _svc_description_ = SERVICE_DESC

        def __init__(self, args):
            win32serviceutil.ServiceFramework.__init__(self, args)
            self.stop_event = win32event.CreateEvent(None, 0, 0, None)
            self.process = None
            self.running = True

        def SvcStop(self):
            self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
            self.running = False
            if self.process and self.process.poll() is None:
                try:
                    self.process.terminate()
                except Exception:
                    pass
            win32event.SetEvent(self.stop_event)

        def SvcDoRun(self):
            servicemanager.LogMsg(
                servicemanager.EVENTLOG_INFORMATION_TYPE,
                servicemanager.PYS_SERVICE_STARTED,
                (self._svc_name_, ""),
            )
            threading.Thread(target=self.main, daemon=True).start()
            win32event.WaitForSingleObject(self.stop_event, win32event.INFINITE)

        def main(self):
            """Mantem o agente rodando; reinicia automaticamente se cair."""
            while self.running:
                try:
                    self.process = subprocess.Popen(
                        _agent_command(),
                        cwd=BASE_DIR,
                        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                    )
                    self.process.wait()
                except Exception as exc:  # noqa: BLE001
                    servicemanager.LogErrorMsg(f"Falha no agente: {exc}")
                if self.running:
                    time.sleep(15)  # backoff antes de reiniciar

    HAS_WIN32 = True
except ImportError:  # Linux/macOS ou pywin32 ausente
    HAS_WIN32 = False


def install_pywin32():
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pywin32"])


def main():
    if not HAS_WIN32:
        if sys.platform == "win32":
            print("pywin32 nao encontrado. Instalando...")
            install_pywin32()
            print("Reexecute este comando apos a instalacao.")
            return
        print("Em Linux use o servico systemd: pontomax-agent.service")
        return

    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(PontoMaxAgentService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(PontoMaxAgentService)


if __name__ == "__main__":
    main()
