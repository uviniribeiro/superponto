import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LogOut, Building2, Landmark, Key, Moon, Sun, LayoutDashboard, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const isActive = (path: string) => {
    if (path === '/super-admin') {
      return location.pathname === '/super-admin';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado');
    navigate('/super-admin-auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">PontoMax</h1>
              <p className="text-xs text-muted-foreground">Super Administrador</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant={isActive('/super-admin') && location.pathname === '/super-admin' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/super-admin')}
              className="flex items-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant={isActive('/super-admin/companies') ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/super-admin/companies')}
              className="flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              Empresas
            </Button>
            <Button
              variant={isActive('/super-admin/city-halls') ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/super-admin/city-halls')}
              className="flex items-center gap-2"
            >
              <Landmark className="h-4 w-4" />
              Prefeituras
            </Button>
            <Button
              variant={isActive('/super-admin/licenses') ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/super-admin/licenses')}
              className="flex items-center gap-2"
            >
              <Key className="h-4 w-4" />
              Licenças
            </Button>
            <Button
              variant={isActive('/super-admin/users') ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/super-admin/users')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Usuários
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Alternar tema</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b bg-background">
        <div className="container flex gap-1 py-2 overflow-x-auto">
          <Button
            variant={isActive('/super-admin') && location.pathname === '/super-admin' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => navigate('/super-admin')}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant={isActive('/super-admin/companies') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => navigate('/super-admin/companies')}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Building2 className="h-4 w-4" />
            Empresas
          </Button>
          <Button
            variant={isActive('/super-admin/city-halls') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => navigate('/super-admin/city-halls')}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Landmark className="h-4 w-4" />
            Prefeituras
          </Button>
          <Button
            variant={isActive('/super-admin/licenses') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => navigate('/super-admin/licenses')}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Key className="h-4 w-4" />
            Licenças
          </Button>
          <Button
            variant={isActive('/super-admin/users') ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => navigate('/super-admin/users')}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Users className="h-4 w-4" />
            Usuários
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
