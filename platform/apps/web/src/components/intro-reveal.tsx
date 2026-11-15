'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { LogoMark } from './logo';

/**
 * Abertura após o login: a marca aparece e o sistema é revelado por um círculo que se expande.
 * Roda uma vez por sessão; respeita "reduzir movimento".
 */
export function IntroReveal({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'idle' | 'logo' | 'reveal' | 'done'>('idle');

  useEffect(() => {
    let pending = false;
    try { pending = sessionStorage.getItem('sp-intro') === 'pending'; } catch { /* sem storage */ }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!pending || reduce) { setPhase('done'); return; }
    try { sessionStorage.removeItem('sp-intro'); } catch { /* sem storage */ }
    setPhase('logo');
    const t1 = setTimeout(() => setPhase('reveal'), 650);
    const t2 = setTimeout(() => setPhase('done'), 1650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <>
      <motion.div
        initial={false}
        animate={{
          clipPath: phase === 'logo' ? 'circle(0% at 50% 50%)' : 'circle(150% at 50% 50%)',
          scale: phase === 'logo' ? 1.04 : 1,
        }}
        transition={{ duration: phase === 'reveal' ? 1 : 0, ease: [0.65, 0, 0.35, 1] }}
        className="min-h-screen"
      >
        {children}
      </motion.div>
      <AnimatePresence>
        {(phase === 'logo' || phase === 'reveal') && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[80] grid place-items-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.7, filter: 'blur(8px)' }}
              animate={phase === 'logo' ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : { opacity: 0, scale: 1.6, filter: 'blur(6px)' }}
              transition={{ duration: phase === 'logo' ? 0.5 : 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex flex-col items-center gap-3"
            >
              <LogoMark className="size-16 drop-shadow-[0_0_40px_var(--brand-glow)]" />
              <span className="font-display text-sm font-bold tracking-[0.3em] text-muted">SUPERPONTO</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
