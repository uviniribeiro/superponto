// Application version configuration
export const APP_VERSION = '2.5.0';
export const APP_BUILD_DATE = '2026-01-31';
export const APP_NAME = 'PontoMax';

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
      'Nova logo PontoMax moderna',
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
    title: 'Nova Identidade PontoMax',
    type: 'major',
    changes: [
      'Rebranding completo para PontoMax',
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
