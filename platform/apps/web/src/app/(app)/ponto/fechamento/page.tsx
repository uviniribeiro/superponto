'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Calculator, FileDown, Lock, LockOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick } from '@/lib/schedules';
import { downloadText } from '@/lib/download';
import { hhmm, monthRange, todayBr } from '@/lib/timesheet';

interface Closing { id: string; periodStart: string; periodEnd: string; status: 'OPEN' | 'CLOSED' | 'REOPENED'; closedAt: string | null; reopenReason: string | null }
const dmy = (v: string) => v.split('-').reverse().join('/');

export default function FechamentoPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = can(me, 'time.closings:manage');
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [reopening, setReopening] = useState<Closing | null>(null);
  const [reason, setReason] = useState('');
  const [calcResult, setCalcResult] = useState<{ employments: number; days: number; pendingAdjustments: number; incompleteDays: number; unauthorizedOvertimeMinutes: number } | null>(null);
  useEffect(() => { const d = new Date(`${todayBr()}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); setPeriod(monthRange(d.toISOString().slice(0, 10))); }, []);
  const list = useQuery({ queryKey: ['closings', tenantId, companyId], queryFn: () => api<Closing[]>(`/closings?companyId=${companyId}`), enabled: !!companyId });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['closings'] }); qc.invalidateQueries({ queryKey: ['mirror'] }); };
  const calc = useMutation({ mutationFn: () => api<NonNullable<typeof calcResult>>('/timesheet/calculate', { method: 'POST', json: { companyId, from: period.from, to: period.to } }), onSuccess: (r) => { setCalcResult(r); toast('success', `Apuração gravada: ${r.days} dia(s) de ${r.employments} funcionário(s)`); }, onError: (e: Error) => toast('error', e.message) });
  const close = useMutation({ mutationFn: () => api<{ bankEntries: number; employments: number }>('/closings', { method: 'POST', json: { companyId, periodStart: period.from, periodEnd: period.to } }), onSuccess: (r) => { refresh(); toast('success', `Período fechado: ${r.employments} funcionário(s), ${r.bankEntries} lançamento(s) no banco de horas`); }, onError: (e: Error) => toast('error', e.message) });
  const aej = useMutation({ mutationFn: () => api<{ filename: string; content: string; totals: { marcacoes: number; vinculos: number }; warnings: string[] }>(`/timesheet/aej?companyId=${companyId}&from=${period.from}&to=${period.to}`), onSuccess: (r) => { downloadText(r.filename, r.content); toast('success', `AEJ gerado: ${r.totals.vinculos} vínculo(s), ${r.totals.marcacoes} marcação(ões)`); if (r.warnings.length) setAejWarnings(r.warnings); }, onError: (e: Error) => toast('error', e.message) });
  const [aejWarnings, setAejWarnings] = useState<string[]>([]);
  const reopen = useMutation({ mutationFn: () => api(`/closings/${reopening!.id}/reopen`, { method: 'POST', json: { reason } }), onSuccess: () => { refresh(); setReopening(null); setReason(''); toast('success', 'Período reaberto; os lançamentos do banco desse fechamento foram desfeitos'); }, onError: (e: Error) => toast('error', e.message) });
  const rows = list.data ?? [];
  return (
    <Page>
      <PageHeader title="Fechamento do ponto" description="Calcule e confira; ao fechar, a apuração fica gravada, o banco de horas recebe créditos e débitos e o período não aceita mais alterações." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {companies.length > 1 && <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="glass h-10 max-w-xs rounded-full px-4 text-sm [&>option]:bg-elevated">{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select>}
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="O fechamento é por empresa." /></Card> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <Card className="space-y-4 rounded-[28px]">
            <h2 className="text-lg font-semibold">Período</h2>
            <div className="grid grid-cols-2 gap-3">
              <Input label="De" type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
              <Input label="Até" type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
            </div>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => calc.mutate()} loading={calc.isPending} disabled={!companyId}><Calculator className="size-4" />Calcular</Button>
                <Button onClick={() => close.mutate()} loading={close.isPending} disabled={!companyId}><Lock className="size-4" />Fechar período</Button>
                {can(me, 'reports.reports:export') && <Button variant="outline" onClick={() => aej.mutate()} loading={aej.isPending} disabled={!companyId}><FileDown className="size-4" />Gerar AEJ</Button>}
              </div>
            ) : <p className="text-sm text-subtle">Você pode ver os fechamentos, mas não fechar ou reabrir.</p>}
            {!!aejWarnings.length && <div className="space-y-1 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs">{aejWarnings.map((w) => <p key={w}>{w}</p>)}<p className="text-muted">Confira o arquivo no validador do MTE e assine (CAdES, certificado ICP-Brasil da empresa) antes de entregar.</p></div>}
            {calcResult && (
              <div className="space-y-1 rounded-2xl bg-hover p-3 text-sm">
                <p><strong>{calcResult.days}</strong> dia(s) calculados de <strong>{calcResult.employments}</strong> funcionário(s).</p>
                {calcResult.pendingAdjustments > 0 && <p className="text-warning">{calcResult.pendingAdjustments} ajuste(s) pendente(s): resolva antes de fechar.</p>}
                {calcResult.incompleteDays > 0 && <p className="text-danger">{calcResult.incompleteDays} dia(s) com marcação ímpar.</p>}
                {calcResult.unauthorizedOvertimeMinutes > 0 && <p className="text-warning">{hhmm(calcResult.unauthorizedOvertimeMinutes)} de extra sem autorização.</p>}
              </div>
            )}
          </Card>
          <Card delay={0.05} className="overflow-hidden rounded-[28px] p-0">
            <h2 className="border-b border-line px-5 py-3 font-semibold">Histórico</h2>
            {list.isLoading ? <div className="p-5"><Skeleton className="h-24" /></div> : !rows.length ? <EmptyState icon={Lock} title="Nenhum fechamento" body="Os períodos fechados aparecem aqui." /> : (
              <ul className="divide-y divide-line">
                {rows.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={cn('grid size-9 place-items-center rounded-xl', c.status === 'CLOSED' ? 'bg-brand text-brand-fg' : 'bg-hover text-muted')}>{c.status === 'CLOSED' ? <Lock className="size-4" /> : <LockOpen className="size-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{dmy(c.periodStart)} a {dmy(c.periodEnd)}</p>
                      <p className="text-xs text-muted">{c.status === 'CLOSED' ? `Fechado${c.closedAt ? ` em ${new Date(c.closedAt).toLocaleString('pt-BR')}` : ''}` : `Reaberto: ${c.reopenReason ?? ''}`}</p>
                    </div>
                    {canManage && c.status === 'CLOSED' && <Button variant="ghost" className="h-9" onClick={() => setReopening(c)}><LockOpen className="size-4" />Reabrir</Button>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      <Sheet open={!!reopening} onClose={() => setReopening(null)} title="Reabrir período">
        {reopening && (
          <form onSubmit={(e) => { e.preventDefault(); reopen.mutate(); }} className="space-y-4 text-sm">
            <p className="text-muted">Reabrir {dmy(reopening.periodStart)} a {dmy(reopening.periodEnd)} desfaz os lançamentos do banco de horas deste fechamento e libera ajustes. Fica registrado na auditoria.</p>
            <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} />
            <Button type="submit" loading={reopen.isPending} className="h-12 w-full">Reabrir</Button>
          </form>
        )}
      </Sheet>
    </Page>
  );
}
