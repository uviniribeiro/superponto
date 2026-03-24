import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useFavorites } from '@/hooks/useFavorites';
import { useDefaultDataSeeder } from '@/hooks/useDefaultDataSeeder';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Star, 
  History, 
  Clock,
  LayoutDashboard,
  Users,
  FileText,
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
  Home as HomeIcon,
  Plus,
  Settings,
} from 'lucide-react';

interface CompanySettings {
  logo_url: string | null;
  company_name: string | null;
}

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  roles: string[];
  description: string;
}

const allMenuItems: MenuItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'employee'], description: 'Visão geral e estatísticas' },
  { title: 'Registrar Ponto', href: '/time-clock', icon: Clock, roles: ['admin', 'manager', 'employee'], description: 'Registre sua entrada e saída' },
  { title: 'Meus Registros', href: '/my-records', icon: FileText, roles: ['admin', 'manager', 'employee'], description: 'Visualize seus registros' },
  { title: 'Banco de Horas', href: '/time-bank', icon: Timer, roles: ['admin', 'manager', 'employee'], description: 'Saldo de horas extras' },
  { title: 'Funcionários', href: '/employees', icon: Users, roles: ['admin', 'manager'], description: 'Gestão de funcionários' },
  { title: 'Cargos e Deptos', href: '/positions-departments', icon: Briefcase, roles: ['admin'], description: 'Cargos e departamentos' },
  { title: 'Jornadas e Escalas', href: '/schedules', icon: CalendarClock, roles: ['admin'], description: 'Horários de trabalho' },
  { title: 'Feriados', href: '/holidays', icon: CalendarDays, roles: ['admin'], description: 'Calendário de feriados' },
  { title: 'Módulo Professor', href: '/teacher-module', icon: GraduationCap, roles: ['admin'], description: 'Gestão de hora-aula' },
  { title: 'Espelho de Ponto', href: '/timesheet', icon: ClipboardList, roles: ['admin', 'manager'], description: 'Folha de ponto' },
  { title: 'Faltas', href: '/absences', icon: UserX, roles: ['admin', 'manager'], description: 'Gestão de faltas' },
  { title: 'Ajustes', href: '/adjustments', icon: ClipboardCheck, roles: ['admin', 'manager'], description: 'Ajustes de ponto' },
  { title: 'Relatórios', href: '/reports', icon: FileText, roles: ['admin', 'manager'], description: 'Relatórios gerenciais' },
  { title: 'Dashboard HE', href: '/overtime-dashboard', icon: TrendingUp, roles: ['admin', 'manager'], description: 'Horas extras' },
  { title: 'Import/Export', href: '/import-export', icon: ArrowUpDown, roles: ['admin'], description: 'Importar e exportar' },
  { title: 'Equipamentos REP', href: '/equipment', icon: Server, roles: ['admin'], description: 'Relógios de ponto' },
  { title: 'Usuários', href: '/users', icon: UserCog, roles: ['admin'], description: 'Gestão de usuários' },
  { title: 'Empresa', href: '/company', icon: Building2, roles: ['admin'], description: 'Dados da empresa' },
];

const quickAccessDefaults = [
  '/dashboard',
  '/time-clock',
  '/my-records',
  '/time-bank',
];

export default function Home() {
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const { favorites, recentRoutes, toggleFavorite, isFavorite } = useFavorites();
  const { isAdmin, isManager } = useAuth();
  useDefaultDataSeeder(); // Auto-seed default registration data

  useEffect(() => {
    const fetchCompanySettings = async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('logo_url, company_name')
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setCompanySettings(data as CompanySettings);
      }
    };

    fetchCompanySettings();
  }, []);

  const filterItem = (item: MenuItem) => {
    if (isAdmin) return true;
    if (isManager && item.roles.includes('manager')) return true;
    return item.roles.includes('employee');
  };

  const getMenuItemByHref = (href: string) => {
    return allMenuItems.find(item => item.href === href);
  };

  // Get favorite items for quick access
  const favoriteItems = favorites
    .map(href => getMenuItemByHref(href))
    .filter((item): item is MenuItem => item !== undefined && filterItem(item));

  // Get recent items (excluding favorites)
  const recentItems = recentRoutes
    .filter(href => !favorites.includes(href) && href !== '/home')
    .map(href => getMenuItemByHref(href))
    .filter((item): item is MenuItem => item !== undefined && filterItem(item))
    .slice(0, 4);

  // Default quick access if no favorites
  const defaultQuickAccess = quickAccessDefaults
    .map(href => getMenuItemByHref(href))
    .filter((item): item is MenuItem => item !== undefined && filterItem(item));

  const quickAccessItems = favoriteItems.length > 0 ? favoriteItems : defaultQuickAccess;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {/* Content */}
      <div className="relative z-10 space-y-6">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">
            Bem-vindo ao {companySettings?.company_name || 'PontoMax'}
          </h1>
          <p className="text-muted-foreground text-sm">
            Acesse rapidamente as funções que você mais utiliza
          </p>
        </div>

        {/* Quick Access Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Acesso Rápido
            </h2>
            {favoriteItems.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Clique na ★ nos menus para adicionar favoritos
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickAccessItems.map((item) => (
              <Link to={item.href} key={item.href}>
                <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer group hover:scale-[1.02]">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                        <item.icon className="w-6 h-6" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(item.href);
                        }}
                        className="p-1 hover:bg-muted rounded transition-colors"
                      >
                        <Star className={`w-4 h-4 ${isFavorite(item.href) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`} />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-base mb-1">{item.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Section */}
        {recentItems.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" />
              Acessados Recentemente
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentItems.map((item) => (
                <Link to={item.href} key={`recent-${item.href}`}>
                  <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(item.href);
                        }}
                        className="p-1 hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Plus className="w-4 h-4 text-muted-foreground hover:text-amber-500" />
                      </button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions for Admin */}
        {isAdmin && (
          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-muted-foreground" />
              Ações Administrativas
            </h2>

            <div className="flex flex-wrap gap-3">
              <Link to="/employees/register">
                <Button variant="outline" className="gap-2">
                  <Users className="w-4 h-4" />
                  Novo Funcionário
                </Button>
              </Link>
              <Link to="/equipment">
                <Button variant="outline" className="gap-2">
                  <Server className="w-4 h-4" />
                  Equipamentos REP
                </Button>
              </Link>
              <Link to="/company">
                <Button variant="outline" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  Configurar Empresa
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* No favorites hint */}
        {favoriteItems.length === 0 && !recentItems.length && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              💡 Dica: Configure a logo da empresa em{' '}
              <Link to="/company" className="text-primary hover:underline">
                Configurações → Empresa
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
