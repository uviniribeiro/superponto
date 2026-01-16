import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/NotificationCenter';
import { SupportChat } from '@/components/support/SupportChat';
import { AnnouncementPopup } from '@/components/announcements/AnnouncementPopup';
import { WhatsNewPopup } from '@/components/WhatsNewPopup';
import { getVersionString } from '@/lib/version';
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
  Bell,
  Smartphone,
  BarChart3,
  Cog,
  FileBarChart,
  Download,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

// Categories following the reference design
const menuCategories: MenuCategory[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'employee'],
    items: [
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
      { title: 'Departamentos', icon: Building2, href: '/departments', roles: ['admin'] },
      { title: 'Escalas', icon: Scale, href: '/work-schedules', roles: ['admin'] },
      { title: 'Feriados', icon: CalendarDays, href: '/holidays', roles: ['admin'] },
    ]
  },
  {
    id: 'ponto',
    title: 'Ponto',
    icon: Clock,
    roles: ['admin', 'manager', 'employee'],
    items: [
      { title: 'Marcações', icon: Clock, href: '/time-clock', roles: ['admin', 'manager', 'employee'] },
      { title: 'Apontamentos', icon: ClipboardList, href: '/mirror-point', roles: ['admin', 'manager'] },
      { title: 'Ajustes', icon: ClipboardCheck, href: '/adjustments', roles: ['admin', 'manager'] },
      { title: 'Afastamentos', icon: UserX, href: '/leave-management', roles: ['admin', 'manager'] },
      { title: 'Banco de Horas', icon: Timer, href: '/time-bank', roles: ['admin', 'manager', 'employee'] },
    ]
  },
  {
    id: 'equipamentos',
    title: 'Equipamentos',
    icon: Server,
    roles: ['admin'],
    items: [
      { title: 'Lista de REP', icon: Server, href: '/equipment/list', roles: ['admin'] },
      { title: 'Status', icon: BarChart3, href: '/equipment/status', roles: ['admin'] },
    ]
  },
  {
    id: 'ponto-mobile',
    title: 'Ponto Mobile',
    icon: Smartphone,
    roles: ['admin'],
    items: [
      { title: 'Configurações', icon: Smartphone, href: '/identification-methods', roles: ['admin'] },
      { title: 'Locais GPS', icon: Home, href: '/georeferenced-locations', roles: ['admin'] },
    ]
  },
  {
    id: 'professor',
    title: 'Professor',
    icon: GraduationCap,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Módulo Professor', icon: GraduationCap, href: '/teacher-module', roles: ['admin', 'manager'] },
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
      { title: 'Faltas/Atrasos', icon: UserX, href: '/reports/absences', roles: ['admin', 'manager'] },
      { title: 'Exportação MTE', icon: Download, href: '/reports/mte', roles: ['admin'] },
    ]
  },
  {
    id: 'desempenho',
    title: 'Desempenho',
    icon: TrendingUp,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Análises Gerenciais', icon: BarChart3, href: '/overtime-dashboard', roles: ['admin', 'manager'] },
    ]
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    icon: Cog,
    roles: ['admin'],
    items: [
      { title: 'Empresa', icon: Building2, href: '/company-settings', roles: ['admin'] },
      { title: 'Regras de HE', icon: TrendingUp, href: '/overtime-percentages', roles: ['admin'] },
      { title: 'Justificativas', icon: ClipboardCheck, href: '/justifications', roles: ['admin'] },
      { title: 'Usuários', icon: Users, href: '/users', roles: ['admin'] },
    ]
  },
];

export default function NewAppLayout() {
  const { profile, roles, signOut, isAdmin, isManager, hasTeacherModule } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>(['cadastros', 'ponto']);

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
    if (isAdmin) return true;
    if (isManager && category.roles.includes('manager')) return true;
    return category.roles.includes('employee');
  };

  const filterItem = (item: MenuItem) => {
    if (item.href === '/teacher-module' && !hasTeacherModule) {
      return false;
    }
    if (isAdmin) return true;
    if (isManager && item.roles.includes('manager')) return true;
    return item.roles.includes('employee');
  };

  const isActiveLink = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <div className="min-h-screen flex w-full bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed h-full z-40">
        {/* Logo/Brand */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-sm text-sidebar-foreground">
                {companySettings?.company_name || 'PontoWeb'}
              </h1>
              <p className="text-xs text-sidebar-foreground/60">Gestão de Ponto</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-1">
            {menuCategories.filter(filterCategory).map((category) => {
              const filteredItems = category.items.filter(filterItem);
              if (filteredItems.length === 0) return null;

              const isOpen = openCategories.includes(category.id);
              const hasActiveChild = filteredItems.some(item => isActiveLink(item.href));

              // Single item category - render as direct link
              if (filteredItems.length === 1 && category.id === 'dashboard') {
                const item = filteredItems[0];
                return (
                  <Link
                    key={category.id}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActiveLink(item.href)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <category.icon className="w-5 h-5" />
                    <span>{category.title}</span>
                  </Link>
                );
              }

              return (
                <Collapsible key={category.id} open={isOpen}>
                  <CollapsibleTrigger
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      hasActiveChild
                        ? "text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <category.icon className="w-5 h-5" />
                      <span>{category.title}</span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 ml-4 space-y-1">
                    {filteredItems.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          isActiveLink(item.href)
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer - Notifications & User */}
        <div className="border-t border-sidebar-border p-3 space-y-3">
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors">
            <Bell className="w-5 h-5" />
            <span>Notificações</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-sidebar-foreground/50 truncate">
                    {profile?.email}
                  </p>
                </div>
                <ChevronUp className="w-4 h-4 text-sidebar-foreground/50" />
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
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64">
        <div className="p-6">
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
