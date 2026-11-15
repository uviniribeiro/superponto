'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { hhmm, todayBr } from '@/lib/timesheet';

interface Statement { employment: { name: string; registration: string }; balanceMinutes: number; nextExpiration: { minutes: number; expiresOn: string } | null; transactions: Array<{ id: string; type: string; minutes: number; refDate: string; expiresOn: string | null; description: string | null; balanceAfter: number }> }
interface Compensation { enabled: boolean; period: string; leftover: string; periods: Array<{ key: string; from: string; to: string; positive: number; negative: number; net: number; toBank: number; toPay: number }> }
const TYPE: Record<string, string> = { CREDIT: 'Crédito', DEBIT: 'Débito', EXPIRATION: 'Vencimento', ADJUSTMENT: 'Ajuste', PAYOUT: 'Pagamento', COMPENSATION: 'Compensação' };
const dmy = (v: string) => v.split('-').reverse().join('/');

function CompensationView({ employmentId }: { employmentId: string }) {
  const [range, setRange] = useState(() => { const t = todayBr(); const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 56); return { from: d.toISOString().slice(0, 10), to: t }; });
  const c = useQuery({ queryKey: ['bank', 'comp', employmentId, range], queryFn: () => api<Compensation>(`/bank/compensation/${employmentId}?from=${range.from}&to=${range.to}`) });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs"><input type="date" aria-label="De" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-8 rounded-lg border border-line bg-hover px-2" />até<input type="date" aria-label="Até" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-8 rounded-lg border border-line bg-hover px-2" /></div>
      {!c.data ? <Skeleton className="h-24" /> : !c.data.enabled ? <p className="text-xs text-subtle">Banco de compensação desativado nas regras (a prévia abaixo usa {c.data.period === 'MONTH' ? 'mês' : 'semana'}).</p> : null}
      {c.data && (
        <ul className="divide-y divide-line rounded-2xl border border-line text-xs">
          {c.data.periods.map((p) => (
            <li key={p.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2">
              <span>{c.data!.period === 'MONTH' ? p.key.split('-').reverse().join('/') : `Semana de ${dmy(p.key)}`}</span>
              <span className="font-mono text-success">{hhmm(p.positive, true)}</span>
              <span className="font-mono text-danger">{hhmm(p.negative, true)}</span>
              <span className="font-mono font-semibold">{hhmm(p.net, true)}{p.toPay ? ' · pagar' : ''}</span>
            </li>
          ))}
          {!c.data.periods.length && <li className="px-3 py-3 text-subtle">Sem dias apurados no período.</li>}
        </ul>
      )}
    </div>
  );
}

export function StatementView({ employmentId }: { employmentId: string }) {
  const [tab, setTab] = useState<'bh' | 'bc'>('bh');
  if (tab === 'bc') return <div className="space-y-3"><Tabs tab={tab} setTab={setTab} /><CompensationView employmentId={employmentId} /></div>;
  return <div className="space-y-3"><Tabs tab={tab} setTab={setTab} /><BankStatement employmentId={employmentId} /></div>;
}

function Tabs({ tab, setTab }: { tab: 'bh' | 'bc'; setTab: (t: 'bh' | 'bc') => void }) {
  return <div className="flex w-fit rounded-full border border-line p-0.5 text-xs">{([['bh', 'Banco de horas'], ['bc', 'Compensação']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn('h-8 rounded-full px-3', tab === k ? 'pill-light' : 'text-muted')}>{l}</button>)}</div>;
}

export function BankStatement({ employmentId, mine }: { employmentId: string; mine?: boolean }) {
  const s = useQuery({ queryKey: ['bank', 'statement', employmentId], queryFn: () => api<Statement>(mine ? '/bank/me' : `/bank/statement/${employmentId}`) });
  if (!s.data) return <Skeleton className="h-60" />;
  const d = s.data;
  return (
    <div className="space-y-4 text-sm">
      <div className={cn('rounded-2xl p-4', d.balanceMinutes >= 0 ? 'hero-brand-soft' : 'border border-danger/40 bg-danger/10')}>
        <div className="text-xs opacity-70">Saldo atual</div><div className="font-mono text-3xl font-semibold">{hhmm(d.balanceMinutes, true)}</div>
        {d.nextExpiration && <div className="mt-1 text-xs opacity-75">{hhmm(d.nextExpiration.minutes)} vencem em {dmy(d.nextExpiration.expiresOn)}</div>}
      </div>
      {!d.transactions.length ? <p className="text-subtle">Sem lançamentos.</p> : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {d.transactions.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-12 font-mono text-xs text-muted">{dmy(t.refDate).slice(0, 5)}</span>
              <div className="min-w-0 flex-1"><p>{TYPE[t.type] ?? t.type}</p><p className="truncate text-xs text-subtle">{t.description}{t.expiresOn ? ` · vence ${dmy(t.expiresOn)}` : ''}</p></div>
              <span className={cn('font-mono text-xs font-semibold', t.minutes > 0 ? 'text-success' : 'text-danger')}>{hhmm(t.minutes, true)}</span>
              <span className="w-16 text-right font-mono text-xs text-muted">{hhmm(t.balanceAfter, true)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

