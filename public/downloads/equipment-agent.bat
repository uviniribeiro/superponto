@echo off
chcp 65001 >nul
title Agente de Sincronização de Relógios de Ponto

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║   🕐 AGENTE DE SINCRONIZAÇÃO DE RELÓGIOS DE PONTO           ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Verifica se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ⚠ Python não encontrado!
    echo.
    echo Para instalar o Python:
    echo 1. Acesse https://www.python.org/downloads/
    echo 2. Baixe e instale a versão mais recente
    echo 3. Marque a opção "Add Python to PATH" durante a instalação
    echo 4. Execute este arquivo novamente
    echo.
    pause
    exit /b 1
)

echo ✓ Python encontrado!
echo.

REM Instala dependências
echo Verificando dependências...
pip install requests >nul 2>&1
echo ✓ Dependências instaladas!
echo.

REM Executa o script Python
echo Iniciando agente...
echo.
python "%~dp0equipment-agent.py"

pause
