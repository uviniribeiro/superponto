import {
  Bot,
  Clock,
  UserPlus,
  CalendarRange,
  Stethoscope,
  Banknote,
  LayoutList,
  LayoutDashboard,
  Users,
  FileText,
  ClipboardCheck,
  Building2,
  CalendarDays,
  Timer,
  UserX,
  TrendingUp,
  SlidersHorizontal,
  Briefcase,
  CalendarClock,
  GraduationCap,
  ClipboardList,
  Server,
  Home,
  Bell,
  Smartphone,
  MonitorSmartphone,
  BarChart3,
  Cog,
  FileBarChart,
  Download,
  Scale,
  MapPin,
  UserCog,
  Shield,
  Wallet,
  Calendar,
  ListChecks,
  Network,
  Activity,
  HardDrive,
  RefreshCw,
  HelpCircle,
  FileCheck,
  Import,
  BookOpen,
  School,
  Hospital,
  AlertCircle,
  FileDown,
  AlertTriangle,
} from 'lucide-react';
import type { CategoryHubConfig } from '@/components/CategoryHub';

// Home category
export const homeHubConfig: CategoryHubConfig = {
  title: 'Início',
  description: 'Acesso rápido às funções principais do sistema',
  groups: [
    {
      title: 'Visão Geral',
      subtitle: 'Acesse os painéis principais',
      items: [
        { title: 'Início', description: 'Tela inicial com resumo do dia', icon: Home, href: '/home', color: 'text-blue-600' },
        { title: 'Dashboard', description: 'Visão geral e estatísticas', icon: LayoutDashboard, href: '/dashboard', color: 'text-emerald-600' },
      ],
    },
    {
      title: 'Atalhos Rápidos',
      subtitle: 'Ferramentas mais utilizadas',
      items: [
        { title: 'Registrar Ponto', description: 'Marque entrada, intervalo e saída', icon: Clock, href: '/time-clock' },
        { title: 'Meus Registros', description: 'Consulte suas marcações', icon: FileText, href: '/my-records' },
        { title: 'Espelho de Ponto', description: 'Folha de ponto dos funcionários', icon: ClipboardList, href: '/timesheet' },
        { title: 'Funcionários', description: 'Cadastro e gestão de pessoas', icon: Users, href: '/employees' },
        { title: 'Ajustes de Ponto', description: 'Solicitações e aprovações', icon: ClipboardCheck, href: '/adjustments' },
        { title: 'Banco de Horas', description: 'Saldo e compensações', icon: Timer, href: '/time-bank' },
        { title: 'Faltas e Afastamentos', description: 'Ausências e justificativas', icon: UserX, href: '/absences' },
        { title: 'Relatórios', description: 'Relatórios legais e gerenciais', icon: FileBarChart, href: '/reports' },
        { title: 'Jornadas e Escalas', description: 'Horários e escalas de trabalho', icon: CalendarClock, href: '/schedules' },
        { title: 'Feriados', description: 'Calendário anual de feriados', icon: CalendarDays, href: '/holidays' },
        { title: 'Equipamentos REP', description: 'Relógios de ponto e coletas', icon: Server, href: '/equipment' },
        { title: 'Empresa', description: 'Dados, unidades e configurações', icon: Building2, href: '/company' },
      ],
    },
  ],
};

// Cadastros category
export const cadastrosHubConfig: CategoryHubConfig = {
  title: 'Cadastros',
  description: 'Gerencie funcionários, cargos, departamentos e dados básicos',
  groups: [
    {
      title: 'Gestão de Pessoas',
      subtitle: 'Cadastro e controle de funcionários',
      items: [
        { title: 'Funcionários', description: 'Cadastro completo de funcionários', icon: Users, href: '/employees', color: 'text-blue-600' },
        { title: 'Novo Funcionário', description: 'Abrir formulário de cadastro', icon: UserPlus, href: '/employees/register', color: 'text-emerald-600' },
        { title: 'Usuários', description: 'Gestão de acessos ao sistema', icon: UserCog, href: '/users', color: 'text-violet-600' },
      ],
    },
    {
      title: 'Estrutura Organizacional',
      subtitle: 'Cargos e departamentos da empresa',
      items: [
        { title: 'Cargos e Departamentos', description: 'Estrutura hierárquica da empresa', icon: Building2, href: '/positions-departments', color: 'text-amber-600' },
        { title: 'Departamentos', description: 'Organograma departamental', icon: Network, href: '/departments', color: 'text-teal-600' },
        { title: 'Sindicatos', description: 'Entidades sindicais', icon: Briefcase, href: '/unions', color: 'text-slate-600' },
      ],
    },
    {
      title: 'Dados Auxiliares',
      subtitle: 'Configurações básicas do sistema',
      items: [
        { title: 'Feriados', description: 'Calendário de feriados nacionais e locais', icon: CalendarDays, href: '/holidays', color: 'text-red-600' },
        { title: 'Justificativas', description: 'Tipos de justificativas para ausências', icon: ClipboardCheck, href: '/justifications', color: 'text-purple-600' },
        { title: 'Tipos de Funcionário', description: 'Categorias de vínculo empregatício', icon: UserCog, href: '/basic-registrations', color: 'text-orange-600' },
        { title: 'Estados Civis', description: 'Cadastro de estados civis', icon: Users, href: '/marital-statuses', color: 'text-pink-600' },
        { title: 'Cidades', description: 'Cadastro de cidades', icon: MapPin, href: '/cities', color: 'text-cyan-600' },
      ],
    },
  ],
};

// Escalas e Jornadas category
export const escalasHubConfig: CategoryHubConfig = {
  title: 'Jornadas e Escalas',
  description: 'Configure horários de trabalho, escalas fixas e agendadas',
  groups: [
    {
      title: 'Jornadas de Trabalho',
      subtitle: 'Defina os horários e regras de trabalho',
      items: [
        { title: 'Jornadas', description: 'Configurar horários de entrada, saída e intervalos', icon: Clock, href: '/journeys', color: 'text-blue-600' },
        { title: 'Horários de Trabalho', description: 'Grade de horários por funcionário', icon: Timer, href: '/work-schedules', color: 'text-cyan-600' },
        { title: 'Agenda de Escalas', description: 'Calendário geral das escalas', icon: CalendarRange, href: '/schedules', color: 'text-violet-600' },
        { title: 'Períodos de Competência', description: 'Períodos de fechamento da folha', icon: CalendarClock, href: '/competency-periods', color: 'text-amber-600' },
      ],
    },
    {
      title: 'Escalas de Trabalho',
      subtitle: 'Escalas de revezamento e plantões',
      items: [
        { title: 'Escalas Fixas', description: 'Escalas cíclicas 12x36, 5x1, 6x1', icon: Calendar, href: '/fixed-scales', color: 'text-violet-600' },
        { title: 'Escalas Agendadas', description: 'Atribuição individual ou em lote', icon: CalendarDays, href: '/scheduled-scales', color: 'text-emerald-600' },
      ],
    },
    {
      title: 'Legado',
      subtitle: 'Páginas anteriores (em desativação)',
      items: [
        { title: 'Configuração Antiga', description: 'Interface unificada anterior', icon: Scale, href: '/schedules', color: 'text-slate-400' },
      ],
    },
  ],
};

// Ponto category
export const pontoHubConfig: CategoryHubConfig = {
  title: 'Registro de Ponto',
  description: 'Marcações, espelhos e folhas de ponto',
  groups: [
    {
      title: 'Registro de Ponto',
      subtitle: 'Realize e visualize marcações',
      items: [
        { title: 'Registrar Ponto', description: 'Registrar entrada, saída e intervalos', icon: Clock, href: '/time-clock', color: 'text-emerald-600' },
        { title: 'Meus Registros', description: 'Visualizar suas marcações pessoais', icon: ListChecks, href: '/my-records', color: 'text-blue-600' },
      ],
    },
    {
      title: 'Espelhos e Folhas',
      subtitle: 'Visualização consolidada de marcações',
      items: [
        { title: 'Espelho de Ponto', description: 'Espelho individual de marcações', icon: ClipboardList, href: '/mirror-point', color: 'text-violet-600' },
        { title: 'Folha de Ponto', description: 'Folha de ponto para impressão', icon: FileText, href: '/timesheet', color: 'text-amber-600' },
        { title: 'Cartões de Ponto', description: 'Cartões de ponto dos funcionários', icon: FileText, href: '/point-cards', color: 'text-slate-600' },
      ],
    },
    {
      title: 'Gestão e Aprovação',
      subtitle: 'Ajustes, ocorrências e homologação',
      items: [
        { title: 'Ajustes de Ponto', description: 'Solicitações de correção de marcação', icon: ClipboardCheck, href: '/adjustments', color: 'text-orange-600' },
        { title: 'Ocorrências', description: 'Atrasos, faltas e inconsistências', icon: AlertCircle, href: '/point-occurrences', color: 'text-red-600' },
        { title: 'Homologação', description: 'Aprovação mensal do ponto', icon: FileCheck, href: '/point-homologation', color: 'text-teal-600' },
      ],
    },
  ],
};

// Afastamentos e Férias category
export const afastamentosHubConfig: CategoryHubConfig = {
  title: 'Ausências e Férias',
  description: 'Gestão de ausências, licenças e período de férias',
  groups: [
    {
      title: 'Gestão de Afastamentos',
      subtitle: 'Licenças, atestados e ausências',
      items: [
        { title: 'Gestão de Afastamentos', description: 'Controle de licenças e atestados', icon: UserX, href: '/leave-management', color: 'text-red-600' },
        { title: 'Faltas e Ausências', description: 'Registro de faltas justificadas e injustificadas', icon: Calendar, href: '/absences', color: 'text-amber-600' },
      ],
    },
    {
      title: 'Férias',
      subtitle: 'Programação e controle de férias',
      items: [
        { title: 'Férias', description: 'Solicitação e aprovação de férias', icon: CalendarDays, href: '/vacations', color: 'text-emerald-600' },
      ],
    },
  ],
};

// Monitoramento category
export const monitoramentoHubConfig: CategoryHubConfig = {
  title: 'Monitoramento',
  description: 'Acompanhamento em tempo real e alertas',
  groups: [
    {
      title: 'Presença em Tempo Real',
      subtitle: 'Visualize quem está trabalhando agora',
      items: [
        { title: 'Central de Presença', description: 'Monitoramento de presença em tempo real', icon: Users, href: '/presence-monitoring', color: 'text-emerald-600' },
        { title: 'Postos de Trabalho', description: 'Locais de trabalho georreferenciados', icon: MapPin, href: '/work-stations', color: 'text-blue-600' },
      ],
    },
    {
      title: 'Alertas e Notificações',
      subtitle: 'Configure notificações automáticas',
      items: [
        { title: 'Notificações', description: 'Alertas personalizados do sistema', icon: Bell, href: '/custom-notifications', color: 'text-amber-600' },
      ],
    },
  ],
};

// Banco de Horas category
export const bancoHorasHubConfig: CategoryHubConfig = {
  title: 'Banco de Horas e Horas Extras',
  description: 'Saldos, compensações e regras de horas extras',
  groups: [
    {
      title: 'Saldo e Movimentação',
      subtitle: 'Controle do banco de horas',
      items: [
        { title: 'Banco de Horas', description: 'Saldo e movimentação de horas', icon: Timer, href: '/time-bank', color: 'text-violet-600' },
        { title: 'Banco Compensação', description: 'Créditos e débitos de horas', icon: Scale, href: '/compensation-bank', color: 'text-blue-600' },
        { title: 'Dashboard HE', description: 'Visão gerencial de horas extras', icon: BarChart3, href: '/overtime-dashboard', color: 'text-emerald-600' },
      ],
    },
    {
      title: 'Movimentações Especiais',
      subtitle: 'Hora in itinere, sobreaviso e abonos',
      items: [
        { title: 'Hora In Itinere', description: 'Tempo de deslocamento (CLT Art. 58)', icon: Clock, href: '/commute-time', color: 'text-amber-600' },
        { title: 'Sobre Aviso', description: 'Escalas de sobreaviso', icon: Bell, href: '/on-call-schedules', color: 'text-orange-600' },
        { title: 'Abono em Lote', description: 'Abonar faltas para múltiplos funcionários', icon: ListChecks, href: '/batch-absolutions', color: 'text-teal-600' },
      ],
    },
    {
      title: 'Configurações',
      subtitle: 'Regras de cálculo de horas extras',
      items: [
        { title: 'Regras de HE', description: 'Percentuais e regras de horas extras', icon: TrendingUp, href: '/overtime-percentages', color: 'text-amber-600' },
        { title: 'Regras de Apuração', description: 'Tolerâncias, noturno, intrajornada e compensação', icon: SlidersHorizontal, href: '/attendance-rules', color: 'text-sky-600' },
      ],
    },
  ],
};

// Equipamentos REP category
export const equipamentosHubConfig: CategoryHubConfig = {
  title: 'Equipamentos REP',
  description: 'Gestão de relógios de ponto eletrônicos',
  groups: [
    {
      title: 'Cadastro e Status',
      subtitle: 'Gerencie seus equipamentos REP',
      items: [
        { title: 'Lista de REP', description: 'Todos os equipamentos cadastrados', icon: Server, href: '/equipment/list', color: 'text-blue-600' },
        { title: 'Adicionar REP', description: 'Cadastrar novo equipamento', icon: HardDrive, href: '/equipment/add', color: 'text-emerald-600' },
        { title: 'Status Online', description: 'Monitorar conectividade dos REPs', icon: Activity, href: '/equipment/status', color: 'text-amber-600' },
      ],
    },
    {
      title: 'Sincronização e Dados',
      subtitle: 'Comunicação com os equipamentos',
      items: [
        { title: 'Sincronização', description: 'Sincronizar marcações dos REPs', icon: RefreshCw, href: '/equipment/sync', color: 'text-violet-600' },
        { title: 'Registros Pendentes', description: 'Marcações aguardando processamento', icon: ClipboardList, href: '/equipment/pending', color: 'text-orange-600' },
        { title: 'Funcionários no REP', description: 'Enviar funcionários para o REP', icon: Users, href: '/equipment/employees', color: 'text-teal-600' },
      ],
    },
    {
      title: 'Auditoria e Suporte',
      subtitle: 'Logs e conformidade',
      items: [
        { title: 'Logs de Comunicação', description: 'Histórico de comunicação com REPs', icon: FileText, href: '/equipment/logs', color: 'text-slate-600' },
        { title: 'Conformidade MTE', description: 'Verificar conformidade com a legislação', icon: Shield, href: '/equipment/compliance', color: 'text-red-600', badges: ['Portaria 671'] },
        { title: 'Robô de Comunicação', description: 'Agentes locais, descoberta de relógios e envio de funcionários', icon: Bot, href: '/equipment/agents', color: 'text-fuchsia-600' },
        { title: 'Saúde do Robô', description: 'CPU, memória, conexão e versão em tempo real', icon: Activity, href: '/equipment/agent-health', color: 'text-lime-600' },
        { title: 'Relógios em Tempo Real', description: 'Status, última comunicação e comandos recebidos', icon: Activity, href: '/equipment/clocks-live', color: 'text-sky-600' },
        { title: 'Servidores de Comunicação', description: 'Henry via TCP/IP e Control iD (local ou iD Cloud)', icon: Server, href: '/equipment/servers', color: 'text-cyan-600' },
        { title: 'Ajuda REP', description: 'Guia de configuração e suporte', icon: HelpCircle, href: '/equipment/help', color: 'text-blue-600' },
      ],
    },
  ],
};

// Ponto Mobile category
export const pontoMobileHubConfig: CategoryHubConfig = {
  title: 'Ponto Mobile',
  description: 'Configurações do ponto via dispositivos móveis',
  groups: [
    {
      title: 'Identificação',
      subtitle: 'Métodos de autenticação no mobile',
      items: [
        { title: 'Métodos de Identificação', description: 'Biometria facial, PIN e outros', icon: Smartphone, href: '/identification-methods', color: 'text-blue-600' },
        { title: 'Auditoria de Validações', description: 'Tentativas de QR/facial, filtros e exportação', icon: Shield, href: '/validation-audit', color: 'text-emerald-600' },
      ],
    },
    {
      title: 'Geolocalização',
      subtitle: 'Cercas eletrônicas e locais permitidos',
      items: [
        { title: 'Locais Georreferenciados', description: 'Defina locais permitidos para registro', icon: MapPin, href: '/georeferenced-locations', color: 'text-emerald-600' },
      ],
    },
  ],
};

// Professor category
export const professorHubConfig: CategoryHubConfig = {
  title: 'Módulo Professor',
  description: 'Gestão de hora-aula e controle de professores',
  groups: [
    {
      title: 'Visão Geral',
      subtitle: 'Dashboard e resumos',
      items: [
        { title: 'Módulo Professor', description: 'Página inicial do módulo', icon: LayoutList, href: '/teacher-module', color: 'text-blue-600' },
        { title: 'Dashboard', description: 'Visão geral do módulo professor', icon: LayoutDashboard, href: '/teacher/dashboard', color: 'text-emerald-600' },
        { title: 'Consolidado', description: 'Resumo de horas-aula do período', icon: FileBarChart, href: '/teacher/summary', color: 'text-violet-600' },
      ],
    },
    {
      title: 'Cadastros',
      subtitle: 'Professores, escolas e turmas',
      items: [
        { title: 'Professores', description: 'Cadastro de docentes', icon: Users, href: '/teacher/professors', color: 'text-blue-600' },
        { title: 'Escolas', description: 'Unidades escolares', icon: School, href: '/teacher/schools', color: 'text-amber-600' },
        { title: 'Aulas', description: 'Turmas e disciplinas', icon: BookOpen, href: '/teacher/classes', color: 'text-teal-600' },
      ],
    },
    {
      title: 'Planejamento',
      subtitle: 'Horários e planos de aula',
      items: [
        { title: 'Plano de Aula', description: 'Planejamento de aulas', icon: FileText, href: '/teacher/lesson-plans', color: 'text-purple-600' },
        { title: 'Quadro de Horários', description: 'Grade de horários dos professores', icon: Calendar, href: '/teacher/schedule', color: 'text-orange-600' },
      ],
    },
    {
      title: 'Controle de Ponto',
      subtitle: 'Espelho e configurações',
      items: [
        { title: 'Espelho de Ponto', description: 'Espelho de marcações dos professores', icon: ClipboardList, href: '/teacher/mirror', color: 'text-slate-600' },
        { title: 'Configurações', description: 'Parâmetros do módulo professor', icon: Cog, href: '/teacher/configurations', color: 'text-gray-600' },
      ],
    },
  ],
};

// Doctor category
export const medicoHubConfig: CategoryHubConfig = {
  title: 'Módulo Médico',
  description: 'Gestão de plantões e controle de profissionais de saúde',
  groups: [
    {
      title: 'Visão Geral',
      subtitle: 'Dashboard e resumos',
      items: [
        { title: 'Módulo Médico', description: 'Página inicial do módulo', icon: Stethoscope, href: '/doctor-module', color: 'text-blue-600' },
        { title: 'Dashboard', description: 'Visão geral do módulo médico', icon: LayoutDashboard, href: '/doctor/dashboard', color: 'text-emerald-600' },
        { title: 'Consolidado', description: 'Resumo de plantões do período', icon: FileBarChart, href: '/doctor/summary', color: 'text-violet-600' },
      ],
    },
    {
      title: 'Cadastros',
      subtitle: 'Médicos e unidades de saúde',
      items: [
        { title: 'Médicos', description: 'Cadastro de profissionais de saúde', icon: Users, href: '/doctor/doctors', color: 'text-blue-600' },
        { title: 'Unidades de Saúde', description: 'Hospitais, UPAs e postos', icon: Hospital, href: '/doctor/health-units', color: 'text-red-600' },
      ],
    },
    {
      title: 'Plantões',
      subtitle: 'Escalas e horários de plantão',
      items: [
        { title: 'Plantões', description: 'Configuração de tipos de plantão', icon: Activity, href: '/doctor/shifts', color: 'text-amber-600' },
        { title: 'Quadro de Plantões', description: 'Escala de plantões médicos', icon: Calendar, href: '/doctor/schedule', color: 'text-teal-600' },
      ],
    },
    {
      title: 'Controle de Ponto',
      subtitle: 'Espelho e configurações',
      items: [
        { title: 'Espelho de Ponto', description: 'Espelho de marcações médicas', icon: ClipboardList, href: '/doctor/mirror', color: 'text-slate-600' },
        { title: 'Configurações', description: 'Parâmetros do módulo médico', icon: Cog, href: '/doctor/configurations', color: 'text-gray-600' },
      ],
    },
  ],
};

// Folha de Pagamento category
export const folhaHubConfig: CategoryHubConfig = {
  title: 'Folha de Pagamento',
  description: 'Gestão de folha de pagamento e holerites',
  groups: [
    {
      title: 'Visão Geral',
      subtitle: 'Dashboard e controle de folhas',
      items: [
        { title: 'Folha de Pagamento', description: 'Página inicial do módulo', icon: Banknote, href: '/payroll-module', color: 'text-blue-600' },
        { title: 'Dashboard', description: 'Visão geral da folha de pagamento', icon: LayoutDashboard, href: '/payroll/dashboard', color: 'text-emerald-600' },
        { title: 'Folhas', description: 'Lista de folhas processadas', icon: FileText, href: '/payroll/list', color: 'text-blue-600' },
      ],
    },
    {
      title: 'Processamento',
      subtitle: 'Gerar e visualizar folhas',
      items: [
        { title: 'Nova Folha', description: 'Processar nova folha de pagamento', icon: ListChecks, href: '/payroll/create', color: 'text-violet-600' },
        { title: 'Holerites', description: 'Demonstrativos de pagamento', icon: FileText, href: '/payroll/payslips', color: 'text-amber-600' },
      ],
    },
    {
      title: 'Configurações',
      subtitle: 'Rubricas e parâmetros',
      items: [
        { title: 'Rubricas', description: 'Itens da folha de pagamento', icon: Cog, href: '/payroll/items', color: 'text-slate-600' },
      ],
    },
  ],
};

// Relatórios category
export const relatoriosHubConfig: CategoryHubConfig = {
  title: 'Relatórios',
  description: 'Geração de relatórios e arquivos fiscais',
  groups: [
    {
      title: 'Relatórios Legais',
      subtitle: 'Exigidos pela legislação trabalhista',
      items: [
        { title: 'Espelho de Ponto', description: 'Relatório individual de marcações', icon: Clock, href: '/reports/mirror-point', badges: ['Portaria 1510', 'Portaria 373', 'Portaria 671'], color: 'text-blue-600' },
        { title: 'AFDT - Arquivo Fonte de Dados', description: 'Arquivo exigido pela Portaria 1510/671', icon: FileText, href: '/reports/mte', badges: ['Portaria 1510', 'Portaria 671'], color: 'text-amber-600' },
        { title: 'ACJEF - Arquivo de Jornada', description: 'Controle de jornada para fiscalização', icon: FileDown, href: '/reports/mte', badges: ['Portaria 1510', 'Portaria 671'], color: 'text-amber-600' },
      ],
    },
    {
      title: 'Relatórios Gerenciais',
      subtitle: 'Para gestão e tomada de decisão',
      items: [
        { title: 'Horas Extras', description: 'Relatório de HE por funcionário', icon: TrendingUp, href: '/reports/overtime', color: 'text-emerald-600' },
        { title: 'Banco de Horas', description: 'Saldo do banco de horas', icon: Timer, href: '/reports/time-bank', color: 'text-violet-600' },
        { title: 'Absenteísmo', description: 'Índice de faltas e ausências', icon: AlertTriangle, href: '/reports/absences', color: 'text-red-600' },
        { title: 'Atrasos e Saídas Antecipadas', description: 'Irregularidades de horário', icon: Clock, href: '/reports/absences', color: 'text-orange-600' },
        { title: 'Turnover', description: 'Análise de rotatividade de funcionários', icon: BarChart3, href: '/reports/turnover', color: 'text-indigo-600' },
      ],
    },
    {
      title: 'Cadastros',
      subtitle: 'Listagem de dados cadastrais',
      items: [
        { title: 'Cadastro de Funcionários', description: 'Lista completa de funcionários', icon: Users, href: '/employees', color: 'text-blue-600' },
      ],
    },
    {
      title: 'Relatórios Operacionais',
      subtitle: 'Acompanhamento do dia a dia',
      items: [
        { title: 'Marcações por Período', description: 'Todas as marcações em um período', icon: Clock, href: '/reports/worked-hours', color: 'text-blue-600' },
        { title: 'Ajustes de Ponto', description: 'Ajustes solicitados e aprovados', icon: ClipboardList, href: '/adjustments', color: 'text-amber-600' },
        { title: 'Afastamentos', description: 'Férias, atestados e licenças', icon: Calendar, href: '/leave-management', color: 'text-purple-600' },
        { title: 'Presença', description: 'Relatório de presença por período', icon: ListChecks, href: '/reports/attendance', color: 'text-teal-600' },
      ],
    },
    {
      title: 'Integração',
      subtitle: 'Arquivos para outros sistemas',
      items: [
        { title: 'Integração Folha de Pagamento', description: 'Arquivo para sistema de folha', icon: FileDown, href: '/payroll-exports', color: 'text-teal-600' },
      ],
    },
  ],
};

// Exportação category
export const exportacaoHubConfig: CategoryHubConfig = {
  title: 'Integrações e Exportações',
  description: 'Importação de cadastros e exportação de arquivos',
  groups: [
    {
      title: 'Exportação para Folha',
      subtitle: 'Arquivos para sistemas de RH',
      items: [
        { title: 'Exportação Folha', description: 'Gerar arquivo para folha de pagamento', icon: Wallet, href: '/payroll-exports', color: 'text-emerald-600' },
      ],
    },
    {
      title: 'Importação/Exportação',
      subtitle: 'Migração de dados',
      items: [
        { title: 'Importação/Exportação', description: 'Importar e exportar dados do sistema', icon: Import, href: '/import-export', color: 'text-blue-600' },
      ],
    },
  ],
};

// Configurações category
export const configuracoesHubConfig: CategoryHubConfig = {
  title: 'Configurações',
  description: 'Configurações gerais do sistema',
  groups: [
    {
      title: 'Empresa',
      subtitle: 'Dados e configurações da empresa',
      items: [
        { title: 'Configurações da Empresa', description: 'Parâmetros gerais da empresa', icon: Cog, href: '/company-settings', color: 'text-blue-600' },
        { title: 'Dados da Empresa', description: 'Informações cadastrais', icon: Building2, href: '/company', color: 'text-amber-600' },
      ],
    },
    {
      title: 'Usuários e Acesso',
      subtitle: 'Gestão de usuários do sistema',
      items: [
        { title: 'Usuários', description: 'Gerenciar usuários e permissões', icon: Users, href: '/users', color: 'text-violet-600' },
      ],
    },
    {
      title: 'Ferramentas',
      subtitle: 'Utilitários e calculadoras',
      items: [
        { title: 'Calculadora de Horas', description: 'Calcular horas extras e adicionais', icon: Clock, href: '/hours-calculator', color: 'text-emerald-600' },
        { title: 'Textos Customizados', description: 'Personalizar mensagens do sistema', icon: FileText, href: '/custom-texts', color: 'text-amber-600' },
      ],
    },
    {
      title: 'Documentação',
      subtitle: 'Ajuda e manuais',
      items: [
        { title: 'Manual do Sistema', description: 'Documentação e guias de uso', icon: BookOpen, href: '/system-manual', color: 'text-slate-600' },
      ],
    },
  ],
};


// Meu Ponto (Portal do Colaborador)
export const meuPontoHubConfig: CategoryHubConfig = {
  title: 'Meu Ponto',
  description: 'Portal do colaborador: registre e acompanhe seu ponto',
  groups: [
    {
      title: 'Registro',
      subtitle: 'Marque e consulte seu ponto',
      items: [
        { title: 'Registrar Ponto', description: 'Entrada, intervalo e saída', icon: Clock, href: '/time-clock', color: 'text-emerald-600' },
        { title: 'Meus Registros', description: 'Histórico das suas marcações', icon: ListChecks, href: '/my-records', color: 'text-blue-600' },
      ],
    },
    {
      title: 'Minhas Solicitações',
      subtitle: 'Acompanhe pedidos e pendências',
      items: [
        { title: 'Minhas Ocorrências', description: 'Inconsistências do seu ponto', icon: AlertCircle, href: '/point-occurrences', color: 'text-orange-600' },
        { title: 'Minhas Férias', description: 'Solicitação e saldo de férias', icon: CalendarDays, href: '/vacations', color: 'text-violet-600' },
        { title: 'Sugestões', description: 'Envie sugestões e melhorias', icon: Bell, href: '/suggestions', color: 'text-amber-600' },
      ],
    },
    {
      title: 'Minha Conta',
      subtitle: 'Dados pessoais e segurança',
      items: [
        { title: 'Minha Conta', description: 'Senha, 2FA e preferências', icon: UserCog, href: '/account-settings', color: 'text-slate-600' },
      ],
    },
  ],
};

// Tratamento de Ponto (apuração)
export const tratamentoHubConfig: CategoryHubConfig = {
  title: 'Tratamento de Ponto',
  description: 'Apuração, ajustes, abonos e fechamento do período',
  groups: [
    {
      title: 'Tratamento Diário',
      subtitle: 'Correções e ocorrências',
      items: [
        { title: 'Ajustes de Ponto', description: 'Solicitações e aprovações de correção', icon: ClipboardCheck, href: '/adjustments', color: 'text-orange-600' },
        { title: 'Ocorrências', description: 'Atrasos, faltas e inconsistências', icon: AlertCircle, href: '/point-occurrences', color: 'text-red-600' },
        { title: 'Abono em Lote', description: 'Abonar ausências de vários funcionários', icon: ListChecks, href: '/batch-absolutions', color: 'text-teal-600' },
      ],
    },
    {
      title: 'Fechamento',
      subtitle: 'Homologação e bloqueio do período',
      items: [
        { title: 'Homologação do Ponto', description: 'Aprovação mensal do espelho', icon: FileCheck, href: '/point-homologation', color: 'text-emerald-600' },
        { title: 'Períodos de Competência', description: 'Datas de corte e fechamento', icon: CalendarClock, href: '/competency-periods', color: 'text-amber-600' },
      ],
    },
    {
      title: 'Regras de Cálculo',
      subtitle: 'Parâmetros da apuração',
      items: [
        { title: 'Regras de Apuração', description: 'Tolerâncias, noturno, intrajornada', icon: SlidersHorizontal, href: '/attendance-rules', color: 'text-sky-600' },
        { title: 'Calculadora de Horas', description: 'Simulação de jornada e adicionais', icon: Clock, href: '/hours-calculator', color: 'text-violet-600' },
      ],
    },
  ],
};

// Dispositivos e REP
export const dispositivosHubConfig: CategoryHubConfig = {
  title: 'Dispositivos e REP',
  description: 'Relógios de ponto, terminais e identificação mobile',
  groups: [
    {
      title: 'Equipamentos REP',
      subtitle: 'Cadastro, status e sincronização',
      items: [
        { title: 'Lista de REP', description: 'Equipamentos cadastrados', icon: Server, href: '/equipment/list', color: 'text-blue-600' },
        { title: 'Adicionar REP', description: 'Cadastrar novo equipamento', icon: HardDrive, href: '/equipment/add', color: 'text-emerald-600' },
        { title: 'Status Online', description: 'Conectividade dos relógios', icon: Activity, href: '/equipment/status', color: 'text-amber-600' },
        { title: 'Sincronização', description: 'Coleta de marcações', icon: RefreshCw, href: '/equipment/sync', color: 'text-violet-600' },
        { title: 'Registros Pendentes', description: 'Marcações a processar', icon: ClipboardList, href: '/equipment/pending', color: 'text-orange-600' },
        { title: 'Funcionários no REP', description: 'Envio de cadastros ao equipamento', icon: Users, href: '/equipment/employees', color: 'text-teal-600' },
      ],
    },
    {
      title: 'Terminais e Mobile',
      subtitle: 'Ponto por app, quiosque e biometria',
      items: [
        { title: 'Terminais de Ponto', description: 'Quiosques por CNPJ', icon: MonitorSmartphone, href: '/kiosk-terminals', color: 'text-blue-600' },
        { title: 'App do Terminal', description: 'Download do APK do terminal', icon: Smartphone, href: '/terminal-app', color: 'text-emerald-600' },
        { title: 'Métodos de Identificação', description: 'Facial, QR Code, PIN e RFID', icon: Smartphone, href: '/identification-methods', color: 'text-violet-600' },
        { title: 'Locais Georreferenciados', description: 'Cercas eletrônicas permitidas', icon: MapPin, href: '/georeferenced-locations', color: 'text-amber-600' },
      ],
    },
    {
      title: 'Conformidade e Suporte',
      subtitle: 'Legislação e diagnósticos',
      items: [
        { title: 'Conformidade MTE', description: 'Portarias 1510, 373 e 671', icon: Shield, href: '/equipment/compliance', color: 'text-red-600', badges: ['Portaria 671'] },
        { title: 'Logs de Comunicação', description: 'Histórico de comunicação', icon: FileText, href: '/equipment/logs', color: 'text-slate-600' },
        { title: 'Robô de Comunicação', description: 'Agentes locais, descoberta de relógios e envio de funcionários', icon: Bot, href: '/equipment/agents', color: 'text-fuchsia-600' },
        { title: 'Saúde do Robô', description: 'CPU, memória, conexão e versão em tempo real', icon: Activity, href: '/equipment/agent-health', color: 'text-lime-600' },
        { title: 'Relógios em Tempo Real', description: 'Status, última comunicação e comandos recebidos', icon: Activity, href: '/equipment/clocks-live', color: 'text-sky-600' },
        { title: 'Servidores de Comunicação', description: 'Henry via TCP/IP e Control iD (local ou iD Cloud)', icon: Server, href: '/equipment/servers', color: 'text-cyan-600' },
        { title: 'Ajuda REP', description: 'Guia de instalação e configuração', icon: HelpCircle, href: '/equipment/help', color: 'text-blue-600' },
      ],
    },
  ],
};

// Integrações e Exportações
export const integracoesHubConfig: CategoryHubConfig = {
  title: 'Integrações e Exportações',
  description: 'Importe cadastros, exporte para folha e gere arquivos legais',
  groups: [
    {
      title: 'Importação',
      subtitle: 'Migração de dados de outros sistemas',
      items: [
        { title: 'Importação de Dados', description: 'CSV e TXT posicional de todos os cadastros', icon: Import, href: '/data-import', color: 'text-emerald-600', badges: ['Novo'] },
        { title: 'Importação de AFD', description: 'Marcações do arquivo fiscal do REP', icon: FileDown, href: '/import-export', color: 'text-blue-600' },
      ],
    },
    {
      title: 'Exportação',
      subtitle: 'Arquivos para folha e fiscalização',
      items: [
        { title: 'Exportação para Folha', description: 'Layouts CSV, eSocial, TOTVS e Senior', icon: Wallet, href: '/payroll-exports', color: 'text-violet-600' },
        { title: 'Exportação MTE', description: 'AFD, AFDT e ACJEF', icon: Download, href: '/reports/mte', color: 'text-amber-600', badges: ['Portaria 671'] },
        { title: 'Layouts Personalizados', description: 'Monte layouts de exportação', icon: Cog, href: '/import-export', color: 'text-slate-600' },
      ],
    },
  ],
};

// Segurança e Auditoria
export const segurancaHubConfig: CategoryHubConfig = {
  title: 'Segurança e Auditoria',
  description: 'Controle de acesso, trilhas de auditoria e diagnósticos',
  groups: [
    {
      title: 'Segurança',
      subtitle: 'Monitoramento de acessos',
      items: [
        { title: 'Painel de Segurança', description: 'Eventos, alertas e bloqueios', icon: Shield, href: '/security', color: 'text-red-600' },
        { title: 'Usuários', description: 'Perfis, papéis e permissões', icon: UserCog, href: '/users', color: 'text-violet-600' },
      ],
    },
    {
      title: 'Auditoria',
      subtitle: 'Trilhas e rastreabilidade',
      items: [
        { title: 'Auditoria de Validações', description: 'Tentativas de facial, QR e PIN', icon: FileCheck, href: '/validation-audit', color: 'text-emerald-600' },
        { title: 'Auditoria de CNPJ', description: 'Alterações e revalidações', icon: FileText, href: '/cnpj-audit', color: 'text-amber-600' },
        { title: 'Painel de Diagnóstico', description: 'Saúde e autocorreção do sistema', icon: Activity, href: '/diagnostics', color: 'text-blue-600' },
      ],
    },
  ],
};

// Map of category IDs to configs
export const categoryHubConfigMap: Record<string, CategoryHubConfig> = {
  'home': homeHubConfig,
  'cadastros': cadastrosHubConfig,
  'escalas': escalasHubConfig,
  'ponto': pontoHubConfig,
  'afastamentos': afastamentosHubConfig,
  'monitoramento': monitoramentoHubConfig,
  'banco-horas': bancoHorasHubConfig,
  'equipamentos': equipamentosHubConfig,
  'ponto-mobile': pontoMobileHubConfig,
  'meu-ponto': meuPontoHubConfig,
  'tratamento': tratamentoHubConfig,
  'dispositivos': dispositivosHubConfig,
  'integracoes': integracoesHubConfig,
  'seguranca': segurancaHubConfig,
  'professor': professorHubConfig,
  'medico': medicoHubConfig,
  'folha': folhaHubConfig,
  'relatorios': relatoriosHubConfig,
  'exportacao': exportacaoHubConfig,
  'configuracoes': configuracoesHubConfig,
};
