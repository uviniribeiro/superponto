<!-- Arquivo gerado por apps/web/scripts/docs.mts a partir de apps/web/src/content. Não edite à mão. -->


# Manual do sistema SuperPonto

_V2 — versão de 15/11/2026. O mesmo conteúdo está no sistema, em Ajuda › Manual._

## Sumário

1. [O que é o SuperPonto](#1-visao)
2. [Entrar no sistema](#2-acesso)
3. [Esqueci minha senha](#3-senha)
4. [Navegação: barra lateral, busca e modo noturno](#4-navegacao)
5. [Visão geral (painel)](#5-painel)
6. [Empresas e CNPJs](#6-empresas)
7. [Estrutura da organização](#7-estrutura)
8. [Funcionários](#8-funcionarios)
9. [Importar funcionários por planilha](#9-importacao)
10. [Agrupamentos](#10-agrupamentos)
11. [Horários (jornadas e escalas)](#11-horarios)
12. [Regras de apuração](#12-regras-apuracao)
13. [Escalas, escala agendada e trocas](#13-escalas)
14. [Registrar ponto pelo navegador](#14-registrar-ponto)
15. [Espelho de ponto e espelho diário](#15-espelho)
16. [Ajustes, justificativas, abonos, afastamentos e sobreaviso](#16-ajustes-abonos)
17. [Cálculo em lote e fechamento do período](#17-fechamento)
18. [Banco de horas](#18-banco-horas)
19. [Solicitações e fluxos de aprovação](#19-solicitacoes)
20. [Equipamentos (relógios de ponto)](#20-equipamentos)
21. [Agente local](#21-agente-local)
22. [Relatórios](#22-relatorios)
23. [Painel ao vivo](#23-painel-ao-vivo)
24. [Ciência do espelho](#24-ciencia-espelho)
25. [Avisos aos funcionários](#25-avisos)
26. [E-mails agendados](#26-emails-agendados)
27. [Aparelhos do app](#27-aparelhos-app)
28. [Textos personalizados](#28-textos)
29. [Central de ajuda](#29-ajuda)
30. [Exportação para a folha](#30-folha)
31. [Importar marcações por planilha](#31-importar-marcacoes)
32. [Feriados](#32-feriados)
33. [Clientes da plataforma](#33-clientes)
34. [Usuários](#34-usuarios)
35. [Dias de acesso, bloqueios e troca de senha](#35-acesso)
36. [Login pela rede da organização (LDAP / Active Directory)](#36-ldap)
37. [Perfis e permissões](#37-perfis)
38. [Segurança, auditoria e privacidade](#38-seguranca)
39. [Módulos em construção](#39-construcao)
40. [Suporte](#40-suporte)

<a id="1-visao"></a>
## 1. O que é o SuperPonto

**Para:** Todos

O SuperPonto é um sistema de gestão de ponto, jornadas e escalas para empresas, escolas, saúde, setor público e operações.

Cada cliente é uma organização (tenant) que pode ter várias empresas, cada uma com o próprio CNPJ (matriz e filiais). Os dados de uma organização nunca aparecem para outra: o isolamento é garantido no banco de dados, não só na tela.

O que cada pessoa vê e pode fazer depende do perfil de acesso (veja "Perfis e permissões").

<a id="2-acesso"></a>
## 2. Entrar no sistema

**Para:** Todos

O acesso é feito com e-mail e senha. A sessão fica protegida em cookies seguros e é renovada automaticamente enquanto você usa o sistema.

**Passo a passo**

1. Abra o endereço do SuperPonto no navegador.
2. Informe seu e-mail e sua senha e clique em "Entrar".
3. Na primeira entrada de cada sessão, a marca aparece e o sistema se abre com uma animação.

> **Dica:** Depois de várias tentativas erradas seguidas, o sistema pede para aguardar um minuto (proteção contra tentativas automáticas).
> **Dica:** Para sair, abra o menu do seu usuário, no rodapé da barra lateral, e clique em "Sair".

<a id="3-senha"></a>
## 3. Esqueci minha senha

**Para:** Todos

Você mesmo cria uma nova senha, sem precisar do suporte. Por segurança, a mensagem é a mesma para e-mails cadastrados ou não.

**Passo a passo**

1. Na tela de login, clique em "Esqueci minha senha".
2. Informe seu e-mail e clique em "Enviar link".
3. Abra o e-mail recebido e clique em "Definir nova senha". O link vale por 1 hora e funciona uma única vez.
4. Digite a nova senha duas vezes (mínimo de 12 caracteres) e salve. Você volta para o login.

> **Dica:** Não recebeu? Confira a caixa de spam e peça um novo link; só o link mais recente funciona.

<a id="4-navegacao"></a>
## 4. Navegação: barra lateral, busca e modo noturno

**Para:** Todos

A barra lateral mostra apenas as telas que o seu perfil pode usar, agrupadas por seção (Principal, Organização, Plataforma, Ajuda).

O botão redondo na borda da barra recolhe ou expande o menu; com ele recolhido, passe o mouse sobre um ícone para ver o nome. A escolha fica salva no seu navegador.

No celular, o menu abre pelo botão no canto superior esquerdo.

**Passo a passo**

1. Busca rápida: pressione Ctrl+K (ou ⌘K no Mac), ou clique em "Buscar telas". Digite parte do nome, use as setas para escolher e Enter para abrir.
2. Modo noturno: use a chave "Modo noturno" no rodapé da barra lateral para alternar entre tema escuro e claro.

> **Dica:** Se o seu sistema operacional pede menos animações (acessibilidade), o SuperPonto reduz os movimentos automaticamente.

<a id="5-painel"></a>
## 5. Visão geral (painel)

**Para:** Todos

Mostra só números reais da sua organização, cada bloco conforme o que o seu perfil pode ver: o cartão amarelo traz o percentual de funcionários ativos com cargo e departamento definidos; o calendário mostra a semana e os próximos feriados da empresa; os cartões trazem funcionários ativos, empresas, usuários ativos (e bloqueios em vigor) e as permissões do seu perfil.

Abaixo ficam atalhos para as telas mais usadas e o gráfico de admissões e desligamentos dos últimos 6 meses.

Para a equipe SuperPonto, sem organização escolhida, mostra o total de clientes da plataforma.

O quadro "Marcações de hoje" fica vazio até a liberação do módulo de ponto da V2.

<a id="6-empresas"></a>
## 6. Empresas e CNPJs

**Para:** Administradores da organização e RH

Cadastre a matriz e as filiais da organização. Cada empresa tem CNPJ, razão social, nome fantasia, contato, inscrição estadual (ou ISENTO), CEI/CNO, código externo para a folha, endereço, segmento e fuso horário (usado no cálculo da jornada).

Ao digitar um CNPJ válido, o sistema consulta a Receita Federal e preenche razão social, nome fantasia, telefone, e-mail e endereço, e avisa se a situação cadastral não estiver ATIVA. Os campos preenchidos automaticamente ficam destacados em verde e podem ser editados.

Ao digitar o CEP, o endereço, a cidade, a UF e o fuso horário são preenchidos sozinhos. O CEP também identifica o município, que define os feriados estaduais e municipais da empresa.

O campo CNPJ aceita o formato numérico e o novo CNPJ alfanumérico da Receita Federal (ex.: 12.ABC.345/01DE-35). A máscara é aplicada enquanto você digita e os dígitos verificadores são conferidos na hora e de novo no servidor.

Não é possível cadastrar o mesmo CNPJ duas vezes na mesma organização.

**Passo a passo**

1. Abra Organização › Estrutura › Empresas.
2. Clique em "Nova empresa" e digite o CNPJ: os dados da Receita são preenchidos automaticamente.
3. Confira o endereço, informe o número e clique em "Cadastrar empresa".
4. Para editar ou remover, passe o mouse sobre a empresa e use os ícones de lápis ou lixeira.
5. Use a busca da lista para encontrar por nome ou CNPJ, com ou sem pontuação.

> **Dica:** Remover uma empresa a tira das listas, mas o histórico continua guardado na auditoria.
> **Dica:** Os botões só aparecem para quem tem a permissão correspondente; a API também confere a permissão.

<a id="7-estrutura"></a>
## 7. Estrutura da organização

**Para:** Administradores da organização e RH

Em Organização › Estrutura ficam os cadastros que organizam as pessoas: Unidades e locais, Departamentos, Cargos, Funções, Centros de custo, Tipos de funcionário e Sindicatos. Em Organização › Competências ficam os períodos com nome usados como filtro.

Departamentos formam uma árvore sem limite de níveis (ex.: Secretaria de Saúde › UBS Centro › Recepção) e cada departamento pode ter seções. O sistema impede colocar um departamento dentro dele mesmo ou de um subdepartamento seu.

Unidades e locais são os lugares de trabalho de cada empresa (matriz, filial, escola, UBS, base operacional…), com CNPJ próprio opcional e cerca virtual (latitude, longitude e raio de 20 a 5.000 m) para o app de ponto. A unidade é escolhida no cadastro do funcionário.

Cargos pertencem a uma empresa e têm o código CBO usado no eSocial. Funções descrevem o que a pessoa faz, independente do cargo. Centros de custo e códigos externos vão na exportação para a folha.

Sindicatos guardam sigla, CNPJ (numérico ou alfanumérico), tipo de entidade, se representam empregados ou empregadores e o mês da data-base.

Nenhum cadastro em uso por funcionário ativo pode ser excluído: o sistema mostra quantos vínculos usam o registro. Nesse caso, desative em vez de excluir.

**Passo a passo**

1. Abra o cadastro desejado no menu Estrutura e clique em "Novo".
2. Em Departamentos, use o ícone de pasta com "+" para criar um subdepartamento e o campo "+ seção" para adicionar seções.
3. Para editar ou excluir, passe o mouse sobre o registro e use o lápis ou a lixeira.

> **Dica:** Comece pela estrutura: funcionários, escalas, relatórios e cálculo em lote usam esses cadastros como filtro.

<a id="8-funcionarios"></a>
## 8. Funcionários

**Para:** RH e administradores

Cada funcionário é uma pessoa com um ou mais vínculos. A mesma pessoa (mesmo CPF) pode ter vínculo em mais de uma empresa; a matrícula não se repete dentro da mesma empresa.

O cadastro pede nome, CPF ou PIS (relógios da Portaria 671 usam o CPF; os da 1.510, o PIS), matrícula, admissão e empresa. O CEP preenche o endereço. Departamento, seção, cargo, função, centro de custo, tipo e sindicato vêm dos cadastros da Estrutura, e o sistema só oferece os da empresa escolhida.

Mudanças de departamento, cargo, função, centro de custo, tipo, sindicato, contrato e carga horária ficam no histórico do vínculo, com a data em que passam a valer e o motivo.

Desligar pede a data e o motivo; o funcionário sai da lista de ativos, mas nada é apagado. "Reativar" desfaz o desligamento.

CPF e PIS completos aparecem só para quem tem a permissão "Ver dados sensíveis"; para os demais eles aparecem mascarados e a busca por CPF não funciona. A auditoria nunca guarda os números completos.

**Passo a passo**

1. Abra Pessoas › Funcionários e clique em "Novo funcionário".
2. Preencha pessoa, endereço (pelo CEP) e vínculo e clique em "Cadastrar funcionário".
3. Clique num funcionário para ver a ficha, o histórico e os botões Editar, Desligar e Reativar.
4. Use os filtros do topo: empresa, departamento (inclui os subdepartamentos), cargo, tipo, agrupamento e situação.

<a id="9-importacao"></a>
## 9. Importar funcionários por planilha

**Para:** RH e administradores

A importação lê planilhas CSV (no Excel: Arquivo › Salvar como › CSV), com separador ponto e vírgula ou vírgula. O sistema reconhece os nomes de coluna mais comuns, como "Data de admissão", "Matrícula" e "PIS/PASEP"; colunas desconhecidas são ignoradas e informadas.

Primeiro o sistema confere a planilha sem gravar nada e mostra, linha por linha, o que está pronto e o que tem erro (CPF ou PIS inválido, data inexistente, matrícula repetida, departamento ou cargo não cadastrado). Depois você importa só as linhas válidas.

Opcionalmente, o sistema cria os departamentos, cargos, funções, centros de custo e tipos que ainda não existirem, e atualiza funcionários cuja matrícula já está cadastrada. Sindicatos precisam estar cadastrados antes.

**Passo a passo**

1. Abra Pessoas › Importar planilha e, se quiser, clique em "Baixar modelo".
2. Escolha a empresa e o arquivo CSV.
3. Clique em "1. Conferir planilha", corrija o que for preciso e confira de novo.
4. Clique em "2. Importar" para gravar as linhas válidas.

> **Dica:** Até 5.000 linhas por vez. Datas no formato dd/mm/aaaa.

<a id="10-agrupamentos"></a>
## 10. Agrupamentos

**Para:** Administradores e RH

Agrupamentos reúnem funcionários, cargos e unidades sem depender da estrutura (ex.: "Plantão noturno", "Motoristas da frota"). Servem de filtro na lista de funcionários e, nas próximas fases, nos relatórios, no cálculo em lote e no envio aos relógios.

**Passo a passo**

1. Abra Organização › Agrupamentos, clique em "Novo" e dê um nome.
2. Clique no botão "funcionário(s)" do agrupamento para escolher os funcionários, os cargos e as unidades (cargos e unidades seguem a empresa escolhida no painel).

<a id="11-horarios"></a>
## 11. Horários (jornadas e escalas)

**Para:** Administradores e RH

Em Jornada › Horários ficam as jornadas de cada empresa: semanais (dia a dia da semana), flexíveis (só a carga do dia) e escalas em ciclo (12x36, 6x1, 5x2, 4x2, revezamento ou ciclo personalizado de até 62 dias). Há modelos prontos para começar.

Cada dia tem entrada, saída, intervalo e o início previsto do intervalo; jornada que passa da meia-noite (ex.: 19h às 7h) é reconhecida. A carga semanal (média, nas escalas em ciclo) é calculada sozinha e o sistema avisa quando passa de 44h.

Configuração avançada: "Feriado vira folga" (desmarque em 12x36 e plantões, que seguem o ciclo no feriado); hora in itinere (minutos de deslocamento somados nos dias trabalhados, quando a convenção coletiva prevê); mobilidade da entrada (a entrada pode variar até N minutos e a saída prevista acompanha, sem atraso nem extra); mobilidade do intervalo (o intervalo pode começar até N minutos antes ou depois do previsto); e a regra de apuração usada.

Horário em uso não pode ser excluído; desative ou atribua outro antes. Alterar um horário em uso é bloqueado enquanto o período atual estiver fechado.

**Passo a passo**

1. Abra Jornada › Horários e clique em "Novo horário".
2. Escolha um modelo, ajuste nome, dias e horários e salve.
3. Use "Duplicar" para criar variações (ex.: o mesmo horário com sábado).

<a id="12-regras-apuracao"></a>
## 12. Regras de apuração

**Para:** Administradores e RH

Em Jornada › Regras de apuração ficam as regras do cálculo: tolerância por marcação (até 5 min) e no dia (até 10 min), conforme a CLT art. 58 §1º; percentuais de hora extra (mínimo de 50%) no dia útil, noturna, descanso, feriado e intervalo suprimido; limite diário de extra; adicional noturno (22h às 5h, com hora reduzida de 52min30s); intervalo mínimo; desconto de faltas e arredondamento.

Faixas de hora extra permitem, por exemplo, as 2 primeiras horas a 50% e o restante a 100%, como em muitas convenções.

Uma regra é a padrão da empresa; os horários podem usar outra. O sistema recusa valores abaixo do mínimo legal.

<a id="13-escalas"></a>
## 13. Escalas, escala agendada e trocas

**Para:** Administradores, RH e responsáveis por escalas

Jornada › Escalas mostra, dia a dia, quem trabalha e em que horário, com feriados, folgas, escala agendada (contorno amarelo) e trocas (contorno azul). Filtre por departamento, agrupamento ou nome e veja 7, 14 ou 28 dias.

Atribuir horário: selecione os funcionários e escolha o horário e a data de início. A jornada anterior termina na véspera e fica no histórico do funcionário. Nas escalas em ciclo, informe o primeiro dia do ciclo.

Escala agendada: define trabalho ou folga em dias específicos (um período, opcionalmente só alguns dias da semana), por cima do horário e do feriado. Ex.: sábados de mutirão ou uma folga concedida.

Troca de escala: com dois funcionários selecionados, cada um faz o horário do outro naquele dia. Troca de folga: com um funcionário, ele folga num dia de trabalho e trabalha numa folga, no mesmo horário. O motivo é obrigatório e tudo fica na auditoria.

Período fechado (fechamento de ponto) não aceita atribuição, escala agendada nem troca: reabra o fechamento antes.

**Passo a passo**

1. Abra Jornada › Escalas e marque os funcionários.
2. Na barra que aparece embaixo, escolha "Atribuir horário", "Escala agendada" ou "Trocar escala/folga".
3. Clique num dia para ver os detalhes e, se for escala agendada ou troca, remover o lançamento.

<a id="14-registrar-ponto"></a>
## 14. Registrar ponto pelo navegador

**Para:** Funcionários

Em Ponto › Registrar ponto, o funcionário marca entrada, intervalo e saída com um clique. A hora é sempre a do servidor (horário de Brasília), nunca a do computador ou celular.

Cada marcação mostra um comprovante com funcionário, empresa, CNPJ, data, hora e um código de integridade. A marcação não pode ser apagada; correções são feitas por ajuste ou solicitação.

Proteções: cada marcação exige um desafio de uso único emitido pelo servidor (contra robôs e repetição), há limite de tentativas por minuto e marcações com menos de 1 minuto de diferença são recusadas. Se a unidade tem cerca virtual, o navegador pede a localização e a marcação fora do raio é recusada.

Para marcar, o usuário precisa estar ligado ao funcionário: o administrador faz isso em Usuários › editar › Funcionário ligado.

<a id="15-espelho"></a>
## 15. Espelho de ponto e espelho diário

**Para:** RH, gestores e funcionários

Ponto › Espelho de ponto mostra o mês do funcionário dia a dia: horário previsto, marcações, horas trabalhadas, saldo e ocorrências (atraso, falta, marcação ímpar, extra, intervalo curto…). No topo ficam previsto, trabalhado, saldo, extras por percentual, noturno e faltas. Quem não tem acesso ao espelho da equipe vê o próprio (Meu espelho).

Marcações incluídas aparecem em azul; desconsideradas, riscadas; pendentes de aprovação, tracejadas. Dias de período fechado mostram um cadeado e não mudam mais. Dias futuros não são apurados.

O funcionário vê o próprio saldo em Bancos e solicitações › Meu banco de horas.

Ponto › Espelho diário mostra a equipe num dia: presentes, atrasados, faltas, marcação ímpar, quem ainda não marcou, folga e afastados.

**Passo a passo**

1. Abra Ponto › Espelho de ponto, escolha o funcionário e o mês.
2. Clique num dia para ver as marcações, incluir uma marcação esquecida, desconsiderar uma duplicada ou abonar.
3. Use "Imprimir" para o espelho em papel ou PDF pelo navegador.

<a id="16-ajustes-abonos"></a>
## 16. Ajustes, justificativas, abonos, afastamentos e sobreaviso

**Para:** RH e gestores

Ajuste de marcação: incluir uma marcação esquecida ou desconsiderar uma duplicada, sempre com justificativa. Quem tem permissão de aprovar lança já aprovado; os demais ficam pendentes em Ponto › Ajustes de marcação, e quem pediu não pode aprovar. A marcação original nunca é apagada (Portaria 671).

Justificativas (Ponto › Justificativas) podem abonar (o dia ou os minutos não geram débito) ou só justificar (a falta aparece justificada, mas é descontada). Cada uma pode ter limite de uso por funcionário por mês ou por ano.

Abonos (Ponto › Abonos e afastamentos) são lançados em lote: vários funcionários e um período, por dia inteiro ou por minutos, pulando folgas e feriados. O sistema recusa o lançamento que passa do limite da justificativa.

Afastamentos (atestado, férias, licenças, acidente, suspensão) deixam os dias neutros no cálculo e não podem se sobrepor. Não registre CID ou diagnóstico: é dado sensível.

Sobreaviso (CLT art. 244 §2º): horas à disposição fora do local de trabalho; aparecem no espelho com o valor de 1/3.

<a id="17-fechamento"></a>
## 17. Cálculo em lote e fechamento do período

**Para:** RH

Em Ponto › Fechamento, "Calcular" grava a apuração do período para todos os funcionários da empresa e avisa ajustes pendentes, dias com marcação ímpar e extra sem autorização.

"Fechar período" exige que não haja ajustes pendentes, grava a apuração final, lança o banco de horas (se ativo) e trava o período: marcações, ajustes, abonos, afastamentos, escalas e horários não mudam mais nele.

Reabrir pede motivo, desfaz os lançamentos do banco daquele fechamento e precisa seguir a ordem (reabra antes o período mais recente). Tudo fica na auditoria.

"Gerar AEJ" baixa o Arquivo Eletrônico de Jornada (Portaria 671) do período, com registradores, vínculos, horários, marcações originais, incluídas e desconsideradas, faltas e movimentos do banco. Confira no validador do MTE e assine com o certificado ICP-Brasil da empresa antes de entregar; o sistema avisa o que falta (ex.: número do REP-P).

Em Fechamento também ficam o número do REP-P no INPI (usado no AFD e no AEJ) e o botão "AFD do REP-P", que gera o arquivo das marcações feitas pelo navegador e pelo app no período, com NSR e código de integridade de cada marcação, no leiaute da Portaria 671. Assine o arquivo com o certificado digital da empresa antes de entregar.

<a id="18-banco-horas"></a>
## 18. Banco de horas

**Para:** RH

Em Bancos e solicitações › Banco de horas › Regras, ative o banco da empresa e defina em quantos dias os créditos vencem (acordo individual: até 6 meses; convenção coletiva: até 1 ano — CLT art. 59), o crédito máximo por dia e, se a convenção prevê, o multiplicador da extra (ex.: 1h a 50% vale 1h30).

No fechamento, o saldo positivo de cada dia vira crédito com data de vencimento e o negativo vira débito, que consome primeiro os créditos mais antigos. Créditos vencidos saem do saldo.

Banco de compensação (nas Regras): os saldos de cada semana ou mês se compensam antes de ir para o banco — horas a mais cobrem faltas e atrasos do mesmo período. A sobra positiva vai para o banco ou é paga como extra; o líquido negativo vira débito. O extrato tem uma aba de compensação por período.

A lista mostra o saldo de cada funcionário; clique para ver o extrato com saldo corrido e o próximo vencimento. Selecione funcionários para lançar ajuste, pagamento em folha ou folga compensada, ou use "Zerar em lote" para pagar saldos positivos ou zerar saldos.

<a id="19-solicitacoes"></a>
## 19. Solicitações e fluxos de aprovação

**Para:** Todos

Em Solicitações, o funcionário pede: inclusão de marcação esquecida, justificativa de falta ou atraso, troca de folga, autorização de hora extra ou outro assunto. Quem tem permissão também pode abrir para outro funcionário.

Em "Para aprovar" aparecem só os pedidos da etapa em que você é o aprovador. Recusar exige motivo. Ao aprovar a última etapa, o sistema aplica o pedido sozinho: inclui a marcação, lança o abono, troca a folga ou registra a autorização de extra.

Em Fluxos de aprovação, cada tipo de pedido pode ter até 5 etapas: superior imediato (definido no cadastro do funcionário), quem tem um perfil, ou quem tem a permissão de aprovar solicitações. Sem fluxo, aprova quem tem essa permissão. Ninguém aprova o próprio pedido.

Política de hora extra: na regra de apuração, "exigir autorização" faz o espelho apontar a extra feita sem autorização prévia. A extra continua sendo paga (é trabalho realizado); o apontamento serve para conferência.

<a id="20-equipamentos"></a>
## 20. Equipamentos (relógios de ponto)

**Para:** Administradores e TI

Em Equipamentos › Relógios (REP) ficam os relógios de cada empresa: portaria (1.510, 373 ou 671), número de fabricação do REP (17 dígitos, vai no AEJ), série, fabricante, modelo, endereço na rede, unidade, grupo de REP, intervalo de coleta e e-mails de alerta.

Cada equipamento mostra se está comunicando, o último contato, comandos na fila e com falha. Sem contato por 3 intervalos de coleta (mínimo 15 minutos), ele passa a "Sem comunicação" e os e-mails cadastrados recebem um aviso; quando volta, recebem outro.

Comandos: enviar funcionários e digitais (com o empregador), enviar data e hora, enviar empregador, coletar registros, receber funcionários, receber digitais e receber empregador. Com grupo de REP, o comando pode ir para todos os relógios do grupo. Falhas podem ser tentadas de novo e comandos na fila, cancelados.

Funcionários: compara quem está no cadastro com quem foi lido do relógio, mostrando quem falta, quem sobra, quem não tem o documento exigido pela portaria (PIS na 1.510, CPF na 671) e o último envio. Digitais recebidas do relógio entram cifradas, sem duplicar.

Arquivos: importar o AFD tirado pelo pendrive (reimportar não duplica) e baixar as linhas originais dos registros coletados no período.

<a id="21-agente-local"></a>
## 21. Agente local

**Para:** TI

O agente local é o programa instalado num computador da rede do cliente, perto dos relógios. Ele conversa com o relógio e com o SuperPonto pela internet (HTTPS), sem abrir portas na rede do cliente.

Na aba "Agente local" do equipamento, gere a chave e informe-a no agente. A chave aparece uma única vez (o SuperPonto guarda só uma impressão dela); gerar outra desliga a anterior. Equipamento desativado ou excluído perde o acesso.

O agente avisa que está vivo, busca a fila de comandos (já com os dados prontos para o relógio: empregador, PIS ou CPF conforme a portaria, nome e digitais), devolve o resultado de cada comando e envia os registros coletados (AFD) no intervalo de coleta.

O programa do agente (pasta apps/agent) roda em Windows (como serviço) ou Linux (systemd), com um arquivo de configuração que traz o endereço da API, a chave de cada relógio e o usuário e a senha do relógio (que nunca saem da rede do cliente). Ele lembra o último NSR enviado para não reenviar marcações e, em falha de rede, tenta de novo esperando 15 s, 30 s, 1 min… até 5 min.

Fabricantes: Control iD (REP iDClass e linha iDAccess/iDFlex/iDFace) pela API local do equipamento, Henry pelo protocolo de gerenciamento 8x (Primme Acesso, Argos e linha Prisma 8.x, porta 3000) e um relógio simulado para testar a instalação. No Control iD, hora e coleta de AFD seguem a documentação do fabricante; empregador, lista e cadastro de usuários e digitais no REP iDClass estão com homologação pendente em equipamento real. O driver Henry foi feito pela especificação do fabricante e também aguarda homologação; equipamento de acesso Henry não é REP certificado (para ponto, exige acordo coletivo). Topdata, Biomtech, Dahua e RW ainda não têm driver.

<a id="22-relatorios"></a>
## 22. Relatórios

**Para:** RH, gestores e administradores

Em Relatórios há 38 relatórios em seis grupos: Ponto (horas trabalhadas, folha de conferência com extras por percentual, cartão ponto em lote, espelho no leiaute da Portaria por PIS, analíticos de extra, falta e atraso, marcações ímpares, déficit de intervalo, intervalo não calculável, divergências de jornada, interjornada menor que 11 horas, absenteísmo, frequência, adicional noturno, sobreaviso e ciência eletrônica do espelho), Movimentações (abonos, afastamentos, ajustes, solicitações, trocas, escala do período e log do espelho por funcionário), Bancos (saldos e extrato), Cadastros (funcionários, aniversariantes e feriados), Equipamentos e marcações (marcações, marcações pelo navegador e app com localização, eventos dos equipamentos) e Segurança (auditoria, acessos com falhas de login, alterações de senha, usuários com perfis e funcionalidades por perfil).

Todos usam os mesmos filtros: empresa, período (até 93 dias), departamento com ou sem subdepartamentos e agrupamento. Relatórios de cadastro e saldos não pedem período.

O Montador de relatório monta um relatório com os campos que você escolher, uma linha por funcionário e dia (matrícula, nome, departamento, horário, marcações, previsto, trabalhado, saldo, extras, noturno, atraso, falta, abono, afastamento, ocorrências…).

Exporte em Excel (planilha com cabeçalho e totais) ou CSV (separado por ponto e vírgula, abre direto no Excel em português), ou use "Imprimir / PDF" para salvar em PDF pelo navegador. CPF só aparece completo para quem pode ver dados sensíveis; Auditoria e Usuários exigem permissão própria.

<a id="23-painel-ao-vivo"></a>
## 23. Painel ao vivo

**Para:** RH, gestores e supervisores

Em Ponto › Painel ao vivo aparece a situação de cada funcionário da empresa agora: trabalhando, em intervalo, já saiu, ainda vai entrar, atrasado sem marcação (passou o horário previsto mais 10 minutos de tolerância), não veio, de folga, afastado ou abonado, e quem marcou sem ter jornada no dia.

A tela se atualiza sozinha a cada 30 segundos. Clique numa situação para filtrar. Os números vêm da mesma apuração do espelho; nada é estimado.

<a id="24-ciencia-espelho"></a>
## 24. Ciência do espelho

**Para:** Funcionários e RH

Depois que o período termina, o funcionário abre Meu espelho, confere e clica em "Dar ciência (de acordo)" ou "Dar ciência com ressalva" (explicando o que está diferente). O texto exibido pode ser definido pela empresa em Textos personalizados.

A ciência guarda o resumo do mês e um código do espelho que o funcionário viu, com data, hora, IP e navegador. Ela não pode ser alterada nem apagada. Se depois houver ajuste ou abono no período, o funcionário e o RH veem que o espelho mudou desde a ciência.

O RH acompanha quem já deu ciência em Relatórios › Ciência eletrônica do espelho (informe exatamente o período do espelho).

<a id="25-avisos"></a>
## 25. Avisos aos funcionários

**Para:** RH e administradores

Em Ferramentas › Avisos publique recados com início e fim, para todas as empresas ou uma só e, se quiser, só para um agrupamento. Avisos importantes aparecem em destaque.

Os avisos aparecem na Visão geral de quem está no público. Com "Pedir confirmação de leitura", o funcionário clica em "Li e entendi" e o RH vê quem leu e quando.

<a id="26-emails-agendados"></a>
## 26. E-mails agendados

**Para:** RH e administradores

Em Ferramentas › E-mails agendados crie resumos enviados todo dia no horário escolhido (Brasília), nos dias da semana marcados: faltas de ontem, atrasados agora sem marcação de entrada, ajustes aguardando aprovação, solicitações pendentes e relógios sem comunicação.

Use "Prévia" para ver o conteúdo sem enviar e "Enviar agora" para mandar na hora. Cada agendamento é enviado uma vez por dia; se o sistema estiver parado no horário, o envio acontece em até 15 minutos depois de voltar, e não mais tarde que isso.

<a id="27-aparelhos-app"></a>
## 27. Aparelhos do app

**Para:** Funcionários e administradores

Em Ponto › Meus aparelhos, o funcionário dá um nome ao celular ou tablet e recebe um código de 6 dígitos no e-mail (vale 10 minutos, 5 tentativas). Confirmado o código, aparece um token que é colado no app uma única vez; o sistema guarda só uma impressão dele.

A marcação feita com o token mostra o aparelho no comprovante e fica registrada na auditoria. Aparelho perdido ou trocado é revogado pelo próprio funcionário ou em Administração › Aparelhos do app.

<a id="28-textos"></a>
## 28. Textos personalizados

**Para:** Administradores da organização

Em Ferramentas › Textos personalizados defina a mensagem no topo da Visão geral, o rodapé do comprovante de marcação, o rodapé do espelho impresso e o termo da ciência do espelho. Texto em branco não aparece.

<a id="29-ajuda"></a>
## 29. Central de ajuda

**Para:** Todos

Em Ajuda › Central de ajuda há uma calculadora de horas (somar e subtrair durações e calcular as horas trabalhadas a partir das marcações, inclusive virando a meia-noite) e respostas para as dúvidas mais comuns.

<a id="30-folha"></a>
## 30. Exportação para a folha

**Para:** RH e departamento pessoal

Em Relatórios › Exportação para a folha monte um layout por empresa: o código de evento (rubrica) de cada verba no seu sistema de folha, o funcionário por matrícula ou CPF, o separador e o formato da quantidade (08:30, 8,50 ou 510 minutos).

Escolha o período e clique em "Gerar arquivo": sai uma linha por funcionário e verba (matrícula ou CPF; evento; quantidade; início; fim), sem linhas zeradas. O SuperPonto avisa quem ficou sem CPF/matrícula e quais verbas tinham valor sem código no layout.

Os valores saem da folha de conferência; calcule e feche o período antes. O SuperPonto só gera o arquivo: não envia dados para outros sistemas.

<a id="31-importar-marcacoes"></a>
## 31. Importar marcações por planilha

**Para:** RH

Em Ponto › Importar marcações envie um arquivo CSV ou TXT (ou cole o conteúdo) com uma marcação por linha: matrícula ou CPF; data (dd/mm/aaaa ou aaaa-mm-dd); hora (hh:mm). Separador ponto e vírgula, vírgula ou tabulação; a primeira linha pode ser cabeçalho.

Clique em "Conferir" para ver o que entra, o que já existe e os erros por linha (funcionário não encontrado, data ou hora inválida, marcação no futuro, fora do vínculo, período fechado ou repetida). Só depois clique em "Importar". Repetir o mesmo arquivo não duplica; a marcação entra com a origem "Importação" e com o código de integridade encadeado.

<a id="32-feriados"></a>
## 32. Feriados

**Para:** Administradores da organização e RH

Os feriados são cadastrados automaticamente: os nacionais (inclusive os móveis, como Carnaval, Sexta-feira da Paixão e Corpus Christi, calculados pela Páscoa de cada ano e o 20 de novembro), os estaduais da UF da empresa e os municipais da cidade da empresa.

O ano seguinte é gerado com antecedência, antes de 1º de janeiro, sem ninguém precisar fazer nada. Consultar um ano futuro também gera os feriados dele na hora.

Ponto facultativo (Carnaval, Quarta-feira de Cinzas e Corpus Christi onde não há lei municipal) aparece como dia de trabalho até a empresa decidir dar folga.

A base de feriados municipais começa pelas capitais. Para outras cidades, cadastre os feriados locais (aniversário da cidade, padroeiro, Corpus Christi) em "Feriado da empresa": eles se repetem todo ano. Itens marcados "confira" vêm da base inicial do SuperPonto e devem ser conferidos com a lei local.

**Passo a passo**

1. Abra Organização › Feriados, escolha a empresa e o ano.
2. Para folgar num ponto facultativo, clique em "Dar folga"; para trabalhar num feriado, "Trabalhar neste dia". "Padrão" desfaz a decisão.
3. Para cadastrar um feriado local, clique em "Feriado da empresa", informe o nome e o dia (ou escolha um feriado móvel).

> **Dica:** Preencha o CEP da empresa: sem ele, só aparecem os feriados nacionais.

<a id="33-clientes"></a>
## 33. Clientes da plataforma

**Para:** Equipe SuperPonto (SuperAdmin)

Área exclusiva da equipe SuperPonto para criar e acompanhar as organizações clientes.

Ao criar um cliente, informe o nome, o identificador (gerado a partir do nome), o CNPJ do titular (opcional) e o primeiro administrador. Ele recebe um e-mail para criar a própria senha.

**Passo a passo**

1. Abra Plataforma › Clientes e clique em "Novo cliente".
2. Preencha os dados e clique em "Criar cliente".
3. Para administrar um cliente, clique nele na lista: o sistema abre as empresas daquele cliente.
4. No painel e em Empresas, o seletor de organização no topo troca o cliente que você está administrando.

> **Dica:** Clientes novos começam no status "Em teste".

<a id="34-usuarios"></a>
## 34. Usuários

**Para:** Administradores

Cada cliente já começa com dois usuários: o Administrador (indicado no cadastro do cliente) e o Suporte SuperPonto, usado pela equipe SuperPonto para atendimento e treinamento.

O usuário de suporte não aparece na lista para os usuários do cliente. Quando o próprio suporte está conectado, ele aparece com um cadeado e não pode ser editado nem excluído.

Novos usuários recebem um convite por e-mail para criar a própria senha. O e-mail é o login e não pode ser trocado depois.

**Passo a passo**

1. Abra Administração › Usuários e clique em "Novo usuário".
2. Informe nome, e-mail e escolha um ou mais perfis de acesso.
3. Para mudar perfis ou desativar o acesso, use o lápis ao lado do usuário; o envelope reenvia o convite para quem ainda não entrou.

> **Dica:** Ninguém pode desativar, bloquear ou limitar os dias do próprio usuário.

<a id="35-acesso"></a>
## 35. Dias de acesso, bloqueios e troca de senha

**Para:** Administradores

No cadastro do usuário dá para marcar os dias da semana em que ele pode entrar. Fora desses dias (horário de Brasília) o login é recusado e quem já estava conectado é desconectado. Nenhum dia marcado significa acesso todos os dias.

O bloqueio de acesso impede a entrada por um período (com início, fim opcional e motivo), por exemplo durante férias ou afastamento. Enquanto vale, as sessões do usuário são encerradas. O motivo só aparece para quem digitou a senha correta.

Em Administração › Bloqueios de acesso ficam os bloqueios vigentes e agendados, com a opção de encerrar antes do fim.

"Pedir troca de senha no próximo acesso" leva o usuário direto para Minha conta até ele trocar a senha. Em Conta › Minha conta, qualquer usuário troca a própria senha informando a atual.

<a id="36-ldap"></a>
## 36. Login pela rede da organização (LDAP / Active Directory)

**Para:** Administradores

Com o login pela rede, o usuário entra no SuperPonto com o mesmo e-mail e senha da rede da organização. A senha é conferida no Active Directory ou OpenLDAP a cada login; o SuperPonto não guarda a senha desses usuários.

A configuração fica em Administração › Login pela rede (LDAP): servidor (ldaps:// recomendado, ou ldap:// com STARTTLS), base de busca, filtro do usuário ({email} ou {login}) e uma conta de serviço só de leitura. A senha da conta de serviço é guardada cifrada e nunca é exibida.

Usuários LDAP não recebem convite por e-mail, não trocam nem redefinem a senha no SuperPonto (isso é feito na rede da organização). Perfis, dias de acesso e bloqueios continuam valendo.

Na nuvem, o servidor do diretório precisa ter endereço público com TLS: por segurança, o SuperPonto recusa endereços internos (10.x, 192.168.x, localhost). Diretório só na rede interna exige instalação própria.

**Passo a passo**

1. Abra Administração › Login pela rede (LDAP), preencha servidor, base, filtro (há modelos para Active Directory e OpenLDAP) e a conta de serviço; marque "Login pela rede ativado" e salve.
2. Use "Testar" com o e-mail de um usuário da rede (e, se quiser, a senha) para conferir antes de liberar.
3. Em Usuários, crie ou edite o usuário e escolha a forma de login "Rede da organização (LDAP)".

> **Dica:** Se o diretório ficar fora do ar, os usuários LDAP veem um aviso para tentar de novo; usuários com senha própria continuam entrando normalmente.

<a id="37-perfis"></a>
## 37. Perfis e permissões

**Para:** Administradores

Cada recurso do sistema tem permissões separadas: por exemplo, Empresas tem Ver, Criar, Editar e Excluir; Feriados tem Ver e Gerenciar; Horas extras tem Aprovar. A tela mostra todos os recursos agrupados por módulo.

Os perfis do sistema (Administrador da empresa, Diretor, RH, Gestor, Supervisor, Coordenadores, Responsáveis por escalas e por equipamentos, Funcionário, Professor, Médico e Profissional da saúde) não podem ser alterados. Para personalizar, use "Criar perfil a partir deste".

Recursos marcados "módulo em construção na V2" já podem ser incluídos nos perfis e passam a valer quando a tela correspondente for liberada.

Mudanças num perfil valem a partir do próximo acesso de cada usuário. Perfis com usuários não podem ser excluídos.

<a id="38-seguranca"></a>
## 38. Segurança, auditoria e privacidade

**Para:** Todos

Toda criação, alteração e exclusão fica registrada na auditoria com data, hora, usuário, endereço IP e os dados antes e depois. A auditoria não pode ser alterada nem apagada, nem mesmo direto no banco.

Senhas são guardadas apenas como hash forte; ninguém, nem a equipe SuperPonto, consegue lê-las.

O tratamento de dados segue a LGPD: o empregador é o controlador dos dados dos trabalhadores e a SuperPonto atua como operadora.

<a id="39-construcao"></a>
## 39. Módulos em construção

**Para:** Todos

A V2 é liberada por fases. Já estão prontos: acesso e recuperação de senha (inclusive login pela rede LDAP/AD), clientes, empresas (com CNPJ alfanumérico), estrutura, unidades, funcionários e importação, usuários, perfis e permissões, auditoria, horários, regras de apuração e escalas, registro de ponto pelo navegador, espelho, ajustes, abonos, afastamentos, fechamento, banco de horas e de compensação, solicitações com aprovação em etapas, equipamentos com agente local (programa com driver Control iD e simulador) e alertas, AEJ, 38 relatórios com exportação, painel ao vivo, avisos, e-mails agendados, aparelhos do app, textos personalizados, central de ajuda, ciência eletrônica do espelho, exportação para a folha e importação de marcações por planilha e, na API, a importação de AFD de relógios das Portarias 1.510/2009, 373/2011 e 671/2021, o cadastro de digitais cifradas e a fila de envio de empregador, funcionários e digitais aos relógios.

O app do terminal (tablet de ponto) é instalado por APK e abre em tela cheia, com a tela sempre ligada e opção de modo quiosque.

Próximas fases: drivers do agente para outras marcas de relógio (Topdata, Biomtech, Dahua, RW) e homologação do Control iD e do Henry em equipamento real, app do funcionário na V2, assinatura ICP-Brasil do AEJ e do espelho, módulos de Educação, Saúde e Operações e Servidor de Comunicação.

A tela "Conformidade MTE" mostra, item por item, o que a legislação exige e o que já está atendido.

<a id="40-suporte"></a>
## 40. Suporte

**Para:** Todos

Dúvidas sobre acesso: use "Esqueci minha senha" ou fale com o administrador da sua organização.

Administradores: falem com a equipe SuperPonto pelo canal de suporte do contrato.
