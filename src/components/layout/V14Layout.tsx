// Layout principal: menu lateral esquerdo recolhível, organizado por categorias com o nome de cada tela,
// busca de telas (Ctrl+K), notificações, tema e conta. Mantém menus, permissões e a paleta do sistema.
// Fluidez: só transições de CSS (largura/opacidade), estado do menu guardado no aparelho.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, LogOut, Settings, ChevronDown, ChevronsLeft, ChevronsRight, Menu as MenuIcon, Home, Smartphone, Users, CalendarDays, Clock, Timer, BarChart3, Router, Bus, Puzzle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
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

/** Categorias do menu lateral: cada uma reúne grupos afins de telas. */
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('sp.menu.collapsed') === '1'; } catch { return false; } });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('sp.menu.groups') ?? '{}'); } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem('sp.menu.collapsed', collapsed ? '1' : '0'); } catch { /* sem armazenamento */ } }, [collapsed]);
  useEffect(() => { try { localStorage.setItem('sp.menu.groups', JSON.stringify(openGroups)); } catch { /* sem armazenamento */ } }, [openGroups]);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

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

  const currentItem = current?.items.find((i) => isActive(i.href));
  const isOpen = (id: string) => openGroups[id] ?? id === group?.id;
  const toggle = (id: string) => setOpenGroups((o) => ({ ...o, [id]: !isOpen(id) }));

  const itemClass = (active: boolean) => cn(
    'group/item flex items-center gap-3 rounded-xl px-3 h-9 text-[13px] font-medium transition-colors duration-150',
    active ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

  const nav = (mini: boolean) => (
    <nav className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-2 [scrollbar-width:thin]">
      {groups.map((g) => {
        const active = g.id === group?.id;
        if (mini) {
          return (
            <DropdownMenu key={g.id}>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={g.title} className={cn('mx-auto my-0.5 flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150', active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                      <g.icon className="h-[18px] w-[18px]" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{g.title}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="right" align="start" className="max-h-[70vh] w-64 overflow-y-auto rounded-2xl">
                {g.sections.map((sec, si) => (
                  <React.Fragment key={sec.id}>
                    {si > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">{sec.title}</DropdownMenuLabel>
                    {sec.items.map((i: Item) => (
                      <DropdownMenuItem key={i.href} onClick={() => navigate(i.href)} className={cn('gap-2 rounded-lg', isActive(i.href) && 'bg-muted font-semibold')}>
                        <i.icon className="h-4 w-4" />{i.title}
                      </DropdownMenuItem>
                    ))}
                  </React.Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        const open = isOpen(g.id);
        return (
          <div key={g.id} className="mb-1">
            <button type="button" onClick={() => toggle(g.id)} aria-expanded={open}
              className={cn('flex w-full items-center gap-3 rounded-xl px-3 h-10 text-sm font-semibold transition-colors duration-150', active ? 'text-foreground' : 'text-foreground/80 hover:bg-muted')}>
              <g.icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
              <span className="flex-1 truncate text-left">{g.title}</span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
            </button>
            <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="overflow-hidden">
                <div className="ml-[18px] border-l border-border/70 pl-2.5 pb-1">
                  {g.sections.map((sec) => (
                    <div key={sec.id} className="pt-1">
                      {g.sections.length > 1 && <p className="px-3 pb-0.5 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80">{sec.title}</p>}
                      {sec.items.map((i: Item) => (
                        <Link key={i.href} to={i.href} className={itemClass(isActive(i.href))}>
                          <i.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{i.title}</span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );

  const brand = (mini: boolean) => (
    <div className={cn('flex h-16 shrink-0 items-center gap-2.5 border-b border-border/60', mini ? 'justify-center px-2' : 'px-4')}>
      <Link to="/home" className="flex min-w-0 items-center gap-2.5">
        <img src={company?.logo_url || pontoMaxClockIcon} alt={company?.company_name || APP_NAME} className="h-8 w-8 shrink-0 rounded-xl object-contain" />
        {!mini && <span className="truncate text-sm font-semibold">{company?.company_name || APP_NAME}</span>}
      </Link>
    </div>
  );

  const userBox = (mini: boolean) => (
    <div className="shrink-0 border-t border-border/60 p-2.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn('flex w-full items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-muted', mini && 'justify-center')}>
            <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials}</AvatarFallback></Avatar>
            {!mini && (
              <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
                <span className="w-full truncate text-left text-xs font-semibold">{profile?.full_name || 'Usuário'}</span>
                <span className="w-full truncate text-left text-[10px] text-muted-foreground">{profile?.email}</span>
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-56 rounded-2xl">
          <DropdownMenuLabel><p className="text-sm font-medium">{profile?.full_name || 'Usuário'}</p><p className="text-xs text-muted-foreground">{profile?.email}</p></DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/account-settings')}><Settings className="mr-2 h-4 w-4" />Minha conta</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={out} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Sair</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const searchBtn = (mini: boolean) => (
    <div className="px-2.5 pt-2.5">
      <button type="button" onClick={() => setSearchOpen(true)} className={cn('flex h-9 w-full items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted', mini && 'justify-center px-0')} aria-label="Buscar telas">
        <Search className="h-4 w-4 shrink-0" />
        {!mini && <><span className="flex-1 text-left">Buscar…</span><kbd className="rounded-md border bg-background px-1.5 text-[10px]">Ctrl K</kbd></>}
      </button>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/40">
      {/* Menu lateral (computador) */}
      <aside
        className={cn('relative hidden shrink-0 flex-col border-r border-border/60 bg-background transition-[width] duration-200 ease-out will-change-[width] md:flex', collapsed ? 'w-[76px]' : 'w-[272px]')}
      >
        {brand(collapsed)}
        {searchBtn(collapsed)}
        {nav(collapsed)}
        {userBox(collapsed)}
        <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="absolute -right-3 top-[52px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground">
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Menu lateral (celular) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-[290px] flex-col p-0">
          {brand(false)}
          {searchBtn(false)}
          {nav(false)}
          {userBox(false)}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-muted md:hidden" aria-label="Abrir menu"><MenuIcon className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group?.title}{current && group && current.title !== group.title ? ` › ${current.title}` : ''}</p>
            <p className="truncate text-base font-semibold leading-tight">{currentItem?.title ?? current?.title ?? 'Início'}</p>
          </div>
          <NotificationCenter />
          <ThemeToggle />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div key={location.pathname} className="mx-auto max-w-[1600px] p-4 lg:p-7 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
            <Outlet />
          </div>
        </main>
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
