// Application version configuration
export const APP_VERSION = '2.0.0';
export const APP_BUILD_DATE = '2026-01-24';
export const APP_NAME = 'SuperPonto';

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
    version: '2.0.0',
    date: '2026-01-24',
    title: 'SuperPonto - Nova Identidade Visual',
    type: 'major',
    changes: [
      'Rebranding completo para SuperPonto',
      'Nova paleta de cores: cinza com acentos verdes',
      'Interface minimalista e moderna',
      'Autenticação 2FA com TOTP e códigos de backup',
      'Login biométrico com WebAuthn/FIDO2',
      'Dashboard de segurança com logs de acesso',
      'Notificações de login suspeito por email',
      'Testes de integração com Docker',
      'Pipeline CI/CD com GitHub Actions',
      'PDFs em formato A4 com logo personalizável',
      'Detecção automática de proporção de tela',
    ],
  },
  {
    version: '1.20.3',
    date: '2026-01-22',
    title: 'Módulos Educação e Saúde',
    type: 'minor',
    changes: [
      'Quadro de horários para professores com escola e sala',
      'Quadro de horários para médicos com setor e sala',
      'Novo módulo de Planos de Aula para educadores',
      'Cadastro automático de escolas municipais por prefeitura',
      'Cadastro automático de UBS, UPA e Hospitais por município',
      'Gestão de turmas vinculadas às escolas',
      'Sincronização de dados municipais via Edge Function',
    ],
  },
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
