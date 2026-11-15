# Análise: Átomo Ponto × SuperPonto

> **Andamento (15/11/2026, V2):**
> - Fases 8 e 9 concluídas e fase 7 completa: painel ao vivo, e-mails agendados, avisos com
>   confirmação de leitura, liberação de aparelho do app por código no e-mail, textos personalizados,
>   central de ajuda com calculadora de horas, ciência eletrônica do espelho, 38 relatórios, layout e
>   arquivo para a folha e importação de marcações por planilha. **Por decisão do cliente, o
>   SuperPonto não se comunica com o Átomo/Velti**: os recursos equivalentes foram feitos de forma
>   nativa. Agente local (programa) pronto com driver Control iD e simulador.
> - Fase 1 (estrutura) concluída: departamentos em árvore com seções, cargos (CBO), funções, centros
>   de custo, tipos de funcionário, sindicatos, competências e empresa com inscrição estadual,
>   CEI/CNO, código externo e logo.
> - Fases 6 e 7 concluídas: equipamentos (cadastro, grupos, comandos de envio e recebimento,
>   agente local com chave, cadastro × relógio, alertas por e-mail, gráfico, exportação de
>   registros, AEJ) e 30 relatórios com montador e Excel/CSV/PDF. Fase 5 completa com banco de
>   compensação e meu banco de horas.
> - Fases 4 e 5 (ponto, bancos e solicitações) concluídas: espelho e espelho diário, ajustes com
>   aprovação, justificativas com limite, abonos em lote, afastamentos, sobreaviso, cálculo em lote,
>   fechar/reabrir ponto, marcação pelo navegador com proteção contra robôs, banco de horas (regras,
>   extrato, lançamentos, zerar em lote), solicitações com aprovação em até 5 etapas e política de
>   hora extra. PDF assinado do espelho fica para depois.
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
| Justificativa (código, limite de uso, desconsidera débitos) | ✅ | ✅ abona ou só justifica, limite por mês/ano | — |
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
| Enviar/receber digital | 🟡 | ✅ enviar e receber (cifradas, sem duplicar) | Captura pelo leitor USB no agente |
| Enviar/receber empresa | ❌ | ✅ enviar e receber (confere o CNPJ) | — |
| Enviar/receber funcionário (verificar digital, só não salvos) | ✅ envio | ✅ enviar, receber e comparar com o cadastro | — |
| Equipamento (alertas de energia, conexão, USB fiscal, e-mail) | ✅ | ✅ tela; alerta de conexão por e-mail | Alertas de energia/USB dependem do agente por marca |
| Exportação de registros (AFD por funcionário/empresa/equipamento) | 🟡 formato com erro | 🟡 linhas originais por equipamento; AEJ gerado | AFD do REP-P com NSR |
| Agente de comunicação (Crab/Octopus no Átomo) | 🟡 robô Python | ✅ agente local com drivers Control iD, Henry (protocolo 8x) e simulador; Topdata, Biomtech, Dahua e RW pendentes | Driver por marca, com documentação do fabricante e equipamento para homologar |
| Exportar empresa / funcionário | ❌ | ✅ relatórios Funcionários e Usuários em Excel/CSV | — |
| Gerenciamento de coleta (agendamentos) | 🟡 | ✅ intervalo por equipamento, executado pelo agente | — |
| Grupo REP | ❌ | ✅ grupo com comando para todos | — |
| Gráficos de comunicação | 🟡 saúde do agente | ✅ registros e contatos por dia | — |
| Status de equipamento | ✅ | ✅ comunicando/sem comunicação, fila e falhas | — |
| Status do funcionário no equipamento | 🟡 | ✅ cadastro × relógio e último envio | — |

## Movimentação

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Abono em lote | ✅ | ✅ dia inteiro ou minutos, pulando folgas, com limite | — |
| Afastamento | ✅ | ✅ tela | — |
| Cálculo em lote (calcular, abrir e fechar ponto) | 🟡 | ✅ calcular, fechar (lança banco) e reabrir com motivo | — |
| Espelho ponto | ✅ | ✅ tela e impressão (PDF assinado pendente) | Assinatura e ciência eletrônica |
| Espelho ponto diário (vários funcionários) | 🟡 | ✅ situação de cada funcionário no dia | — |
| Layout de exportação (folha) | ✅ | ❌ | Layouts configuráveis por sistema de folha |
| Meu espelho / Meu extrato BH / Meu extrato BC / Meu holerite | ✅ | ✅ meu espelho, meu banco e registrar ponto | Holerite |
| Minhas solicitações / Solicitações | ✅ | ✅ até 5 etapas, efeito aplicado na aprovação | — |
| Painel de ocorrência | ✅ | ❌ | Painel do gestor |
| Sobreaviso | ✅ | ✅ lançamento e 1/3 no espelho | — |
| Zerar banco de horas em lote | ❌ | ✅ pagar positivos ou zerar, com auditoria | — |

## Bancos de horas e de compensação

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Cadastro BH (vencimento, limites, ocorrências, prioridade) | ✅ | ✅ vencimento, limite diário, multiplicador | — |
| Extrato BH | ✅ | ✅ saldo corrido e próximo vencimento | — |
| Cadastro BC / Extrato BC | ✅ | ✅ compensação semanal/mensal e extrato por período | — |

## Exportação, importação e marcações

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Arquivos MTE (AFD, AEJ, ACJEF) | 🟡 | ❌ | Geradores no leiaute oficial da Portaria 671 (e 1.510 para legado) |
| Exportar ocorrências | ✅ | ✅ analíticos em Excel/CSV | — |
| Layout de folha (eventos/rubricas) | 🟡 | ✅ layout por empresa e arquivo do período | — |
| Importar funcionário | ✅ | ✅ CSV com conferência por linha | — |
| Importar holerite | 🟡 | ❌ | Importação de arquivo do sistema de folha |
| Importar registros (AFD) | 🟡 | ✅ | — |
| Importar marcações por planilha | ❌ | ✅ CSV/TXT com conferência, sem duplicar | — |
| Marcação desconsiderada / efetuada | 🟡 | ✅ relatório de ajustes e log do espelho | — |
| Marcação de ponto web (com captcha) | ✅ sem captcha | ✅ com desafio assinado de uso único | — |

## Relatórios (41 no Átomo)

v1 tem: cartão ponto, espelho, MTE, presença, ausências, horas trabalhadas, extras, banco de horas,
rotatividade. **Faltam:** aniversariantes, auditoria completa, banco de compensação, clima
organizacional, customizado, escala fixa, escala mensal, eventos do equipamento, feriados, folha de
conferência, funcionários, holerite, login e falha, navegação de página, alteração de senha, TAC
(inter e intrajornada), solicitações, troca de escala, ajuste manual, marcação incompleta,
marcação mobile, abono, absenteísmo, analítico de atraso, de extra e de falta, assiduidade, déficit
de intervalo, intervalo não calculável, sobreaviso, assinatura eletrônica, divergência, folha ponto,
frequência sintético, log do espelho, Portaria 1.510, usuários do grupo e funcionalidades do grupo.

**V2 (fase 7):** 30 relatórios com filtros padronizados (empresa, período, departamento com ou sem
subdepartamentos, agrupamento) e saída em Excel, CSV e PDF pela impressão, mais o montador por campos
(substitui o "customizado" sem SQL livre). Fase 7 completa com 38 relatórios: entraram divergência,
intervalo não calculável, espelho no leiaute da Portaria (por PIS), ciência eletrônica do espelho
(assinatura eletrônica), log do espelho, acessos com falhas de login, alterações de senha e
funcionalidades por perfil. Fora do escopo: holerite (é do sistema de folha), clima organizacional
(pesquisa de RH, não é ponto) e navegação de página (registrar cada clique gera dados pessoais sem
necessidade; a auditoria registra as alterações e os acessos).

## Grupos, segurança e ferramentas

| Átomo | v1 | V2 | Como incluir |
|---|---|---|---|
| Grupo (telas visíveis por grupo) | 🟡 | ✅ perfis com permissão por recurso | — |
| Usuário (acesso por dias da semana, troca de senha no login, LDAP) | ✅ | ✅ dias de acesso, troca obrigatória e LDAP/AD | — |
| Alterar senha | ✅ | ✅ Minha conta | — |
| Bloqueio de acesso (motivo, período) | ❌ | ✅ | — |
| Agendamento de notificação (e-mail de ocorrências) | 🟡 | ✅ e-mails agendados com prévia e envio imediato | — |
| Calculadora de horas | ✅ | ✅ central de ajuda | — |
| Configuração do sistema | ✅ | ❌ | Configurações do cliente |
| Dashboard (falta, atraso, absenteísmo, abono) | ✅ | 🟡 painel inicial | Indicadores do motor de cálculo |
| Gerador de relatório (SQL próprio) | ❌ | ❌ | **Com cuidado**: em SaaS multiempresa, SQL livre quebraria o isolamento; oferecer montador de relatório por campos, não SQL |
| Gerenciar funcionalidades (ativar módulos) | 🟡 licenças | ❌ | Ligado aos planos do SaaS |
| Informação (mensagem no app) | ❌ | ✅ avisos com público e confirmação de leitura | — |
| Log de processos / navegação | ❌ | ✅ auditoria, acessos e alterações de senha | — |
| Painel de funcionário (atrasados, ausentes, sem horário) | ✅ | ✅ painel ao vivo; alerta pelos e-mails agendados | — |
| Texto customizado | ✅ | ✅ painel, comprovante, espelho e termo de ciência | — |
| Token do app móvel (liberação por e-mail) | 🟡 | ✅ código por e-mail, token guardado só como hash, revogação | — |
| Dicas, vídeos, novidades, sobre | ❌ | ✅ central de ajuda e manual | — |
| Documentação de integração | ❌ | ✅ Swagger da API | — |
| Justificativa de crédito / Política de hora extra | ❌ | ✅ autorização prévia por solicitação; extra sem autorização apontada | — |

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
9. **Recursos de troca de arquivos** (redefinida pelo cliente: sem integração nem comunicação com o
   Átomo/Velti): layout e arquivo para a folha, importação de marcações por planilha, exportação de
   cadastros em Excel/CSV.

## Cuidados

- **Gerador de relatório com SQL livre**: não será copiado. No SaaS, SQL digitado pelo cliente
  poderia ler dados de outros clientes. O equivalente seguro é escolher campos e filtros.
- **Backup e restauração pelo cliente**: num servidor compartilhado, restaurar um backup voltaria os
  dados de todos. O cliente terá exportação dos próprios dados; backup e restauração ficam com a
  equipe SuperPonto.
- **Licença por arquivo**: o Átomo valida licença por arquivo; no SaaS isso vira o plano contratado.
- **Visual**: as funções são reproduzidas com as regras descritas no manual, no visual do SuperPonto,
  sem copiar marca, textos ou telas do Átomo.
