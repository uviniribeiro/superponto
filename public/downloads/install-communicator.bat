@echo off
chcp 65001 >nul
title Ponto Max Communicator - Instalador

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║   🕐 SUPERPONTO COMMUNICATOR - INSTALADOR AUTOMÁTICO        ║
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
    echo ⚠ Python não encontrado! Instalando...
    echo.
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo.
        echo ⚠ Falha na instalação automática do Python.
        echo.
        echo Para instalar manualmente:
        echo 1. Acesse https://www.python.org/downloads/
        echo 2. Baixe e instale a versão mais recente
        echo 3. MARQUE a opção "Add Python to PATH"
        echo 4. Execute este arquivo novamente
        echo.
        pause
        exit /b 1
    )
    echo ✓ Python instalado com sucesso!
    echo.
)

echo ✓ Python encontrado!
python --version
echo.

REM Instala dependências
echo Instalando dependências...
python -m pip install --upgrade pip >nul 2>&1
python -m pip install pywin32 requests >nul 2>&1
echo ✓ Dependências instaladas!
echo.

REM Cria diretório de instalação
set INSTALL_DIR=%ProgramData%\Ponto MaxCommunicator
echo Criando diretório de instalação...
mkdir "%INSTALL_DIR%" 2>nul
echo ✓ Diretório: %INSTALL_DIR%
echo.

REM Copia o comunicador
echo Copiando arquivos...
copy "%~dp0superponto-communicator.py" "%INSTALL_DIR%\superponto-communicator.py" >nul
echo ✓ Comunicador copiado!
echo.

REM Executa configuração
echo.
echo ═══════════════════════════════════════════════════════════════
echo   CONFIGURAÇÃO INICIAL
echo ═══════════════════════════════════════════════════════════════
echo.
cd /d "%INSTALL_DIR%"
python superponto-communicator.py configure

REM Instala o serviço Windows
echo.
echo Instalando serviço Windows...
python superponto-communicator.py install
echo.

REM Inicia o serviço
echo Iniciando serviço...
python superponto-communicator.py start
echo.

REM Cria atalho no desktop
echo Criando atalhos...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Ponto Max Communicator.lnk'); $s.TargetPath = 'http://localhost:8899'; $s.IconLocation = 'shell32.dll,14'; $s.Save()" >nul 2>&1
echo ✓ Atalho criado no Desktop!
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║   ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!                      ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║   O serviço foi instalado e iniciará automaticamente        ║
echo ║   com o Windows.                                             ║
echo ║                                                              ║
echo ║   📊 Dashboard de monitoramento:                             ║
echo ║   http://localhost:8899                                      ║
echo ║                                                              ║
echo ║   📁 Arquivos: %ProgramData%\Ponto MaxCommunicator          ║
echo ║                                                              ║
echo ║   Comandos úteis (executar como Admin):                      ║
echo ║   - Parar:     python superponto-communicator.py stop        ║
echo ║   - Iniciar:   python superponto-communicator.py start       ║
echo ║   - Remover:   python superponto-communicator.py remove      ║
echo ║   - Console:   python superponto-communicator.py debug       ║
echo ║   - Reconfig:  python superponto-communicator.py configure   ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

pause
