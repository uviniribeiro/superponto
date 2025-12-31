@echo off
chcp 65001 >nul
title Instalador do Serviço de Sincronização

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║   🔧 INSTALADOR DO SERVIÇO DE SINCRONIZAÇÃO                  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Verifica privilégios de administrador
net session >nul 2>&1
if errorlevel 1 (
    echo ⚠ Este script precisa ser executado como Administrador!
    echo.
    echo Clique com botão direito e selecione "Executar como administrador"
    echo.
    pause
    exit /b 1
)

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
echo Instalando dependências...
pip install pywin32 requests flask >nul 2>&1
echo ✓ Dependências instaladas!
echo.

REM Cria diretório de dados
echo Criando diretório de dados...
mkdir "%ProgramData%\EquipmentSyncAgent" 2>nul
echo ✓ Diretório criado!
echo.

REM Copia o script para o diretório de instalação
echo Copiando arquivos...
copy "%~dp0equipment-service.py" "%ProgramData%\EquipmentSyncAgent\equipment-service.py" >nul
echo ✓ Arquivos copiados!
echo.

REM Instala o serviço
echo Instalando serviço Windows...
cd /d "%ProgramData%\EquipmentSyncAgent"
python equipment-service.py install
echo.

REM Inicia o serviço
echo Iniciando serviço...
python equipment-service.py start
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║   ✅ INSTALAÇÃO CONCLUÍDA!                                   ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║   O serviço foi instalado e iniciará automaticamente        ║
echo ║   com o Windows.                                             ║
echo ║                                                              ║
echo ║   Dashboard de monitoramento:                                ║
echo ║   http://localhost:8765                                      ║
echo ║                                                              ║
echo ║   Comandos úteis:                                            ║
echo ║   - Parar:    python equipment-service.py stop               ║
echo ║   - Iniciar:  python equipment-service.py start              ║
echo ║   - Remover:  python equipment-service.py remove             ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

pause
