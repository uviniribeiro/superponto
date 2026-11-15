/**
 * Manual do sistema. Fonte única: alimenta a tela /manual e o arquivo MANUAL.md (npm run docs).
 * Descreve apenas o que já funciona; módulos em construção aparecem como tal.
 */

export interface ManualSection {
  id: string;
  title: string;
  /** quem usa esta parte */
  audience: string;
  body: string[];
  steps?: string[];
  tips?: string[];
}

export const MANUAL_VERSION = 'V2 — versão de 15/11/2026';

export const SECTIONS: ManualSection[] = [
  {
    id: 'visao',
    title: 'O que é o SuperPonto',
    audience: 'Todos',
    body: [
      'O SuperPonto é um sistema de gestão de ponto, jornadas e escalas para empresas, escolas, saúde, setor público e operações.',
      'Cada cliente é uma organização (tenant) que pode ter várias empresas, cada uma com o próprio CNPJ (matriz e filiais). Os dados de uma organização nunca aparecem para outra: o isolamento é garantido no banco de dados, não só na tela.',
      'O que cada pessoa vê e pode fazer depende do perfil de acesso (veja "Perfis e permissões").',
    ],
  },
  {
    id: 'acesso',
    title: 'Entrar no sistema',
    audience: 'Todos',
    body: ['O acesso é feito com e-mail e senha. A sessão fica protegida em cookies seguros e é renovada automaticamente enquanto você usa o sistema.'],
    steps: [
      'Abra o endereço do SuperPonto no navegador.',
      'Informe seu e-mail e sua senha e clique em "Entrar".',
      'Na primeira entrada de cada sessão, a marca aparece e o sistema se abre com uma animação.',
    ],
    tips: [
      'Depois de várias tentativas erradas seguidas, o sistema pede para aguardar um minuto (proteção contra tentativas automáticas).',
      'Para sair, abra o menu do seu usuário, no rodapé da barra lateral, e clique em "Sair".',
    ],
  },
  {
    id: 'senha',
    title: 'Esqueci minha senha',
    audience: 'Todos',
    body: ['Você mesmo cria uma nova senha, sem precisar do suporte. Por segurança, a mensagem é a mesma para e-mails cadastrados ou não.'],
    steps: [
      'Na tela de login, clique em "Esqueci minha senha".',
      'Informe seu e-mail e clique em "Enviar link".',
      'Abra o e-mail recebido e clique em "Definir nova senha". O link vale por 1 hora e funciona uma única vez.',
      'Digite a nova senha duas vezes (mínimo de 12 caracteres) e salve. Você volta para o login.',
    ],
    tips: ['Não recebeu? Confira a caixa de spam e peça um novo link; só o link mais recente funciona.'],
  },
  {
    id: 'navegacao',
    title: 'Navegação: barra lateral, busca e modo noturno',
    audience: 'Todos',
    body: [
      'A barra lateral mostra apenas as telas que o seu perfil pode usar, agrupadas por seção (Principal, Organização, Plataforma, Ajuda).',
      'O botão redondo na borda da barra recolhe ou expande o menu; com ele recolhido, passe o mouse sobre um ícone para ver o nome. A escolha fica salva no seu navegador.',
      'No celular, o menu abre pelo botão no canto superior esquerdo.',
    ],
    steps: [
      'Busca rápida: pressione Ctrl+K (ou ⌘K no Mac), ou clique em "Buscar telas". Digite parte do nome, use as setas para escolher e Enter para abrir.',
      'Modo noturno: use a chave "Modo noturno" no rodapé da barra lateral para alternar entre tema escuro e claro.',
    ],
    tips: ['Se o seu sistema operacional pede menos animações (acessibilidade), o SuperPonto reduz os movimentos automaticamente.'],
  },
  {
    id: 'painel',
    title: 'Visão geral (painel)',
    audience: 'Todos',
    body: [
      'Mostra os números reais da sua organização: empresas cadastradas, permissões do seu perfil e o percentual de cadastros completos (empresas com CNPJ e nome fantasia).',
      'Para a equipe SuperPonto, mostra também o total de clientes da plataforma.',
      'O quadro "Marcações de hoje" fica vazio até a liberação do módulo de ponto da V2.',
    ],
  },
  {
    id: 'empresas',
    title: 'Empresas e CNPJs',
    audience: 'Administradores da organização e RH',
    body: [
      'Cadastre a matriz e as filiais da organização. Cada empresa tem CNPJ, razão social, nome fantasia, contato, endereço, segmento e fuso horário (usado no cálculo da jornada).',
      'Ao digitar um CNPJ válido, o sistema consulta a Receita Federal e preenche razão social, nome fantasia, telefone, e-mail e endereço, e avisa se a situação cadastral não estiver ATIVA. Os campos preenchidos automaticamente ficam destacados em verde e podem ser editados.',
      'Ao digitar o CEP, o endereço, a cidade, a UF e o fuso horário são preenchidos sozinhos. O CEP também identifica o município, que define os feriados estaduais e municipais da empresa.',
      'O campo CNPJ aceita o formato numérico e o novo CNPJ alfanumérico da Receita Federal (ex.: 12.ABC.345/01DE-35). A máscara é aplicada enquanto você digita e os dígitos verificadores são conferidos na hora e de novo no servidor.',
      'Não é possível cadastrar o mesmo CNPJ duas vezes na mesma organização.',
    ],
    steps: [
      'Abra Organização › Estrutura › Empresas.',
      'Clique em "Nova empresa" e digite o CNPJ: os dados da Receita são preenchidos automaticamente.',
      'Confira o endereço, informe o número e clique em "Cadastrar empresa".',
      'Para editar ou remover, passe o mouse sobre a empresa e use os ícones de lápis ou lixeira.',
      'Use a busca da lista para encontrar por nome ou CNPJ, com ou sem pontuação.',
    ],
    tips: [
      'Remover uma empresa a tira das listas, mas o histórico continua guardado na auditoria.',
      'Os botões só aparecem para quem tem a permissão correspondente; a API também confere a permissão.',
    ],
  },
  {
    id: 'feriados',
    title: 'Feriados',
    audience: 'Administradores da organização e RH',
    body: [
      'Os feriados são cadastrados automaticamente: os nacionais (inclusive os móveis, como Carnaval, Sexta-feira da Paixão e Corpus Christi, calculados pela Páscoa de cada ano e o 20 de novembro), os estaduais da UF da empresa e os municipais da cidade da empresa.',
      'O ano seguinte é gerado com antecedência, antes de 1º de janeiro, sem ninguém precisar fazer nada. Consultar um ano futuro também gera os feriados dele na hora.',
      'Ponto facultativo (Carnaval, Quarta-feira de Cinzas e Corpus Christi onde não há lei municipal) aparece como dia de trabalho até a empresa decidir dar folga.',
      'A base de feriados municipais começa pelas capitais. Para outras cidades, cadastre os feriados locais (aniversário da cidade, padroeiro, Corpus Christi) em "Feriado da empresa": eles se repetem todo ano. Itens marcados "confira" vêm da base inicial do SuperPonto e devem ser conferidos com a lei local.',
    ],
    steps: [
      'Abra Organização › Feriados, escolha a empresa e o ano.',
      'Para folgar num ponto facultativo, clique em "Dar folga"; para trabalhar num feriado, "Trabalhar neste dia". "Padrão" desfaz a decisão.',
      'Para cadastrar um feriado local, clique em "Feriado da empresa", informe o nome e o dia (ou escolha um feriado móvel).',
    ],
    tips: ['Preencha o CEP da empresa: sem ele, só aparecem os feriados nacionais.'],
  },
  {
    id: 'clientes',
    title: 'Clientes da plataforma',
    audience: 'Equipe SuperPonto (SuperAdmin)',
    body: [
      'Área exclusiva da equipe SuperPonto para criar e acompanhar as organizações clientes.',
      'Ao criar um cliente, informe o nome, o identificador (gerado a partir do nome), o CNPJ do titular (opcional) e o primeiro administrador. Ele recebe um e-mail para criar a própria senha.',
    ],
    steps: [
      'Abra Plataforma › Clientes e clique em "Novo cliente".',
      'Preencha os dados e clique em "Criar cliente".',
      'Para administrar um cliente, clique nele na lista: o sistema abre as empresas daquele cliente.',
      'No painel e em Empresas, o seletor de organização no topo troca o cliente que você está administrando.',
    ],
    tips: ['Clientes novos começam no status "Em teste".'],
  },
  {
    id: 'perfis',
    title: 'Perfis e permissões',
    audience: 'Administradores',
    body: [
      'Cada usuário recebe um ou mais perfis. Os perfis do sistema são: SuperAdministrador, Administrador da empresa, Diretor, RH, Gestor, Supervisor, Coordenador escolar, Coordenador médico, Coordenador operacional, Responsável por escalas, Responsável por equipamentos, Funcionário, Professor e Médico.',
      'Um perfil pode valer para a organização inteira ou só para empresas específicas: quem tem acesso a uma empresa não vê as outras.',
      'A tela de usuários e perfis personalizados está em construção; até lá, os perfis são atribuídos pela equipe SuperPonto.',
    ],
  },
  {
    id: 'seguranca',
    title: 'Segurança, auditoria e privacidade',
    audience: 'Todos',
    body: [
      'Toda criação, alteração e exclusão fica registrada na auditoria com data, hora, usuário, endereço IP e os dados antes e depois. A auditoria não pode ser alterada nem apagada, nem mesmo direto no banco.',
      'Senhas são guardadas apenas como hash forte; ninguém, nem a equipe SuperPonto, consegue lê-las.',
      'O tratamento de dados segue a LGPD: o empregador é o controlador dos dados dos trabalhadores e a SuperPonto atua como operadora.',
    ],
  },
  {
    id: 'construcao',
    title: 'Módulos em construção',
    audience: 'Todos',
    body: [
      'A V2 é liberada por fases. Já estão prontos: acesso e recuperação de senha, clientes, empresas (com CNPJ alfanumérico), permissões, auditoria, o motor de cálculo de jornada e, na API, a importação de AFD de relógios das Portarias 1.510/2009, 373/2011 e 671/2021, o cadastro de digitais cifradas e a fila de envio de empregador, funcionários e digitais aos relógios.',
      'O app do terminal (tablet de ponto) é instalado por APK e abre em tela cheia, com a tela sempre ligada e opção de modo quiosque.',
      'Próximas fases: unidades e departamentos, usuários e perfis, pessoas e vínculos, jornadas e escalas, registro de ponto (REP-P e relógios), espelho de ponto, AFD/AEJ, banco de horas, solicitações, módulos de Educação, Saúde e Operações, equipamentos e Servidor de Comunicação.',
      'A tela "Conformidade MTE" mostra, item por item, o que a legislação exige e o que já está atendido.',
    ],
  },
  {
    id: 'suporte',
    title: 'Suporte',
    audience: 'Todos',
    body: [
      'Dúvidas sobre acesso: use "Esqueci minha senha" ou fale com o administrador da sua organização.',
      'Administradores: falem com a equipe SuperPonto pelo canal de suporte do contrato.',
    ],
  },
];
