'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Eraser, PiggyBank, Plus, Search, Settings2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick } from '@/lib/schedules';
import { hhmm, todayBr } from '@/lib/timesheet';

interface Balance { employmentId: string; registration: string; status: string; name: string; balanceMinutes: number }
interface Policy { enabled: boolean; expirationDays: number | null; maxDailyCreditMinutes: number | null; creditMultipliers: Record<string, number>; configured?: boolean }
interface Statement { employment: { name: string; registration: string }; balanceMinutes: number; nextExpiration: { minutes: number; expiresOn: string } | null; transactions: Array<{ id: string; type: string; minutes: number; refDate: string; expiresOn: string | null; description: string | null; balanceAfter: number }> }
const TYPE: Record<string, string> = { CREDIT: 'Crédito', DEBIT: 'Débito', EXPIRATION: 'Vencimento', ADJUSTMENT: 'Ajuste', PAYOUT: 'Pagamento', COMPENSATION: 'Compensação' };
const dmy = (v: string) => v.split('-').reverse().join('/');
const parseHm = (v: string) => { const m = v.trim().match(/^(-)?(\d{1,4})(?::(\d{2}))?$/); if (!m) return NaN; const t = Number(m[2]) * 60 + Number(m[3] ?? 0); return m[1] ? -t : t; };

function PolicyForm({ companyId, policy, onDone }: { companyId: string; policy: Policy; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ enabled: policy.enabled, expirationDays: policy.expirationDays ? String(policy.expirationDays) : '', maxDaily: policy.maxDailyCreditMinutes ? String(policy.maxDailyCreditMinutes) : '', m50: String(policy.creditMultipliers['50'] ?? ''), m100: String(policy.creditMultipliers['100'] ?? '') });
  const save = useMutation({
    mutationFn: () => api('/bank/policy', { method: 'PUT', json: {
      companyId, enabled: f.enabled, expirationDays: f.expirationDays ? Number(f.expirationDays) : null, maxDailyCreditMinutes: f.maxDaily ? Number(f.maxDaily) : null,
      creditMultipliers: Object.fromEntries([['50', f.m50], ['100', f.m100]].filter(([, v]) => v).map(([k, v]) => [k, Number(String(v).replace(',', '.'))])),
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-policy'] }); toast('success', 'Regras do banco salvas'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4 text-sm">
      <label className="flex items-center justify-between rounded-2xl border border-line px-4 py-3"><span><span className="block">Banco de horas ativo</span><span className="block text-xs text-subtle">No fechamento, o saldo de cada dia vira crédito ou débito</span></span><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} className="size-4 accent-[var(--brand)]" /></label>
      <Input label="Créditos vencem em (dias)" inputMode="numeric" value={f.expirationDays} onChange={(e) => setF({ ...f, expirationDays: e.target.value.replace(/\D/g, '') })} hint="Acordo individual: até 6 meses (180 dias); convenção coletiva: até 1 ano (CLT art. 59). Vazio = não vence" />
      <Input label="Crédito máximo por dia (min)" inputMode="numeric" value={f.maxDaily} onChange={(e) => setF({ ...f, maxDaily: e.target.value.replace(/\D/g, '') })} hint="Vazio = sem limite" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Multiplicador da extra 50%" value={f.m50} onChange={(e) => setF({ ...f, m50: e.target.value })} placeholder="1" hint="Ex.: 1,5 = 1h extra vale 1h30 no banco" />
        <Input label="Multiplicador da extra 100%" value={f.m100} onChange={(e) => setF({ ...f, m100: e.target.value })} placeholder="1" />
      </div>
      <Button type="submit" loading={save.isPending} className="h-12 w-full">Salvar regras</Button>
    </form>
  );
}

function TxForm({ ids, names, onDone }: { ids: string[]; names: string; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ type: 'ADJUSTMENT', amount: '', refDate: todayBr(), description: '' });
  const minutes = parseHm(f.amount);
  const save = useMutation({
    mutationFn: () => api('/bank/transactions', { method: 'POST', json: { employmentIds: ids, type: f.type, minutes, refDate: f.refDate, description: f.description } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank'] }); toast('success', 'Lançamento registrado'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4 text-sm">
      <p className="text-muted">{names}</p>
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-line p-1">{([['ADJUSTMENT', 'Ajuste (+/−)'], ['PAYOUT', 'Pagamento em folha'], ['COMPENSATION', 'Folga compensada']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setF({ ...f, type: k })} className={cn('h-9 rounded-xl text-xs', f.type === k ? 'pill-light' : 'text-muted')}>{l}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Horas" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder={f.type === 'ADJUSTMENT' ? '-2:30 ou 4:00' : '8:00'} hint={Number.isNaN(minutes) ? 'Formato h:mm' : f.type === 'ADJUSTMENT' ? hhmm(minutes, true) : `−${hhmm(Math.abs(minutes))} do saldo`} className="font-mono" />
        <Input label="Data de referência" type="date" value={f.refDate} onChange={(e) => setF({ ...f, refDate: e.target.value })} />
      </div>
      <Input label="Descrição" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required minLength={3} placeholder="Ex.: pago na folha de março" />
      <Button type="submit" loading={save.isPending} disabled={Number.isNaN(minutes) || !minutes} className="h-12 w-full">Lançar</Button>
    </form>
  );
}

function ResetForm({ companyId, ids, onDone }: { companyId: string; ids: string[]; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ type: 'PAYOUT', only: 'POSITIVE', refDate: todayBr(), description: '' });
  const save = useMutation({
    mutationFn: () => api<{ zeroed: number; totalMinutes: number }>('/bank/reset', { method: 'POST', json: { companyId, employmentIds: ids.length ? ids : undefined, ...f } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['bank'] }); toast('success', `${r.zeroed} saldo(s) zerado(s), total ${hhmm(r.totalMinutes, true)}`); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4 text-sm">
      <p className="text-muted">{ids.length ? `${ids.length} funcionário(s) selecionado(s).` : 'Todos os funcionários da empresa.'} Cada saldo recebe um lançamento contrário e fica zerado; o histórico fica no extrato.</p>
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line p-1">{([['PAYOUT', 'Pagar saldo positivo'], ['ADJUSTMENT', 'Zerar (ajuste)']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setF({ ...f, type: k, only: k === 'PAYOUT' ? 'POSITIVE' : f.only })} className={cn('h-9 rounded-xl text-xs', f.type === k ? 'pill-light' : 'text-muted')}>{l}</button>)}</div>
      {f.type === 'ADJUSTMENT' && (
        <select aria-label="Quais saldos" value={f.only} onChange={(e) => setF({ ...f, only: e.target.value })} className="h-10 w-full rounded-2xl border border-line bg-hover px-3 [&>option]:bg-elevated"><option value="ALL">Positivos e negativos</option><option value="POSITIVE">Só positivos</option><option value="NEGATIVE">Só negativos</option></select>
      )}
      <Input label="Data de referência" type="date" value={f.refDate} onChange={(e) => setF({ ...f, refDate: e.target.value })} />
      <Input label="Descrição" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required minLength={3} placeholder="Ex.: pagamento do banco no fechamento semestral" />
      <Button type="submit" variant="danger" loading={save.isPending} className="h-12 w-full"><Eraser className="size-4" />Zerar saldos</Button>
    </form>
  );
}

function StatementView({ employmentId }: { employmentId: string }) {
  const s = useQuery({ queryKey: ['bank', 'statement', employmentId], queryFn: () => api<Statement>(`/bank/statement/${employmentId}`) });
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

export default function BancoPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const canManage = can(me, 'time.bank:manage');
  const canPolicy = can(me, 'time.compensation:manage');
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim().toLowerCase());
  const [selected, setSelected] = useState<string[]>([]);
  const [sheet, setSheet] = useState<null | 'policy' | 'tx' | 'reset' | { statement: string; name: string }>(null);
  const policy = useQuery({ queryKey: ['bank-policy', tenantId, companyId], queryFn: () => api<Policy>(`/bank/policy?companyId=${companyId}`), enabled: !!companyId });
  const balances = useQuery({ queryKey: ['bank', 'balances', tenantId, companyId], queryFn: () => api<Balance[]>(`/bank/balances?companyId=${companyId}`), enabled: !!companyId });
  const rows = useMemo(() => (balances.data ?? []).filter((b) => !q || b.name.toLowerCase().includes(q) || b.registration.includes(q)), [balances.data, q]);
  const pos = rows.filter((r) => r.balanceMinutes > 0).reduce((s, r) => s + r.balanceMinutes, 0);
  const neg = rows.filter((r) => r.balanceMinutes < 0).reduce((s, r) => s + r.balanceMinutes, 0);
  const names = (balances.data ?? []).filter((b) => selected.includes(b.employmentId)).map((b) => b.name).join(', ');

  return (
    <Page>
      <PageHeader title="Banco de horas" description="Saldos, extrato com vencimentos, lançamentos manuais e zerar em lote. Créditos e débitos entram no fechamento do ponto." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {companies.length > 1 && <select aria-label="Empresa" value={companyId} onChange={(e) => { setCompanyId(e.target.value); setSelected([]); }} className="glass h-10 max-w-xs rounded-full px-4 text-sm [&>option]:bg-elevated">{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select>}
        {canPolicy && <Button variant="outline" onClick={() => setSheet('policy')}><Settings2 className="size-4" />Regras</Button>}
        {canManage && <Button variant="outline" onClick={() => setSheet('reset')}><Eraser className="size-4" />Zerar em lote</Button>}
        {canManage && <Button onClick={() => setSheet('tx')} disabled={!selected.length}><Plus className="size-4" />Lançar</Button>}
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="O banco de horas é por empresa." /></Card> : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Situação', policy.data ? (policy.data.enabled ? `Ativo${policy.data.expirationDays ? ` · vence em ${policy.data.expirationDays} dias` : ' · sem vencimento'}` : 'Desativado') : '…'], ['Saldos positivos', hhmm(pos, true)], ['Saldos negativos', hhmm(neg, true)]].map(([k, v], i) => (
              <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} className={cn('rounded-[20px] p-4', i === 0 ? 'hero-brand-soft' : 'glass')}><div className={cn('text-xs', i === 0 ? 'opacity-70' : 'text-muted')}>{k}</div><div className="font-mono text-lg font-semibold">{v}</div></motion.div>
            ))}
          </div>
          <Card className="overflow-hidden rounded-[28px] p-0">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3"><Search className="size-4 text-subtle" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar funcionário…" aria-label="Buscar funcionário" className="h-9 flex-1 bg-transparent text-sm outline-none" />{!!selected.length && <span className="text-xs text-muted">{selected.length} selecionado(s)</span>}</div>
            {balances.isLoading ? <div className="p-5"><Skeleton className="h-32" /></div> : !rows.length ? <EmptyState icon={PiggyBank} title="Nenhum funcionário" body="Cadastre funcionários nesta empresa." /> : (
              <ul className="divide-y divide-line">
                {rows.map((b) => (
                  <li key={b.employmentId} className="flex items-center gap-3 px-5 py-2.5">
                    {canManage && <input type="checkbox" checked={selected.includes(b.employmentId)} onChange={() => setSelected((s) => (s.includes(b.employmentId) ? s.filter((x) => x !== b.employmentId) : [...s, b.employmentId]))} className="size-4 accent-[var(--brand)]" aria-label={`Selecionar ${b.name}`} />}
                    <button onClick={() => setSheet({ statement: b.employmentId, name: b.name })} className="min-w-0 flex-1 text-left"><span className="font-medium">{b.name}</span> <span className="text-xs text-subtle">· {b.registration}{b.status === 'TERMINATED' ? ' · desligado' : ''}</span></button>
                    <span className={cn('rounded-full px-3 py-1 font-mono text-sm font-semibold', b.balanceMinutes > 0 ? 'bg-success/15 text-success' : b.balanceMinutes < 0 ? 'bg-danger/15 text-danger' : 'bg-hover text-muted')}>{hhmm(b.balanceMinutes, true)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      <Sheet open={sheet === 'policy'} onClose={() => setSheet(null)} title="Regras do banco de horas">{sheet === 'policy' && policy.data && <PolicyForm companyId={companyId} policy={policy.data} onDone={() => setSheet(null)} />}</Sheet>
      <Sheet open={sheet === 'tx'} onClose={() => setSheet(null)} title="Lançamento no banco">{sheet === 'tx' && <TxForm ids={selected} names={names} onDone={() => { setSheet(null); setSelected([]); }} />}</Sheet>
      <Sheet open={sheet === 'reset'} onClose={() => setSheet(null)} title="Zerar em lote">{sheet === 'reset' && <ResetForm companyId={companyId} ids={selected} onDone={() => { setSheet(null); setSelected([]); }} />}</Sheet>
      <Sheet open={typeof sheet === 'object' && sheet !== null} onClose={() => setSheet(null)} title={typeof sheet === 'object' && sheet ? `Extrato · ${sheet.name}` : ''}>{typeof sheet === 'object' && sheet && <StatementView employmentId={sheet.statement} />}</Sheet>
    </Page>
  );
}
