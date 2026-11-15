# SuperPonto v2 — Situação do projeto

Atualizado em 15/11/2026. A v1 (raiz do repositório) segue em produção; a v2 é construída em
`platform/` e substitui a v1 na fase 10.

## Fases

| Fase | Escopo | Situação |
|---|---|---|
| 1. Auditoria e planejamento | Inventário da v1, arquitetura, modelo de dados, módulos, riscos | **Concluída** — ARCHITECTURE.md, DATABASE.md, COMMUNICATION_SERVER.md, DEVICE_INTEGRATIONS.md |
| 2. Infraestrutura e base | Monorepo, API NestJS, Prisma, autenticação, multi-tenant, permissões, auditoria | **Em andamento** — API e app web prontos e testados (detalhes abaixo); falta MFA nas rotas |
| 3. Núcleo de gestão | Pessoas, empresas, unidades, funcionários, matrículas, vínculos, jornadas, escalas | Não iniciada (modelo de dados pronto) |
| 4. Módulos especializados | Educação, saúde, operacional | Não iniciada (modelo de dados pronto) |
| 5. Controle de ponto | Marcações, apuração, banco de horas, solicitações, aprovações, relatórios | Motor de cálculo pronto e testado; API e telas não iniciadas |
| 6. Equipamentos | Cadastro, adaptadores, sincronização, homologação | Não iniciada (projeto em DEVICE_INTEGRATIONS.md) |
| 7. Communication Server | Serviço independente em Node.js, filas, protocolos, painel | Não iniciada (projeto em COMMUNICATION_SERVER.md) |
| 8. SaaS e SuperAdmin | Planos, assinaturas, cobrança, limites | Criação de clientes pelo SuperAdmin pronta; resto não iniciado |
| 9. Testes e homologação | Ampliação contínua a cada fase | Em andamento |
| 10. Produção | Docker, servidores, migração de dados da v1, virada | Não iniciada |

## O que já funciona (verificado por testes)

**Banco (PostgreSQL 17, Prisma 7)** — 82 tabelas; RLS por tenant em 64 delas; marcações, auditoria e
eventos de equipamento imutáveis; pessoas e vínculos sem exclusão física; período fechado protegido.

**Motor de jornada** (`packages/time-engine`, 26 testes) — jornada fixa e flexível, escalas 12x36,
6x1, 5x2, 4x2 e rotativas por ciclo, plantão noturno atravessando a meia-noite, atribuição de
marcações ao dia da jornada, tolerância da CLT (5 min por marcação / 10 min no dia), extras por
percentual (normal, noturna, folga, feriado, intervalo), hora noturna reduzida, faltas, afastamentos,
banco de horas com vencimento FIFO e multiplicadores, resumo do período.

**CNPJ alfanumérico** (`packages/br-docs`, 7 testes) — validação e máscara do CNPJ numérico e do
alfanumérico (IN RFB 2.229/2024), com o exemplo oficial; usado pela API, pelo banco (restrição de
formato) e pelas telas. Multi-CNPJ: cada cliente tem várias empresas e o mesmo CNPJ pode existir em
clientes diferentes, sem vazamento.

**App web** (`apps/web`, Next.js 16) — login, esqueci/redefinir senha, painel com dados reais,
empresas (CRUD com CNPJ alfanumérico), clientes (SuperAdmin, com seletor de organização), Manual e
Conformidade MTE (30 exigências legais com a situação de cada uma). Barra lateral flutuante de vidro
(recolhe/expande, pílula deslizante, árvore de subitens, tooltips, modo noturno), busca Ctrl+K,
abertura com revelação circular, transições entre telas (View Transitions), versão celular.
Sessão em cookies httpOnly via BFF (`/api/*`). MANUAL.md e CONFORMIDADE_MTE.md são gerados do mesmo
conteúdo das telas (`npm run docs -w @superponto/web`).

**API** (`apps/api`, 59 testes contra PostgreSQL real com o papel sujeito à RLS):
- Autenticação com `@nestjs/authentication`: login por sessão (cookie `__Host-sid` httpOnly) e por
  token (JWT 15 min + refresh rotativo com detecção de reuso), saída, `/me`, esqueci minha senha
  (link de uso único, 1 h, mesma resposta para e-mail inexistente), scrypt (OWASP), limite de
  tentativas, CSRF. Store em Prisma aprovado na **suíte oficial de contrato do pacote, com testes de
  concorrência**.
- Multi-tenant: tenant vem da sessão/token; só o SuperAdmin escolhe outro (`X-Tenant-Id`); a
  transação fixa `app.tenant_id` e o banco recusa o resto. Teste: o cliente B não lê, não edita e não
  exclui dados do cliente A, nem trocando o cabeçalho.
- Permissões: 50 permissões `modulo.recurso:acao`, 15 perfis de sistema (SuperAdmin, Administrador,
  Diretor, RH, Gestor, Supervisor, Coordenadores escolar/médico/operacional, Responsáveis por escalas e
  equipamentos, Funcionário, Professor, Médico, Profissional da saúde), escopo por tenant, empresa,
  unidade ou departamento; verificadas na API.
- Auditoria na mesma transação da alteração (antes/depois, ator, IP, navegador).
- Empresas: listar (busca, paginação), detalhar, cadastrar, editar, excluir logicamente (bloqueia com
  vínculos ativos), CNPJ normalizado e único por cliente.
- SuperAdmin: listar e criar clientes; o primeiro administrador recebe e-mail para definir a senha.
- Health check, Swagger em `/docs`, CI dedicado (`.github/workflows/platform-ci.yml`).

## Próximos passos (fase 2 → 3)

1. Equipamentos: leitura de AFD das Portarias 1510/2009 e 671/2021, envio de empregador,
   funcionários e digitais ao REP, terminal Android (APK em tela cheia).
2. MFA (TOTP) nas rotas administrativas e de SuperAdmin.
3. Unidades, departamentos, cargos, usuários e perfis personalizados (API + telas).
4. Pessoas e vínculos com múltiplas matrículas; jornadas e escalas usando o motor.

## Decisões

| Decisão | Situação |
|---|---|
| Banco | **Supabase** (esquema `superponto`), pronto para VPS: `scripts/db-move.sh` testado de ponta a ponta |
| API | Imagem Docker + `deploy/docker-compose.yml`; roda em qualquer servidor com Docker |
| Communication Server | Repositório `uviniribeiro/superponto-communication-server` criado; recebe o código na fase 7 |
| Dados da v1 (Lovable Cloud) | **Backup completo feito em 15/11/2026** (35 contas com senha, 11 empresas, 28 perfis, 12 marcações, 16 arquivos); importação validada; aguarda os secrets do Supabase próprio |

## Riscos técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| Escopo total (19 módulos, 26 grupos de telas) | Prazo longo | Entregas por fase, cada uma testada e utilizável |
| `@nestjs/authentication` em versão 0.x | Mudanças de API | Versão fixada; store validado pela suíte oficial; atualização com os testes |
| Protocolos proprietários de relógios | Integração sem equipamento real é especulativa | Adaptadores portados do robô v1 e homologação só com equipamento real |
| Conformidade (Portaria 671, AFD/AEJ, LGPD) | Comercialização como "homologado" | Validação técnica e jurídica por modalidade antes da venda |
| Migração da v1 (132 tabelas, dados reais) | Perda ou inconsistência de dados | ETL com contagens e conferência; v1 ativa até a virada |
| Dados do Lovable Cloud | — | Backup feito e importação validada; Cloud pode ser desligado |
