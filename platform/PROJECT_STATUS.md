# SuperPonto v2 — Situação do projeto

Atualizado em 20/11/2026 (servidor reescrito em Dart e telas reescritas em Flutter, com visual liquid glass; sem integração com Átomo/Velti por decisão do cliente). A v1 (raiz do repositório) segue em produção; a v2 é construída em
`platform/` e substitui a v1 na fase 10.

## Fases

| Fase | Escopo | Situação |
|---|---|---|
| 1. Auditoria e planejamento | Inventário da v1, arquitetura, modelo de dados, módulos, riscos | **Concluída** |
| 2. Infraestrutura e base | Monorepo, API NestJS, Prisma, autenticação, multi-tenant, permissões, auditoria | **Concluída** — inclui verificação em duas etapas (TOTP) |
| 3. Núcleo de gestão | Empresas, unidades, estrutura, funcionários, vínculos, jornadas, escalas | **Concluída** |
| 4. Módulos especializados | Educação, saúde, operacional | **Concluída (versão básica)** — plantões com cobertura e trocas; turmas, grade e aulas; ocorrências com histórico |
| 5. Controle de ponto | Marcações, apuração, banco de horas, solicitações, relatórios | **Concluída** — 38 relatórios, ciência do espelho, AEJ e AFD do REP-P com NSR |
| 6. Equipamentos | Cadastro, adaptadores, sincronização, homologação | **Concluída no software** — agente local com drivers Control iD e Henry; homologação em equipamento real pendente |
| 7. Communication Server | Serviço de comunicação com os relógios | **Separado** no repositório `superponto-communication-server` (Dart): servidor de comunicação com fila em disco + agente local na rede do cliente. O sistema só aceita agentes vindos dele (`COMM_SERVER_TOKEN`) |
| 8. SaaS e SuperAdmin | Planos, assinaturas, limites | **Concluída** — planos com limites, assinatura por cliente, suspensão; cobrança automática depende do meio de pagamento |
| 9. Testes e homologação | Ampliação contínua | 212+ testes de API, motor, protocolos e agente na CI |
| 10. Produção | Docker, servidores, migração da v1, virada | **Pronta para executar** — migração v1→v2 testada (`node dist/migrate-v1.js`), roteiro em `VIRADA.md` |

## Dart e Flutter (20/11/2026)

- **Servidor em Dart** (`dart/server`): mesma API da versão Node, validada pelos mesmos 215 testes de contrato
  (rodam contra os dois servidores na CI). Binário nativo; serve também o app web na mesma origem (`WEB_DIR`).
- **App Flutter** (`flutter/app`): substitui as telas Next.js nas 52 páginas, com login, recuperação de senha,
  MFA e o mesmo menu por permissões. Um código só para web, Android, iOS, Windows, macOS e Linux; visual
  liquid glass (vidro fosco com desfoque, borda luminosa e fundo animado) com os mesmos tokens de cor e o
  mesmo logo da identidade. Verificado no navegador: todas as telas abrem sem erro de tela ou de API, como
  administrador e como funcionário, no computador e no celular.
- **Publicação**: tag `platform-vX.Y.Z` → imagem `ghcr.io/<dono>/superponto-v2` (API + app web) e os apps
  Android (APK), Windows, macOS, Linux e iOS (sem assinatura) anexados à release
  (`.github/workflows/platform-release.yml`). A App Store/Play Store exigem as contas e certificados da empresa.

## O que já funciona (verificado por testes)

**Banco (PostgreSQL 17, Prisma 7)** — 82 tabelas; RLS por tenant em 64 delas; marcações, auditoria e
eventos de equipamento imutáveis; pessoas e vínculos sem exclusão física; período fechado protegido.

**Motor de jornada** (`packages/time-engine`, 33 testes) — jornada fixa e flexível, escalas 12x36,
6x1, 5x2, 4x2 e rotativas por ciclo, plantão noturno atravessando a meia-noite, atribuição de
marcações ao dia da jornada, tolerância da CLT (5 min por marcação / 10 min no dia), extras por
percentual (normal, noturna, folga, feriado, intervalo), hora noturna reduzida, faltas, afastamentos,
banco de horas com vencimento FIFO e multiplicadores, resumo do período.

**CNPJ alfanumérico** (`packages/br-docs`, 7 testes) — validação e máscara do CNPJ numérico e do
alfanumérico (IN RFB 2.229/2024), com o exemplo oficial; usado pela API, pelo banco (restrição de
formato) e pelas telas. Multi-CNPJ: cada cliente tem várias empresas e o mesmo CNPJ pode existir em
clientes diferentes, sem vazamento.

**Equipamentos** (`packages/rep-protocols`, 18 testes; API, 14 testes) — leitura de AFD das
Portarias 1.510/2009 (PIS, data sem fuso) e 671/2021 (CPF, fuso, REP-P com hash), com detecção
automática; importação idempotente que cria marcações com hash encadeado; fila de envio ao REP
(empregador, funcionários, digitais) conferindo PIS/CPF por portaria; digitais cifradas (AES-256-GCM)
com permissão própria; adaptador Control iD. Terminal Android: APK em tela cheia/quiosque gerado
pelo workflow **APK do terminal**.

**Cadastro inteligente e feriados** — consulta de CNPJ na Receita (BrasilAPI) e de CEP (BrasilAPI
com reserva ViaCEP), com cache, limite por minuto e código IBGE/fuso; formulário de empresa que se
preenche sozinho. Feriados nacionais (fixos, móveis pela Páscoa e 20/11), estaduais e municipais
(base inicial das capitais) por empresa; geração anual automática e idempotente (ano corrente e o
seguinte, na subida da API e a cada 6 h); feriados próprios da empresa repetidos todo ano e decisão
de folga/trabalho por data (14 testes de API, 7 de regras).

**Usuários, suporte e permissões** — cada cliente nasce com Administrador e Suporte SuperPonto
(clientes antigos recebem o suporte na subida da API); o suporte fica oculto da lista e, quando
logado, aparece sem poder ser editado. Catálogo de 72 permissões separadas por recurso e ação, com
nomes para a tela; perfis personalizados por cliente; telas de Usuários e de Perfis e permissões
(9 testes de API).

**Estrutura (fase 1 do plano Átomo)** — departamentos em árvore com seções e proteção contra
ciclos; cargos com CBO; funções, centros de custo, tipos de funcionário, sindicatos (CNPJ, data-base)
e competências por uma fábrica de cadastros com auditoria, busca, isolamento por cliente e bloqueio
de exclusão quando em uso; empresa com inscrição estadual, CEI/CNO e código externo (15 testes).

**Pessoas e acesso (fase 2 do plano Átomo)** — funcionários (pessoa + vínculos), CPF/PIS validados e
mascarados sem permissão, histórico com vigência, desligamento/reativação; importação CSV com
conferência por linha e criação opcional de cadastros; agrupamentos; dias de acesso, bloqueio por
período (derruba sessões), troca obrigatória e troca de senha (18 testes). Logo da empresa. Unidades e
locais com cerca virtual, também nos agrupamentos. Login pela rede (LDAP/Active Directory) por cliente:
conta de serviço com senha cifrada, filtro com escape contra injeção, bloqueio de endereço interno no
SaaS, sem senha local para contas LDAP (8 testes contra OpenLDAP real, que também roda na CI).

**Jornada (fase 3 do plano Átomo)** — horários semanais, flexíveis e em ciclo (até 62 dias) com
intervalo previsto, carga semanal calculada, considera feriado, in itinere e mobilidade de entrada e de
intervalo; regras de apuração com limites legais e faixas de extra; atribuição em lote com vigência e
histórico; escala agendada por período e dias da semana; troca de escala e de folga; jornada prevista
por funcionário e grade da equipe com feriados; período fechado bloqueia mudanças (12 testes de API,
7 novos no motor).

**Ponto, bancos e solicitações (fases 4 e 5 do plano Átomo)** — apuração (jornada prevista +
marcações originais/incluídas/desconsideradas + abonos e afastamentos + regras) pelo motor; espelho,
meu espelho e espelho diário; ajustes com aprovação (original preservado); justificativas com limite;
abonos em lote; afastamentos; sobreaviso; cálculo em lote, fechamento que grava a apuração e lança o
banco, reabertura em ordem; marcação pelo navegador com desafio de uso único, intervalo mínimo, cerca
virtual e comprovante; banco de horas (regras, FIFO com vencimento, extrato, lançamentos, zerar em
lote); solicitações com fluxos de até 5 etapas e efeito na aprovação final; política de hora extra
(13 testes de API). Banco de compensação semanal/mensal e meu banco de horas (4 testes). Pendentes: PDF
assinado e ciência do espelho, NSR do REP-P.

**Equipamentos (fase 6)** — cadastro com portaria, nº do REP, grupo, coleta e alertas; comandos de envio
e recebimento (empregador, funcionários, digitais, data/hora, registros) por equipamento ou grupo;
protocolo do agente local com chave por equipamento; cadastro × relógio; alerta de sem comunicação e
retorno por e-mail; gráfico diário; exportação das linhas originais do AFD; AEJ (Portaria 671) gerado da
apuração (10 testes). Assinatura CAdES (.p7s) do AFD do REP-P e do AEJ com o certificado A1 da empresa (cifrado no servidor). Homologação dos drivers em equipamento real pendente.

**Relatórios (fase 7)** — 30 relatórios com filtros padronizados, montador por campos e exportação Excel,
CSV e PDF pela impressão (10 testes).

**App web** (`apps/web`, Next.js 16) — login, esqueci/redefinir senha, painel com dados reais,
empresas (CRUD com CNPJ alfanumérico), clientes (SuperAdmin, com seletor de organização), Manual e
Conformidade MTE (30 exigências legais com a situação de cada uma). Barra lateral flutuante de vidro
(recolhe/expande, pílula deslizante, árvore de subitens, tooltips, modo noturno), busca Ctrl+K,
abertura com revelação por lente, transições entre telas (View Transitions), versão celular. Visual de
vidro com fundo vivo e janela flutuante; painel inicial com números reais (resumo próprio na API).
Sessão em cookies httpOnly via BFF (`/api/*`). MANUAL.md e CONFORMIDADE_MTE.md são gerados do mesmo
conteúdo das telas (`npm run docs -w @superponto/web`).

**API** (`apps/api`, 190 testes contra PostgreSQL real com o papel sujeito à RLS):
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

1. Equipamentos: telas (cadastro, importar AFD, digitais), execução da fila pelo Communication
   Server e homologação com equipamento Control iD real.
2. MFA (TOTP) nas rotas administrativas e de SuperAdmin.
3. Unidades, departamentos, cargos, usuários e perfis personalizados (API + telas).
4. Pessoas e vínculos com múltiplas matrículas; jornadas e escalas usando o motor.

## Decisões

| Decisão | Situação |
|---|---|
| Banco | **Supabase** (esquema `superponto`), pronto para VPS: `scripts/db-move.sh` testado de ponta a ponta |
| API | Imagem `ghcr.io/…/superponto-v2` + `deploy/docker-compose.yml` (banco, migrações, API, HTTPS); publicação nos servidores pronta e desligada até a troca |
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
