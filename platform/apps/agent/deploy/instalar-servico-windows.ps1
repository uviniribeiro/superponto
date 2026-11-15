# Instala o agente como serviço do Windows (executar no PowerShell como Administrador).
# Requer Node.js 22+ e o NSSM (https://nssm.cc) no PATH.
param(
  [string]$Pasta = "C:\SuperPonto\agente",
  [string]$Config = "C:\SuperPonto\agente\agent.json"
)
$node = (Get-Command node).Source
nssm install SuperPontoAgente $node "$Pasta\dist\main.js"
nssm set SuperPontoAgente AppDirectory $Pasta
nssm set SuperPontoAgente AppEnvironmentExtra "SUPERPONTO_AGENT_CONFIG=$Config"
nssm set SuperPontoAgente AppStdout "$Pasta\agente.log"
nssm set SuperPontoAgente AppStderr "$Pasta\agente.log"
nssm set SuperPontoAgente AppRotateFiles 1
nssm set SuperPontoAgente AppRotateBytes 10485760
nssm set SuperPontoAgente Start SERVICE_AUTO_START
nssm start SuperPontoAgente
