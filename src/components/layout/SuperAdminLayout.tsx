import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LogOut, Building2, Landmark, Key, Moon, Sun, LayoutDashboard, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { getVersionString } from '@/lib/version';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/super-admin', exact: true },
  { label: 'Empresas', icon: Building2, path: '/super-admin/companies' },
  { label: 'Prefeituras', icon: Landmark, path: '/super-admin/city-halls' },
  { label: 'Licenças', icon: Key, path: '/super-admin/licenses' },
  { label: 'Usuários', icon: Users, path: '/super-admin/users' },
];

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado');
    navigate('/super-admin-auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-[68px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="brand-gradient flex h-11 w-11 items-center justify-center rounded-2xl shadow-brand">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-base font-bold tracking-tight leading-none">Ponto Max</h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Super Admin • {getVersionString()}
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-border/70 bg-muted/50 p-1">
            {navItems.map(({ label, icon: Icon, path, exact }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200',
                  isActive(path, exact)
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              aria-label="Alternar tema"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 rounded-xl">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="container flex gap-1.5 overflow-x-auto py-2.5">
          {navItems.map(({ label, icon: Icon, path, exact }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive(path, exact)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="container py-8">
        <Outlet />
      </main>

      {/* Footer with version */}
      <footer className="border-t border-border/60 py-5">
        <div className="container flex items-center justify-center text-xs text-muted-foreground">
          Ponto Max {getVersionString()} • Sistema de Registro de Ponto Eletrônico
        </div>
      </footer>
    </div>
  );
}
