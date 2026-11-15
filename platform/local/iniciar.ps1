# SuperPonto — versão local (Windows). Requer o Docker Desktop aberto.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Write-Host 'Instale e abra o Docker Desktop: https://www.docker.com/products/docker-desktop/'; Read-Host 'Enter para sair'; exit 1 }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host 'Abra o Docker Desktop e rode de novo.'; Read-Host 'Enter para sair'; exit 1 }

function Rand([int]$n = 32) { $c = [char[]]'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; -join (1..$n | ForEach-Object { $c[[System.Security.Cryptography.RandomNumberGenerator]::GetInt32($c.Length)] }) }
function Key32 { $b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Fill($b); [Convert]::ToBase64String($b) }

if (-not (Test-Path .env)) {
  $email = Read-Host 'E-mail do administrador [admin@superponto.local]'
  if (-not $email) { $email = 'admin@superponto.local' }
  do {
    $sec = Read-Host 'Senha do administrador (mínimo 8 caracteres)' -AsSecureString
    $pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if ($pass.Length -lt 8) { Write-Host 'Senha curta demais.' }
  } while ($pass.Length -lt 8)
  @(
    "POSTGRES_PASSWORD=$(Rand 24)", "API_DB_PASSWORD=$(Rand 24)", "JWT_SECRET=$(Rand 48)",
    "MFA_ENCRYPTION_KEY=$(Key32)", "BIOMETRIC_ENCRYPTION_KEY=$(Key32)", "ADMIN_EMAIL=$email", "ADMIN_PASSWORD=$pass"
  ) | Set-Content -Encoding ascii .env
  Write-Host 'Configuração salva em local\.env'
}

Write-Host 'Montando e subindo o SuperPonto (a primeira vez leva alguns minutos)...'
docker compose --env-file .env up -d --build
if ($LASTEXITCODE -ne 0) { Read-Host 'Falhou. Enter para sair'; exit 1 }
Write-Host ''
Write-Host 'Pronto!'
Write-Host '  Sistema:            http://localhost:3001'
Write-Host '  E-mails de teste:   http://localhost:8025'
Write-Host '  API e documentação: http://localhost:3000/docs'
Write-Host 'Para parar: parar.bat'
Start-Process 'http://localhost:3001'
Read-Host 'Enter para fechar esta janela'
