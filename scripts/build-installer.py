#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SuperPonto - Gerador de Executável
Cria um instalador executável para Windows, Linux e macOS
"""

import os
import sys
import shutil
import subprocess
import platform
from pathlib import Path
import argparse

def create_spec_file():
    """Cria arquivo .spec para PyInstaller"""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['scripts/install-database.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('supabase/migrations', 'supabase/migrations'),
        ('scripts/setup-database.sql', 'scripts'),
        ('server', 'server'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='SuperPonto-Installer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='public/favicon.ico' if os.path.exists('public/favicon.ico') else None,
)
'''
    
    with open('superponto-installer.spec', 'w') as f:
        f.write(spec_content)
    
    print("✓ Arquivo .spec criado")

def build_executable():
    """Compila o executável usando PyInstaller"""
    
    # Instalar PyInstaller se necessário
    try:
        import PyInstaller
    except ImportError:
        print("Instalando PyInstaller...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'], check=True)
    
    # Criar spec file
    create_spec_file()
    
    # Compilar
    print("\nCompilando executável...")
    result = subprocess.run([
        sys.executable, '-m', 'PyInstaller',
        '--clean',
        '--onefile',
        'superponto-installer.spec'
    ])
    
    if result.returncode == 0:
        system = platform.system()
        if system == 'Windows':
            exe_name = 'SuperPonto-Installer.exe'
        else:
            exe_name = 'SuperPonto-Installer'
        
        exe_path = Path('dist') / exe_name
        
        if exe_path.exists():
            print(f"\n✓ Executável criado: {exe_path}")
            print(f"  Tamanho: {exe_path.stat().st_size / 1024 / 1024:.2f} MB")
            return str(exe_path)
    
    print("✗ Falha ao criar executável")
    return None

def create_inno_setup_script():
    """Cria script Inno Setup para instalador Windows profissional"""
    
    iss_content = '''[Setup]
AppName=SuperPonto
AppVersion=1.0.0
AppPublisher=SuperPonto
AppPublisherURL=https://superponto.lovable.app
AppSupportURL=https://superponto.lovable.app
AppUpdatesURL=https://superponto.lovable.app
DefaultDirName={autopf}\\SuperPonto
DefaultGroupName=SuperPonto
AllowNoIcons=yes
LicenseFile=LICENSE.txt
OutputDir=dist
OutputBaseFilename=SuperPonto-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\\SuperPonto-Installer.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "server\\*"; DestDir: "{app}\\server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "supabase\\migrations\\*"; DestDir: "{app}\\migrations"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "scripts\\setup-database.sql"; DestDir: "{app}\\scripts"; Flags: ignoreversion

[Icons]
Name: "{group}\\SuperPonto Installer"; Filename: "{app}\\SuperPonto-Installer.exe"
Name: "{group}\\{cm:UninstallProgram,SuperPonto}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\\SuperPonto Installer"; Filename: "{app}\\SuperPonto-Installer.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\\SuperPonto-Installer.exe"; Description: "{cm:LaunchProgram,SuperPonto}"; Flags: nowait postinstall skipifsilent
'''
    
    with open('superponto-setup.iss', 'w') as f:
        f.write(iss_content)
    
    print("✓ Script Inno Setup criado: superponto-setup.iss")
    print("  Para compilar o instalador Windows, use Inno Setup Compiler")

def create_appimage_script():
    """Cria script para AppImage Linux"""
    
    appimage_script = '''#!/bin/bash
# Criar AppImage para SuperPonto

set -e

APP_NAME="SuperPonto"
APP_VERSION="1.0.0"

# Criar estrutura de diretórios
mkdir -p AppDir/usr/bin
mkdir -p AppDir/usr/share/applications
mkdir -p AppDir/usr/share/icons/hicolor/256x256/apps

# Copiar executável
cp dist/SuperPonto-Installer AppDir/usr/bin/superponto-installer
chmod +x AppDir/usr/bin/superponto-installer

# Criar .desktop file
cat > AppDir/usr/share/applications/superponto.desktop << EOF
[Desktop Entry]
Name=SuperPonto Installer
Exec=superponto-installer
Icon=superponto
Type=Application
Categories=Utility;
EOF

# Copiar ícone (se existir)
if [ -f "public/favicon.ico" ]; then
    convert public/favicon.ico AppDir/usr/share/icons/hicolor/256x256/apps/superponto.png 2>/dev/null || true
fi

# Link simbólico para AppRun
cat > AppDir/AppRun << EOF
#!/bin/bash
exec "\\$APPDIR/usr/bin/superponto-installer" "\\$@"
EOF
chmod +x AppDir/AppRun

# Baixar appimagetool se necessário
if [ ! -f "appimagetool-x86_64.AppImage" ]; then
    wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
    chmod +x appimagetool-x86_64.AppImage
fi

# Criar AppImage
./appimagetool-x86_64.AppImage AppDir ${APP_NAME}-${APP_VERSION}-x86_64.AppImage

echo "✓ AppImage criado: ${APP_NAME}-${APP_VERSION}-x86_64.AppImage"
'''
    
    with open('scripts/create-appimage.sh', 'w') as f:
        f.write(appimage_script)
    
    os.chmod('scripts/create-appimage.sh', 0o755)
    print("✓ Script AppImage criado: scripts/create-appimage.sh")

def main():
    parser = argparse.ArgumentParser(description='Gerar executável SuperPonto')
    parser.add_argument('--platform', choices=['windows', 'linux', 'macos', 'all'], 
                        default='all', help='Plataforma alvo')
    parser.add_argument('--inno', action='store_true', 
                        help='Criar script Inno Setup para Windows')
    parser.add_argument('--appimage', action='store_true',
                        help='Criar script AppImage para Linux')
    
    args = parser.parse_args()
    
    print("\n╔═══════════════════════════════════════════════════════════════╗")
    print("║   SuperPonto - Gerador de Executável                          ║")
    print("╚═══════════════════════════════════════════════════════════════╝\n")
    
    # Compilar executável principal
    exe_path = build_executable()
    
    if exe_path:
        # Criar scripts adicionais
        if args.inno or args.platform in ['windows', 'all']:
            create_inno_setup_script()
        
        if args.appimage or args.platform in ['linux', 'all']:
            create_appimage_script()
        
        print("\n" + "="*60)
        print("SUCESSO!")
        print("="*60)
        print(f"\nExecutável: {exe_path}")
        print("\nPara distribuir:")
        print("  Windows: Use Inno Setup com superponto-setup.iss")
        print("  Linux: Execute scripts/create-appimage.sh")
        print("  macOS: Distribua o executável diretamente")

if __name__ == '__main__':
    main()
