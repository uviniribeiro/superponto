// Application version configuration
export const APP_VERSION = '3.0.0';
export const APP_BUILD_DATE = '2026-08-17';
export const APP_NAME = 'Ponto Max';

// Changelog entries
export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
  type: 'major' | 'minor' | 'patch';
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.0.0',
    date: '2026-08-17',
    title: 'Ponto Max — Nova Cara e Múltiplos CNPJs',
    type: 'major',
    changes: [
      'Sistema agora se chama Ponto Max, com nova logo, novo ícone e novo nome do aplicativo',
      'Interface renovada: visual mais limpo, leve e fácil de usar em qualquer tela',
      'Cadastro de várias unidades na mesma base: uma matriz e quantas filiais precisar',
      'Novo campo para indicar se a unidade é matriz ou filial, com CNPJ próprio para cada uma',
      'Validações reforçadas em todo o sistema: CNPJ, CPF, PIS, e-mail, telefone, CEP e endereço completo',
      'Mensagens de erro mais claras, mostrando o que está errado e como corrigir',
      'Novo aplicativo exclusivo do Terminal, com download direto pelo sistema',
    ],
  },
  {

    version: '2.7.0',
    date: '2026-07-26',
    title: 'CNPJ Alfanumérico e Exportações Mais Rápidas',
    type: 'minor',
    changes: [
      'Suporte ao novo CNPJ alfanumérico exigido a partir de 2026',
      'Validação e máscara automáticas para CNPJ com letras e números',
      'Pacote ZIP de evidências gerado em segundo plano, sem travar a tela',
      'Acompanhamento do andamento da geração do ZIP (em andamento/concluído)',
      'Confirmação antes de exportar CSV, PDF e ZIP para evitar envios duplicados',
      'Indicadores de carregamento nos botões de exportação',
      'Nova tela de histórico de downloads de evidências, com filtro por período',
      'Formulário de sugestões exclusivo do administrador, já preenchido com o contexto do sistema',
    ],
  },
  {

    version: '2.6.0',
    date: '2026-07-19',
    title: 'Ponto Max — Nova Identidade e Sugestões',
    type: 'major',
    changes: [
      'Sistema renomeado para Ponto Max com nova identidade visual',
      'Novo canal de Sugestões: envie melhorias, funcionalidades e relatórios direto pelo sistema',
      'Painel administrativo de Sugestões com controle de status e notas internas',
      'Auditoria com paginação por página para grandes volumes de registros',
      'Download em lote (ZIP) dos pacotes de evidências de bloqueios',
      'Pacote de evidências agora destaca o campo divergente (esperado × enviado)',
      'Registro completo de quem baixou cada evidência (rastreabilidade)',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-01-31',
    title: 'Temas de Feriados e Menu Aprimorado',
    type: 'minor',
    changes: [
      'Temas visuais completos para cada feriado brasileiro',
      'Carnaval com cores vibrantes e confetes animados',
      'Páscoa, Natal e Ano Novo com decorações temáticas',
      'Ícones do menu sempre visíveis em todas as posições',
      'Menu lateral com melhor contraste e legibilidade',
      'Marca d\'água única centralizada em todas as telas',
      'Suporte aprimorado para modo claro e escuro',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-01-26',
    title: 'Temas Sazonais e Instalação Mobile',
    type: 'minor',
    changes: [
      'Marca d\'água dinâmica com logo da empresa',
      'Sistema automático de temas para feriados',
      'Banner festivo com contagem regressiva',
      'Melhorias na instalação do app no celular',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-01-26',
    title: 'Nova Identidade Visual',
    type: 'minor',
    changes: [
      'Nova logo Ponto Max moderna',
      'Interface renovada com visual futurista',
      'Separação de Jornadas, Escalas Fixas e Agendadas',
      'Sistema de escala individual e em lote',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-01-25',
    title: 'Recursos de Gestão Avançada',
    type: 'minor',
    changes: [
      'Preenchimento automático de endereço pelo CEP',
      'Relatório de Turnover com gráficos',
      'Calculadora de Horas com adicional noturno',
      'Gestão de Hora In Itinere para deslocamento',
      'Abono em Lote para múltiplos funcionários',
      'Central de Categorias com navegação simplificada',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-01-25',
    title: 'Homologação de Ponto',
    type: 'minor',
    changes: [
      'Fluxo completo de homologação mensal',
      'Gestão de cartões de ponto com assinaturas',
      'Registro de ocorrências com justificativas',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-01-24',
    title: 'Nova Identidade Ponto Max',
    type: 'major',
    changes: [
      'Rebranding completo para Ponto Max',
      'Nova paleta de cores moderna',
      'Autenticação com verificação em duas etapas',
      'Login com biometria (digital/reconhecimento facial)',
      'Dashboard de segurança com histórico de acessos',
    ],
  },
  {
    version: '1.20.3',
    date: '2026-01-22',
    title: 'Módulos Educação e Saúde',
    type: 'minor',
    changes: [
      'Quadro de horários para professores',
      'Quadro de horários para médicos',
      'Módulo de Planos de Aula',
      'Cadastro de escolas e unidades de saúde',
    ],
  },
  {
    version: '1.20.2',
    date: '2026-01-16',
    title: 'Interface Modernizada',
    type: 'minor',
    changes: [
      'Nova interface visual',
      'Menu lateral com categorias organizadas',
      'Páginas de relatórios individuais',
      'Formulário de funcionários com abas',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-02',
    title: 'Lançamento Inicial',
    type: 'major',
    changes: [
      'Sistema de controle de ponto eletrônico',
      'Gestão de funcionários e jornadas',
      'Relatórios e exportações',
      'Módulo de equipamentos REP',
    ],
  },
];

// Version display format
export const getVersionString = () => {
  return `v${APP_VERSION}`;
};

export const getFullVersionInfo = () => {
  return {
    version: APP_VERSION,
    buildDate: APP_BUILD_DATE,
    name: APP_NAME,
    displayString: `${APP_NAME} v${APP_VERSION}`,
    changelog: CHANGELOG,
  };
};

export const getLatestChangelog = () => {
  return CHANGELOG[0];
};
