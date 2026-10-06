
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
Var GatewayBox
Var Token
Var Empresa
Var Cnpj
Var Ranges
Var Gateway

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom ConfigPage ConfigPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Function ConfigPage
    !insertmacro MUI_HEADER_TEXT "Configuracao do robo" "Informe o backend, o token, a empresa e as faixas de rede."
    nsDialogs::Create 1018
    Pop $Dialog
    ${If} $Dialog == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 12u "Backend Supabase (URL do agent-gateway):"
    Pop $0
    ${NSD_CreateText} 0 14u 100% 12u "https://example.supabase.co/functions/v1/agent-gateway"
    Pop $GatewayBox

    ${NSD_CreateLabel} 0 34u 100% 12u "Token do agente (gerado em Equipamentos > Robo de Comunicacao):"
    Pop $0
    ${NSD_CreateText} 0 48u 100% 12u ""
    Pop $TokenBox

    ${NSD_CreateLabel} 0 68u 100% 12u "Empresa (razao social):"
    Pop $0
    ${NSD_CreateText} 0 82u 100% 12u ""
    Pop $EmpresaBox

    ${NSD_CreateLabel} 0 102u 100% 12u "CNPJ (aceita formato alfanumerico):"
    Pop $0
    ${NSD_CreateText} 0 116u 100% 12u ""
    Pop $CnpjBox

    ${NSD_CreateLabel} 0 136u 100% 12u "Faixas de rede a varrer (ex: 192.168.0.0/24, 10.0.1.0/24):"
    Pop $0
    ${NSD_CreateText} 0 150u 100% 12u ""
    Pop $RangesBox

    nsDialogs::Show
FunctionEnd

Function ConfigPageLeave
    ${NSD_GetText} $GatewayBox $Gateway
    ${NSD_GetText} $TokenBox $Token
    ${NSD_GetText} $EmpresaBox $Empresa
    ${NSD_GetText} $CnpjBox $Cnpj
    ${NSD_GetText} $RangesBox $Ranges
    ${If} $Gateway == ""
        MessageBox MB_ICONEXCLAMATION "Informe o endereço do backend Supabase para continuar."
        Abort
    ${EndIf}
    ${If} $Token == ""
        MessageBox MB_ICONEXCLAMATION "Informe o token do agente para continuar."
        Abort
    ${EndIf}
FunctionEnd

Section "Principal"
    SetOutPath $INSTDIR
    File "dist\PontoMaxAgent.exe"
    File /nonfatal "pontomax-agent.py"
    File /nonfatal "README.txt"

    ; Grava a configuracao (backend, token, empresa e faixas) sem perguntas
    nsExec::ExecToLog '"$INSTDIR\PontoMaxAgent.exe" --configure --sim --gateway "$Gateway" --token "$Token" --empresa "$Empresa" --cnpj "$Cnpj" --ranges "$Ranges"'
    Pop $0

    CreateDirectory "$SMPROGRAMS\Ponto Max Agent"
    CreateShortcut "$SMPROGRAMS\Ponto Max Agent\Configurar Agente.lnk" "$INSTDIR\PontoMaxAgent.exe" "--configure"
    CreateShortcut "$SMPROGRAMS\Ponto Max Agent\Varrer a rede.lnk" "$INSTDIR\PontoMaxAgent.exe" "--scan"
    CreateShortcut "$SMPROGRAMS\Ponto Max Agent\Desinstalar.lnk" "$INSTDIR\uninstall.exe"

    ; Servico do Windows com inicializacao automatica
    nsExec::ExecToLog '"$INSTDIR\PontoMaxAgent.exe" install'
    nsExec::ExecToLog 'sc config PontoMaxAgent start= auto'
    nsExec::ExecToLog 'sc failure PontoMaxAgent reset= 60 actions= restart/15000/restart/15000/restart/30000'
    nsExec::ExecToLog '"$INSTDIR\PontoMaxAgent.exe" start'

    WriteUninstaller "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PontoMaxAgent" "DisplayName" "Ponto Max - Robo de Comunicacao"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PontoMaxAgent" "DisplayVersion" "3.1.0"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PontoMaxAgent" "UninstallString" "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
    nsExec::ExecToLog '"$INSTDIR\PontoMaxAgent.exe" stop'
    nsExec::ExecToLog '"$INSTDIR\PontoMaxAgent.exe" remove'
    Delete "$INSTDIR\*.*"
    RMDir "$INSTDIR"
    RMDir /r "$SMPROGRAMS\Ponto Max Agent"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PontoMaxAgent"
SectionEnd
