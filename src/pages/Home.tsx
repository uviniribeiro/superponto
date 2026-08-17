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

  const [heroItem, ...restItems] = quickAccessItems;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      {/* Content */}
      <div className="relative z-10 space-y-10">
        {/* Welcome Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              Bem-vindo ao {companySettings?.company_name || 'Ponto Max'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestão de ponto eletrônico — acesse suas funções mais usadas
            </p>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Painel principal
          </span>
        </header>

        {/* Quick Access Bento */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold flex items-center gap-2">
              <Star className="w-4 h-4 text-brand" />
              Acesso Rápido
            </h2>
            {favoriteItems.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Clique na ★ nos cards para fixar favoritos
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:auto-rows-[minmax(150px,auto)]">
            {heroItem && (
              <Link
                to={heroItem.href}
                className="bento-hero group flex flex-col justify-between md:col-span-2 md:row-span-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
                    <heroItem.icon className="h-8 w-8" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite(heroItem.href);
                    }}
                    aria-label="Fixar como favorito"
                    className="rounded-xl p-2 transition-colors hover:bg-brand/30"
                  >
                    <Star className={`w-4 h-4 ${isFavorite(heroItem.href) ? 'fill-brand text-brand' : 'text-primary-foreground/60'}`} />
                  </button>
                </div>
                <div>
                  <h3 className="font-heading text-4xl font-bold">{heroItem.title}</h3>
                  <p className="mt-2 max-w-sm text-primary-foreground/70">{heroItem.description}</p>
                </div>
              </Link>
            )}

            {restItems.map((item) => (
              <Link to={item.href} key={item.href} className="bento-card group flex flex-col justify-between gap-6">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-brand-deep transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite(item.href);
                    }}
                    aria-label="Fixar como favorito"
                    className="rounded-xl p-2 transition-colors hover:bg-muted"
                  >
                    <Star className={`w-4 h-4 ${isFavorite(item.href) ? 'fill-brand text-brand' : 'text-muted-foreground'}`} />
                  </button>
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Section */}
        {recentItems.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-bold flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              Acessados Recentemente
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentItems.map((item) => (
                <Link
                  to={item.href}
                  key={`recent-${item.href}`}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand-deep transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-sm font-semibold truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite(item.href);
                    }}
                    aria-label="Fixar como favorito"
                    className="rounded-lg p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Quick Actions for Admin */}
        {isAdmin && (
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-bold flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              Ações Administrativas
            </h2>

            <div className="flex flex-wrap gap-3">
              <Link to="/employees/register">
                <Button variant="outline" className="gap-2 rounded-2xl">
                  <Users className="w-4 h-4" />
                  Novo Funcionário
                </Button>
              </Link>
              <Link to="/equipment">
                <Button variant="outline" className="gap-2 rounded-2xl">
                  <Server className="w-4 h-4" />
                  Equipamentos REP
                </Button>
              </Link>
              <Link to="/company">
                <Button variant="outline" className="gap-2 rounded-2xl">
                  <Building2 className="w-4 h-4" />
                  Configurar Empresa
                </Button>
              </Link>
            </div>
          </section>
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
