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
7. [Clientes da plataforma](#7-clientes)
8. [Perfis e permissões](#8-perfis)
9. [Segurança, auditoria e privacidade](#9-seguranca)
10. [Módulos em construção](#10-construcao)
11. [Suporte](#11-suporte)

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

Mostra os números reais da sua organização: empresas cadastradas, permissões do seu perfil e o percentual de cadastros completos (empresas com CNPJ e nome fantasia).

Para a equipe SuperPonto, mostra também o total de clientes da plataforma.

O quadro "Marcações de hoje" fica vazio até a liberação do módulo de ponto da V2.

<a id="6-empresas"></a>
## 6. Empresas e CNPJs

**Para:** Administradores da organização e RH

Cadastre a matriz e as filiais da organização. Cada empresa tem razão social, nome fantasia, CNPJ, segmento e fuso horário (usado no cálculo da jornada).

O campo CNPJ aceita o formato numérico e o novo CNPJ alfanumérico da Receita Federal (ex.: 12.ABC.345/01DE-35). A máscara é aplicada enquanto você digita e os dígitos verificadores são conferidos na hora e de novo no servidor.

Não é possível cadastrar o mesmo CNPJ duas vezes na mesma organização.

**Passo a passo**

1. Abra Organização › Estrutura › Empresas.
2. Clique em "Nova empresa", preencha os dados e clique em "Cadastrar empresa".
3. Para editar ou remover, passe o mouse sobre a empresa e use os ícones de lápis ou lixeira.
4. Use a busca da lista para encontrar por nome ou CNPJ, com ou sem pontuação.

> **Dica:** Remover uma empresa a tira das listas, mas o histórico continua guardado na auditoria.
> **Dica:** Os botões só aparecem para quem tem a permissão correspondente; a API também confere a permissão.

<a id="7-clientes"></a>
## 7. Clientes da plataforma

**Para:** Equipe SuperPonto (SuperAdmin)

Área exclusiva da equipe SuperPonto para criar e acompanhar as organizações clientes.

Ao criar um cliente, informe o nome, o identificador (gerado a partir do nome), o CNPJ do titular (opcional) e o primeiro administrador. Ele recebe um e-mail para criar a própria senha.

**Passo a passo**

1. Abra Plataforma › Clientes e clique em "Novo cliente".
2. Preencha os dados e clique em "Criar cliente".
3. Para administrar um cliente, clique nele na lista: o sistema abre as empresas daquele cliente.
4. No painel e em Empresas, o seletor de organização no topo troca o cliente que você está administrando.

> **Dica:** Clientes novos começam no status "Em teste".

<a id="8-perfis"></a>
## 8. Perfis e permissões

**Para:** Administradores

Cada usuário recebe um ou mais perfis. Os perfis do sistema são: SuperAdministrador, Administrador da empresa, Diretor, RH, Gestor, Supervisor, Coordenador escolar, Coordenador médico, Coordenador operacional, Responsável por escalas, Responsável por equipamentos, Funcionário, Professor e Médico.

Um perfil pode valer para a organização inteira ou só para empresas específicas: quem tem acesso a uma empresa não vê as outras.

A tela de usuários e perfis personalizados está em construção; até lá, os perfis são atribuídos pela equipe SuperPonto.

<a id="9-seguranca"></a>
## 9. Segurança, auditoria e privacidade

**Para:** Todos

Toda criação, alteração e exclusão fica registrada na auditoria com data, hora, usuário, endereço IP e os dados antes e depois. A auditoria não pode ser alterada nem apagada, nem mesmo direto no banco.

Senhas são guardadas apenas como hash forte; ninguém, nem a equipe SuperPonto, consegue lê-las.

O tratamento de dados segue a LGPD: o empregador é o controlador dos dados dos trabalhadores e a SuperPonto atua como operadora.

<a id="10-construcao"></a>
## 10. Módulos em construção

**Para:** Todos

A V2 é liberada por fases. Já estão prontos: acesso e recuperação de senha, clientes, empresas (com CNPJ alfanumérico), permissões, auditoria, o motor de cálculo de jornada e, na API, a importação de AFD de relógios das Portarias 1.510/2009, 373/2011 e 671/2021, o cadastro de digitais cifradas e a fila de envio de empregador, funcionários e digitais aos relógios.

O app do terminal (tablet de ponto) é instalado por APK e abre em tela cheia, com a tela sempre ligada e opção de modo quiosque.

Próximas fases: unidades e departamentos, usuários e perfis, pessoas e vínculos, jornadas e escalas, registro de ponto (REP-P e relógios), espelho de ponto, AFD/AEJ, banco de horas, solicitações, módulos de Educação, Saúde e Operações, equipamentos e Servidor de Comunicação.

A tela "Conformidade MTE" mostra, item por item, o que a legislação exige e o que já está atendido.

<a id="11-suporte"></a>
## 11. Suporte

**Para:** Todos

Dúvidas sobre acesso: use "Esqueci minha senha" ou fale com o administrador da sua organização.

Administradores: falem com a equipe SuperPonto pelo canal de suporte do contrato.
