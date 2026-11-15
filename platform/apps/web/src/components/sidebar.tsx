'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Moon, Search, Sun, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { Logo, LogoMark } from './logo';
import { buildNav, type NavItem, type NavLeaf } from './nav';
import { useSession } from './providers';
import { useTheme } from './theme';

const SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.8 } as const;
const WIDTH = { collapsed: 76, expanded: 272 };

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'SP';
}

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
  onOpenSearch: () => void;
  /** em telas pequenas: painel sobreposto, fechado pelo botão X */
  mobile?: boolean;
  onClose?: () => void;
}

/**
 * Barra lateral flutuante de vidro. Recolhida: trilho de ícones com dicas; expandida: seções,
 * subitens em árvore, contadores. Uma pílula desliza sob o item em foco (hover) e outra marca a tela atual.
 */
export function Sidebar({ expanded, onToggle, onOpenSearch, mobile, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useSession();
  const { theme, toggle } = useTheme();
  const sections = useMemo(() => buildNav(me), [me]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ structure: true });
  const [menuOpen, setMenuOpen] = useState(false);
  const open = expanded || !!mobile;

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    try { sessionStorage.removeItem('sp-intro-done'); } catch { /* sem storage */ }
    router.replace('/login');
  }

  return (
    <motion.aside
      style={{ viewTransitionName: mobile ? undefined : 'sidebar', ...(mobile ? { background: 'var(--bg-elevated)' } : {}) }}
      initial={false}
      animate={{ width: open ? WIDTH.expanded : WIDTH.collapsed }}
      transition={SPRING}
      onMouseLeave={() => setHovered(null)}
      className="glass-strong relative flex h-full flex-col rounded-[28px] px-3 py-4"
      aria-label="Navegação principal"
    >
      {/* Topo: marca e botão de expandir/recolher */}
      <div className="relative flex h-11 items-center px-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <motion.div key="full" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}>
              <Logo subtitle="Gestão de ponto" />
            </motion.div>
          ) : (
            <motion.div key="mark" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.18 }}>
              <LogoMark />
            </motion.div>
          )}
        </AnimatePresence>
        {mobile ? (
          <button onClick={onClose} className="glass ml-auto grid size-8 place-items-center rounded-full text-muted hover:text-fg" aria-label="Fechar menu">
            <X className="size-4" />
          </button>
        ) : (
          <button
            onClick={onToggle}
            title={open ? 'Recolher' : 'Expandir'}
            className="glass-strong absolute -right-7 top-1.5 z-20 grid size-8 place-items-center rounded-full text-muted transition-colors hover:text-fg"
            aria-label={open ? 'Recolher menu' : 'Expandir menu'}
            aria-expanded={open}
          >
            {open ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        )}
      </div>

      {/* Busca (⌘K) */}
      <div className="mt-4">
        <Tip label="Buscar" kbd="⌘K" show={!open && hovered === 'search'}>
          <button
            onClick={onOpenSearch}
            onMouseEnter={() => setHovered('search')}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-2xl text-sm text-muted transition-colors hover:text-fg',
              open ? 'bg-hover px-3' : 'justify-center',
            )}
            aria-label="Buscar telas (Ctrl+K)"
          >
            <Search className="size-[18px] shrink-0" />
            {open && (
              <>
                <span className="flex-1 truncate text-left">Buscar telas</span>
                <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-subtle">⌘K</kbd>
              </>
            )}
          </button>
        </Tip>
      </div>

      {/* Seções */}
      <LayoutGroup id="sidebar">
        <nav className="mt-3 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-0.5">
          {sections.map((section) => (
            <div key={section.id}>
              <div className="h-5 px-3">
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
                      {section.label}
                    </motion.span>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto mt-2 h-px w-6 bg-line" />
                  )}
                </AnimatePresence>
              </div>
              <ul className="mt-1 space-y-0.5">
                {section.items.map((item) => (
                  <NavRow
                    key={item.id}
                    item={item}
                    open={open}
                    pathname={pathname}
                    hovered={hovered}
                    setHovered={setHovered}
                    groupOpen={!!openGroups[item.id]}
                    toggleGroup={() => setOpenGroups((g) => ({ ...g, [item.id]: !g[item.id] }))}
                    onNavigate={onClose}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </LayoutGroup>

      {/* Rodapé: modo noturno e usuário */}
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        <Tip label={theme === 'dark' ? 'Modo claro' : 'Modo noturno'} show={!open && hovered === 'theme'}>
          <button
            onClick={toggle}
            onMouseEnter={() => setHovered('theme')}
            className={cn('flex h-10 w-full items-center gap-3 rounded-2xl text-sm text-muted hover:bg-hover hover:text-fg', open ? 'px-3' : 'justify-center')}
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Modo noturno"
          >
            {theme === 'dark' ? <Moon className="size-[18px] shrink-0" /> : <Sun className="size-[18px] shrink-0" />}
            {open && (
              <>
                <span className="flex-1 text-left">Modo noturno</span>
                <span className={cn('relative h-5 w-9 rounded-full transition-colors', theme === 'dark' ? 'bg-brand' : 'bg-line-strong')}>
                  <motion.span layout transition={SPRING} className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow', theme === 'dark' ? 'right-0.5' : 'left-0.5')} />
                </span>
              </>
            )}
          </button>
        </Tip>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onMouseEnter={() => setHovered('user')}
            className={cn('flex w-full items-center gap-3 rounded-2xl p-1.5 text-left hover:bg-hover', !open && 'justify-center')}
            aria-label="Conta"
            aria-expanded={menuOpen}
          >
            <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">
              {initials(me?.displayName ?? '')}
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--bg-elevated)] bg-success" />
            </span>
            {open && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{me?.displayName ?? '…'}</span>
                <span className="block truncate text-xs text-subtle">{me?.email}</span>
              </span>
            )}
            {open && <ChevronDown className={cn('size-4 text-subtle transition-transform', menuOpen && 'rotate-180')} />}
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className={cn('glass-strong absolute bottom-full z-50 mb-2 rounded-2xl p-1.5', open ? 'inset-x-0' : 'left-0 w-52')}
              >
                <button onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger hover:bg-hover">
                  <LogOut className="size-4" /> Sair
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}

function NavRow({
  item, open, pathname, hovered, setHovered, groupOpen, toggleGroup, onNavigate,
}: {
  item: NavItem;
  open: boolean;
  pathname: string;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  groupOpen: boolean;
  toggleGroup: () => void;
  onNavigate?: () => void;
}) {
  const hasChildren = !!item.children?.length;
  const active = hasChildren ? item.children!.some((c) => isActive(pathname, c.href)) : isActive(pathname, item.href);
  const Icon = item.icon;

  const content = (
    <>
      <Pills id={item.id} active={active && (!hasChildren || !open)} hovered={hovered === item.id} />
      <span className="relative z-10 grid size-[18px] place-items-center">
        <Icon className={cn('size-[18px] transition-colors', active ? 'text-brand' : 'text-muted group-hover:text-fg')} />
        {!open && !!item.badge && <span className="absolute -right-1.5 -top-1.5 size-2 rounded-full bg-danger" />}
      </span>
      <AnimatePresence initial={false}>
        {open && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.16 }}
            className={cn('relative z-10 flex-1 truncate text-left', active ? 'font-semibold text-fg' : 'text-muted group-hover:text-fg')}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {open && !!item.badge && <Badge value={item.badge} />}
      {open && hasChildren && <ChevronDown className={cn('relative z-10 size-4 text-subtle transition-transform', groupOpen && 'rotate-180')} />}
    </>
  );

  const rowClass = cn('group relative flex h-10 w-full items-center gap-3 rounded-2xl text-sm', open ? 'px-3' : 'justify-center');

  return (
    <li onMouseEnter={() => setHovered(item.id)}>
      <Tip label={item.label} badge={item.badge} show={!open && hovered === item.id}>
        {hasChildren && open ? (
          <button className={rowClass} onClick={toggleGroup} aria-expanded={groupOpen}>{content}</button>
        ) : (
          <Link href={hasChildren ? item.children![0]!.href : item.href} className={rowClass} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
            {content}
          </Link>
        )}
      </Tip>
      <AnimatePresence initial={false}>
        {open && hasChildren && groupOpen && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative ml-[21px] overflow-hidden border-l border-line pl-3"
          >
            {item.children!.map((child) => (
              <ChildRow key={child.id} child={child} pathname={pathname} hovered={hovered} setHovered={setHovered} onNavigate={onNavigate} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

function ChildRow({ child, pathname, hovered, setHovered, onNavigate }: {
  child: NavLeaf; pathname: string; hovered: string | null; setHovered: (id: string | null) => void; onNavigate?: () => void;
}) {
  const active = isActive(pathname, child.href);
  return (
    <li onMouseEnter={() => setHovered(child.id)} className="py-0.5">
      <Link href={child.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className="group relative flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13px]">
        <Pills id={child.id} active={active} hovered={hovered === child.id} small />
        <span className="relative z-10 size-1.5 rounded-full" style={{ background: child.dot ?? 'var(--fg-subtle)' }} />
        <span className={cn('relative z-10 flex-1 truncate', active ? 'font-semibold text-fg' : 'text-muted group-hover:text-fg')}>{child.label}</span>
        {!!child.badge && <Badge value={child.badge} />}
      </Link>
    </li>
  );
}

/** Pílulas animadas: a de hover desliza entre itens; a ativa marca a tela atual em amarelo. */
function Pills({ id, active, hovered, small }: { id: string; active: boolean; hovered: boolean; small?: boolean }) {
  return (
    <>
      {hovered && !active && (
        <motion.span
          layoutId="sp-hover-pill"
          transition={SPRING}
          className={cn('absolute inset-0 border border-line bg-hover', small ? 'rounded-xl' : 'rounded-2xl')}
        />
      )}
      {active && (
        <motion.span
          layoutId="sp-active-pill"
          transition={SPRING}
          className={cn('absolute inset-0 border border-[color:var(--brand-glow)] bg-brand-soft', small ? 'rounded-xl' : 'rounded-2xl')}
          data-id={id}
        >
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
        </motion.span>
      )}
    </>
  );
}

function Badge({ value }: { value: number }) {
  return <span className="relative z-10 rounded-full bg-brand px-1.5 text-[10px] font-bold leading-[18px] text-brand-fg">{value > 99 ? '99+' : value}</span>;
}

/** Dica ao lado do trilho recolhido (como no vídeo de referência). */
function Tip({ label, kbd, badge, show, children }: { label: string; kbd?: string; badge?: number; show: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -6, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="glass-strong pointer-events-none absolute left-full top-1/2 z-50 ml-4 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium"
            role="tooltip"
          >
            {label}
            {kbd && <kbd className="rounded border border-line px-1 text-[10px] text-subtle">{kbd}</kbd>}
            {!!badge && <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-fg">{badge}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Estado da barra (recolhida/expandida) lembrado por navegador. */
export function useSidebarState() {
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sp-sidebar');
      if (saved) setExpanded(saved === 'expanded');
    } catch { /* sem storage */ }
  }, []);
  const toggle = () =>
    setExpanded((v) => {
      try { localStorage.setItem('sp-sidebar', v ? 'collapsed' : 'expanded'); } catch { /* sem storage */ }
      return !v;
    });
  return { expanded, toggle };
}
