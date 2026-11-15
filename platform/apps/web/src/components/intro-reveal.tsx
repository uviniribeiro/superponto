'use client';

import { animate, AnimatePresence, motion, useMotionTemplate, useMotionValue } from 'motion/react';
import { useEffect, useState } from 'react';
import { LogoMark } from './logo';

/**
 * Abertura após o login (como no vídeo de referência): a marca surge no escuro e o sistema aparece
 * por uma "lente" — um círculo de borda suave que se expande enquanto o desfoque some.
 * Roda uma vez por sessão; respeita "reduzir movimento".
 */
export function IntroReveal({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'idle' | 'logo' | 'reveal' | 'done'>('idle');
  const radius = useMotionValue(0);
  const blur = useMotionValue(0);
  const mask = useMotionTemplate`radial-gradient(circle at 50% 50%, #000 ${radius}%, transparent calc(${radius}% + 12%))`;
  const filter = useMotionTemplate`blur(${blur}px)`;

  useEffect(() => {
    let pending = false;
    try { pending = sessionStorage.getItem('sp-intro') === 'pending'; } catch { /* sem storage */ }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!pending || reduce) { setPhase('done'); return; }
    try { sessionStorage.removeItem('sp-intro'); } catch { /* sem storage */ }
    blur.set(18);
    setPhase('logo');
    const t1 = setTimeout(() => {
      setPhase('reveal');
      animate(radius, 160, { duration: 1.25, ease: [0.65, 0, 0.35, 1] });
      animate(blur, 0, { duration: 1.1, ease: [0.4, 0, 0.2, 1], delay: 0.15 });
    }, 1000);
    const t2 = setTimeout(() => setPhase('done'), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [radius, blur]);

  const active = phase === 'logo' || phase === 'reveal';
  return (
    <>
      <motion.div
        style={active ? { maskImage: mask, WebkitMaskImage: mask, filter } : undefined}
        initial={false}
        animate={{ scale: phase === 'logo' ? 1.06 : 1 }}
        transition={{ duration: phase === 'reveal' ? 1.3 : 0, ease: [0.65, 0, 0.35, 1] }}
        className="min-h-screen"
      >
        {children}
      </motion.div>
      <AnimatePresence>
        {active && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[80] grid place-items-center"
            style={{ background: phase === 'logo' ? 'var(--bg)' : 'transparent' }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8, filter: 'blur(10px)' }}
              animate={phase === 'logo' ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, scale: 1.25, filter: 'blur(8px)' }}
              transition={{ duration: phase === 'logo' ? 0.7 : 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-col items-center gap-3"
            >
              <LogoMark className="size-14 drop-shadow-[0_0_40px_var(--brand-glow)]" />
              <span className="font-brand text-sm font-bold tracking-[0.42em] text-fg/85">SUPERPONTO</span>
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ delay: 0.35 }} className="text-[9px] font-semibold tracking-[0.5em] text-muted">GESTÃO DE PONTO · V2</motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
