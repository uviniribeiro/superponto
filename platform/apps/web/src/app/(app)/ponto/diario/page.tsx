'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarCheck2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick } from '@/lib/schedules';
import { addDays, FLAG_LABEL, hhmm, todayBr, type MirrorDay } from '@/lib/timesheet';

interface Daily { date: string; totals: Record<string, number>; rows: Array<{ employmentId: string; registration: string; name: string; situation: string; day: MirrorDay }> }
const SIT: Record<string, [string, string]> = {
  PRESENT: ['Presente', 'bg-success/15 text-success'], LATE: ['Atrasado', 'bg-warning/15 text-warning'], ABSENT: ['Falta', 'bg-danger/15 text-danger'],
  INCOMPLETE: ['Marcação ímpar', 'bg-danger/15 text-danger'], OFF: ['Folga', 'bg-hover text-muted'], LEAVE: ['Afastado', 'bg-sky-500/15 text-sky-300'],
  ALLOWANCE: ['Abonado', 'bg-sky-500/15 text-sky-300'], EXPECTED: ['Ainda não marcou', 'bg-brand-soft'],
};

export default function DiarioPage() {
  const { tenantId, select, isPlatform } = useActiveTenant();
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const [date, setDate] = useState('');
  useEffect(() => setDate(todayBr()), []);
  const daily = useQuery({ queryKey: ['daily', tenantId, companyId, date], queryFn: () => api<Daily>(`/timesheet/daily?companyId=${companyId}&date=${date}`), enabled: !!companyId && !!date, placeholderData: (p) => p });
  const d = daily.data;
  return (
    <Page>
      <PageHeader title="Espelho diário" description="Como está a equipe no dia: quem marcou, quem atrasou, faltou, está de folga ou afastado." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {companies.length > 1 && <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="glass h-10 max-w-xs rounded-full px-4 text-sm [&>option]:bg-elevated">{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select>}
        <div className="glass flex h-10 items-center gap-1 rounded-full px-1">
          <button className="h-8 rounded-full px-3 text-sm text-muted hover:text-fg" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">‹</button>
          <input type="date" aria-label="Dia" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-transparent text-sm outline-none" />
          <button className="h-8 rounded-full px-3 text-sm text-muted hover:text-fg" onClick={() => setDate(addDays(date, 1))} aria-label="Próximo dia">›</button>
        </div>
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="O espelho diário é por empresa." /></Card>
        : !d ? <Skeleton className="h-96 rounded-[28px]" />
        : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              {[['Presentes', d.totals.present, 'hero-brand-soft'], ['Atrasados', d.totals.late], ['Faltas', d.totals.absent], ['Marcação ímpar', d.totals.incomplete], ['Ainda não marcaram', d.totals.expected], ['Folga', d.totals.off], ['Afastados/abonados', d.totals.leave]].map(([k, v, cls], i) => (
                <motion.div key={k as string} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }} className={cn('rounded-[20px] p-4', (cls as string) ?? 'glass')}>
                  <div className={cn('text-xs', cls ? 'opacity-70' : 'text-muted')}>{k}</div><div className="text-3xl font-semibold">{v as number}</div>
                </motion.div>
              ))}
            </div>
            <Card className="overflow-hidden rounded-[28px] p-0">
              {!d.rows.length ? <EmptyState icon={CalendarCheck2} title="Nenhum funcionário" body="Não há vínculos ativos nesta empresa no dia." /> : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted"><tr><th className="px-4 py-2">Funcionário</th><th className="px-2">Previsto</th><th className="px-2">Marcações</th><th className="px-2 text-right">Saldo</th><th className="px-4">Situação</th></tr></thead>
                  <tbody>
                    {d.rows.map((r) => {
                      const [label, cls] = SIT[r.situation] ?? [r.situation, 'bg-hover'];
                      const e = r.day.expected;
                      return (
                        <tr key={r.employmentId} className="border-t border-line">
                          <td className="px-4 py-2"><div className="font-medium">{r.name}</div><div className="text-xs text-subtle">Matrícula {r.registration}</div></td>
                          <td className="px-2 font-mono text-xs">{e.isWorkday ? (e.start ? `${e.start}–${e.end}` : hhmm(e.expectedMinutes)) : e.isHoliday ? 'feriado' : 'folga'}</td>
                          <td className="px-2"><div className="flex flex-wrap gap-1">{r.day.punches.map((p) => <span key={p.id} className={cn('rounded-md bg-hover px-1.5 py-0.5 font-mono text-xs', p.status === 'DISREGARDED' && 'line-through opacity-50')}>{p.time}</span>)}</div></td>
                          <td className={cn('px-2 text-right font-mono text-xs', (r.day.result?.balanceMinutes ?? 0) < 0 && 'text-danger', (r.day.result?.balanceMinutes ?? 0) > 0 && 'text-success')}>{r.day.result?.balanceMinutes ? hhmm(r.day.result.balanceMinutes, true) : ''}</td>
                          <td className="px-4"><span className={cn('rounded-full px-2.5 py-1 text-xs', cls)} title={r.day.result?.flags.map((f) => FLAG_LABEL[f] ?? f).join(', ')}>{label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        )}
    </Page>
  );
}
