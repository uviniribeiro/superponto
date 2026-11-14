# Implantação

Status: **planejado (fase 10)**. A v1 segue em produção pelos fluxos de `deploy/` na raiz.

## Topologia

| Serviço | Onde | Observação |
|---|---|---|
| PostgreSQL 17 | Supabase (gerenciado) ou VPS | papel `superponto_app` para a API; migrações com papel dono |
| API + workers | VPS (Docker Compose) | Redis local para BullMQ |
| Web | Vercel ou VPS | variáveis só de URL pública da API |
| Armazenamento | S3-compatível | buckets privados; URLs assinadas |
| Communication Server | servidor dedicado, IPv4 próprio | ver COMMUNICATION_SERVER.md |

## Ambientes

`development` (local, Docker), `staging` (homologação, dados fictícios), `production`.
Cada um com banco, Redis, segredos e domínio próprios.

## CI/CD (GitHub Actions)

1. Pull request: lint, typecheck, testes (com PostgreSQL em contêiner), build.
2. Merge na main: build das imagens, `prisma migrate deploy` em staging, deploy em staging.
3. Promoção manual para produção, com backup antes da migração.
