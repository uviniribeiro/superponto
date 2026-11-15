'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CommandPalette } from './command-palette';
import { IntroReveal } from './intro-reveal';
import { LogoMark } from './logo';
import { buildNav } from './nav';
import { AppProviders, useSession } from './providers';
import { Sidebar, useSidebarState } from './sidebar';
import { ToastProvider } from './ui';

function Shell({ children }: { children: React.ReactNode }) {
  const { expanded, toggle } = useSidebarState();
  const { me } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  // Troca obrigatória de senha: só "Minha conta" fica acessível até trocar.
  useEffect(() => {
    if (me?.mustChangePassword && pathname !== '/minha-conta') router.replace('/minha-conta');
  }, [me?.mustChangePassword, pathname, router]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sections = useMemo(() => buildNav(me), [me]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <IntroReveal>
      <div className="flex min-h-screen">
        {/* Desktop: barra flutuante fixa */}
        <div className="sticky top-0 hidden h-screen shrink-0 p-3 md:block">
          <Sidebar expanded={expanded} onToggle={toggle} onOpenSearch={() => setSearchOpen(true)} />
        </div>

        {/* Celular: barra superior + painel sobreposto */}
        <div className="glass-strong fixed inset-x-3 top-3 z-30 flex h-14 items-center gap-3 rounded-2xl px-3 md:hidden">
          <button onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-hover" aria-label="Abrir menu"><Menu className="size-5" /></button>
          <LogoMark className="size-8" />
          <span className="font-brand font-bold">Super<span className="text-brand">Ponto</span></span>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
              <motion.div className="fixed inset-y-0 left-0 z-50 p-3 md:hidden" initial={{ x: '-110%' }} animate={{ x: 0 }} exit={{ x: '-110%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
                <Sidebar expanded mobile onToggle={toggle} onClose={() => setMobileOpen(false)} onOpenSearch={() => { setMobileOpen(false); setSearchOpen(true); }} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 px-3 pb-3 pt-[72px] md:py-3 md:pl-1 md:pr-3">
          <div className="window min-h-[calc(100vh-84px)] rounded-[28px] px-4 py-6 md:min-h-[calc(100vh-24px)] md:rounded-[34px] md:px-8 md:py-7">{children}</div>
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} sections={sections} />
    </IntroReveal>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <ToastProvider>
        <Shell>{children}</Shell>
      </ToastProvider>
    </AppProviders>
  );
}
