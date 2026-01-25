import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/NotificationCenter';
import { SupportChat } from '@/components/support/SupportChat';
import { AnnouncementPopup } from '@/components/announcements/AnnouncementPopup';
import { WhatsNewPopup } from '@/components/WhatsNewPopup';
import { getVersionString, APP_NAME } from '@/lib/version';
import superpontoLogo from '@/assets/superponto-logo.png';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Outlet } from 'react-router-dom';

interface CompanySettings {
  company_name: string;
  logo_url: string | null;
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
    ]
  },
  {
    id: 'cadastros',
    title: 'Cadastros',
    icon: Users,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Funcionários', icon: Users, href: '/employees', roles: ['admin', 'manager'] },
      { title: 'Cargos e Departamentos', icon: Building2, href: '/positions-departments', roles: ['admin'] },
      { title: 'Departamentos', icon: Network, href: '/departments', roles: ['admin'] },
      { title: 'Feriados', icon: CalendarDays, href: '/holidays', roles: ['admin'] },
      { title: 'Sindicatos', icon: Briefcase, href: '/unions', roles: ['admin'] },
      { title: 'Justificativas', icon: ClipboardCheck, href: '/justifications', roles: ['admin'] },
      { title: 'Tipos de Funcionário', icon: UserCog, href: '/basic-registrations', roles: ['admin'] },
    ]
  },
  {
    id: 'escalas',
    title: 'Escalas e Jornadas',
    icon: Scale,
    roles: ['admin'],
    items: [
      { title: 'Jornadas de Trabalho', icon: Clock, href: '/schedules', roles: ['admin'] },
      { title: 'Escalas', icon: Scale, href: '/work-schedules', roles: ['admin'] },
      { title: 'Escalas Fixas', icon: Calendar, href: '/scales', roles: ['admin'] },
      { title: 'Períodos de Competência', icon: CalendarClock, href: '/competency-periods', roles: ['admin'] },
    ]
  },
  {
    id: 'ponto',
    title: 'Ponto',
    icon: Clock,
    roles: ['admin', 'manager', 'employee'],
    items: [
      { title: 'Registrar Ponto', icon: Clock, href: '/time-clock', roles: ['admin', 'manager', 'employee'] },
      { title: 'Meus Registros', icon: ListChecks, href: '/my-records', roles: ['admin', 'manager', 'employee'] },
      { title: 'Espelho de Ponto', icon: ClipboardList, href: '/mirror-point', roles: ['admin', 'manager'] },
      { title: 'Ajustes de Ponto', icon: ClipboardCheck, href: '/adjustments', roles: ['admin', 'manager'] },
      { title: 'Folha de Ponto', icon: FileText, href: '/timesheet', roles: ['admin', 'manager'] },
      { title: 'Homologação', icon: FileCheck, href: '/point-homologation', roles: ['admin', 'manager'] },
      { title: 'Ocorrências', icon: AlertCircle, href: '/point-occurrences', roles: ['admin', 'manager', 'employee'] },
      { title: 'Cartões de Ponto', icon: FileText, href: '/point-cards', roles: ['admin', 'manager'] },
    ]
  },
  {
    id: 'afastamentos',
    title: 'Afastamentos',
    icon: UserX,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Gestão de Afastamentos', icon: UserX, href: '/leave-management', roles: ['admin', 'manager'] },
      { title: 'Faltas e Ausências', icon: Calendar, href: '/absences', roles: ['admin', 'manager'] },
    ]
  },
  {
    id: 'banco-horas',
    title: 'Banco de Horas',
    icon: Timer,
    roles: ['admin', 'manager', 'employee'],
    items: [
      { title: 'Banco de Horas', icon: Timer, href: '/time-bank', roles: ['admin', 'manager', 'employee'] },
      { title: 'Regras de HE', icon: TrendingUp, href: '/overtime-percentages', roles: ['admin'] },
      { title: 'Dashboard HE', icon: BarChart3, href: '/overtime-dashboard', roles: ['admin', 'manager'] },
    ]
  },
  {
    id: 'equipamentos',
    title: 'Equipamentos REP',
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
      { title: 'Ajuda REP', icon: HelpCircle, href: '/equipment/help', roles: ['admin'] },
    ]
  },
  {
    id: 'ponto-mobile',
    title: 'Ponto Mobile',
    icon: Smartphone,
    roles: ['admin'],
    items: [
      { title: 'Métodos de Identificação', icon: Smartphone, href: '/identification-methods', roles: ['admin'] },
      { title: 'Locais Georreferenciados', icon: MapPin, href: '/georeferenced-locations', roles: ['admin'] },
    ]
  },
  {
    id: 'professor',
    title: 'Módulo Professor',
    icon: GraduationCap,
    roles: ['admin', 'manager'],
    items: [
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
    icon: Activity,
    roles: ['admin', 'manager'],
    items: [
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
      { title: 'Dashboard', icon: LayoutDashboard, href: '/payroll/dashboard', roles: ['admin'] },
      { title: 'Folhas', icon: FileText, href: '/payroll/list', roles: ['admin'] },
      { title: 'Nova Folha', icon: ListChecks, href: '/payroll/create', roles: ['admin'] },
      { title: 'Holerites', icon: FileText, href: '/payroll/payslips', roles: ['admin'] },
      { title: 'Rubricas', icon: Cog, href: '/payroll/items', roles: ['admin'] },
    ]
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    icon: FileBarChart,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Central de Relatórios', icon: FileBarChart, href: '/reports', roles: ['admin', 'manager'] },
      { title: 'Espelho de Ponto', icon: FileText, href: '/reports/mirror-point', roles: ['admin', 'manager'] },
      { title: 'Horas Trabalhadas', icon: Clock, href: '/reports/worked-hours', roles: ['admin', 'manager'] },
      { title: 'Horas Extras', icon: TrendingUp, href: '/reports/overtime', roles: ['admin', 'manager'] },
      { title: 'Faltas e Atrasos', icon: UserX, href: '/reports/absences', roles: ['admin', 'manager'] },
      { title: 'Banco de Horas', icon: Timer, href: '/reports/time-bank', roles: ['admin', 'manager'] },
      { title: 'Presença', icon: ListChecks, href: '/reports/attendance', roles: ['admin', 'manager'] },
      { title: 'Exportação MTE', icon: Download, href: '/reports/mte', roles: ['admin'] },
    ]
  },
  {
    id: 'exportacao',
    title: 'Exportação',
    icon: Download,
    roles: ['admin'],
    items: [
      { title: 'Exportação Folha', icon: Wallet, href: '/payroll-exports', roles: ['admin'] },
      { title: 'Importação/Exportação', icon: Import, href: '/import-export', roles: ['admin'] },
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
    if (isCollapsed) {
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

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';

  return (
    <div className="min-h-screen flex w-full bg-muted/30">
      {/* Sidebar */}
      <aside className={cn(
        "bg-sidebar border-r border-sidebar-border flex flex-col fixed h-full z-40 transition-all duration-300",
        sidebarWidth
      )}>
        {/* Logo/Brand */}
        <div className="p-3 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img 
              src={companySettings?.logo_url || superpontoLogo} 
              alt={companySettings?.company_name || APP_NAME} 
              className="h-10 w-10 rounded-lg object-contain shrink-0"
            />
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold text-sm text-sidebar-foreground truncate">
                  {companySettings?.company_name || APP_NAME}
                </h1>
                <p className="text-xs text-sidebar-foreground/60">Gestão de Ponto</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute -right-3 top-16 h-6 w-6 rounded-full border bg-background shadow-sm z-50"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-1">
            {menuCategories.filter(filterCategory).map((category) => {
              const filteredItems = category.items.filter(filterItem);
              if (filteredItems.length === 0) return null;

              const isOpen = openCategories.includes(category.id);
              const hasActiveChild = filteredItems.some(item => isActiveLink(item.href));

              if (isCollapsed) {
                // Collapsed mode - show only icons with tooltip
                return (
                  <Tooltip key={category.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className={cn(
                          "flex items-center justify-center w-full p-2.5 rounded-lg text-sm transition-colors",
                          hasActiveChild
                            ? "bg-primary text-primary-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                        )}
                      >
                        <category.icon className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex flex-col gap-1">
                      <span className="font-medium">{category.title}</span>
                      <div className="text-xs text-muted-foreground">
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
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      hasActiveChild
                        ? "text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <category.icon className="w-5 h-5 shrink-0" />
                      <span className="truncate">{category.title}</span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 ml-4 space-y-0.5">
                    {filteredItems.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors",
                          isActiveLink(item.href)
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer - User */}
        <div className="border-t border-sidebar-border p-2">
          {!isCollapsed && (
            <div className="flex items-center gap-2 px-2 py-1 mb-2">
              <ThemeToggle />
              <NotificationCenter />
            </div>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-3 w-full p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors",
                isCollapsed && "justify-center"
              )}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {profile?.full_name || 'Usuário'}
                      </p>
                      <p className="text-xs text-sidebar-foreground/50 truncate">
                        {profile?.email}
                      </p>
                    </div>
                    <ChevronUp className="w-4 h-4 text-sidebar-foreground/50 shrink-0" />
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
            <p className="text-[10px] text-center text-sidebar-foreground/40 mt-2">
              {getVersionString()}
            </p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        isCollapsed ? "ml-16" : "ml-64"
      )}>
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
