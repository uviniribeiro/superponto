// Catálogo de permissões ("modulo.recurso:acao") e perfis de sistema.
// O seed grava ambos; perfis personalizados por tenant combinam estas mesmas permissões.

export const PERMISSIONS = {
  // Organização
  'org.companies:read': 'Ver empresas',
  'org.companies:create': 'Cadastrar empresas',
  'org.companies:update': 'Editar empresas',
  'org.companies:delete': 'Excluir (logicamente) empresas',
  'org.units:read': 'Ver unidades e departamentos',
  'org.units:manage': 'Gerenciar unidades e departamentos',
  // Pessoas e vínculos
  'people.people:read': 'Ver pessoas',
  'people.people:manage': 'Cadastrar e editar pessoas',
  'people.sensitive:read': 'Ver dados sensíveis (CPF, PIS, documentos)',
  'people.employments:read': 'Ver vínculos e matrículas',
  'people.employments:manage': 'Admitir, alterar e desligar vínculos',
  'people.employments:import': 'Importar vínculos em lote',
  // Jornadas e escalas
  'schedules.schedules:read': 'Ver jornadas e escalas',
  'schedules.schedules:manage': 'Gerenciar jornadas e escalas',
  // Ponto
  'time.records:read': 'Ver marcações',
  'time.records:create': 'Registrar marcação própria',
  'time.adjustments:create': 'Lançar ajustes de marcação',
  'time.adjustments:approve': 'Aprovar ajustes de marcação',
  'time.calculations:read': 'Ver apuração e espelho',
  'time.closings:manage': 'Fechar e reabrir períodos',
  'time.bank:read': 'Ver banco de horas',
  'time.bank:manage': 'Lançar movimentos no banco de horas',
  // Solicitações
  'requests.requests:create': 'Abrir solicitações',
  'requests.requests:read': 'Ver solicitações da equipe',
  'requests.requests:approve': 'Aprovar solicitações',
  'requests.flows:manage': 'Configurar fluxos de aprovação',
  // Educação
  'education.academic:read': 'Ver turmas, disciplinas e grades',
  'education.academic:manage': 'Gerenciar turmas, disciplinas e grades',
  'education.sessions:manage': 'Registrar aulas e substituições',
  // Saúde
  'health.shifts:read': 'Ver plantões',
  'health.shifts:manage': 'Gerenciar plantões e coberturas',
  'health.rooms:manage': 'Gerenciar salas e agenda administrativa',
  // Operacional
  'operational.board:read': 'Ver painel operacional',
  'operational.occurrences:manage': 'Registrar e tratar ocorrências',
  'operational.assignments:manage': 'Gerenciar alocações e equipes',
  // Equipamentos
  'devices.devices:read': 'Ver equipamentos',
  'devices.devices:manage': 'Cadastrar e configurar equipamentos',
  'devices.commands:execute': 'Enviar comandos aos equipamentos',
  'devices.servers:manage': 'Gerenciar servidores de comunicação',
  // Relatórios
  'reports.reports:read': 'Ver relatórios',
  'reports.reports:export': 'Exportar relatórios (PDF, Excel, CSV, AFD, AEJ)',
  // Administração do tenant
  'admin.users:read': 'Ver usuários',
  'admin.users:manage': 'Gerenciar usuários',
  'admin.roles:manage': 'Gerenciar perfis e permissões',
  'admin.audit:read': 'Ver auditoria',
  'admin.settings:manage': 'Configurações da organização',
  'admin.billing:manage': 'Plano e assinatura',
  // Plataforma (somente SuperAdmin)
  'platform.tenants:manage': 'Gerenciar clientes (tenants)',
  'platform.plans:manage': 'Gerenciar planos',
  'platform.monitoring:read': 'Monitorar a plataforma',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const all = Object.keys(PERMISSIONS) as PermissionKey[];
const tenantAll = all.filter((p) => !p.startsWith('platform.'));
const pick = (...prefixes: string[]) => tenantAll.filter((p) => prefixes.some((x) => p.startsWith(x)));
const readOnly = (perms: PermissionKey[]) => perms.filter((p) => p.endsWith(':read'));

const SELF: PermissionKey[] = ['time.records:create', 'requests.requests:create'];

export interface SystemRole {
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export const SYSTEM_ROLES: SystemRole[] = [
  { key: 'super_admin', name: 'SuperAdministrador', description: 'Equipe SuperPonto: administração global da plataforma', permissions: all },
  { key: 'company_admin', name: 'Administrador da empresa', description: 'Acesso total à organização', permissions: tenantAll },
  { key: 'director', name: 'Diretor', description: 'Visão completa, sem administração técnica', permissions: [...readOnly(tenantAll), 'requests.requests:approve', 'reports.reports:export'] },
  { key: 'hr', name: 'RH', description: 'Pessoas, vínculos, ponto e banco de horas', permissions: [...pick('people.', 'schedules.', 'time.', 'requests.', 'reports.'), 'org.companies:read', 'org.units:read', 'admin.users:read'] },
  { key: 'manager', name: 'Gestor', description: 'Equipe sob sua gestão', permissions: [...SELF, 'people.people:read', 'people.employments:read', 'schedules.schedules:read', 'time.records:read', 'time.calculations:read', 'time.bank:read', 'time.adjustments:create', 'time.adjustments:approve', 'requests.requests:read', 'requests.requests:approve', 'reports.reports:read', 'org.units:read'] },
  { key: 'supervisor', name: 'Supervisor', description: 'Acompanhamento da equipe e ocorrências', permissions: [...SELF, 'people.employments:read', 'time.records:read', 'time.calculations:read', 'requests.requests:read', 'operational.board:read', 'operational.occurrences:manage', 'org.units:read'] },
  { key: 'school_coordinator', name: 'Coordenador escolar', description: 'Gestão acadêmica e jornada docente', permissions: [...SELF, ...pick('education.'), 'people.employments:read', 'schedules.schedules:read', 'time.calculations:read', 'requests.requests:read', 'requests.requests:approve', 'reports.reports:read', 'org.units:read'] },
  { key: 'medical_coordinator', name: 'Coordenador médico', description: 'Escalas, plantões e coberturas', permissions: [...SELF, ...pick('health.'), 'people.employments:read', 'schedules.schedules:read', 'time.calculations:read', 'requests.requests:read', 'requests.requests:approve', 'reports.reports:read', 'org.units:read'] },
  { key: 'operations_coordinator', name: 'Coordenador operacional', description: 'Painel operacional, equipes e ocorrências', permissions: [...SELF, ...pick('operational.'), 'people.employments:read', 'schedules.schedules:read', 'time.records:read', 'reports.reports:read', 'org.units:read'] },
  { key: 'scheduler', name: 'Responsável por escalas', description: 'Monta jornadas, escalas e plantões', permissions: [...SELF, 'schedules.schedules:read', 'schedules.schedules:manage', 'health.shifts:read', 'health.shifts:manage', 'education.academic:read', 'people.employments:read', 'org.units:read'] },
  { key: 'device_manager', name: 'Responsável por equipamentos', description: 'Relógios, leitores e servidores de comunicação', permissions: [...SELF, ...pick('devices.'), 'org.units:read'] },
  { key: 'employee', name: 'Funcionário', description: 'Marcação, espelho e solicitações próprios', permissions: SELF },
  { key: 'teacher', name: 'Professor', description: 'Marcação, aulas e solicitações próprios', permissions: [...SELF, 'education.academic:read'] },
  { key: 'physician', name: 'Médico', description: 'Marcação, plantões e solicitações próprios', permissions: [...SELF, 'health.shifts:read'] },
  { key: 'health_professional', name: 'Profissional da saúde', description: 'Marcação, plantões e solicitações próprios', permissions: [...SELF, 'health.shifts:read'] },
];
