# Implantação da v2

A v1 continua em produção pelos fluxos de `deploy/` na raiz. A v2 roda com:

| Peça | Agora | Depois (VPS) |
|---|---|---|
| PostgreSQL 17 | **Supabase** (esquema `superponto`, fora da API REST do Supabase) | PostgreSQL do `docker-compose` (perfil `vps`) |
| API NestJS + Redis | Docker (`platform/deploy/docker-compose.yml`) em qualquer servidor | o mesmo |
| Web (Next.js) | Vercel ou o mesmo servidor | o mesmo |
| Communication Server | servidor dedicado com IPv4 próprio | o mesmo |

A troca de banco é só `DATABASE_URL`: o código, as migrações, a RLS e os scripts são os mesmos.

## Banco no Supabase (padrão)

O mesmo projeto Supabase da v1 pode hospedar a v2: ela fica no esquema `superponto`, isolada da v1
(`public`). A migração revoga o acesso dos papéis `anon` e `authenticated`, e o esquema não é
publicado pela API REST do Supabase; um teste automatizado garante isso.

1. Pegue as conexões do pooler **modo sessão** (porta 5432) em *Project Settings → Database*.
2. Prepare o banco, a partir de `platform/`, numa máquina com Node 22 e Docker:
   ```bash
   npm ci && npm run build -w @superponto/time-engine && npm run build -w @superponto/database && npm run build -w @superponto/api
   ```
   ```bash
   MIGRATION_DATABASE_URL="postgresql://postgres.REF:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?schema=superponto" API_DB_PASSWORD="$(openssl rand -hex 24)" SEED_ADMIN_EMAIL=viniciusacacio1@gmail.com ./scripts/db-setup.sh
   ```
   O script aplica as migrações, cria o papel `superponto_api` (sujeito à RLS) e grava permissões, perfis
   e o SuperAdmin. Guarde a senha gerada: ela vai em `DATABASE_URL`.
3. Copie `deploy/.env.example` para `deploy/.env`, preencha e suba:
   ```bash
   cd deploy && docker compose --env-file .env up -d --build
   ```

## Levando o banco para uma VPS

Testado de ponta a ponta: contagens conferidas, API subindo no banco novo e login com senha existente.

1. Pare a API (congela a escrita).
2. Suba o PostgreSQL da VPS:
   ```bash
   cd deploy && docker compose --env-file .env --profile vps up -d db
   ```
3. Mova o banco (usa cliente PostgreSQL 17 local ou um contêiner, automaticamente):
   ```bash
   SOURCE_URL="postgresql://postgres.REF:SENHA@...supabase.com:5432/postgres" DEST_URL="postgresql://postgres:SENHA@127.0.0.1:5432/superponto" ./scripts/db-move.sh
   ```
4. Crie o papel da API no destino:
   ```bash
   MIGRATION_DATABASE_URL="postgresql://postgres:SENHA@127.0.0.1:5432/superponto?schema=superponto" API_DB_PASSWORD=... ./scripts/db-setup.sh
   ```
5. Em `deploy/.env`, aponte `DATABASE_URL` para `db` (exemplo comentado no arquivo) e suba a API com
   `--profile vps`.

## Ambientes e CI/CD

- `development` (local, Docker), `staging` (homologação, dados fictícios), `production`; cada um com
  banco, Redis, segredos e domínio próprios.
- CI (`.github/workflows/platform-ci.yml`): build, typecheck e testes com PostgreSQL real a cada push.
- Deploy contínuo da v2 entra junto com o app web (fase 2): build da imagem, `db-setup.sh` em staging,
  promoção para produção com backup antes da migração.

## Servidor de comunicação de equipamentos (servidor separado)

Os relógios não falam com o sistema: o agente local de cada cliente fala com o **servidor de
comunicação** (repositório `superponto-communication-server`), que repassa ao sistema. Para ligar:

1. Gere um segredo: `openssl rand -base64 48`.
2. Neste servidor, defina `COMM_SERVER_TOKEN=<segredo>` no contêiner da API. Com ele definido, as rotas
   `/v1/agent/*` só aceitam chamadas vindas do servidor de comunicação.
3. No servidor de comunicação, use `SYSTEM_URL=https://<este sistema>` e o mesmo `COMM_SERVER_TOKEN`.

Detalhes em [COMMUNICATION_SERVER.md](COMMUNICATION_SERVER.md).
