# Análise: Átomo Ponto × SuperPonto

> **Andamento (15/11/2026, V2):**
> - Fase 1 (estrutura) concluída: departamentos em árvore com seções, cargos (CBO), funções, centros
>   de custo, tipos de funcionário, sindicatos, competências e empresa com inscrição estadual,
>   CEI/CNO, código externo e logo.
> - Fase 3 (jornada) concluída: horários semanais, flexíveis e em ciclo com configuração avançada
>   (considera feriado, in itinere, mobilidade de entrada e de intervalo), regras de apuração com
>   faixas de extra, atribuição com vigência, escala agendada, troca de escala e de folga e grade da
>   equipe.
> - Fase 2 (pessoas e usuários) concluída: funcionários com vínculos e histórico, desligamento,
>   importação por planilha com conferência, agrupamentos, dias de acesso, bloqueio por período, troca
>   obrigatória e troca de senha pelo usuário, unidades/locais com cerca virtual e login pela rede
  (LDAP/Active Directory). Captura de digital pelo leitor fica para a fase 6
>   (equipamentos), porque depende do aplicativo local do leitor; o cadastro e o envio das digitais
>   aos relógios já existem na API.

Fontes: manual do sistema Átomo (2 PDFs, 162 páginas, 131 funções; inventário com campos em
`docs/atomo-inventario.json`), Swagger e coleção Postman da API "servicoponto", e tela de login de
https://ponto.montesclaros.mg.gov.br/atomo. Comparado com a **v1** (sistema no ar; existência de
tela verificada pelas rotas do código, não pela profundidade de cada tela) e a **V2** (`platform/`).

Legenda: ✅ tem · 🟡 parcial · ❌ não tem

## Resumo

| | Funções do Átomo | v1 tem tela | V2 pronta |
|---|---|---|---|
| Cadastros | 18 | 13 | 11 |
| Ponto (configuração) | 8 | 5 | 0 (cálculo pronto no motor) |
| Comunicação com equipamentos | 12 | 6 | 3 (via API) |
| Movimentação | 16 | 11 | 0 |
| Bancos de horas e compensação | 4 | 3 | 0 (cálculo pronto no motor) |
| Exportação e importação | 5 | 3 | 1 (importação de AFD) |
| Marcações | 3 | 2 | 0 |
| Relatórios | 41 | 9 | 0 |
| Segurança | 4 | 3 | 2 |
| Ferramentas | 11 | 6 | 1 (manual) |
| Ajuda, extras, novidades | 9 | 3 | 2 |
| **Total** | **131** | | |

**Onde o Átomo vai além do SuperPonto hoje:** cerca de 35 relatórios que não existem (analíticos de
atraso, extra e falta, absenteísmo, assiduidade, déficit de intervalo, TAC, folha de conferência,
divergência, assinatura eletrônica, log do espelho etc.); gerador de relatório próprio; agrupamento,
centro de custo, seção e tipo de funcionário; mobilidade de intervalo; política de aprovação em
níveis; política de hora extra com justificativa de crédito; cálculo em lote com abrir/fechar
ponto; espelho diário de vários funcionários; zerar banco de horas em lote; receber funcionários e
digitais do relógio (não só enviar); grupo de REP, gráficos de comunicação e agendamento de coleta;
bloqueio de acesso por período e acesso por dias da semana; agendamento de notificação por e-mail;
token do app móvel por e-mail; backup e restauração; log de processos e de navegação.

**Onde o SuperPonto já vai além do Átomo:** multiempresa SaaS com isolamento no banco, CNPJ
alfanumérico, feriados municipais automáticos por CEP, consulta de CNPJ na Receita, Portaria 671
completa (REP-P com hash, CPF), digitais cifradas, módulos de Educação, Saúde e Operacional,
checklist de conformidade MTE, app do funcionário com GPS e selfie, terminal em quiosque.

**Dá para incluir tudo?** Sim. Nada no manual depende de tecnologia que o SuperPonto não use; a
maior parte é cadastro, cálculo (já existe no motor da V2) e relatório. As exceções e cuidados estão
na última seção.

## Cadastros

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Agrupamento (vincula funcionários, locais e cargos) | ❌ | ✅ funcionários, cargos e unidades | Nova entidade "Agrupamento" usada como filtro em relatórios, cálculo em lote e permissões |
| Especialidades | ❌ | 🟡 modelo (especialidade do vínculo) | Tela na fase de Pessoas |
| Cargo | ✅ | ✅ com CBO e categoria | Tela na fase de Estrutura |
| Centro de custo | ❌ | ✅ | Nova entidade, vinculada ao vínculo e à exportação para folha |
| Cidade | ✅ | ✅ automático pelo CEP (IBGE) | Sem cadastro manual: vem do CEP |
| Competência (períodos nomeados) | ✅ | ✅ | Tela de competências; usada como filtro em todo o sistema |
| Departamento (com subdepartamentos) | ✅ | ✅ árvore sem limite de níveis | Tela com árvore de subdepartamentos |
| Empresa | ✅ | ✅ com CNPJ/CEP automáticos, IE, CEI/CNO, código externo e logo | — |
| Estado civil | ✅ | ❌ | Lista fixa no cadastro de pessoa (não precisa de tela) |
| Feriado | ✅ | ✅ (automático, melhor que o Átomo) | — |
| Função | 🟡 | ✅ | Tela simples junto com Cargo |
| Funcionário (com aba de biometria) | ✅ | ✅ vínculos, histórico, desligamento; digitais na API | Captura pelo leitor na fase 6 |
| Justificativa (código, limite de uso, desconsidera débitos) | ✅ | ❌ | Tela de justificativas com limite de uso por período |
| Local de trabalho | ✅ | ✅ unidades e locais por empresa | — |
| Local georreferenciado (aprovar mobile automaticamente) | ✅ | 🟡 cerca virtual na unidade (tela pronta); aprovação automática vem com a marcação mobile | Tela de cercas com aprovação automática dentro do raio |
| Seção | ❌ | ✅ dentro do departamento | Nível opcional abaixo de departamento |
| Sindicato | ✅ | ✅ com CNPJ e data-base | Tela + vínculo com regras da convenção |
| Tipo de funcionário | ❌ | ✅ | Tabela configurável por cliente |

## Ponto (configuração)

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Escala agendada | ✅ | ✅ trabalho/folga por dia, em lote por período e dias da semana | — |
| Escala fixa (ciclo, DSR, considera feriado) | ✅ | ✅ ciclos até 62 dias, considera feriado, grade da equipe | — |
| Gerenciar banco de dados (backup/restauração) | ❌ | ❌ | Backup automático do servidor + exportação dos dados do cliente; restauração só pela equipe SuperPonto |
| Hora in itinere | ✅ | ✅ no horário, somada nos dias trabalhados | — |
| Horário (códigos, carga, noturno, DSR, mobilidade de jornada) | ✅ | ✅ código, carga semanal, noturno, mobilidade de entrada | — |
| Mobilidade de intervalo | ❌ | ✅ janela para o início do intervalo | — |
| Percentual extra | ✅ | ✅ percentuais por tipo de dia e faixas | — |
| Política de aprovação (níveis de hierarquia) | ❌ | 🟡 fluxos no modelo | Tela de fluxos de aprovação em níveis |

## Comunicação com equipamentos

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Enviar data e hora | 🟡 | ✅ comando na API | Tela de equipamentos |
| Enviar/receber digital | 🟡 | 🟡 envio na API | Acrescentar **receber** digitais do relógio |
| Enviar/receber empresa | ❌ | 🟡 envio na API | Acrescentar receber |
| Enviar/receber funcionário (verificar digital, só não salvos) | ✅ envio | 🟡 envio na API | Acrescentar receber e comparar com o cadastro |
| Equipamento (alertas de energia, conexão, USB fiscal, e-mail) | ✅ | 🟡 modelo | Tela + alertas por e-mail |
| Exportação de registros (AFD por funcionário/empresa/equipamento) | 🟡 formato com erro | ❌ | Gerador de AFD no leiaute oficial (o leitor já existe) |
| Exportar empresa / funcionário | ❌ | ❌ | Exportação em arquivo para outros sistemas |
| Gerenciamento de coleta (agendamentos) | 🟡 | ❌ | Agendamento no Servidor de Comunicação |
| Grupo REP | ❌ | ❌ | Agrupar equipamentos por departamento/local |
| Gráficos de comunicação | 🟡 saúde do agente | ❌ | Painel com histórico de conexão |
| Status de equipamento | ✅ | ❌ | Tela de status |
| Status do funcionário no equipamento | 🟡 | ❌ | Lista enviados/excluídos/pendentes por relógio |

## Movimentação

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Abono em lote | ✅ | ❌ | Tela de abono em lote |
| Afastamento | ✅ | ❌ | Tela + importação (também pela integração Átomo) |
| Cálculo em lote (calcular, abrir e fechar ponto) | 🟡 | ❌ | Tela; fechamento já protegido no banco da V2 |
| Espelho ponto | ✅ | ❌ | Tela central da fase de Ponto |
| Espelho ponto diário (vários funcionários) | 🟡 | ❌ | Visão diária da equipe |
| Layout de exportação (folha) | ✅ | ❌ | Layouts configuráveis por sistema de folha |
| Meu espelho / Meu extrato BH / Meu extrato BC / Meu holerite | ✅ | ❌ | Área do funcionário |
| Minhas solicitações / Solicitações | ✅ | ❌ | Módulo de solicitações com fluxo de aprovação |
| Painel de ocorrência | ✅ | ❌ | Painel do gestor |
| Sobreaviso | ✅ | ❌ | Lançamento e cálculo de sobreaviso |
| Zerar banco de horas em lote | ❌ | ❌ | Ação em lote com motivo e auditoria |

## Bancos de horas e de compensação

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Cadastro BH (vencimento, limites, ocorrências, prioridade) | ✅ | 🟡 motor com vencimento | Tela de regras de banco de horas |
| Extrato BH | ✅ | ❌ | Extrato por funcionário |
| Cadastro BC / Extrato BC | ✅ | ❌ | Mesma base do BH, regras de compensação |

## Exportação, importação e marcações

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Arquivos MTE (AFD, AEJ, ACJEF) | 🟡 | ❌ | Geradores no leiaute oficial da Portaria 671 (e 1.510 para legado) |
| Exportar ocorrências | ✅ | ❌ | Junto com layouts de folha |
| Importar funcionário | ✅ | ✅ CSV com conferência por linha | — |
| Importar holerite | 🟡 | ❌ | Importação de arquivo do sistema de folha |
| Importar registros (AFD) | 🟡 | ✅ | — |
| Marcação desconsiderada / efetuada | 🟡 | ❌ | Listas com motivo (a marcação original nunca é apagada) |
| Marcação de ponto web (com captcha) | ✅ sem captcha | ❌ | Registro web com proteção contra robôs |

## Relatórios (41 no Átomo)

v1 tem: cartão ponto, espelho, MTE, presença, ausências, horas trabalhadas, extras, banco de horas,
rotatividade. **Faltam:** aniversariantes, auditoria completa, banco de compensação, clima
organizacional, customizado, escala fixa, escala mensal, eventos do equipamento, feriados, folha de
conferência, funcionários, holerite, login e falha, navegação de página, alteração de senha, TAC
(inter e intrajornada), solicitações, troca de escala, ajuste manual, marcação incompleta,
marcação mobile, abono, absenteísmo, analítico de atraso, de extra e de falta, assiduidade, déficit
de intervalo, intervalo não calculável, sobreaviso, assinatura eletrônica, divergência, folha ponto,
frequência sintético, log do espelho, Portaria 1.510, usuários do grupo e funcionalidades do grupo.

Como incluir: um módulo de relatórios com filtros padronizados (empresa, departamento com
subdepartamentos, tipo de funcionário, agrupamento, competência/período, situação) e saída em
PDF/Excel/CSV, gerando cada relatório a partir do motor de cálculo.

## Grupos, segurança e ferramentas

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Grupo (telas visíveis por grupo) | 🟡 | ✅ perfis com permissão por recurso | — |
| Usuário (acesso por dias da semana, troca de senha no login, LDAP) | ✅ | ✅ dias de acesso, troca obrigatória e LDAP/AD | — |
| Alterar senha | ✅ | ✅ Minha conta | — |
| Bloqueio de acesso (motivo, período) | ❌ | ✅ | — |
| Agendamento de notificação (e-mail de ocorrências) | 🟡 | ❌ | Agendador de e-mails |
| Calculadora de horas | ✅ | ❌ | Ferramenta simples |
| Configuração do sistema | ✅ | ❌ | Configurações do cliente |
| Dashboard (falta, atraso, absenteísmo, abono) | ✅ | 🟡 painel inicial | Indicadores do motor de cálculo |
| Gerador de relatório (SQL próprio) | ❌ | ❌ | **Com cuidado**: em SaaS multiempresa, SQL livre quebraria o isolamento; oferecer montador de relatório por campos, não SQL |
| Gerenciar funcionalidades (ativar módulos) | 🟡 licenças | ❌ | Ligado aos planos do SaaS |
| Informação (mensagem no app) | ❌ | ❌ | Avisos para o app do funcionário |
| Log de processos / navegação | ❌ | 🟡 auditoria | Registro de processos e acessos |
| Painel de funcionário (atrasados, ausentes, sem horário) | ✅ | ❌ | Painel ao vivo com alerta por e-mail |
| Texto customizado | ✅ | ❌ | Textos por cliente |
| Token do app móvel (liberação por e-mail) | 🟡 | ❌ | Liberação de aparelho com código por e-mail |
| Dicas, vídeos, novidades, sobre | ❌ | 🟡 manual | Central de ajuda |
| Documentação de integração | ❌ | ✅ Swagger da API | — |
| Justificativa de crédito / Política de hora extra | ❌ | 🟡 permissão de aprovar extra | Aprovação de extra com justificativa e limites |

## Plano de inclusão (V2)

Cada fase entra com API, tela, testes e atualização do manual, na ordem que destrava as seguintes:

1. **Estrutura completa**: unidades/locais, departamentos com subdepartamentos, seção, cargo, função,
   centro de custo, tipo de funcionário, agrupamento, sindicato, competências; empresa com IE, CEI/CNO
   e logo.
2. **Pessoas**: funcionário com vínculos, importação por planilha, captura de digital; usuário com
   dias de acesso, troca obrigatória de senha e bloqueio por período.
3. **Jornada**: horários (com configuração avançada, in itinere, mobilidade de intervalo e de
   jornada), percentuais extra, escalas fixas e agendadas, troca de escala.
4. **Ponto**: espelho e espelho diário, ajustes, abonos (inclusive em lote), justificativas com
   limite, afastamentos, sobreaviso, cálculo em lote com abrir/fechar ponto, marcação web com
   proteção contra robôs.
5. **Bancos e solicitações**: banco de horas e de compensação (regras, extratos, zerar em lote),
   solicitações com política de aprovação em níveis, política de hora extra.
6. **Equipamentos**: telas, enviar e **receber** empresa/funcionários/digitais, status, grupo de REP,
   gráficos, agendamento de coleta, alertas por e-mail, exportação AFD/AEJ oficiais.
7. **Relatórios**: os 41, com filtros padronizados e PDF/Excel/CSV; montador de relatórios por campos.
8. **Ferramentas**: painel de funcionários ao vivo, agendamento de notificações, avisos no app, token
   do app, textos customizados, central de ajuda.
9. **Integração Átomo** (conector pronto): tela de conexão por cliente para importar marcações e
   enviar ajustes, abonos, escalas e aprovações (precisa de token do sistema de origem).

## Cuidados

- **Gerador de relatório com SQL livre**: não será copiado. No SaaS, SQL digitado pelo cliente
  poderia ler dados de outros clientes. O equivalente seguro é escolher campos e filtros.
- **Backup e restauração pelo cliente**: num servidor compartilhado, restaurar um backup voltaria os
  dados de todos. O cliente terá exportação dos próprios dados; backup e restauração ficam com a
  equipe SuperPonto.
- **Licença por arquivo**: o Átomo valida licença por arquivo; no SaaS isso vira o plano contratado.
- **Visual**: as funções são reproduzidas com as regras descritas no manual, no visual do SuperPonto,
  sem copiar marca, textos ou telas do Átomo.
