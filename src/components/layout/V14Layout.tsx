// Layout "Dashboard V14": barra superior com abas em pílula (categorias), trilho de ícones à esquerda
// (telas da categoria), busca de telas (Ctrl+K), notificações, tema e conta. Mantém menus, permissões e
// a paleta de cores do sistema (tokens do Tailwind).
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, LogOut, Settings, ChevronDown, Menu as MenuIcon, Home, Smartphone, Users, CalendarDays, Clock, Timer, BarChart3, Router, Bus, Puzzle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/NotificationCenter';
import { SupportChat } from '@/components/support/SupportChat';
import { AnnouncementPopup } from '@/components/announcements/AnnouncementPopup';
import { WhatsNewPopup } from '@/components/WhatsNewPopup';
import { APP_NAME } from '@/lib/version';
import { pontoMaxClockIcon } from '@/components/PontoMaxLogo';
import { menuCategories } from './CollapsibleSidebar';
import { cn } from '@/lib/utils';

type Category = (typeof menuCategories)[number];

/** Abas do topo: cada uma reúne categorias afins (as telas aparecem no trilho, separadas por seção). */
const GROUPS: { id: string; title: string; icon: React.ComponentType<{ className?: string }>; cats: string[] }[] = [
  { id: 'inicio', title: 'Início', icon: Home, cats: ['home', 'monitoramento'] },
  { id: 'meu-ponto', title: 'Meu Ponto', icon: Smartphone, cats: ['meu-ponto'] },
  { id: 'cadastros', title: 'Cadastros', icon: Users, cats: ['cadastros'] },
  { id: 'jornada', title: 'Jornada', icon: CalendarDays, cats: ['escalas'] },
  { id: 'ponto', title: 'Ponto', icon: Clock, cats: ['ponto', 'tratamento', 'afastamentos'] },
  { id: 'banco', title: 'Banco de Horas', icon: Timer, cats: ['banco-horas'] },
  { id: 'relatorios', title: 'Relatórios', icon: BarChart3, cats: ['relatorios', 'integracoes'] },
  { id: 'equipamentos', title: 'Equipamentos', icon: Router, cats: ['dispositivos'] },
  { id: 'operacional', title: 'Operacional', icon: Bus, cats: ['controle-operacional'] },
  { id: 'modulos', title: 'Módulos', icon: Puzzle, cats: ['professor', 'medico', 'folha'] },
  { id: 'admin', title: 'Administração', icon: ShieldCheck, cats: ['seguranca', 'configuracoes'] },
];
type Item = Category['items'][number];

export default function V14Layout() {
  const { profile, signOut, isAdmin, isManager, hasTeacherModule, hasDoctorModule, hasPayrollModule } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [company, setCompany] = useState<{ company_name?: string; logo_url?: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    supabase.from('company_settings').select('company_name, logo_url').limit(1).maybeSingle().then(({ data }) => data && setCompany(data));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allowed = (href: string, roles: string[]) => {
    if (href.includes('teacher') && !hasTeacherModule) return false;
    if (href.includes('doctor') && !hasDoctorModule) return false;
    if (href.includes('payroll') && !hasPayrollModule) return false;
    if (isAdmin) return true;
    if (isManager && roles.includes('manager')) return true;
    return roles.includes('employee');
  };
  const categories = useMemo(() => menuCategories
    .filter((c) => !(c.id === 'professor' && !hasTeacherModule) && !(c.id === 'medico' && !hasDoctorModule) && !(c.id === 'folha' && !hasPayrollModule))
    .filter((c) => isAdmin || (isManager && c.roles.includes('manager')) || c.roles.includes('employee'))
    .map((c) => ({ ...c, items: c.items.filter((i) => allowed(i.href, i.roles)) }))
    .filter((c) => c.items.length > 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [isAdmin, isManager, hasTeacherModule, hasDoctorModule, hasPayrollModule]);

  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, sections: g.cats.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as Category[] })).filter((g) => g.sections.length), [categories]);

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/');
  const current: Category | undefined = location.pathname.startsWith('/category/')
    ? categories.find((c) => c.id === location.pathname.split('/category/')[1])
    : categories.find((c) => c.items.some((i) => isActive(i.href))) ?? categories[0];

  const group = groups.find((g) => g.sections.some((c) => c.id === current?.id)) ?? groups[0];
  const initials = (profile?.full_name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const go = (href: string) => { setSearchOpen(false); navigate(href); };
  const out = async () => { await signOut(); navigate('/auth'); };

  const pill = (active: boolean) => cn(
    'h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 inline-flex items-center gap-2',
    active ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
  );

  return (
    <div className="min-h-screen w-full bg-muted/40 p-2 sm:p-3">
      <div className="mx-auto max-w-[1600px] min-h-[calc(100vh-1.5rem)] rounded-3xl bg-background shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_40px_-12px_rgba(0,0,0,.12)] border border-border/60 flex flex-col overflow-hidden">
        {/* Barra superior */}
        <header className="sticky top-0 z-40 flex items-center gap-3 px-3 sm:px-5 h-16 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <Link to="/home" className="flex items-center gap-2 shrink-0">
            <img src={company?.logo_url || pontoMaxClockIcon} alt={company?.company_name || APP_NAME} className="h-8 w-8 rounded-xl object-contain" />
            <span className="hidden md:block font-semibold text-sm max-w-[160px] truncate">{company?.company_name || APP_NAME}</span>
          </Link>

          <nav className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 w-max mx-auto">
              {groups.map((g) => (
                <button key={g.id} type="button" onClick={() => navigate(g.sections[0].items[0].href)} className={pill(group?.id === g.id)} title={g.title}>
                  <g.icon className="h-4 w-4 xl:hidden" />
                  <span className="hidden xl:inline">{g.title}</span>
                </button>
              ))}
            </div>
          </nav>

          <div className="flex items-center gap-1 shrink-0">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => setSearchOpen(true)} className="h-9 w-9 rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Buscar">
                  <Search className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Buscar telas (Ctrl+K)</TooltipContent>
            </Tooltip>
            <NotificationCenter />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="ml-1 flex items-center gap-2 rounded-full border border-border/70 pl-1 pr-2 h-10 hover:bg-muted">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback></Avatar>
                  <span className="hidden lg:flex flex-col items-start leading-tight max-w-[140px]">
                    <span className="text-xs font-semibold truncate max-w-[140px]">{profile?.full_name || 'Usuário'}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{profile?.email}</span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{profile?.full_name || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/account-settings')}><Settings className="w-4 h-4 mr-2" />Minha conta</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={out} className="text-destructive"><LogOut className="w-4 h-4 mr-2" />Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Trilho de ícones (telas da categoria) */}
          {group && (
            <aside className="hidden md:flex flex-col items-center gap-1.5 w-16 py-4 border-r border-border/60 overflow-y-auto no-scrollbar">
              {group.sections.map((sec, si) => (
                <React.Fragment key={sec.id}>
                  {si > 0 && <div className="my-1.5 h-px w-8 bg-border" title={sec.title} />}
                  {sec.items.map((i: Item) => (
                    <Tooltip key={i.href} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link to={i.href} aria-label={i.title}
                          className={cn('h-10 w-10 shrink-0 rounded-full inline-flex items-center justify-center transition-all duration-200',
                            isActive(i.href) ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                          <i.icon className="h-[18px] w-[18px]" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right"><span className="text-[10px] uppercase text-muted-foreground">{sec.title}</span><br />{i.title}</TooltipContent>
                    </Tooltip>
                  ))}
                </React.Fragment>
              ))}
            </aside>
          )}

          <main className="flex-1 min-w-0 overflow-auto">
            {/* Celular: telas da categoria em pílulas */}
            {group && (
              <div className="md:hidden flex gap-1 overflow-x-auto no-scrollbar px-3 pt-3">
                <MenuIcon className="h-4 w-4 m-2.5 shrink-0 text-muted-foreground" />
                {group.sections.flatMap((sec) => sec.items).map((i: Item) => (
                  <Link key={i.href} to={i.href} className={pill(isActive(i.href))}>{i.title}</Link>
                ))}
              </div>
            )}
            <div key={location.pathname} className="p-4 lg:p-7 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Buscar telas…" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          {groups.flatMap((g) => g.sections.map((c) => ({ ...c, title: g.title === c.title ? c.title : `${g.title} › ${c.title}` }))).map((c) => (
            <CommandGroup key={c.id} heading={c.title}>
              {c.items.map((i: Item) => (
                <CommandItem key={i.href} value={`${c.title} ${i.title}`} onSelect={() => go(i.href)}>
                  <i.icon className="mr-2 h-4 w-4" />{i.title}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>

      <SupportChat />
      <AnnouncementPopup />
      <WhatsNewPopup />
    </div>
  );
}
