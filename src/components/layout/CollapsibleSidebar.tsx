import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/NotificationCenter';
import { SupportChat } from '@/components/support/SupportChat';
import { AnnouncementPopup } from '@/components/announcements/AnnouncementPopup';
import { WhatsNewPopup } from '@/components/WhatsNewPopup';
import { MenuPositionSelector } from '@/components/MenuPositionSelector';
import { useMenuPosition, MenuPosition } from '@/hooks/useMenuPosition';
import { getVersionString, APP_NAME } from '@/lib/version';
import superpontoLogo from '@/assets/pontomax-logo.webp';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Clock,
  Bus,
  Route as RouteIcon,
  Gauge,
  ShieldCheck,
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
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
  ArrowUpDown,
  Server,
  Home,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Bell,
  Smartphone,
  BarChart3,
  Cog,
  FileBarChart,
  Download,
  Scale,
  MapPin,
  Book,
  PanelLeftClose,
  PanelLeft,
  UserCog,
  Shield,
  Wallet,
  Calendar,
  ListChecks,
  Network,
  Landmark,
  Store,
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
  ArrowLeft,
  Grid3X3,
  MonitorSmartphone,
  Bug,
  FileSearch,
  UserPlus,
  CalendarRange,
  Stethoscope,
  Banknote,
  LayoutList,
} from 'lucide-react';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu as MenuIcon, X as CloseIcon } from 'lucide-react';
import { categoryHubConfigMap } from '@/config/categoryHubConfigs';

interface CompanySettings {
  company_name: string;
  logo_url: string | null;
}

interface SidebarUnit {
  id: string;
  unit_name: string;
  trade_name: string | null;
  unit_type: 'matriz' | 'filial';
  is_active: boolean;
}

interface MenuCategory {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
  roles: string[];
}

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  roles: string[];
}

// Categories with ALL resources individually displayed
const menuCategories: MenuCategory[] = [
  {
    id: 'home',
    title: 'Início',
    icon: Home,
    roles: ['admin', 'manager', 'employee'],
    items: [
      { title: 'Início', icon: Home, href: '/home', roles: ['admin', 'manager', 'employee'] },
      { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['admin', 'manager', 'employee'] },
      { title: 'Central de Presença', icon: Activity, href: '/presence-monitoring', roles: ['admin', 'manager'] },
    ]
  },
  {
    id: 'meu-ponto',
    title: 'Meu Ponto',
    icon: Smartphone,
    roles: ['admin', 'manager', 'employee'],
    items: [
      { title: 'Registrar Ponto', icon: Clock, href: '/time-clock', roles: ['admin', 'manager', 'employee'] },
      { title: 'Meus Registros', icon: ListChecks, href: '/my-records', roles: ['admin', 'manager', 'employee'] },
      { title: 'Minhas Ocorrências', icon: AlertCircle, href: '/point-occurrences', roles: ['admin', 'manager', 'employee'] },
      { title: 'Minhas Férias', icon: CalendarDays, href: '/vacations', roles: ['admin', 'manager', 'employee'] },
      { title: 'Sugestões', icon: Bell, href: '/suggestions', roles: ['admin', 'manager', 'employee'] },
      { title: 'Minha Conta', icon: UserCog, href: '/account-settings', roles: ['admin', 'manager', 'employee'] },
    ]
  },
  {
    id: 'cadastros',
    title: 'Cadastros',
    icon: Users,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Funcionários', icon: Users, href: '/employees', roles: ['admin', 'manager'] },
      { title: 'Novo Funcionário', icon: UserPlus, href: '/employees/register', roles: ['admin', 'manager'] },
      { title: 'Cargos e Departamentos', icon: Building2, href: '/positions-departments', roles: ['admin'] },
      { title: 'Departamentos', icon: Network, href: '/departments', roles: ['admin'] },
      { title: 'Unidades (Matriz/Filiais)', icon: Building2, href: '/company-units', roles: ['admin'] },
      { title: 'Postos de Trabalho', icon: MapPin, href: '/work-stations', roles: ['admin'] },
      { title: 'Sindicatos', icon: Briefcase, href: '/unions', roles: ['admin'] },
      { title: 'Feriados', icon: CalendarDays, href: '/holidays', roles: ['admin'] },
      { title: 'Justificativas', icon: ClipboardCheck, href: '/justifications', roles: ['admin'] },
      { title: 'Cadastros Básicos', icon: UserCog, href: '/basic-registrations', roles: ['admin'] },
      { title: 'Estados Civis', icon: Users, href: '/marital-statuses', roles: ['admin'] },
      { title: 'Cidades', icon: MapPin, href: '/cities', roles: ['admin'] },
    ]
  },
  {
    id: 'escalas',
    title: 'Jornadas e Escalas',
    icon: CalendarClock,
    roles: ['admin'],
    items: [
      { title: 'Jornadas', icon: Clock, href: '/journeys', roles: ['admin'] },
      { title: 'Horários de Trabalho', icon: Timer, href: '/work-schedules', roles: ['admin'] },
      { title: 'Escalas Fixas', icon: Calendar, href: '/fixed-scales', roles: ['admin'] },
      { title: 'Escalas Agendadas', icon: CalendarDays, href: '/scheduled-scales', roles: ['admin'] },
      { title: 'Todas as Escalas', icon: Grid3X3, href: '/scales', roles: ['admin'] },
      { title: 'Agenda de Escalas', icon: CalendarRange, href: '/schedules', roles: ['admin'] },
      { title: 'Sobre Aviso', icon: Bell, href: '/on-call-schedules', roles: ['admin'] },
      { title: 'Períodos de Competência', icon: CalendarClock, href: '/competency-periods', roles: ['admin'] },
    ]
  },
  {
    id: 'ponto',
    title: 'Registro de Ponto',
    icon: Clock,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Espelho de Ponto', icon: ClipboardList, href: '/mirror-point', roles: ['admin', 'manager'] },
      { title: 'Folha de Ponto', icon: FileText, href: '/timesheet', roles: ['admin', 'manager'] },
      { title: 'Cartões de Ponto', icon: FileText, href: '/point-cards', roles: ['admin', 'manager'] },
      { title: 'Registrar Ponto', icon: Clock, href: '/time-clock', roles: ['admin', 'manager'] },
    ]
  },
  {
    id: 'tratamento',
    title: 'Tratamento de Ponto',
    icon: ClipboardCheck,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Ajustes de Ponto', icon: ClipboardCheck, href: '/adjustments', roles: ['admin', 'manager'] },
      { title: 'Ocorrências', icon: AlertCircle, href: '/point-occurrences', roles: ['admin', 'manager'] },
      { title: 'Abono em Lote', icon: ListChecks, href: '/batch-absolutions', roles: ['admin'] },
      { title: 'Homologação do Ponto', icon: FileCheck, href: '/point-homologation', roles: ['admin', 'manager'] },
      { title: 'Regras de Apuração', icon: SlidersHorizontal, href: '/attendance-rules', roles: ['admin', 'manager'] },
      { title: 'Calculadora de Horas', icon: Clock, href: '/hours-calculator', roles: ['admin', 'manager'] },
    ]
  },
  {
    id: 'afastamentos',
    title: 'Ausências e Férias',
    icon: UserX,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Gestão de Afastamentos', icon: UserX, href: '/leave-management', roles: ['admin', 'manager'] },
      { title: 'Faltas e Ausências', icon: Calendar, href: '/absences', roles: ['admin', 'manager'] },
      { title: 'Férias', icon: CalendarDays, href: '/vacations', roles: ['admin', 'manager'] },
    ]
  },
  {
    id: 'banco-horas',
    title: 'Banco de Horas e HE',
    icon: Timer,
    roles: ['admin', 'manager', 'employee'],
    items: [
      { title: 'Banco de Horas', icon: Timer, href: '/time-bank', roles: ['admin', 'manager', 'employee'] },
      { title: 'Compensação', icon: ArrowUpDown, href: '/compensation-bank', roles: ['admin'] },
      { title: 'Dashboard de HE', icon: BarChart3, href: '/overtime-dashboard', roles: ['admin', 'manager'] },
      { title: 'Regras de HE', icon: TrendingUp, href: '/overtime-percentages', roles: ['admin'] },
      { title: 'Hora In Itinere', icon: Clock, href: '/commute-time', roles: ['admin'] },
    ]
  },
  {
    id: 'controle-operacional',
    title: 'Controle Operacional',
    icon: Gauge,
    roles: ['admin', 'manager', 'employee'],
    items: [
      { title: 'Minha Operação', icon: Bus, href: '/operational/my-day', roles: ['admin', 'manager', 'employee'] },
      { title: 'Painel Operacional', icon: Gauge, href: '/operational', roles: ['admin', 'manager'] },
      { title: 'Supervisão', icon: Activity, href: '/operational/supervision', roles: ['admin', 'manager'] },


      { title: 'Escalas', icon: CalendarDays, href: '/operational/schedules', roles: ['admin', 'manager'] },
      { title: 'Operação do Dia', icon: Activity, href: '/operational/day', roles: ['admin', 'manager'] },
      { title: 'Motoristas', icon: Users, href: '/operational/drivers', roles: ['admin', 'manager'] },
      { title: 'Veículos', icon: Bus, href: '/operational/vehicles', roles: ['admin', 'manager'] },
      { title: 'Linhas e Serviços', icon: RouteIcon, href: '/operational/lines', roles: ['admin', 'manager'] },
      { title: 'Ponto x Escala', icon: Clock, href: '/operational/time-check', roles: ['admin', 'manager'] },
      { title: 'Alertas Operacionais', icon: AlertCircle, href: '/operational/alerts', roles: ['admin', 'manager'] },
      { title: 'Jornadas por Linha', icon: FileSpreadsheet, href: '/operational/line-report', roles: ['admin', 'manager'] },
      { title: 'Permissões', icon: ShieldCheck, href: '/operational/permissions', roles: ['admin'] },
    ]
  },
  {
    id: 'dispositivos',
    title: 'Dispositivos e REP',
    icon: Server,
    roles: ['admin'],
    items: [
      { title: 'Lista de REP', icon: Server, href: '/equipment/list', roles: ['admin'] },
      { title: 'Adicionar REP', icon: HardDrive, href: '/equipment/add', roles: ['admin'] },
      { title: 'Status Online', icon: Activity, href: '/equipment/status', roles: ['admin'] },
      { title: 'Sincronização', icon: RefreshCw, href: '/equipment/sync', roles: ['admin'] },
      { title: 'Registros Pendentes', icon: ClipboardList, href: '/equipment/pending', roles: ['admin'] },
      { title: 'Funcionários no REP', icon: Users, href: '/equipment/employees', roles: ['admin'] },
      { title: 'Logs de Comunicação', icon: FileText, href: '/equipment/logs', roles: ['admin'] },
      { title: 'Conformidade MTE', icon: Shield, href: '/equipment/compliance', roles: ['admin'] },
      { title: 'Terminais de Ponto', icon: MonitorSmartphone, href: '/kiosk-terminals', roles: ['admin'] },
      { title: 'App do Terminal', icon: Smartphone, href: '/terminal-app', roles: ['admin'] },
      { title: 'Métodos de Identificação', icon: Smartphone, href: '/identification-methods', roles: ['admin'] },
      { title: 'Locais Georreferenciados', icon: MapPin, href: '/georeferenced-locations', roles: ['admin'] },
      { title: 'Robô de Comunicação', icon: Bot, href: '/equipment/agents', roles: ['admin'] },
      { title: 'Servidores de Comunicação', icon: Server, href: '/equipment/servers', roles: ['admin'] },
      { title: 'Ajuda REP', icon: HelpCircle, href: '/equipment/help', roles: ['admin'] },
    ]
  },
  {
    id: 'monitoramento',
    title: 'Monitoramento',
    icon: Activity,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Central de Presença', icon: Users, href: '/presence-monitoring', roles: ['admin', 'manager'] },
      { title: 'Notificações', icon: Bell, href: '/custom-notifications', roles: ['admin'] },
      { title: 'Textos Customizados', icon: FileText, href: '/custom-texts', roles: ['admin'] },
    ]
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    icon: FileBarChart,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Espelho de Ponto', icon: FileText, href: '/reports/mirror-point', roles: ['admin', 'manager'] },
      { title: 'Horas Trabalhadas', icon: Clock, href: '/reports/worked-hours', roles: ['admin', 'manager'] },
      { title: 'Horas Extras', icon: TrendingUp, href: '/reports/overtime', roles: ['admin', 'manager'] },
      { title: 'Faltas e Atrasos', icon: UserX, href: '/reports/absences', roles: ['admin', 'manager'] },
      { title: 'Banco de Horas', icon: Timer, href: '/reports/time-bank', roles: ['admin', 'manager'] },
      { title: 'Presença', icon: ListChecks, href: '/reports/attendance', roles: ['admin', 'manager'] },
      { title: 'Turnover', icon: BarChart3, href: '/reports/turnover', roles: ['admin', 'manager'] },
      { title: 'Exportação MTE', icon: Download, href: '/reports/mte', roles: ['admin'] },
    ]
  },
  {
    id: 'integracoes',
    title: 'Integrações e Exportações',
    icon: Import,
    roles: ['admin'],
    items: [
      { title: 'Importação de Dados', icon: Import, href: '/data-import', roles: ['admin'] },
      { title: 'Importação/Exportação AFD', icon: ArrowUpDown, href: '/import-export', roles: ['admin'] },
      { title: 'Exportação para Folha', icon: Wallet, href: '/payroll-exports', roles: ['admin'] },
      { title: 'Exportação MTE', icon: Download, href: '/reports/mte', roles: ['admin'] },
    ]
  },
  {
    id: 'professor',
    title: 'Módulo Professor',
    icon: GraduationCap,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Visão Geral do Módulo', icon: LayoutList, href: '/teacher-module', roles: ['admin', 'manager'] },
      { title: 'Dashboard', icon: LayoutDashboard, href: '/teacher/dashboard', roles: ['admin', 'manager'] },
      { title: 'Professores', icon: Users, href: '/teacher/professors', roles: ['admin', 'manager'] },
      { title: 'Escolas', icon: School, href: '/teacher/schools', roles: ['admin', 'manager'] },
      { title: 'Aulas', icon: BookOpen, href: '/teacher/classes', roles: ['admin', 'manager'] },
      { title: 'Plano de Aula', icon: FileText, href: '/teacher/lesson-plans', roles: ['admin', 'manager'] },
      { title: 'Quadro de Horários', icon: Calendar, href: '/teacher/schedule', roles: ['admin', 'manager'] },
      { title: 'Espelho de Ponto', icon: ClipboardList, href: '/teacher/mirror', roles: ['admin', 'manager'] },
      { title: 'Consolidado', icon: FileBarChart, href: '/teacher/summary', roles: ['admin', 'manager'] },
      { title: 'Configurações', icon: Cog, href: '/teacher/configurations', roles: ['admin'] },
    ]
  },
  {
    id: 'medico',
    title: 'Módulo Médico',
    icon: Hospital,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Visão Geral do Módulo', icon: Stethoscope, href: '/doctor-module', roles: ['admin', 'manager'] },
      { title: 'Dashboard', icon: LayoutDashboard, href: '/doctor/dashboard', roles: ['admin', 'manager'] },
      { title: 'Médicos', icon: Users, href: '/doctor/doctors', roles: ['admin', 'manager'] },
      { title: 'Unidades de Saúde', icon: Hospital, href: '/doctor/health-units', roles: ['admin', 'manager'] },
      { title: 'Plantões', icon: Activity, href: '/doctor/shifts', roles: ['admin', 'manager'] },
      { title: 'Quadro de Plantões', icon: Calendar, href: '/doctor/schedule', roles: ['admin', 'manager'] },
      { title: 'Espelho de Ponto', icon: ClipboardList, href: '/doctor/mirror', roles: ['admin', 'manager'] },
      { title: 'Consolidado', icon: FileBarChart, href: '/doctor/summary', roles: ['admin', 'manager'] },
      { title: 'Configurações', icon: Cog, href: '/doctor/configurations', roles: ['admin'] },
    ]
  },
  {
    id: 'folha',
    title: 'Folha de Pagamento',
    icon: Wallet,
    roles: ['admin'],
    items: [
      { title: 'Visão Geral do Módulo', icon: Banknote, href: '/payroll-module', roles: ['admin'] },
      { title: 'Dashboard', icon: LayoutDashboard, href: '/payroll/dashboard', roles: ['admin'] },
      { title: 'Folhas', icon: FileText, href: '/payroll/list', roles: ['admin'] },
      { title: 'Nova Folha', icon: ListChecks, href: '/payroll/create', roles: ['admin'] },
      { title: 'Holerites', icon: FileText, href: '/payroll/payslips', roles: ['admin'] },
      { title: 'Rubricas', icon: Cog, href: '/payroll/items', roles: ['admin'] },
    ]
  },
  {
    id: 'seguranca',
    title: 'Segurança e Auditoria',
    icon: Shield,
    roles: ['admin'],
    items: [
      { title: 'Painel de Segurança', icon: Shield, href: '/security', roles: ['admin'] },
      { title: 'Auditoria de Validações', icon: FileSearch, href: '/validation-audit', roles: ['admin'] },
      { title: 'Auditoria de CNPJ', icon: FileSearch, href: '/cnpj-audit', roles: ['admin'] },
      { title: 'Painel de Diagnóstico', icon: Bug, href: '/diagnostics', roles: ['admin'] },
    ]
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    icon: Cog,
    roles: ['admin'],
    items: [
      { title: 'Empresa', icon: Building2, href: '/company-settings', roles: ['admin'] },
      { title: 'Dados da Empresa', icon: FileCheck, href: '/company', roles: ['admin'] },
      { title: 'Unidades (Matriz/Filiais)', icon: Building2, href: '/company-units', roles: ['admin'] },
      { title: 'Usuários', icon: Users, href: '/users', roles: ['admin'] },
      { title: 'Manual do Sistema', icon: BookOpen, href: '/system-manual', roles: ['admin', 'manager', 'employee'] },
    ]
  },
];

export default function CollapsibleSidebar() {
  const { profile, signOut, isAdmin, isManager, hasTeacherModule, hasDoctorModule, hasPayrollModule } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>(['home', 'ponto']);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const { position, setPosition, isHorizontal } = useMenuPosition();

  // Fecha o menu lateral ao navegar no celular
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const fetchCompanySettings = async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('company_name, logo_url')
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setCompanySettings(data as CompanySettings);
      }
    };

    fetchCompanySettings();
  }, []);

  // Unidades (matriz/filiais)
  const [units, setUnits] = useState<SidebarUnit[]>([]);
  const [unitsOpen, setUnitsOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin && !isManager) return;
    const fetchUnits = async () => {
      const { data } = await (supabase as any)
        .from('company_units')
        .select('id, unit_name, trade_name, unit_type, is_active')
        .order('unit_type', { ascending: true })
        .order('unit_name', { ascending: true });
      if (data) setUnits(data as SidebarUnit[]);
    };
    fetchUnits();
  }, [isAdmin, isManager]);

  // Open category containing current route
  useEffect(() => {
    for (const category of menuCategories) {
      const hasActiveItem = category.items.some(item => 
        location.pathname === item.href || location.pathname.startsWith(item.href + '/')
      );
      if (hasActiveItem && !openCategories.includes(category.id)) {
        setOpenCategories(prev => [...prev, category.id]);
      }
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleCategory = (categoryId: string) => {
    if (isCollapsed && !isHorizontal) {
      setIsCollapsed(false);
      setOpenCategories([categoryId]);
      return;
    }
    setOpenCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const filterCategory = (category: MenuCategory) => {
    if (category.id === 'professor' && !hasTeacherModule) {
      return false;
    }
    if (category.id === 'medico' && !hasDoctorModule) {
      return false;
    }
    if (category.id === 'folha' && !hasPayrollModule) {
      return false;
    }
    if (isAdmin) return true;
    if (isManager && category.roles.includes('manager')) return true;
    return category.roles.includes('employee');
  };

  const filterItem = (item: MenuItem) => {
    if (item.href.includes('teacher') && !hasTeacherModule) {
      return false;
    }
    if (item.href.includes('doctor') && !hasDoctorModule) {
      return false;
    }
    if (item.href.includes('payroll') && !hasPayrollModule) {
      return false;
    }
    if (isAdmin) return true;
    if (isManager && item.roles.includes('manager')) return true;
    return item.roles.includes('employee');
  };

  const isActiveLink = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const getCurrentCategory = () => {
    // Check if on category page
    if (location.pathname.startsWith('/category/')) {
      const categoryId = location.pathname.split('/category/')[1];
      return menuCategories.find(c => c.id === categoryId) || null;
    }
    // Find category by current route
    for (const category of menuCategories) {
      const hasItem = category.items.some(i => isActiveLink(i.href));
      if (hasItem) return category;
    }
    return null;
  };

  const handleBack = () => {
    const currentCategory = getCurrentCategory();
    if (currentCategory && location.pathname !== '/home' && !location.pathname.startsWith('/category/')) {
      // Navigate to category hub
      navigate(`/category/${currentCategory.id}`);
    } else if (location.pathname.startsWith('/category/')) {
      // From category hub, go to home
      navigate('/home');
    } else {
      navigate(-1);
    }
  };

  const getCurrentPageTitle = () => {
    // Check category page first
    if (location.pathname.startsWith('/category/')) {
      const categoryId = location.pathname.split('/category/')[1];
      const category = menuCategories.find(c => c.id === categoryId);
      return category ? `Central de ${category.title}` : 'Categorias';
    }
    // Find in menu items
    for (const category of menuCategories) {
      const item = category.items.find(i => isActiveLink(i.href));
      if (item) return item.title;
    }
    return 'Início';
  };

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';
  const sidebarHeight = isCollapsed ? 'h-14' : 'h-auto';

  // Render horizontal menu (top/bottom)
  if (isHorizontal) {
    return (
      <div className={cn(
        "min-h-screen flex w-full bg-muted/30",
        position === 'top' ? "flex-col" : "flex-col-reverse"
      )}>
        {/* Horizontal Navigation Bar */}
        <nav className={cn(
          "bg-sidebar border-sidebar-border flex items-center px-4 py-2 z-40",
          position === 'top' ? "border-b sticky top-0" : "border-t sticky bottom-0"
        )}>
          {/* Logo */}
          <div className="flex items-center gap-2 mr-4">
            <img 
              src={companySettings?.logo_url || superpontoLogo} 
              alt={companySettings?.company_name || APP_NAME} 
              className="h-8 w-8 rounded-lg object-contain"
            />
            <span className="font-semibold text-sm text-white hidden lg:block">
              {companySettings?.company_name || APP_NAME}
            </span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1 mr-4">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Voltar</TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link to="/home">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Início</TooltipContent>
          </Tooltip>
          </div>

          {/* Category Buttons */}
          <ScrollArea className="flex-1">
            <div className="flex items-center gap-1">
              {menuCategories.filter(filterCategory).filter(c => c.id !== 'home').map((category) => {
                const hasActiveChild = category.items.some(item => isActiveLink(item.href));
                const isCategoryPage = location.pathname === `/category/${category.id}`;
                
                return (
                  <DropdownMenu key={category.id}>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant={hasActiveChild || isCategoryPage ? "default" : "ghost"} 
                        size="sm"
                        className="h-8 gap-1.5 shrink-0 text-white hover:text-white"
                      >
                        <category.icon className="h-4 w-4" />
                        <span className="hidden md:inline text-xs">{category.title}</span>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel className="flex items-center gap-2">
                        <category.icon className="h-4 w-4" />
                        {category.title}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to={`/category/${category.id}`} className="flex items-center gap-2">
                          <Grid3X3 className="h-4 w-4" />
                          <span>Central de {category.title}</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {category.items.filter(filterItem).map((item) => (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link 
                            to={item.href}
                            className={cn(
                              "flex items-center gap-2",
                              isActiveLink(item.href) && "bg-accent"
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          </ScrollArea>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 ml-4">
            <MenuPositionSelector position={position} onPositionChange={setPosition} compact />
            <ThemeToggle />
            <NotificationCenter />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="text-sm font-medium">{profile?.full_name || 'Usuário'}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/account-settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6">
            <Outlet />
          </div>
        </main>

        {/* Utility Components */}
        <SupportChat />
        <AnnouncementPopup />
        <WhatsNewPopup />
      </div>
    );
  }

  // Render vertical menu (left/right)
  return (
    <div className={cn(
      "min-h-screen flex w-full bg-muted/30",
      position === 'right' && "flex-row-reverse"
    )}>
      {/* Sidebar */}
      <aside className={cn(
        "bg-sidebar border-sidebar-border flex flex-col fixed h-full z-50 transition-transform duration-300 lg:z-40 lg:transition-all",
        isMobile ? "w-72 max-w-[85vw] shadow-2xl" : sidebarWidth,
        position === 'left' ? "left-0 border-r" : "right-0 border-l",
        isMobile && !mobileOpen && (position === 'left' ? "-translate-x-full" : "translate-x-full")
      )}>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fechar menu"
            className="absolute top-3 right-2 h-8 w-8 text-white hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <CloseIcon className="h-4 w-4" />
          </Button>
        )}
        {/* Logo/Brand */}
        <div className="p-3 border-b border-sidebar-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
              <img 
                src={companySettings?.logo_url || superpontoLogo} 
                alt={companySettings?.company_name || APP_NAME} 
                className="h-7 w-7 object-contain"
              />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="font-heading font-semibold text-sm text-white truncate tracking-tight">
                  {companySettings?.company_name || APP_NAME}
                </h1>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Gestão de Ponto</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "absolute top-16 h-6 w-6 rounded-full border bg-background shadow-sm z-50 hidden lg:flex",
            position === 'left' ? "-right-3" : "-left-3"
          )}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {position === 'left' ? (
            isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />
          ) : (
            isCollapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          )}
        </Button>

        {/* Quick Actions - Always visible */}
        <div className={cn(
          "p-2 border-b border-sidebar-border flex",
          isCollapsed ? "flex-col gap-1 items-center justify-center" : "flex-row items-center gap-1"
        )}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white hover:text-white" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={position === 'left' ? 'right' : 'left'}>Voltar</TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link to="/home">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white hover:text-white">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side={position === 'left' ? 'right' : 'left'}>Início</TooltipContent>
          </Tooltip>
          {!isCollapsed && <div className="flex-1" />}
          <MenuPositionSelector position={position} onPositionChange={setPosition} compact />
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-1">
            {menuCategories.filter(filterCategory).map((category) => {
              const filteredItems = category.items.filter(filterItem);
              if (filteredItems.length === 0) return null;

              const isOpen = openCategories.includes(category.id);
              const hasActiveChild = filteredItems.some(item => isActiveLink(item.href));
              const isCategoryPage = location.pathname === `/category/${category.id}`;

              if (isCollapsed) {
                // Collapsed mode - show only icons with tooltip
                return (
                  <Tooltip key={category.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className={cn(
                          "flex items-center justify-center w-full p-2.5 rounded-xl text-sm transition-all duration-200",
                          hasActiveChild || isCategoryPage
                            ? "bg-sidebar-primary text-white shadow-md"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <category.icon className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side={position === 'left' ? 'right' : 'left'} className="flex flex-col gap-1">
                      <span className="font-medium">{category.title}</span>
                      <div className="text-xs text-muted-foreground">
                        <Link
                          to={`/category/${category.id}`}
                          className="block py-1 hover:text-foreground text-primary font-medium"
                        >
                          Central de {category.title}
                        </Link>
                        {filteredItems.map(item => (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              "block py-1 hover:text-foreground",
                              isActiveLink(item.href) && "text-primary font-medium"
                            )}
                          >
                            {item.title}
                          </Link>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Collapsible key={category.id} open={isOpen}>
                  <CollapsibleTrigger
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      "group flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                      hasActiveChild || isCategoryPage
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        hasActiveChild || isCategoryPage
                          ? "bg-sidebar-primary text-white"
                          : "bg-white/[0.07] text-white group-hover:bg-white/15"
                      )}>
                        <category.icon className="w-4 h-4" />
                      </span>
                      <span className="truncate">{category.title}</span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 shrink-0 text-white/50" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0 text-white/50" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 ml-5 space-y-0.5 border-l border-white/10 pl-2">
                    {/* Central da Categoria */}
                    <Link
                      to={`/category/${category.id}`}
                      className={cn(
                        "nav-item py-1.5 text-[13px]",
                        isCategoryPage && "nav-item-active"
                      )}
                    >
                      <Grid3X3 className="w-4 h-4 shrink-0 text-white" />
                      <span className="truncate">Central</span>
                    </Link>
                    {filteredItems.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "nav-item py-1.5 text-[13px]",
                          isActiveLink(item.href) && "nav-item-active"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0 text-white" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {/* Unidades (Matriz/Filiais) */}
            {(isAdmin || isManager) && units.length > 0 && (
              isCollapsed ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setIsCollapsed(false); setUnitsOpen(true); }}
                      className="flex items-center justify-center w-full p-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200"
                    >
                      <Landmark className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side={position === 'left' ? 'right' : 'left'} className="flex flex-col gap-1">
                    <span className="font-medium">Unidades</span>
                    <div className="text-xs text-muted-foreground">
                      {units.map(u => (
                        <Link key={u.id} to={`/company-units?unit=${u.id}`} className="block py-1 hover:text-foreground">
                          {u.unit_name} · {u.unit_type === 'matriz' ? 'Matriz' : 'Filial'} · {u.is_active ? 'Ativa' : 'Inativa'}
                        </Link>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Collapsible open={unitsOpen}>
                  <CollapsibleTrigger
                    onClick={() => setUnitsOpen(o => !o)}
                    className={cn(
                      "group flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                      isActiveLink('/company-units')
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isActiveLink('/company-units')
                          ? "bg-sidebar-primary text-white"
                          : "bg-white/[0.07] text-white group-hover:bg-white/15"
                      )}>
                        <Landmark className="w-4 h-4" />
                      </span>
                      <span className="truncate">Unidades</span>
                      <span className="ml-1 rounded-full bg-white/10 px-1.5 text-[10px] text-white/70">{units.length}</span>
                    </div>
                    {unitsOpen ? (
                      <ChevronUp className="w-4 h-4 shrink-0 text-white/50" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0 text-white/50" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 ml-5 space-y-0.5 border-l border-white/10 pl-2">
                    <Link
                      to="/company-units"
                      className={cn(
                        "nav-item py-1.5 text-[13px]",
                        location.pathname === '/company-units' && !location.search && "nav-item-active"
                      )}
                    >
                      <Grid3X3 className="w-4 h-4 shrink-0 text-white" />
                      <span className="truncate">Todas as unidades</span>
                    </Link>
                    {units.map((unit) => {
                      const UnitIcon = unit.unit_type === 'matriz' ? Landmark : Store;
                      return (
                        <Link
                          key={unit.id}
                          to={`/company-units?unit=${unit.id}`}
                          className={cn(
                            "nav-item py-1.5 text-[13px]",
                            location.search.includes(unit.id) && "nav-item-active"
                          )}
                        >
                          <UnitIcon className="w-4 h-4 shrink-0 text-white" />
                          <span className="truncate">{unit.unit_name}</span>
                          <span
                            title={unit.is_active ? 'Ativa' : 'Inativa'}
                            className={cn(
                              "ml-auto h-2 w-2 shrink-0 rounded-full",
                              unit.is_active ? "bg-emerald-400" : "bg-white/30"
                            )}
                          />
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )
            )}
          </nav>
        </ScrollArea>

        {/* Footer - User */}
        <div className="border-t border-sidebar-border p-2">
          <div className={cn(
            "flex items-center mb-2",
            isCollapsed ? "flex-col gap-1 justify-center" : "flex-row gap-2 px-2 py-1"
          )}>
            <ThemeToggle />
            <NotificationCenter />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-3 w-full p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors",
                isCollapsed && "justify-center"
              )}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-white text-xs">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {profile?.full_name || 'Usuário'}
                      </p>
                      <p className="text-xs text-white/50 truncate">
                        {profile?.email}
                      </p>
                    </div>
                    <ChevronUp className="w-4 h-4 text-white/50 shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/account-settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {!isCollapsed && (
            <p className="text-[10px] text-center text-white/40 mt-2">
              {getVersionString()}
            </p>
          )}
        </div>
      </aside>

      {/* Overlay do menu no celular */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <main className={cn(
        "min-w-0 flex-1 transition-all duration-300",
        isMobile
          ? "ml-0 mr-0"
          : position === 'left'
            ? (isCollapsed ? "ml-16" : "ml-64")
            : (isCollapsed ? "mr-16" : "mr-64")
      )}>
        {isMobile && (
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir menu"
              className="h-9 w-9"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <img
                src={companySettings?.logo_url || superpontoLogo}
                alt={companySettings?.company_name || APP_NAME}
                className="h-6 w-6 shrink-0 object-contain"
              />
              <span className="truncate font-heading text-sm font-semibold">
                {companySettings?.company_name || APP_NAME}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <NotificationCenter />
              <ThemeToggle />
            </div>
          </div>
        )}
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>

      {/* Utility Components */}
      <SupportChat />
      <AnnouncementPopup />
      <WhatsNewPopup />
    </div>
  );
}

export { menuCategories };
