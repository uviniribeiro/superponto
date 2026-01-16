// Application version configuration
export const APP_VERSION = '1.20.2';
export const APP_BUILD_DATE = '2026-01-16';
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
    version: '1.20.2',
    date: '2026-01-16',
    title: 'Nova Interface e Melhorias',
    type: 'minor',
    changes: [
      'Nova interface visual modernizada',
      'Novo layout de sidebar com categorias colapsáveis',
      'Páginas de relatórios individuais',
      'Novo design para cadastro de escalas e departamentos',
      'Formulário de funcionários com abas',
      'Nova página de configurações da empresa',
      'Campos obrigatórios simplificados no cadastro',
      'Correção de duplicidades no código',
    ],
  },
  {
    version: '1.20.1',
    date: '2026-01-13',
    title: 'Otimizações e Novos Recursos',
    type: 'minor',
    changes: [
      'Novo popup "O que há de novo" após cada atualização',
      'Manual do sistema integrado nas configurações',
      'Reorganização completa das categorias do menu',
      'Tela de login simplificada e otimizada',
      'Novos cadastros: Sindicatos, Justificativas, Escalas, Percentuais',
      'Novo módulo de Competências e Locais GPS',
      'Melhorias gerais de interface e usabilidade',
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
