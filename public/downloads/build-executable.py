#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para compilar o Agente de Equipamentos em executável
Gera .exe para Windows e binário para Linux
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_pyinstaller():
    """Verifica e instala PyInstaller se necessário"""
    try:
        import PyInstaller
        print("✓ PyInstaller encontrado")
        return True
    except ImportError:
        print("Instalando PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        return True

def build_windows():
    """Compila para Windows (.exe)"""
    print("\n" + "="*60)
    print("COMPILANDO PARA WINDOWS")
    print("="*60)
    
    # Verificar se existe o arquivo fonte
    service_file = Path("equipment-service.py")
    if not service_file.exists():
        print(f"Erro: {service_file} não encontrado!")
        return False
    
    # Comando PyInstaller para Windows
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--windowed",  # Sem console (roda em background)
        "--name", "EquipmentAgentSetup",
        "--icon", "icon.ico" if Path("icon.ico").exists() else "NONE",
        "--add-data", "README.txt;." if Path("README.txt").exists() else "",
        "--hidden-import", "win32timezone",
        "--hidden-import", "win32serviceutil",
        "--hidden-import", "win32service",
        "--hidden-import", "win32event",
        "--hidden-import", "servicemanager",
        "equipment-service.py"
    ]
    
    # Remover argumentos vazios
    cmd = [c for c in cmd if c]
    
    try:
        subprocess.run(cmd, check=True)
        print("\n✓ Executável Windows criado: dist/EquipmentAgentSetup.exe")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Erro na compilação: {e}")
        return False

def build_linux():
    """Compila para Linux"""
    print("\n" + "="*60)
    print("COMPILANDO PARA LINUX")
    print("="*60)
    
    # Verificar se existe o arquivo fonte
    agent_file = Path("equipment-agent-linux.py")
    if not agent_file.exists():
        print(f"Erro: {agent_file} não encontrado!")
        return False
    
    # Comando PyInstaller para Linux
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "equipment-agent",
        "equipment-agent-linux.py"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        
        # Tornar executável
        exe_path = Path("dist/equipment-agent")
        if exe_path.exists():
            os.chmod(exe_path, 0o755)
        
        print("\n✓ Executável Linux criado: dist/equipment-agent")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Erro na compilação: {e}")
        return False

def create_installer_nsis():
    """Cria script NSIS para instalador Windows profissional"""
    nsis_script = '''
; Instalador do Agente de Equipamentos REP
; Requer NSIS (https://nsis.sourceforge.io/)

!include "MUI2.nsh"
!include "nsDialogs.nsh"

Name "Agente de Equipamentos REP"
OutFile "EquipmentAgentInstaller.exe"
InstallDir "$PROGRAMFILES\\EquipmentAgent"
RequestExecutionLevel admin

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "PortugueseBR"

Section "Principal"
    SetOutPath $INSTDIR
    
    ; Copiar arquivos
    File "dist\\EquipmentAgentSetup.exe"
    File "README.txt"
    
    ; Criar atalho
    CreateDirectory "$SMPROGRAMS\\Agente de Equipamentos"
    CreateShortcut "$SMPROGRAMS\\Agente de Equipamentos\\Dashboard.lnk" "http://localhost:8765"
    CreateShortcut "$SMPROGRAMS\\Agente de Equipamentos\\Desinstalar.lnk" "$INSTDIR\\uninstall.exe"
    
    ; Instalar serviço
    nsExec::ExecToLog '"$INSTDIR\\EquipmentAgentSetup.exe" install'
    nsExec::ExecToLog '"$INSTDIR\\EquipmentAgentSetup.exe" start'
    
    ; Criar desinstalador
    WriteUninstaller "$INSTDIR\\uninstall.exe"
    
    ; Registro
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\EquipmentAgent" "DisplayName" "Agente de Equipamentos REP"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\EquipmentAgent" "UninstallString" "$INSTDIR\\uninstall.exe"
SectionEnd

Section "Uninstall"
    ; Parar e remover serviço
    nsExec::ExecToLog '"$INSTDIR\\EquipmentAgentSetup.exe" stop'
    nsExec::ExecToLog '"$INSTDIR\\EquipmentAgentSetup.exe" remove'
    
    ; Remover arquivos
    Delete "$INSTDIR\\*.*"
    RMDir "$INSTDIR"
    
    ; Remover atalhos
    RMDir /r "$SMPROGRAMS\\Agente de Equipamentos"
    
    ; Remover registro
    DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\EquipmentAgent"
SectionEnd
'''
    
    with open("installer.nsi", "w", encoding="utf-8") as f:
        f.write(nsis_script)
    
    print("\n✓ Script NSIS criado: installer.nsi")
    print("  Para compilar o instalador, instale NSIS e execute:")
    print("  makensis installer.nsi")

def create_deb_package():
    """Cria estrutura para pacote .deb"""
    deb_dir = Path("deb-package")
    
    # Criar estrutura de diretórios
    (deb_dir / "DEBIAN").mkdir(parents=True, exist_ok=True)
    (deb_dir / "usr/local/bin").mkdir(parents=True, exist_ok=True)
    (deb_dir / "etc/systemd/system").mkdir(parents=True, exist_ok=True)
    (deb_dir / "etc/equipment-agent").mkdir(parents=True, exist_ok=True)
    
    # Arquivo de controle
    control = '''Package: equipment-agent
Version: 1.0.0
Section: utils
Priority: optional
Architecture: amd64
Maintainer: Seu Nome <seu@email.com>
Description: Agente de Sincronização de Equipamentos REP
 Detecta automaticamente relógios de ponto na rede
 e sincroniza com o sistema de ponto eletrônico.
'''
    
    with open(deb_dir / "DEBIAN/control", "w") as f:
        f.write(control)
    
    # Script pós-instalação
    postinst = '''#!/bin/bash
set -e

# Criar usuário se não existir
if ! id "equipment-agent" &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin equipment-agent
fi

# Criar diretórios
mkdir -p /var/lib/equipment-agent
mkdir -p /var/log/equipment-agent
chown -R equipment-agent:equipment-agent /var/lib/equipment-agent
chown -R equipment-agent:equipment-agent /var/log/equipment-agent
chown -R equipment-agent:equipment-agent /etc/equipment-agent

# Habilitar e iniciar serviço
systemctl daemon-reload
systemctl enable equipment-agent
systemctl start equipment-agent

echo "Agente de Equipamentos instalado com sucesso!"
echo "Dashboard: http://localhost:8765"
'''
    
    with open(deb_dir / "DEBIAN/postinst", "w") as f:
        f.write(postinst)
    os.chmod(deb_dir / "DEBIAN/postinst", 0o755)
    
    # Script pré-remoção
    prerm = '''#!/bin/bash
set -e
systemctl stop equipment-agent || true
systemctl disable equipment-agent || true
'''
    
    with open(deb_dir / "DEBIAN/prerm", "w") as f:
        f.write(prerm)
    os.chmod(deb_dir / "DEBIAN/prerm", 0o755)
    
    print("\n✓ Estrutura do pacote .deb criada em: deb-package/")
    print("  Copie o executável para deb-package/usr/local/bin/equipment-agent")
    print("  Copie o arquivo .service para deb-package/etc/systemd/system/")
    print("  Para criar o pacote: dpkg-deb --build deb-package equipment-agent_1.0.0_amd64.deb")

def main():
    print("╔═══════════════════════════════════════════════════════════════╗")
    print("║     COMPILADOR DO AGENTE DE EQUIPAMENTOS REP                 ║")
    print("╚═══════════════════════════════════════════════════════════════╝")
    print()
    
    # Verificar PyInstaller
    if not check_pyinstaller():
        print("Erro: Não foi possível instalar PyInstaller")
        sys.exit(1)
    
    # Detectar sistema operacional
    if sys.platform == "win32":
        print("\nSistema detectado: Windows")
        build_windows()
        create_installer_nsis()
    else:
        print("\nSistema detectado: Linux/Mac")
        build_linux()
        create_deb_package()
    
    print("\n" + "="*60)
    print("COMPILAÇÃO CONCLUÍDA!")
    print("="*60)
    print("\nOs executáveis estão na pasta 'dist/'")
    print("\nPara distribuição:")
    print("  Windows: Use NSIS para criar instalador profissional")
    print("  Linux: Use dpkg-deb para criar pacote .deb")
    print("         Ou distribua o binário com o script install-linux.sh")

if __name__ == "__main__":
    main()
