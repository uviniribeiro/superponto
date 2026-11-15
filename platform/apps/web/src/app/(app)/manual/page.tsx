'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MANUAL_VERSION, SECTIONS } from '@/content/manual';

export default function ManualPage() {
  const [active, setActive] = useState(SECTIONS[0]!.id);

  // Destaca no índice a seção visível.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  return (
    <Page>
      <PageHeader title="Manual do sistema" description={MANUAL_VERSION} />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Índice do manual" className="hidden lg:block">
          <ul className="glass sticky top-6 space-y-0.5 rounded-[24px] p-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={cn('relative block rounded-xl px-3 py-2 text-sm transition-colors', active === s.id ? 'text-fg' : 'text-muted hover:text-fg')}>
                  {active === s.id && <motion.span layoutId="manual-pill" className="absolute inset-0 rounded-xl bg-brand-soft" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <span className="relative">{s.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-4">
          {SECTIONS.map((s, i) => (
            <Card key={s.id} delay={Math.min(i, 6) * 0.04} className="scroll-mt-6 p-6 md:p-8">
              <section id={s.id} aria-labelledby={`${s.id}-t`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`${s.id}-t`} className="font-display text-xl font-bold">{s.title}</h2>
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-subtle">{s.audience}</span>
                </div>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted">
                  {s.body.map((p) => <p key={p}>{p}</p>)}
                </div>
                {s.steps && (
                  <ol className="mt-5 space-y-2.5">
                    {s.steps.map((step, n) => (
                      <li key={step} className="flex gap-3 text-[15px]">
                        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand text-xs font-bold text-brand-fg">{n + 1}</span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {s.tips && (
                  <div className="mt-5 rounded-2xl border border-brand/25 bg-brand-soft/50 p-4 text-sm">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">Dica</p>
                    {s.tips.map((t) => <p key={t} className="text-muted">{t}</p>)}
                  </div>
                )}
              </section>
            </Card>
          ))}
        </div>
      </div>
    </Page>
  );
}
