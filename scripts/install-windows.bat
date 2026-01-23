@echo off
REM ============================================
REM SuperPonto - Instalador Windows
REM Criação automática de banco de dados local
REM ============================================

setlocal enabledelayedexpansion

echo.
echo ============================================
echo    SuperPonto - Instalador Windows
echo ============================================
echo.

REM Verificar se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo Python nao encontrado. Instalando...
    winget install Python.Python.3.12 --silent
    if errorlevel 1 (
        echo ERRO: Falha ao instalar Python
        echo Por favor, instale Python manualmente: https://www.python.org/downloads/
        pause
        exit /b 1
    )
)

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js nao encontrado. Instalando...
    winget install OpenJS.NodeJS.LTS --silent
    if errorlevel 1 (
        echo ERRO: Falha ao instalar Node.js
        echo Por favor, instale Node.js manualmente: https://nodejs.org/
        pause
        exit /b 1
    )
)

REM Menu de seleção de banco de dados
echo.
echo Selecione o banco de dados:
echo [1] PostgreSQL (Recomendado)
echo [2] Microsoft SQL Server
echo [3] Oracle Database
echo.
set /p DB_CHOICE="Opcao: "

if "%DB_CHOICE%"=="1" (
    set DB_TYPE=postgresql
    set DEFAULT_PORT=5432
) else if "%DB_CHOICE%"=="2" (
    set DB_TYPE=sqlserver
    set DEFAULT_PORT=1433
) else if "%DB_CHOICE%"=="3" (
    set DB_TYPE=oracle
    set DEFAULT_PORT=1521
) else (
    echo Opcao invalida
    pause
    exit /b 1
)

REM Configurações do banco
echo.
echo Configuracoes do banco de dados:
set /p DB_HOST="Host [localhost]: " || set DB_HOST=localhost
set /p DB_PORT="Porta [%DEFAULT_PORT%]: " || set DB_PORT=%DEFAULT_PORT%
set /p DB_USER="Usuario [superponto]: " || set DB_USER=superponto
set /p DB_PASS="Senha [SuperPonto@2024]: " || set DB_PASS=SuperPonto@2024
set /p DB_NAME="Banco [superponto]: " || set DB_NAME=superponto

REM Executar instalador Python
echo.
echo Executando instalacao...
python scripts\install-database.py --db %DB_TYPE% --host %DB_HOST% --port %DB_PORT% --user %DB_USER% --password %DB_PASS% --database %DB_NAME%

if errorlevel 1 (
    echo.
    echo ERRO: Falha na instalacao do banco de dados
    pause
    exit /b 1
)

REM Perguntar se deseja instalar dependências
echo.
set /p INSTALL_DEPS="Instalar dependencias do projeto? [S/n]: " || set INSTALL_DEPS=S
if /i "%INSTALL_DEPS%"=="S" (
    echo.
    echo Instalando dependencias do frontend...
    call npm install --legacy-peer-deps
    
    echo.
    echo Instalando dependencias do backend...
    cd server
    call npm install
    cd ..
)

echo.
echo ============================================
echo    INSTALACAO CONCLUIDA!
echo ============================================
echo.
echo Para iniciar o sistema:
echo.
echo 1. Backend: cd server ^&^& npm run dev
echo 2. Frontend: npm run dev
echo.
echo Acesse: http://localhost:5173
echo.
pause
