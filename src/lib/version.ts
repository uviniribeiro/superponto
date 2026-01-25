// Application version configuration
export const APP_VERSION = '2.2.0';
export const APP_BUILD_DATE = '2026-01-25';
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
    version: '2.2.0',
    date: '2026-01-25',
    title: 'Recursos Avançados e Relatórios Gerenciais',
    type: 'minor',
    changes: [
      'Relatório de Turnover com gráficos de rotatividade',
      'Calculadora de Horas com cálculo de adicional noturno',
      'Gestão de Textos Customizados do sistema',
      'Hora In Itinere (CLT Art. 58) para deslocamento',
      'Cadastro de Sobre Aviso para escalas de plantão',
      'Abono em Lote para múltiplos funcionários',
      'Banco de Compensação com créditos/débitos manuais',
      'Cadastro de Estados Civis e Cidades',
      'Central de Categorias com navegação por hub',
      '19 novas tabelas para requisitos técnicos de licitação',
      'Campos expandidos no cadastro de funcionários',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-01-25',
    title: 'Homologação de Ponto e Correções de Segurança',
    type: 'minor',
    changes: [
      'Nova logo profissional SuperPonto',
      'Fluxo completo de homologação de ponto mensal',
      'Gestão de cartões de ponto com assinaturas',
      'Registro de ocorrências com justificativas',
      'Correção de vulnerabilidades em views seguras',
      'Views profiles_secure, equipment_secure e payroll_secure protegidas',
      'Padronização visual de todas as páginas novas',
      'Limpeza de código duplicado e arquivos obsoletos',
    ],
  },
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
