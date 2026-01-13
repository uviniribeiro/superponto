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
import { useBrasiliaTime } from '@/hooks/useBrasiliaTime';
import { useDailyMessage } from '@/hooks/useDailyMessage';
import { useFavorites } from '@/hooks/useFavorites';
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
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
  UserCog,
  TrendingUp,
  Briefcase,
  CalendarClock,
  GraduationCap,
  ClipboardList,
  ArrowUpDown,
  Server,
  Home,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  FolderOpen,
  FileBarChart,
  Cog,
  Star,
  History,
  ChevronUp,
  Plus,
  FileWarning,
  RefreshCw,
  HelpCircle,
  Activity,
  Shield,
  MapPin,
  BookOpen,
  Percent,
  ListChecks,
  Scale,
  IdCard,
  Layers,
} from 'lucide-react';

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

// Categories with their items - reorganized with individual subcategories
const menuCategories: MenuCategory[] = [
  {
    id: 'principal',
    title: 'Principal',
    icon: Home,
    roles: ['admin', 'manager', 'employee'],
    items: [
      { title: 'Início', icon: Home, href: '/home', roles: ['admin', 'manager', 'employee'] },
      { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['admin', 'manager', 'employee'] },
      { title: 'Registrar Ponto', icon: Clock, href: '/time-clock', roles: ['admin', 'manager', 'employee'] },
    ]
  },
  {
    id: 'meus-dados',
    title: 'Meus Dados',
    icon: FileText,
    roles: ['admin', 'manager', 'employee'],
    items: [
      { title: 'Meus Registros', icon: FileText, href: '/my-records', roles: ['admin', 'manager', 'employee'] },
      { title: 'Banco de Horas', icon: Timer, href: '/time-bank', roles: ['admin', 'manager', 'employee'] },
    ]
  },
  {
    id: 'funcionarios',
    title: 'Funcionários',
    icon: Users,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Lista de Funcionários', icon: Users, href: '/employees', roles: ['admin', 'manager'] },
      { title: 'Identificação', icon: IdCard, href: '/identification-methods', roles: ['admin'] },
    ]
  },
  {
    id: 'estrutura',
    title: 'Estrutura Organizacional',
    icon: Building2,
    roles: ['admin'],
    items: [
      { title: 'Cargos e Departamentos', icon: Briefcase, href: '/positions-departments', roles: ['admin'] },
      { title: 'Sindicatos', icon: Building2, href: '/unions', roles: ['admin'] },
    ]
  },
  {
    id: 'jornadas',
    title: 'Jornadas e Horários',
    icon: CalendarClock,
    roles: ['admin'],
    items: [
      { title: 'Jornadas de Trabalho', icon: CalendarClock, href: '/schedules', roles: ['admin'] },
      { title: 'Escalas de Ponto', icon: Scale, href: '/scales', roles: ['admin'] },
      { title: 'Feriados', icon: CalendarDays, href: '/holidays', roles: ['admin'] },
      { title: 'Competências', icon: ListChecks, href: '/competency-periods', roles: ['admin'] },
    ]
  },
  {
    id: 'cadastros-basicos',
    title: 'Cadastros Básicos',
    icon: FolderOpen,
    roles: ['admin'],
    items: [
      { title: 'Cadastros Gerais', icon: Layers, href: '/basic-registrations', roles: ['admin'] },
      { title: 'Justificativas', icon: FileText, href: '/justifications', roles: ['admin'] },
      { title: 'Percentuais Extra', icon: Percent, href: '/overtime-percentages', roles: ['admin'] },
      { title: 'Locais GPS', icon: MapPin, href: '/georeferenced-locations', roles: ['admin'] },
    ]
  },
  {
    id: 'professor',
    title: 'Módulo Professor',
    icon: GraduationCap,
    roles: ['admin'],
    items: [
      { title: 'Módulo Professor', icon: GraduationCap, href: '/teacher-module', roles: ['admin'] },
    ]
  },
  {
    id: 'espelhos-ponto',
    title: 'Espelhos de Ponto',
    icon: ClipboardList,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Espelho de Ponto', icon: ClipboardList, href: '/mirror-point', roles: ['admin', 'manager'] },
      { title: 'Folha de Ponto', icon: ClipboardList, href: '/timesheet', roles: ['admin', 'manager'] },
      { title: 'Faltas', icon: UserX, href: '/absences', roles: ['admin', 'manager'] },
      { title: 'Ajustes', icon: ClipboardCheck, href: '/adjustments', roles: ['admin', 'manager'] },
      { title: 'Afastamentos', icon: UserX, href: '/leave-management', roles: ['admin', 'manager'] },
    ]
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    icon: FileBarChart,
    roles: ['admin', 'manager'],
    items: [
      { title: 'Relatórios', icon: FileText, href: '/reports', roles: ['admin', 'manager'] },
      { title: 'Dashboard HE', icon: TrendingUp, href: '/overtime-dashboard', roles: ['admin', 'manager'] },
      { title: 'Import/Export', icon: ArrowUpDown, href: '/import-export', roles: ['admin'] },
      { title: 'Exportar Folha', icon: FileText, href: '/payroll-exports', roles: ['admin'] },
    ]
  },
  {
    id: 'equipamentos-rep',
    title: 'Equipamentos REP',
    icon: Server,
    roles: ['admin'],
    items: [
      { title: 'Status de Conexão', icon: Activity, href: '/equipment/status', roles: ['admin'] },
      { title: 'Lista de Equipamentos', icon: Server, href: '/equipment/list', roles: ['admin'] },
      { title: 'Adicionar Equipamento', icon: Plus, href: '/equipment/add', roles: ['admin'] },
      { title: 'Funcionários no REP', icon: Users, href: '/equipment/employees', roles: ['admin'] },
      { title: 'Registros Pendentes', icon: FileWarning, href: '/equipment/pending', roles: ['admin'] },
      { title: 'Conformidade MTE', icon: Shield, href: '/equipment/compliance', roles: ['admin'] },
      { title: 'Logs de Comunicação', icon: FileText, href: '/equipment/logs', roles: ['admin'] },
      { title: 'Sincronizar', icon: RefreshCw, href: '/equipment/sync', roles: ['admin'] },
      { title: 'Ajuda', icon: HelpCircle, href: '/equipment/help', roles: ['admin'] },
    ]
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    icon: Cog,
    roles: ['admin'],
    items: [
      { title: 'Dados da Empresa', icon: Building2, href: '/company', roles: ['admin'] },
      { title: 'Usuários', icon: UserCog, href: '/users', roles: ['admin'] },
      { title: 'Manual do Sistema', icon: BookOpen, href: '/system-manual', roles: ['admin', 'manager', 'employee'] },
    ]
  },
];

// Get all menu items flattened
const getAllMenuItems = (): MenuItem[] => {
  return menuCategories.flatMap(cat => cat.items);
};

export default function AppLayout() {
  const { profile, roles, signOut, isAdmin, isManager, hasTeacherModule } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>(['principal']);
  const { getFormattedDate, getFormattedTime } = useBrasiliaTime();
  const dailyMessage = useDailyMessage();
  const { favorites, recentRoutes, toggleFavorite, isFavorite, addRecentRoute } = useFavorites();

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

  // Track route changes for recent routes
  useEffect(() => {
    addRecentRoute(location.pathname);
  }, [location.pathname, addRecentRoute]);

  // Determine which category contains the current route and open it
  useEffect(() => {
    for (const category of menuCategories) {
      const hasActiveItem = category.items.some(item => item.href === location.pathname);
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
    // Filter professor category based on hasTeacherModule permission
    if (category.id === 'professor' && !hasTeacherModule) {
      return false;
    }
    if (isAdmin) return true;
    if (isManager && category.roles.includes('manager')) return true;
    return category.roles.includes('employee');
  };

  const filterItem = (item: MenuItem) => {
    // Filter teacher module based on hasTeacherModule permission
    if (item.href === '/teacher-module' && !hasTeacherModule) {
      return false;
    }
    if (isAdmin) return true;
    if (isManager && item.roles.includes('manager')) return true;
    return item.roles.includes('employee');
  };

  const getCurrentPageTitle = () => {
    for (const category of menuCategories) {
      const item = category.items.find(i => i.href === location.pathname);
      if (item) return item.title;
    }
    if (location.pathname.startsWith('/category/')) {
      const categoryId = location.pathname.split('/category/')[1];
      const category = menuCategories.find(c => c.id === categoryId);
      return category?.title || 'Categoria';
    }
    return 'Início';
  };

  const getCurrentCategory = () => {
    for (const category of menuCategories) {
      const hasItem = category.items.some(i => i.href === location.pathname);
      if (hasItem) return category;
    }
    return null;
  };

  const handleBack = () => {
    const currentCategory = getCurrentCategory();
    if (currentCategory && location.pathname !== '/home') {
      // Navigate to category overview
      navigate(`/category/${currentCategory.id}`);
    } else {
      navigate(-1);
    }
  };

  const getMenuItemByHref = (href: string) => {
    return getAllMenuItems().find(item => item.href === href);
  };

  // Get favorite items
  const favoriteItems = favorites
    .map(href => getMenuItemByHref(href))
    .filter((item): item is MenuItem => item !== undefined && filterItem(item));

  // Get recent items (excluding favorites and current route)
  const recentItems = recentRoutes
    .filter(href => !favorites.includes(href) && href !== location.pathname)
    .map(href => getMenuItemByHref(href))
    .filter((item): item is MenuItem => item !== undefined && filterItem(item))
    .slice(0, 3);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r border-sidebar-border">
          <SidebarHeader className="p-4 space-y-3">
            {/* Company Logo and Name */}
            <div className="flex items-center gap-3">
              {companySettings?.logo_url ? (
                <Avatar className="h-10 w-10 rounded-lg">
                  <AvatarImage src={companySettings.logo_url} alt="Logo" className="object-cover" />
                  <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
                    {companySettings.company_name ? getInitials(companySettings.company_name) : 'CO'}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-10 w-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-sidebar-primary-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold text-sm text-sidebar-foreground truncate">
                  {companySettings?.company_name || 'PontoMax'}
                </h1>
                <p className="text-xs text-sidebar-foreground/50">Controle de Ponto • {getVersionString()}</p>
              </div>
            </div>

            {/* User Info */}
            <div className="bg-sidebar-accent/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-sidebar-foreground truncate">
                    {profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-[10px] text-sidebar-foreground/50 capitalize">
                    {roles[0] || 'employee'}
                  </p>
                </div>
              </div>
              
              {/* Date/Time */}
              <div className="text-[10px] text-sidebar-foreground/70 space-y-0.5">
                <p className="capitalize">{getFormattedDate()}</p>
                <p className="font-mono text-sidebar-foreground">{getFormattedTime()}</p>
              </div>
              
              {/* Daily Message */}
              <div className="pt-1 border-t border-sidebar-border/50">
                <p className="text-[10px] italic text-sidebar-foreground/60 leading-relaxed">
                  "{dailyMessage.text}"
                </p>
                <p className="text-[9px] text-sidebar-foreground/40 mt-0.5">
                  — {dailyMessage.author}
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2">
            {/* Favorites Section */}
            {favoriteItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-amber-500 flex items-center gap-2 px-2">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Favoritos</span>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {favoriteItems.map((item) => (
                      <SidebarMenuItem key={`fav-${item.href}`}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === item.href}
                          className="h-8 group"
                        >
                          <Link to={item.href}>
                            <item.icon className="w-3.5 h-3.5" />
                            <span className="text-xs flex-1">{item.title}</span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleFavorite(item.href);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            </button>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Recent Section */}
            {recentItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 flex items-center gap-2 px-2">
                  <History className="w-3.5 h-3.5" />
                  <span>Recentes</span>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {recentItems.map((item) => (
                      <SidebarMenuItem key={`recent-${item.href}`}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === item.href}
                          className="h-8 group"
                        >
                          <Link to={item.href}>
                            <item.icon className="w-3.5 h-3.5" />
                            <span className="text-xs flex-1">{item.title}</span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleFavorite(item.href);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Star className="w-3 h-3 text-muted-foreground hover:text-amber-500" />
                            </button>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Divider */}
            {(favoriteItems.length > 0 || recentItems.length > 0) && (
              <div className="my-2 border-t border-sidebar-border/50" />
            )}

            {/* Menu Categories */}
            {menuCategories.filter(filterCategory).map((category) => (
              <SidebarGroup key={category.id}>
                <Collapsible 
                  open={openCategories.includes(category.id)} 
                  onOpenChange={() => toggleCategory(category.id)}
                >
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-2 py-1.5 flex items-center justify-between w-full text-xs font-medium text-sidebar-foreground/70">
                      <div className="flex items-center gap-2">
                        <category.icon className="w-3.5 h-3.5" />
                        <span>{category.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Link 
                          to={`/category/${category.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-sidebar-accent rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronUp className="w-3 h-3 rotate-90" />
                        </Link>
                        {openCategories.includes(category.id) ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {category.items.filter(filterItem).map((item) => (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              asChild
                              isActive={location.pathname === item.href}
                              className="h-8 pl-6 group"
                            >
                              <Link to={item.href}>
                                <item.icon className="w-3.5 h-3.5" />
                                <span className="text-xs flex-1">{item.title}</span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleFavorite(item.href);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Star className={`w-3 h-3 ${isFavorite(item.href) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`} />
                                </button>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2 px-2 hover:bg-sidebar-accent">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm">Conta</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-popover border border-border z-50">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account-settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/users">
                        <UserCog className="mr-2 h-4 w-4" />
                        Usuários
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/company">
                        <Building2 className="mr-2 h-4 w-4" />
                        Empresa
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 glass px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Link to="/home">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Home className="h-4 w-4" />
                  </Button>
                </Link>
                <h2 className="text-sm font-medium">
                  {getCurrentPageTitle()}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <NotificationCenter />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
        <SupportChat />
      </div>
    </SidebarProvider>
  );
}

export { menuCategories };
