#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PontoMax Equipment Agent - Windows Installer Builder
Creates a standalone Windows executable with installer

Requirements:
    pip install pyinstaller pillow

Usage:
    python build-windows-installer.py

Output:
    dist/PontoMaxAgent.exe - Standalone executable
    dist/PontoMaxAgent_Setup.exe - Installer (if NSIS is installed)
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

# Configuration
APP_NAME = "PontoMax Equipment Agent"
APP_VERSION = "2.0.0"
APP_ICON = "pontomax.ico"
MAIN_SCRIPT = "equipment-agent-advanced.py"
OUTPUT_NAME = "PontoMaxAgent"

# PyInstaller spec content
SPEC_CONTENT = f'''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['{MAIN_SCRIPT}'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['sqlite3', 'ssl', 'hashlib', 'struct', 'socket'],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas'],
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
    name='{OUTPUT_NAME}',
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
    icon='{APP_ICON}' if os.path.exists('{APP_ICON}') else None,
    version='version_info.txt',
)
'''

# Version info for Windows
VERSION_INFO = f'''VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(2, 0, 0, 0),
    prodvers=(2, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo(
      [
      StringTable(
        u'040904B0',
        [StringStruct(u'CompanyName', u'PontoMax'),
        StringStruct(u'FileDescription', u'{APP_NAME}'),
        StringStruct(u'FileVersion', u'{APP_VERSION}'),
        StringStruct(u'InternalName', u'{OUTPUT_NAME}'),
        StringStruct(u'LegalCopyright', u'Copyright (c) 2024 PontoMax'),
        StringStruct(u'OriginalFilename', u'{OUTPUT_NAME}.exe'),
        StringStruct(u'ProductName', u'{APP_NAME}'),
        StringStruct(u'ProductVersion', u'{APP_VERSION}')])
      ]),
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
'''

# NSIS installer script
NSIS_SCRIPT = f'''!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "{APP_NAME}"
OutFile "dist\\{OUTPUT_NAME}_Setup.exe"
InstallDir "$PROGRAMFILES\\PontoMax"
RequestExecutionLevel admin

!define MUI_ICON "pontomax.ico"
!define MUI_UNICON "pontomax.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "PortugueseBR"

Section "Install"
    SetOutPath $INSTDIR
    
    ; Copy executable
    File "dist\\{OUTPUT_NAME}.exe"
    
    ; Create shortcuts
    CreateDirectory "$SMPROGRAMS\\PontoMax"
    CreateShortcut "$SMPROGRAMS\\PontoMax\\{APP_NAME}.lnk" "$INSTDIR\\{OUTPUT_NAME}.exe"
    CreateShortcut "$DESKTOP\\{APP_NAME}.lnk" "$INSTDIR\\{OUTPUT_NAME}.exe"
    
    ; Create Windows Service
    nsExec::ExecToLog 'sc create PontoMaxAgent binPath= "$INSTDIR\\{OUTPUT_NAME}.exe --service" start= auto DisplayName= "{APP_NAME}"'
    nsExec::ExecToLog 'sc description PontoMaxAgent "PontoMax Equipment Synchronization Agent"'
    
    ; Write uninstaller
    WriteUninstaller "$INSTDIR\\Uninstall.exe"
    
    ; Registry entries for Add/Remove Programs
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PontoMaxAgent" \\
                     "DisplayName" "{APP_NAME}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PontoMaxAgent" \\
                     "UninstallString" "$INSTDIR\\Uninstall.exe"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PontoMaxAgent" \\
                     "DisplayVersion" "{APP_VERSION}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PontoMaxAgent" \\
                     "Publisher" "PontoMax"
SectionEnd

Section "Uninstall"
    ; Stop and remove service
    nsExec::ExecToLog 'sc stop PontoMaxAgent'
    nsExec::ExecToLog 'sc delete PontoMaxAgent'
    
    ; Remove files
    Delete "$INSTDIR\\{OUTPUT_NAME}.exe"
    Delete "$INSTDIR\\Uninstall.exe"
    RMDir "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$SMPROGRAMS\\PontoMax\\{APP_NAME}.lnk"
    RMDir "$SMPROGRAMS\\PontoMax"
    Delete "$DESKTOP\\{APP_NAME}.lnk"
    
    ; Remove registry
    DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PontoMaxAgent"
SectionEnd
'''


def check_pyinstaller():
    """Check if PyInstaller is installed"""
    try:
        import PyInstaller
        return True
    except ImportError:
        print("PyInstaller not found. Installing...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'], check=True)
        return True


def create_icon():
    """Create a simple icon if PIL is available"""
    try:
        from PIL import Image, ImageDraw
        
        # Create a simple clock icon
        size = 256
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Blue circle background
        draw.ellipse([10, 10, size-10, size-10], fill='#2563eb')
        
        # White clock face
        draw.ellipse([30, 30, size-30, size-30], fill='white')
        
        # Clock hands
        center = size // 2
        draw.line([(center, center), (center, 50)], fill='#1e40af', width=8)
        draw.line([(center, center), (center + 50, center)], fill='#1e40af', width=6)
        
        # Center dot
        draw.ellipse([center-10, center-10, center+10, center+10], fill='#1e40af')
        
        # Save as ICO
        img.save(APP_ICON, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
        print(f"Created icon: {APP_ICON}")
        return True
    except Exception as e:
        print(f"Could not create icon: {e}")
        return False


def build_executable():
    """Build the executable using PyInstaller"""
    print("Building Windows executable...")
    
    # Check dependencies
    check_pyinstaller()
    
    # Create icon
    if not os.path.exists(APP_ICON):
        create_icon()
    
    # Write version info
    with open('version_info.txt', 'w') as f:
        f.write(VERSION_INFO)
    
    # Write spec file
    with open(f'{OUTPUT_NAME}.spec', 'w') as f:
        f.write(SPEC_CONTENT)
    
    # Run PyInstaller
    result = subprocess.run([
        sys.executable, '-m', 'PyInstaller',
        '--clean',
        '--onefile',
        f'{OUTPUT_NAME}.spec'
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"PyInstaller error: {result.stderr}")
        return False
    
    print(f"Executable created: dist/{OUTPUT_NAME}.exe")
    return True


def build_installer():
    """Build NSIS installer if available"""
    nsis_path = None
    
    # Check for NSIS
    possible_paths = [
        r'C:\Program Files (x86)\NSIS\makensis.exe',
        r'C:\Program Files\NSIS\makensis.exe',
        shutil.which('makensis'),
    ]
    
    for path in possible_paths:
        if path and os.path.exists(path):
            nsis_path = path
            break
    
    if not nsis_path:
        print("NSIS not found. Skipping installer creation.")
        print("Download NSIS from: https://nsis.sourceforge.io/")
        return False
    
    print("Building installer with NSIS...")
    
    # Write NSIS script
    with open('installer.nsi', 'w') as f:
        f.write(NSIS_SCRIPT)
    
    # Run NSIS
    result = subprocess.run([nsis_path, 'installer.nsi'], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"NSIS error: {result.stderr}")
        return False
    
    print(f"Installer created: dist/{OUTPUT_NAME}_Setup.exe")
    return True


def cleanup():
    """Clean up temporary files"""
    temp_files = [
        'version_info.txt',
        f'{OUTPUT_NAME}.spec',
        'installer.nsi',
        APP_ICON,
    ]
    
    for f in temp_files:
        if os.path.exists(f):
            os.remove(f)
    
    if os.path.exists('build'):
        shutil.rmtree('build')


def main():
    """Main build process"""
    print(f"Building {APP_NAME} v{APP_VERSION}")
    print("=" * 50)
    
    # Check main script exists
    if not os.path.exists(MAIN_SCRIPT):
        print(f"Error: {MAIN_SCRIPT} not found!")
        print("Run this script from the downloads directory.")
        sys.exit(1)
    
    # Build executable
    if not build_executable():
        print("Failed to build executable!")
        sys.exit(1)
    
    # Build installer
    build_installer()
    
    # Cleanup
    cleanup()
    
    print("=" * 50)
    print("Build complete!")
    print(f"  Executable: dist/{OUTPUT_NAME}.exe")
    
    if os.path.exists(f'dist/{OUTPUT_NAME}_Setup.exe'):
        print(f"  Installer: dist/{OUTPUT_NAME}_Setup.exe")
    
    print("\nUsage:")
    print(f"  {OUTPUT_NAME}.exe --service     Run as background service")
    print(f"  {OUTPUT_NAME}.exe --scan <range> Scan for equipment")
    print(f"  {OUTPUT_NAME}.exe --version     Show version")


if __name__ == '__main__':
    main()
