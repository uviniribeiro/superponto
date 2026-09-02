#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ponto Max - Gerador do instalador do Robo de Comunicacao
========================================================
Compila o agente local em um unico executavel (.exe no Windows) e
gera o script NSIS do instalador, que ja:

  * copia os arquivos para "Arquivos de Programas\\PontoMax Agent"
  * abre o assistente de configuracao (token + rede a varrer)
  * registra e inicia o servico do Windows (inicializacao automatica)
  * cria atalhos no menu iniciar

Uso:
    python build-pontomax-installer.py            compila para o SO atual
    python build-pontomax-installer.py --nsis     apenas gera o script NSIS
"""

import argparse
import os
import platform
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
AGENT = HERE / "pontomax-agent.py"
SERVICE = HERE / "pontomax-agent-service.py"
APP_NAME = "PontoMaxAgent"
VERSION = "3.0.0"


def ensure_pyinstaller():
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("Instalando PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])


def build_executable():
    if not AGENT.exists():
        print(f"Erro: {AGENT.name} nao encontrado.")
        return False

    ensure_pyinstaller()
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--clean", "--onefile",
        "--name", APP_NAME,
        "--add-data", f"{AGENT}{os.pathsep}.",
    ]
    if platform.system() == "Windows":
        cmd += [
            "--hidden-import", "win32timezone",
            "--hidden-import", "win32serviceutil",
            "--hidden-import", "win32service",
            "--hidden-import", "win32event",
            "--hidden-import", "servicemanager",
            str(SERVICE),
        ]
    else:
        cmd += [str(AGENT)]

    print("Compilando executavel...")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print("Falha na compilacao.")
        return False

    out = Path("dist") / (f"{APP_NAME}.exe" if platform.system() == "Windows" else APP_NAME)
    if out.exists():
        if platform.system() != "Windows":
            os.chmod(out, 0o755)
        print(f"OK: {out} ({out.stat().st_size / 1024 / 1024:.1f} MB)")
    return True


NSIS_TEMPLATE = r'''
; Instalador do Robo de Comunicacao Ponto Max (wizard: token, empresa e rede)
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Name "Ponto Max - Robo de Comunicacao"
OutFile "PontoMaxAgentInstaller.exe"
InstallDir "$PROGRAMFILES64\PontoMax Agent"
RequestExecutionLevel admin
Unicode true

Var Dialog
Var TokenBox
Var EmpresaBox
Var CnpjBox
Var RangesBox
Var Token
Var Empresa
Var Cnpj
Var Ranges

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom ConfigPage ConfigPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Function ConfigPage
    !insertmacro MUI_HEADER_TEXT "Configuracao do robo" "Informe o token, a empresa e as faixas de rede."
    nsDialogs::Create 1018
    Pop $Dialog
    ${If} $Dialog == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 12u "Token do agente (gerado em Equipamentos > Robo de Comunicacao):"
    Pop $0
    ${NSD_CreateText} 0 14u 100% 12u ""
    Pop $TokenBox

    ${NSD_CreateLabel} 0 34u 100% 12u "Empresa (razao social):"
    Pop $0
    ${NSD_CreateText} 0 48u 100% 12u ""
    Pop $EmpresaBox

    ${NSD_CreateLabel} 0 68u 100% 12u "CNPJ (aceita formato alfanumerico):"
    Pop $0
    ${NSD_CreateText} 0 82u 100% 12u ""
    Pop $CnpjBox

    ${NSD_CreateLabel} 0 102u 100% 12u "Faixas de rede a varrer (ex: 192.168.0.0/24, 10.0.1.0/24):"
    Pop $0
    ${NSD_CreateText} 0 116u 100% 12u ""
    Pop $RangesBox

    nsDialogs::Show
FunctionEnd

Function ConfigPageLeave
    ${NSD_GetText} $TokenBox $Token
    ${NSD_GetText} $EmpresaBox $Empresa
    ${NSD_GetText} $CnpjBox $Cnpj
    ${NSD_GetText} $RangesBox $Ranges
    ${If} $Token == ""
        MessageBox MB_ICONEXCLAMATION "Informe o token do agente para continuar."
        Abort
    ${EndIf}
FunctionEnd

Section "Principal"
    SetOutPath $INSTDIR
    File "dist\__APP__.exe"
    File /nonfatal "pontomax-agent.py"
    File /nonfatal "README.txt"

    ; Grava a configuracao (token, empresa e faixas) sem perguntas
    nsExec::ExecToLog '"$INSTDIR\__APP__.exe" --configure --sim --token "$Token" --empresa "$Empresa" --cnpj "$Cnpj" --ranges "$Ranges"'
    Pop $0

    CreateDirectory "$SMPROGRAMS\Ponto Max Agent"
    CreateShortcut "$SMPROGRAMS\Ponto Max Agent\Configurar Agente.lnk" "$INSTDIR\__APP__.exe" "--configure"
    CreateShortcut "$SMPROGRAMS\Ponto Max Agent\Varrer a rede.lnk" "$INSTDIR\__APP__.exe" "--scan"
    CreateShortcut "$SMPROGRAMS\Ponto Max Agent\Desinstalar.lnk" "$INSTDIR\uninstall.exe"

    ; Servico do Windows com inicializacao automatica
    nsExec::ExecToLog '"$INSTDIR\__APP__.exe" install'
    nsExec::ExecToLog 'sc config __APP__ start= auto'
    nsExec::ExecToLog 'sc failure __APP__ reset= 60 actions= restart/15000/restart/15000/restart/30000'
    nsExec::ExecToLog '"$INSTDIR\__APP__.exe" start'

    WriteUninstaller "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\__APP__" "DisplayName" "Ponto Max - Robo de Comunicacao"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\__APP__" "DisplayVersion" "__VERSION__"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\__APP__" "UninstallString" "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
    nsExec::ExecToLog '"$INSTDIR\__APP__.exe" stop'
    nsExec::ExecToLog '"$INSTDIR\__APP__.exe" remove'
    Delete "$INSTDIR\*.*"
    RMDir "$INSTDIR"
    RMDir /r "$SMPROGRAMS\Ponto Max Agent"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\__APP__"
SectionEnd
'''


def write_nsis():
    script = NSIS_TEMPLATE.replace("__APP__", APP_NAME).replace("__VERSION__", VERSION)
    path = HERE / "pontomax-agent-installer.nsi"
    path.write_text(script, encoding="utf-8")
    print(f"Script NSIS gerado: {path}")
    print("Compile com: makensis pontomax-agent-installer.nsi")


def main():
    parser = argparse.ArgumentParser(description="Gerar instalador do Robo Ponto Max")
    parser.add_argument("--nsis", action="store_true", help="apenas gerar o script NSIS")
    args = parser.parse_args()

    if args.nsis:
        write_nsis()
        return

    if build_executable() and platform.system() == "Windows":
        write_nsis()


if __name__ == "__main__":
    main()
