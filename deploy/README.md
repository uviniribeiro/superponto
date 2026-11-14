# PontoMax em servidores próprios (sem Lovable e sem Supabase Cloud)

Este guia instala o PontoMax completo em servidores seus. A arquitetura é a mesma dos
sistemas de ponto em nuvem: um servidor central com o sistema e o banco, um servidor de
comunicação com os relógios e os apps no celular e no terminal, todos falando por HTTPS.

```
                    ┌──────────────────────── VPS principal (ponto.suaempresa.com.br) ─────────────────────────┐
  Navegador ──┐     │  Caddy :443 (HTTPS automático)                                                            │
  App do      │     │   ├─ /                → app web (React)                                                   │
  funcionário ├────►│   └─ /auth /rest /realtime /storage /functions → gateway da API (só 127.0.0.1)            │
  App do      │     │        Auth · PostgREST (RLS) · Realtime · Storage · Edge Functions · PostgreSQL 17       │
  terminal  ──┘     │  Agendador: robô diário, horas extras, relatório semanal, feriados, backup às 02:30       │
                    └───────────────────────────────────────────▲─────────────────────────────────────────────┘
                                                                │ HTTPS (agent-gateway, token por empresa)
                    ┌───────── Servidor de comunicação (IPv4 próprio) ─────────┐
                    │  pontomax-agent@empresa-a, @empresa-b ... (systemd)      │──► relógios REP (Henry, Control iD,
                    └──────────────────────────────────────────────────────────┘    ZKTeco, Topdata, Dimep...) por IP/porta
```

Por baixo, a VPS roda o **Supabase de código aberto** (auto-hospedado), o mesmo software do
Supabase Cloud. Por isso o app, as regras de segurança do banco (RLS) e as Edge Functions
funcionam sem reescrita, e os dados ficam todos no seu servidor.

## 1. VPS principal

**Requisitos:** Ubuntu 24.04 (ou 22.04/Debian 12), 4 vCPU, 8 GB de RAM e 80 GB de SSD
recomendados (mínimo 2 vCPU/4 GB). Um domínio com registro DNS **A** apontando para o IPv4 da
VPS, e as portas 80 e 443 liberadas.

```bash
git clone https://github.com/uviniribeiro/superponto.git /opt/pontomax
```

```bash
cd /opt/pontomax/deploy/vps && sudo ./install.sh
```

O instalador pergunta o domínio, o e-mail do certificado e o IPv4 do servidor de comunicação.
Depois ele instala o Docker, gera todos os segredos em `deploy/vps/.env`, compila o app com o seu
domínio, sobe os serviços, aplica as migrações do banco e configura o firewall (22, 80, 443).
**Guarde uma cópia do `.env` em local seguro**: sem ele os dados não podem ser recuperados.

Crie o primeiro Super Admin (a senha é exibida uma única vez):

```bash
sudo ./scripts/create-super-admin.sh "Seu Nome" voce@suaempresa.com.br
```

Acesse `https://SEU_DOMINIO/super-admin-auth`.

### Configurações no `.env`

Depois de editar o `.env`, aplique com `sudo ./pontomax up -d`.

| Variável | Para quê |
|---|---|
| `SMTP_*` | E-mail de recuperação de senha (obrigatório para "Esqueci minha senha") |
| `RESEND_API_KEY` | Alertas e relatórios por e-mail das funções |
| `AI_API_KEY` (+ `AI_API_URL`, `AI_MODEL`) | Reconhecimento facial e assistente. O padrão é o Google Gemini; qualquer API compatível com OpenAI serve |
| `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` | Alertas por WhatsApp |
| `COMM_SERVER_IPS` | IP(s) que podem usar o gateway do robô. Deixe vazio se também houver robôs instalados nas redes dos clientes |

## 2. Dados do Supabase Cloud (opcional)

Com o Cloud inativo, os dados antigos só podem vir de um backup. Há duas formas de obtê-lo:

- **Reativar o Cloud temporariamente** só para exportar. Use a string de conexão do banco
  (Configurações do projeto → Database):
  ```bash
  pg_dump "postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres" -Fc --data-only --schema=public --schema=auth -f cloud.dump
  ```
- **Pedir o backup ao suporte do Lovable/Supabase.**

Importe na VPS **logo após a instalação, antes de cadastrar qualquer coisa**:

```bash
sudo ./scripts/import-cloud-backup.sh cloud.dump
```

O script preserva e-mails, senhas (hash), perfis, empresas e marcações. Depois ele aplica a
proteção dos cadastros existentes, que impede alterar e-mails, usuários e empresas.

Se o Cloud estiver acessível, as fotos e logos são copiadas à parte (a chave service_role fica em
Configurações → API):

```bash
sudo ./scripts/copy-cloud-storage.py --source-url https://PROJETO.supabase.co --source-key CHAVE_SERVICE_ROLE
```

Sem o backup, o sistema começa vazio: as empresas e os usuários são cadastrados de novo pelo
painel do Super Admin.

## 3. Servidor de comunicação

Veja [comm/README.md](comm/README.md). Resumo:

```bash
sudo ./install.sh --domain ponto.suaempresa.com.br
```

```bash
sudo pontomax-comm add empresa-a --token TOKEN_GERADO_NO_SISTEMA --empresa "Empresa A"
```

## 4. Apps (funcionário e terminal)

Gere os APKs na própria VPS ou em qualquer máquina com Node 22, JDK 21 e Android SDK. O
script lê o domínio e a chave pública do `.env`:

```bash
scripts/build-mobile.sh funcionario
```

```bash
scripts/build-mobile.sh terminal
```

- **App do funcionário** (`br.com.pontomax.app`): abre no registro de ponto, com câmera e GPS.
- **App do terminal** (`br.com.pontomax.terminal`): abre direto no terminal de ponto.

Os arquivos ficam em `public/downloads/` e aparecem para download na tela **Apps de Ponto**
(`https://SEU_DOMINIO/downloads/pontomax-funcionario.apk`). Para a Play Store ou para
instalação em massa, defina as variáveis `PONTOMAX_KEYSTORE*` (veja o cabeçalho do script) e
assine com a sua chave. A interface vai dentro do app, que só acessa a API do seu domínio.

O instalador Windows do robô sai pelo workflow **Robo de Comunicacao - Instalador Windows**
(GitHub Actions). Informe `https://SEU_DOMINIO/functions/v1/agent-gateway`.

## 5. Operação

| Tarefa | Comando (em `deploy/vps`) |
|---|---|
| Status dos serviços | `sudo ./pontomax ps` |
| Logs | `sudo ./pontomax logs -f web` (ou `functions`, `auth`, `db`, `scheduler`) |
| Atualizar para a versão do repositório | `sudo ./scripts/update.sh` |
| Aplicar migrações novas | `sudo ./scripts/migrate.sh` |
| Backup manual | `sudo docker exec pontomax-scheduler /scheduler/backup.sh` |
| Painel do banco (Studio) | `ssh -L 8000:127.0.0.1:8000 usuario@vps` e abrir `http://localhost:8000` |

**Backups:** todo dia às 02:30, o banco completo e os arquivos vão para `deploy/vps/backups/`
(14 dias de retenção, ajustável em `BACKUP_KEEP_DAYS`). Copie essa pasta para fora da VPS, por
exemplo com rclone ou um bucket S3.

**Restaurar num servidor novo:**
1. Rode o `install.sh` com o mesmo `.env`.
2. Rode `./scripts/import-cloud-backup.sh backups/db-AAAAMMDD-HHMM.dump --force`.
3. Extraia `storage-*.tar.gz` em `deploy/vps/supabase/volumes/storage/`.

## Segurança

- Só as portas 80 e 443 ficam públicas. O banco, o painel e o gateway escutam apenas
  internamente.
- O certificado HTTPS é emitido e renovado automaticamente.
- As funções agendadas e administrativas exigem login com o papel certo, ou a chave de serviço
  usada pelo agendador.
- O gateway dos robôs aceita só os IPs de `COMM_SERVER_IPS`, quando a variável está definida.
- O `.env` e os backups ficam com permissão restrita (600).

## Limitações conhecidas

- **Relógios em "modo push"** (o relógio conecta sozinho no IP do servidor) não são suportados
  pelo robô atual. O servidor de comunicação busca as marcações nos relógios pelo IP/porta. Para
  relógios em redes de clientes, use IP público com redirecionamento de porta no roteador do
  cliente, ou uma VPN entre o servidor de comunicação e a rede do cliente.
- As Edge Functions baixam bibliotecas de `deno.land`, `esm.sh` e `jsr.io` na primeira execução.
  Depois elas ficam em cache na VPS.
