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
14. [Feriados](#14-feriados)
15. [Clientes da plataforma](#15-clientes)
16. [Usuários](#16-usuarios)
17. [Dias de acesso, bloqueios e troca de senha](#17-acesso)
18. [Login pela rede da organização (LDAP / Active Directory)](#18-ldap)
19. [Perfis e permissões](#19-perfis)
20. [Segurança, auditoria e privacidade](#20-seguranca)
21. [Módulos em construção](#21-construcao)
22. [Suporte](#22-suporte)

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

<a id="14-feriados"></a>
## 14. Feriados

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

<a id="15-clientes"></a>
## 15. Clientes da plataforma

**Para:** Equipe SuperPonto (SuperAdmin)

Área exclusiva da equipe SuperPonto para criar e acompanhar as organizações clientes.

Ao criar um cliente, informe o nome, o identificador (gerado a partir do nome), o CNPJ do titular (opcional) e o primeiro administrador. Ele recebe um e-mail para criar a própria senha.

**Passo a passo**

1. Abra Plataforma › Clientes e clique em "Novo cliente".
2. Preencha os dados e clique em "Criar cliente".
3. Para administrar um cliente, clique nele na lista: o sistema abre as empresas daquele cliente.
4. No painel e em Empresas, o seletor de organização no topo troca o cliente que você está administrando.

> **Dica:** Clientes novos começam no status "Em teste".

<a id="16-usuarios"></a>
## 16. Usuários

**Para:** Administradores

Cada cliente já começa com dois usuários: o Administrador (indicado no cadastro do cliente) e o Suporte SuperPonto, usado pela equipe SuperPonto para atendimento e treinamento.

O usuário de suporte não aparece na lista para os usuários do cliente. Quando o próprio suporte está conectado, ele aparece com um cadeado e não pode ser editado nem excluído.

Novos usuários recebem um convite por e-mail para criar a própria senha. O e-mail é o login e não pode ser trocado depois.

**Passo a passo**

1. Abra Administração › Usuários e clique em "Novo usuário".
2. Informe nome, e-mail e escolha um ou mais perfis de acesso.
3. Para mudar perfis ou desativar o acesso, use o lápis ao lado do usuário; o envelope reenvia o convite para quem ainda não entrou.

> **Dica:** Ninguém pode desativar, bloquear ou limitar os dias do próprio usuário.

<a id="17-acesso"></a>
## 17. Dias de acesso, bloqueios e troca de senha

**Para:** Administradores

No cadastro do usuário dá para marcar os dias da semana em que ele pode entrar. Fora desses dias (horário de Brasília) o login é recusado e quem já estava conectado é desconectado. Nenhum dia marcado significa acesso todos os dias.

O bloqueio de acesso impede a entrada por um período (com início, fim opcional e motivo), por exemplo durante férias ou afastamento. Enquanto vale, as sessões do usuário são encerradas. O motivo só aparece para quem digitou a senha correta.

Em Administração › Bloqueios de acesso ficam os bloqueios vigentes e agendados, com a opção de encerrar antes do fim.

"Pedir troca de senha no próximo acesso" leva o usuário direto para Minha conta até ele trocar a senha. Em Conta › Minha conta, qualquer usuário troca a própria senha informando a atual.

<a id="18-ldap"></a>
## 18. Login pela rede da organização (LDAP / Active Directory)

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

<a id="19-perfis"></a>
## 19. Perfis e permissões

**Para:** Administradores

Cada recurso do sistema tem permissões separadas: por exemplo, Empresas tem Ver, Criar, Editar e Excluir; Feriados tem Ver e Gerenciar; Horas extras tem Aprovar. A tela mostra todos os recursos agrupados por módulo.

Os perfis do sistema (Administrador da empresa, Diretor, RH, Gestor, Supervisor, Coordenadores, Responsáveis por escalas e por equipamentos, Funcionário, Professor, Médico e Profissional da saúde) não podem ser alterados. Para personalizar, use "Criar perfil a partir deste".

Recursos marcados "módulo em construção na V2" já podem ser incluídos nos perfis e passam a valer quando a tela correspondente for liberada.

Mudanças num perfil valem a partir do próximo acesso de cada usuário. Perfis com usuários não podem ser excluídos.

<a id="20-seguranca"></a>
## 20. Segurança, auditoria e privacidade

**Para:** Todos

Toda criação, alteração e exclusão fica registrada na auditoria com data, hora, usuário, endereço IP e os dados antes e depois. A auditoria não pode ser alterada nem apagada, nem mesmo direto no banco.

Senhas são guardadas apenas como hash forte; ninguém, nem a equipe SuperPonto, consegue lê-las.

O tratamento de dados segue a LGPD: o empregador é o controlador dos dados dos trabalhadores e a SuperPonto atua como operadora.

<a id="21-construcao"></a>
## 21. Módulos em construção

**Para:** Todos

A V2 é liberada por fases. Já estão prontos: acesso e recuperação de senha (inclusive login pela rede LDAP/AD), clientes, empresas (com CNPJ alfanumérico), estrutura, unidades, funcionários e importação, usuários, perfis e permissões, auditoria, horários, regras de apuração e escalas, o motor de cálculo de jornada e, na API, a importação de AFD de relógios das Portarias 1.510/2009, 373/2011 e 671/2021, o cadastro de digitais cifradas e a fila de envio de empregador, funcionários e digitais aos relógios.

O app do terminal (tablet de ponto) é instalado por APK e abre em tela cheia, com a tela sempre ligada e opção de modo quiosque.

Próximas fases: registro de ponto (REP-P e relógios), espelho de ponto, AFD/AEJ, banco de horas, solicitações, módulos de Educação, Saúde e Operações, equipamentos e Servidor de Comunicação.

A tela "Conformidade MTE" mostra, item por item, o que a legislação exige e o que já está atendido.

<a id="22-suporte"></a>
## 22. Suporte

**Para:** Todos

Dúvidas sobre acesso: use "Esqueci minha senha" ou fale com o administrador da sua organização.

Administradores: falem com a equipe SuperPonto pelo canal de suporte do contrato.
