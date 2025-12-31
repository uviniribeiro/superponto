import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Calendar,
  FileText,
  Settings,
  LogOut,
  Fingerprint,
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
} from 'lucide-react';

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['admin', 'manager', 'employee'] },
  { title: 'Registrar Ponto', icon: Clock, href: '/time-clock', roles: ['admin', 'manager', 'employee'] },
  { title: 'Meus Registros', icon: FileText, href: '/my-records', roles: ['admin', 'manager', 'employee'] },
  { title: 'Banco de Horas', icon: Timer, href: '/time-bank', roles: ['admin', 'manager', 'employee'] },
  { title: 'Funcionários', icon: Users, href: '/employees', roles: ['admin', 'manager'] },
  { title: 'Cargos e Deptos', icon: Briefcase, href: '/positions-departments', roles: ['admin'] },
  { title: 'Jornadas e Escalas', icon: CalendarClock, href: '/schedules', roles: ['admin'] },
  { title: 'Espelho de Ponto', icon: ClipboardList, href: '/timesheet', roles: ['admin', 'manager'] },
  { title: 'Módulo Professor', icon: GraduationCap, href: '/teacher-module', roles: ['admin'] },
  { title: 'Feriados', icon: CalendarDays, href: '/holidays', roles: ['admin'] },
  { title: 'Faltas', icon: UserX, href: '/absences', roles: ['admin', 'manager'] },
  { title: 'Ajustes', icon: ClipboardCheck, href: '/adjustments', roles: ['admin', 'manager'] },
  { title: 'Relatórios', icon: FileText, href: '/reports', roles: ['admin', 'manager'] },
  { title: 'Import/Export', icon: ArrowUpDown, href: '/import-export', roles: ['admin'] },
  { title: 'Equipamentos REP', icon: Server, href: '/equipment', roles: ['admin'] },
  { title: 'Dashboard HE', icon: TrendingUp, href: '/overtime-dashboard', roles: ['admin', 'manager'] },
  { title: 'Usuários', icon: UserCog, href: '/users', roles: ['admin'] },
  { title: 'Empresa', icon: Building2, href: '/company', roles: ['admin'] },
];

export default function AppLayout() {
  const { profile, roles, signOut, isAdmin, isManager } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

  const filteredMenuItems = menuItems.filter(item => {
    if (isAdmin) return true;
    if (isManager && item.roles.includes('manager')) return true;
    return item.roles.includes('employee');
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sidebar-primary rounded-lg">
                <Fingerprint className="w-6 h-6 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-sidebar-foreground">PontoMax</h1>
                <p className="text-xs text-sidebar-foreground/60">Controle de Ponto</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredMenuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === item.href}
                      >
                        <Link to={item.href}>
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                      {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium text-sidebar-foreground">
                      {profile?.full_name || 'Usuário'}
                    </span>
                    <span className="text-xs text-sidebar-foreground/60 capitalize">
                      {roles[0] || 'employee'}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
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
          <header className="sticky top-0 z-10 glass border-b px-6 py-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">
                {menuItems.find(item => item.href === location.pathname)?.title || 'Dashboard'}
              </h2>
            </div>
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}