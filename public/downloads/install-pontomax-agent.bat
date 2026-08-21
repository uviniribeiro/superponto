@echo off
REM =====================================================================
REM  Ponto Max - Instalador do Robo de Comunicacao (Windows)
REM  Instala dependencias, configura o agente e registra o servico.
REM  Execute como Administrador.
REM =====================================================================
setlocal
title Ponto Max - Instalacao do Robo de Comunicacao

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Execute este arquivo como ADMINISTRADOR.
    echo  Clique com o botao direito ^> "Executar como administrador".
    echo.
    pause
    exit /b 1
)

set "INSTALL_DIR=%ProgramFiles%\PontoMax Agent"

echo.
echo  ============================================================
echo    PONTO MAX - ROBO DE COMUNICACAO
echo  ============================================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo  Python nao encontrado. Instale o Python 3.10+ em python.org
    echo  e marque a opcao "Add Python to PATH".
    pause
    exit /b 1
)

echo  [1/5] Instalando dependencias...
python -m pip install --upgrade pip >nul
python -m pip install pywin32 >nul

echo  [2/5] Copiando arquivos para "%INSTALL_DIR%"...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /Y "%~dp0pontomax-agent.py" "%INSTALL_DIR%" >nul
copy /Y "%~dp0pontomax-agent-service.py" "%INSTALL_DIR%" >nul

echo  [3/5] Assistente de configuracao (token e faixa de rede)...
pushd "%INSTALL_DIR%"
python "pontomax-agent.py" --configure
if %errorlevel% neq 0 (
    echo  Configuracao cancelada.
    popd
    pause
    exit /b 1
)

echo  [4/5] Registrando o servico do Windows...
python "pontomax-agent-service.py" install
sc config PontoMaxAgent start= auto >nul
sc failure PontoMaxAgent reset= 60 actions= restart/15000/restart/15000/restart/30000 >nul

echo  [5/5] Iniciando o servico...
python "pontomax-agent-service.py" start
popd

echo.
echo  ============================================================
echo    INSTALACAO CONCLUIDA
echo  ============================================================
echo    O robo ja esta varrendo a rede em busca de relogios.
echo    Acompanhe em: Equipamentos ^> Robo de Comunicacao
echo.
echo    Comandos uteis:
echo      python "%INSTALL_DIR%\pontomax-agent.py" --scan
echo      python "%INSTALL_DIR%\pontomax-agent-service.py" restart
echo.
pause
endlocal
