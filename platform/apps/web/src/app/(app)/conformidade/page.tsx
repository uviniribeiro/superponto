'use client';

import { CircleCheck, CircleDashed, Clock4, Building, Hammer } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { Card, CountUp } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DISCLAIMER, GROUPS, LAST_REVIEW, STATUS_LABEL, summary, type Status } from '@/content/conformidade';

const STYLE: Record<Status, { icon: React.ElementType; cls: string }> = {
  feito: { icon: CircleCheck, cls: 'bg-success/15 text-success' },
  andamento: { icon: Hammer, cls: 'bg-brand-soft text-brand' },
  planejado: { icon: CircleDashed, cls: 'bg-hover text-muted' },
  cliente: { icon: Building, cls: 'bg-sky-500/15 text-sky-400' },
  fornecedor: { icon: Clock4, cls: 'bg-orange-500/15 text-orange-400' },
};

const FILTERS: Array<Status | 'todos'> = ['todos', 'feito', 'andamento', 'planejado', 'fornecedor', 'cliente'];

export default function CompliancePage() {
  const [filter, setFilter] = useState<Status | 'todos'>('todos');
  const s = summary();
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => filter === 'todos' || i.status === filter) })).filter((g) => g.items.length);

  return (
    <Page>
      <PageHeader title="Conformidade MTE" description={`Exigências legais do registro de ponto e o que o SuperPonto já atende · revisado em ${LAST_REVIEW}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([['feito', s.feito], ['andamento', s.andamento], ['planejado', s.planejado], ['fornecedor', s.fornecedor + s.cliente]] as const).map(([k, v], i) => {
          const Icon = STYLE[k].icon;
          return (
            <Card key={k} delay={i * 0.05} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-subtle">{k === 'fornecedor' ? 'Ações fora do software' : STATUS_LABEL[k]}</span>
                <span className={cn('grid size-9 place-items-center rounded-xl', STYLE[k].cls)}><Icon className="size-4" /></span>
              </div>
              <div className="mt-3 font-display text-4xl font-bold"><CountUp value={v} /></div>
              <p className="mt-1 text-xs text-muted">de {s.total} exigências</p>
            </Card>
          );
        })}
      </div>

      <p className="mt-4 rounded-2xl border border-line bg-hover px-4 py-3 text-xs leading-relaxed text-muted">{DISCLAIMER}</p>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por situação">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn('relative rounded-full px-3.5 py-1.5 text-sm transition-colors', filter === f ? 'text-brand-fg' : 'text-muted hover:text-fg')}>
            {filter === f && <motion.span layoutId="cf-filter" className="absolute inset-0 rounded-full bg-brand" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{f === 'todos' ? 'Todas' : STATUS_LABEL[f]}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        <AnimatePresence mode="popLayout">
          {groups.map((g) => (
            <motion.section key={g.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-labelledby={`g-${g.id}`}>
              <h2 id={`g-${g.id}`} className="font-display text-lg font-bold">{g.title}</h2>
              <p className="mb-3 text-sm text-muted">{g.intro}</p>
              <div className="grid gap-3 xl:grid-cols-2">
                {g.items.map((item) => {
                  const st = STYLE[item.status];
                  const Icon = st.icon;
                  return (
                    <motion.article key={item.id} layout className="glass rounded-[22px] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold">{item.title}</h3>
                        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs', st.cls)}><Icon className="size-3.5" />{STATUS_LABEL[item.status]}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{item.rule}</p>
                      <p className="mt-2 text-xs text-subtle">Base legal: {item.basis}</p>
                      <div className="mt-3 border-t border-line pt-3 text-sm"><span className="font-semibold text-brand">No SuperPonto: </span><span className="text-muted">{item.howWe}</span></div>
                    </motion.article>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>
    </Page>
  );
}
