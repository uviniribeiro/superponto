@echo off
REM ============================================================
REM  Ponto Max - Instalador do Agente Control iD
REM  Execute este arquivo como ADMINISTRADOR
REM ============================================================
title Ponto Max - Agente Control iD
color 0B

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [ERRO] Execute este instalador como ADMINISTRADOR.
    echo  Clique com o botao direito no arquivo e escolha "Executar como administrador".
    echo.
    pause
    exit /b 1
)

set INSTALL_DIR=%ProgramFiles%\PontoMax\ControlIDAgent
echo.
echo  Instalando em: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo  [1/5] Verificando Python...
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERRO] Python nao encontrado. Instale o Python 3.8+ em https://python.org
    echo  Marque a opcao "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

echo  [2/5] Instalando dependencias...
python -m pip install --quiet --upgrade pip requests pywin32

echo  [3/5] Copiando arquivos...
copy /Y "%~dp0controlid-agent.py" "%INSTALL_DIR%\controlid-agent.py" >nul

echo  [4/5] Procurando equipamentos Control iD na rede local...
python "%INSTALL_DIR%\controlid-agent.py" --discover

echo  [5/5] Registrando servico do Windows...
python "%INSTALL_DIR%\controlid-agent.py" --install-service

echo.
echo  ============================================================
echo   Instalacao concluida!
echo.
echo   Configuracao: %INSTALL_DIR%\controlid-config.json
echo   Log:          %INSTALL_DIR%\controlid-agent.log
echo.
echo   Edite o arquivo de configuracao com a chave da empresa
echo   (cloud_api_key) e reinicie o servico:
echo       sc stop PontoMaxControlIDAgent
echo       sc start PontoMaxControlIDAgent
echo  ============================================================
echo.
pause
