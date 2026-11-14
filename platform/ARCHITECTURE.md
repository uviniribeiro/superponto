# SuperPonto v2 — Arquitetura

> Fase 1 (auditoria e planejamento). Proposta para validação antes da construção das telas.

## 1. Ponto de partida (sistema atual)

| Aspecto | Hoje (v1) | Problema frente ao objetivo |
|---|---|---|
| Stack | Vite + React SPA, Supabase (PostgREST, Auth, Edge Functions Deno) | Não segue a stack pedida (Next.js, NestJS, Prisma) |
| Regra de negócio | ~280 consultas diretas ao banco a partir do frontend | Lógica crítica no navegador; difícil auditar e testar |
| Pessoa × vínculo | `profiles` = pessoa + funcionário + login, preso a uma empresa | Impossível ter múltiplas matrículas |
| Multi-tenant | `company_id` em cada tabela; sem nível acima da empresa | Cliente com várias empresas não é representável |
| Permissões | 4 papéis fixos (`admin`, `manager`, `employee`, `super_admin`) | Sem perfis personalizados nem escopo por unidade |
| Ponto | `time_records` editável | Registro original pode ser sobrescrito |
| Equipamentos | Robô de comunicação em **Python** (proibido no novo escopo) | Precisa ser reescrito em Node.js/TypeScript |
| Tamanho | 139 telas, 132 tabelas, 30 funções, ~110 mil linhas | Migração precisa ser por fases, sem parar a operação |

O que se aproveita da v1: regras de apuração (`src/lib/timeCalculation.ts`, testadas), layout AFD,
conhecimento dos protocolos Henry/Control iD/ZKTeco/Topdata/Dimep do robô atual, identidade visual
e os dados reais (migrados por ETL na virada).

## 2. Visão geral

```
                         ┌─────────────────────────── SERVIDOR 1 — SuperPonto Principal ───────────────────────────┐
 Navegador / PWA ──HTTPS─►  apps/web (Next.js App Router)  ──REST/JSON──►  apps/api (NestJS, Swagger)               │
 Apps (Capacitor) ───────►    SSR + React + Tailwind + shadcn/ui              │   ├─ módulos por domínio            │
                         │                                                    │   ├─ guards: auth, tenant, RBAC,    │
                         │                                                    │   │   plano                         │
                         │                                                    │   └─ BullMQ (Redis): apuração,      │
                         │                                                    │       notificações, relatórios,     │
                         │                                                    │       comandos p/ equipamentos      │
                         │   PostgreSQL 17 (RLS por tenant) ◄── Prisma ───────┘                                     │
                         │   Armazenamento S3-compatível (fotos, anexos, relatórios)                                │
                         └───────────────────────────────────────▲──────────────────────────────────────────────────┘
                                                                 │ HTTPS + credencial do servidor (HMAC) → token curto (JWT)
                                                                 │ lotes idempotentes, confirmação por item
                         ┌──────────── SERVIDOR 2 — SuperPonto Communication Server (produto independente) ──────────┐
                         │  Node.js/TypeScript · fila persistente local (SQLite WAL) · BullMQ/Redis opcional          │
                         │  adaptadores: control-id, henry, zkteco, topdata, dimep, ... (um por fabricante/modelo)    │
                         └───▲────────────────▲───────────────────────▲───────────────────────────────────────────────┘
                             │ TCP/UDP/HTTP   │ conexão do relógio    │ túnel / agente local (rede do cliente)
                          Relógios REP     Catracas/portas        Equipamentos sem acesso direto à internet
```

### Princípios

1. **Backend é a fonte da verdade.** O frontend nunca grava direto no banco; toda regra (cálculo,
   permissão, limite de plano, fechamento) é validada na API.
2. **Defesa em profundidade no isolamento.** A API filtra por tenant **e** o PostgreSQL aplica RLS
   com um papel sem privilégios de dono. Um bug de filtro na API não vaza dados de outro cliente.
3. **Registros originais imutáveis.** Marcações, eventos de equipamento e auditoria são somente
   inserção (gatilhos no banco). Correções são eventos com justificativa e aprovação.
4. **Pessoa ≠ vínculo ≠ login.** Uma pessoa tem N vínculos (matrículas); cada vínculo tem jornada,
   escala, banco de horas e apuração próprios. O login (usuário) aponta opcionalmente para a pessoa.
5. **Ponto ≠ acesso físico ≠ escala ≠ atividade.** Tabelas e finalidades separadas; aproveitar
   evento de acesso como ponto só com regra explícita.
6. **Motor de cálculo puro.** `packages/time-engine` não acessa banco nem rede: entra jornada +
   marcações + regras, sai apuração. Versionado (`engineVersion` gravado em cada cálculo).
7. **Comunicação com equipamentos fora do servidor principal.** O Communication Server nunca acessa
   o PostgreSQL; fala só com a API, por credencial própria e lotes idempotentes.

## 3. Estrutura do repositório

```
platform/
├── apps/
│   ├── api/                    NestJS — API REST principal + workers BullMQ
│   ├── web/                    Next.js — aplicação web e PWA
│   └── communication-server/   Communication Server (extraível para repositório próprio)
├── packages/
│   ├── database/               schema Prisma, migrações, RLS, seed
│   ├── time-engine/            motor de apuração de jornada (puro, testado)
│   └── contracts/              esquemas Zod compartilhados (API ↔ web ↔ Communication Server)
└── *.md                        documentação viva (este arquivo, DATABASE.md, PROJECT_STATUS.md...)
```

A v1 continua na raiz do repositório e em produção até a virada (fase 10). A v2 cresce em
`platform/` sem interromper a operação atual.

> O documento pede **repositório independente** para o Communication Server. Esta sessão não pode
> criar repositórios no GitHub; ele nasce em `apps/communication-server`, sem dependências internas
> além de `packages/contracts` (copiável). Quando o repositório `superponto-communication-server`
> existir, a pasta é movida com histórico.

## 4. Backend (apps/api)

- **NestJS 12**, módulos por domínio, cada um com controller (REST), service (regras), DTOs (Zod),
  testes. Swagger/OpenAPI gerado em `/docs`.
- **Prisma 7** com `@prisma/adapter-pg`. Cada requisição autenticada roda numa transação que fixa
  `app.tenant_id` (RLS). Operações de plataforma usam um cliente separado e auditado.
- **Autenticação própria** (sem fornecedor): senha com Argon2id; access token JWT de 15 min; refresh
  token rotativo com detecção de reuso (família de sessões); MFA TOTP obrigatório para perfis
  administrativos; bloqueio progressivo; recuperação de senha por token de uso único (hash no banco).
  Os hashes bcrypt da v1 são aceitos na migração e reescritos em Argon2id no primeiro login.
- **Autorização**: permissões `modulo.recurso:acao` agrupadas em perfis (sistema ou personalizados),
  atribuídas ao usuário com **escopo** (tenant, empresa, unidade, departamento, próprio). Guard
  global + decorator `@RequirePermission('time.records:approve')`.
- **Limites de plano** verificados na API (guard `@RequireFeature('module.health')` e contadores),
  nunca só no frontend.
- **Auditoria**: interceptor grava `audit_logs` (antes/depois, ator, IP, request-id) para toda
  mutação marcada; tabela somente inserção.
- **Filas (BullMQ + Redis)**: recálculo de apuração, fechamento, notificações, geração de relatórios
  pesados, comandos para equipamentos, webhooks de cobrança. Retentativas com backoff e DLQ.
- **Logs estruturados** (pino, JSON) com request-id; métricas Prometheus; health checks.
- **Rate limiting** (login, recuperação de senha, ingestão), Helmet, CORS restrito, validação Zod.

## 5. Frontend (apps/web)

- **Next.js (App Router)** + React + TypeScript + Tailwind + shadcn/ui + Lucide + Recharts;
  React Hook Form + Zod (os mesmos esquemas de `packages/contracts`); TanStack Query.
- Sessão por cookie httpOnly (BFF no Next): o token nunca fica acessível ao JavaScript da página.
- **Identidade visual** (referência dos vídeos): tema escuro grafite/preto como principal e claro
  como alternativa; amarelo SuperPonto como destaque; painéis com transparência sutil, bordas
  discretas, profundidade; sidebar compacta agrupada por domínio; relógio radial de marcações por
  hora, barras empilhadas, medidores; verde/azul/vermelho/laranja só para estados.
- Tokens de design centralizados (CSS variables) aplicados a **todas** as telas: listagens,
  formulários, calendários, relatórios, modais, detalhes, administração e mobile.
- PWA para o funcionário (marcação, espelho, solicitações) e modo quiosque para o terminal.

## 6. Communication Server (resumo — detalhes em COMMUNICATION_SERVER.md)

- Recebe conexões dos relógios (push) e conecta-se a eles (pull), por adaptador.
- Fila local persistente: nada é descartado se o servidor principal estiver fora; reenvio com
  idempotência (`deviceId + nsr + occurredAt`) e confirmação por item.
- Autentica na API com `keyId` + segredo (HMAC da requisição) e recebe token de curta duração;
  escopo limitado às empresas/unidades autorizadas no cadastro do servidor.
- Para equipamentos sem acesso direto à internet: agente local (o mesmo binário em modo gateway)
  dentro da rede do cliente, com túnel de saída.

## 7. Infraestrutura alvo

| Componente | Ambiente recomendado |
|---|---|
| PostgreSQL 17 | Supabase (gerenciado) ou VPS própria; backups diários + PITR |
| API + workers + Redis | VPS (Docker Compose) ou PaaS com containers |
| Web (Next.js) | Vercel ou a mesma VPS (container) |
| Armazenamento | S3-compatível (Supabase Storage, Cloudflare R2, MinIO) |
| Communication Server | Servidor dedicado com IPv4 público próprio (Docker) |
| CI/CD | GitHub Actions: teste → build → migração → deploy; ambientes dev/homologação/produção |

## 8. Decisões que precisam da sua validação

1. **Hospedagem da API** (NestJS + Redis precisam de processo contínuo): VPS própria (recomendado,
   já existe `deploy/vps`) ou PaaS.
2. **Banco**: manter no Supabase como PostgreSQL gerenciado (recomendado; só o banco e o
   armazenamento, sem depender do Auth/PostgREST deles) ou PostgreSQL na VPS.
3. **Autenticação própria na API** (recomendado, sem dependência de fornecedor) em vez do Supabase Auth.
4. **Virada**: a v1 segue em produção enquanto a v2 é construída; dados migram por ETL na fase 10.
