'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Building2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { CompanyActions } from '@/components/company-actions';
import { Page, PageHeader } from '@/components/page';
import { useActiveTenant } from '@/components/tenant-picker';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick } from '@/lib/schedules';

type State = 'WORKING' | 'ON_BREAK' | 'LEFT' | 'NOT_YET' | 'LATE_NOW' | 'ABSENT' | 'OFF' | 'LEAVE' | 'NO_SCHEDULE';
interface Live { date: string; time: string; totals: Record<State, number>; rows: Array<{ employmentId: string; registration: string; name: string; state: State; label: string; lastPunch: string | null; punches: string[]; expectedStart: string | null; expectedEnd: string | null; lateMinutes: number }> }

const ORDER: Array<[State, string, string]> = [
  ['LATE_NOW', 'Atrasados agora', 'bg-danger'], ['WORKING', 'Trabalhando', 'bg-success'], ['ON_BREAK', 'Em intervalo', 'bg-warning'], ['NOT_YET', 'Ainda vão entrar', 'bg-[#60a5fa]'],
  ['LEFT', 'Já saíram', 'bg-subtle'], ['ABSENT', 'Não vieram', 'bg-danger/60'], ['LEAVE', 'Afastados/abonados', 'bg-[#a78bfa]'], ['OFF', 'Folga', 'bg-line-strong'], ['NO_SCHEDULE', 'Sem jornada', 'bg-[#fb923c]'],
];

export default function AoVivoPage() {
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const [filter, setFilter] = useState<State | ''>('');
  const live = useQuery({ queryKey: ['live', tenantId, companyId], queryFn: () => api<Live>(`/live?companyId=${companyId}`), enabled: !!companyId, refetchInterval: 30_000 });
  const rows = (live.data?.rows ?? []).filter((r) => !filter || r.state === filter).sort((a, b) => ORDER.findIndex((o) => o[0] === a.state) - ORDER.findIndex((o) => o[0] === b.state) || a.name.localeCompare(b.name));

  return (
    <Page>
      <PageHeader title="Painel ao vivo" description="Quem está trabalhando, em intervalo, atrasado ou ainda vai entrar agora. Atualiza sozinho a cada 30 segundos." actions={<CompanyActions {...{ isPlatform, tenantId, pickTenant, companies, companyId, setCompanyId }} />} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="O painel mostra os funcionários de uma empresa." /></Card> : !live.data ? <Skeleton className="h-96 rounded-[28px]" /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-muted"><RefreshCw className={cn('size-3.5', live.isFetching && 'animate-spin')} />{live.data.date.split('-').reverse().join('/')} às {live.data.time}</span>
            <button onClick={() => setFilter('')} className={cn('rounded-full border px-3 py-1.5 text-sm', !filter ? 'border-brand/50 bg-brand-soft' : 'border-line text-muted')}>Todos ({live.data.rows.length})</button>
            {ORDER.filter(([k]) => live.data!.totals[k]).map(([k, label, dot]) => (
              <button key={k} onClick={() => setFilter(filter === k ? '' : k)} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm', filter === k ? 'border-brand/50 bg-brand-soft' : 'border-line text-muted hover:text-fg')}>
                <span className={cn('size-2 rounded-full', dot)} />{label} <b className="text-fg">{live.data!.totals[k]}</b>
              </button>
            ))}
          </div>
          {!rows.length ? <Card><EmptyState icon={Activity} title="Ninguém nesta situação" body="Troque o filtro ou a empresa." /></Card> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((r, i) => {
                const o = ORDER.find((x) => x[0] === r.state)!;
                return (
                  <motion.div key={r.employmentId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.02 }}>
                    <Card className="flex items-start gap-3 rounded-[22px] p-4">
                      <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', o[2], r.state === 'WORKING' && 'animate-pulse')} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.name}</p>
                        <p className="text-xs text-subtle">Mat. {r.registration}{r.expectedStart ? ` · previsto ${r.expectedStart}–${r.expectedEnd}` : ''}</p>
                        <p className={cn('mt-1 text-sm', r.state === 'LATE_NOW' ? 'text-danger' : 'text-muted')}>{r.label}{r.state === 'LATE_NOW' ? ` há ${Math.floor(r.lateMinutes / 60) ? `${Math.floor(r.lateMinutes / 60)}h` : ''}${r.lateMinutes % 60}min` : ''}</p>
                        {!!r.punches.length && <p className="mt-1 font-mono text-xs text-subtle">{r.punches.join(' · ')}</p>}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
