'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HeartPulse, Plus, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Employee, type Page as Paged, type Ref } from '@/lib/api';
import { cn } from '@/lib/cn';
import { addDays, LEAVE_TYPES, monthRange, todayBr } from '@/lib/timesheet';

type Tab = 'allowances' | 'leaves';
interface AllowanceRow { id: string; date: string; fullDay: boolean; minutes: number; note: string | null; justification: { name: string; disregardsDebits: boolean }; employment: { id: string; registration: string; name: string } }
interface LeaveRow { id: string; type: string; startDate: string; endDate: string; note: string | null; employment: { id: string; registration: string; name: string } }
const dmy = (v: string) => v.split('-').reverse().join('/');
const LEAVE = Object.fromEntries(LEAVE_TYPES);

function PickEmployees({ value, onChange, single }: { value: Array<{ id: string; name: string }>; onChange: (v: Array<{ id: string; name: string }>) => void; single?: boolean }) {
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const list = useQuery({ queryKey: ['employees', 'pick', q], queryFn: () => api<Paged<Employee>>(`/employees?pageSize=15${q ? `&search=${encodeURIComponent(q)}` : ''}`) });
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-subtle">{single ? 'Funcionário' : `Funcionários (${value.length})`}</span>
      {!!value.length && <div className="flex flex-wrap gap-1.5">{value.map((v) => <button type="button" key={v.id} onClick={() => onChange(value.filter((x) => x.id !== v.id))} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs">{v.name} ✕</button>)}</div>}
      {(!single || !value.length) && (
        <>
          <div className="flex items-center gap-2 rounded-2xl border border-line px-3"><Search className="size-4 text-subtle" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou matrícula…" aria-label="Buscar funcionário" className="h-10 flex-1 bg-transparent text-sm outline-none" /></div>
          <ul className="max-h-44 overflow-y-auto rounded-2xl border border-line">
            {(list.data?.data ?? []).filter((e) => !value.some((v) => v.id === e.id)).map((e) => (
              <li key={e.id}><button type="button" onClick={() => onChange(single ? [{ id: e.id, name: e.socialName ?? e.fullName }] : [...value, { id: e.id, name: e.socialName ?? e.fullName }])} className="w-full px-3 py-2 text-left text-sm hover:bg-hover">{e.socialName ?? e.fullName} <span className="text-xs text-subtle">· {e.registration}</span></button></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function AllowanceForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [emps, setEmps] = useState<Array<{ id: string; name: string }>>([]);
  const t = todayBr();
  const [f, setF] = useState({ from: t, to: t, justificationId: '', fullDay: true, minutes: '', onlyWorkdays: true, note: '' });
  const js = useQuery({ queryKey: ['justifications'], queryFn: () => api<Paged<Ref & { active: boolean; disregardsDebits: boolean; usageLimit: number | null; limitPeriod: string }>>('/justifications?pageSize=200') });
  const save = useMutation({
    mutationFn: () => api<{ created: number }>('/allowances', { method: 'POST', json: { employmentIds: emps.map((e) => e.id), from: f.from, to: f.to, justificationId: f.justificationId, fullDay: f.fullDay, onlyWorkdays: f.onlyWorkdays, note: f.note || undefined, ...(f.fullDay ? {} : { minutes: Number(f.minutes) }) } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['allowances'] }); qc.invalidateQueries({ queryKey: ['mirror'] }); toast('success', `${r.created} abono(s) lançado(s)`); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <PickEmployees value={emps} onChange={setEmps} />
      <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wider text-subtle">Justificativa</span>
        <select required value={f.justificationId} onChange={(e) => setF({ ...f, justificationId: e.target.value })} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm [&>option]:bg-elevated">
          <option value="">Escolha…</option>
          {(js.data?.data ?? []).filter((j) => j.active).map((j) => <option key={j.id} value={j.id}>{j.name}{j.disregardsDebits ? '' : ' (só justifica)'}{j.usageLimit ? ` · até ${j.usageLimit}/${j.limitPeriod === 'YEAR' ? 'ano' : 'mês'}` : ''}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Input label="De" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: f.to < e.target.value ? e.target.value : f.to })} />
        <Input label="Até" type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.fullDay} onChange={(e) => setF({ ...f, fullDay: e.target.checked })} className="accent-[var(--brand)]" />Dia inteiro</label>
        {!f.fullDay && <label className="flex items-center gap-2">Minutos <input aria-label="Minutos abonados" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value.replace(/\D/g, '') })} className="h-9 w-20 rounded-xl border border-line bg-hover px-2 text-center font-mono" /></label>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.onlyWorkdays} onChange={(e) => setF({ ...f, onlyWorkdays: e.target.checked })} className="accent-[var(--brand)]" />Só dias de trabalho</label>
      </div>
      <Input label="Observação" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} />
      <Button type="submit" loading={save.isPending} disabled={!emps.length || !f.justificationId} className="h-12 w-full">Lançar abono</Button>
    </form>
  );
}

function LeaveForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [emps, setEmps] = useState<Array<{ id: string; name: string }>>([]);
  const t = todayBr();
  const [f, setF] = useState({ type: 'MEDICAL', startDate: t, endDate: t, note: '' });
  const save = useMutation({
    mutationFn: () => api('/leaves', { method: 'POST', json: { employmentId: emps[0]!.id, ...f, note: f.note || undefined } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); qc.invalidateQueries({ queryKey: ['mirror'] }); toast('success', 'Afastamento registrado'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <PickEmployees value={emps} onChange={setEmps} single />
      <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wider text-subtle">Tipo</span>
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm [&>option]:bg-elevated">{LEAVE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Início" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} />
        <Input label="Fim" type="date" value={f.endDate} min={f.startDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
      </div>
      <Input label="Observação" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} hint="Não registre o CID ou diagnóstico: é dado sensível (LGPD)" />
      <Button type="submit" loading={save.isPending} disabled={!emps.length} className="h-12 w-full">Registrar afastamento</Button>
    </form>
  );
}

function OnCallForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [emps, setEmps] = useState<Array<{ id: string; name: string }>>([]);
  const [f, setF] = useState({ date: todayBr(), startTime: '18:00', endTime: '06:00', note: '' });
  const save = useMutation({
    mutationFn: () => api<{ created: number; minutes: number }>('/on-call', { method: 'POST', json: { employmentIds: emps.map((e) => e.id), ...f, note: f.note || undefined } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['mirror'] }); toast('success', `Sobreaviso de ${Math.round(r.minutes / 60)}h lançado para ${r.created} funcionário(s)`); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <p className="text-sm text-muted">Horas em que o funcionário fica à disposição fora do local de trabalho (CLT art. 244 §2º). Aparecem no espelho, pagas à razão de 1/3.</p>
      <PickEmployees value={emps} onChange={setEmps} />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Dia" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <Input label="Início" type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
        <Input label="Fim" type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
      </div>
      <Input label="Observação" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} />
      <Button type="submit" loading={save.isPending} disabled={!emps.length} className="h-12 w-full">Lançar sobreaviso</Button>
    </form>
  );
}

export default function AbonosPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = can(me, 'time.allowances:create');
  const [tab, setTab] = useState<Tab>('allowances');
  const [form, setForm] = useState<null | 'allowance' | 'leave' | 'oncall'>(null);
  const [range, setRange] = useState({ from: '', to: '' });
  useEffect(() => { const r = monthRange(todayBr()); setRange({ from: addDays(r.from, -31), to: r.to }); }, []);
  const ok = !!tenantId && !!range.from;
  const allowances = useQuery({ queryKey: ['allowances', tenantId, range], queryFn: () => api<AllowanceRow[]>(`/allowances?from=${range.from}&to=${range.to}`), enabled: ok && tab === 'allowances' });
  const leaves = useQuery({ queryKey: ['leaves', tenantId, range], queryFn: () => api<LeaveRow[]>(`/leaves?from=${range.from}&to=${range.to}`), enabled: ok && tab === 'leaves' });
  const remove = useMutation({
    mutationFn: (path: string) => api(path, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [tab] }); qc.invalidateQueries({ queryKey: ['mirror'] }); toast('success', 'Removido'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const rows = tab === 'allowances' ? allowances : leaves;
  return (
    <Page>
      <PageHeader title="Abonos e afastamentos" description="Abonos em lote (dia inteiro ou minutos), afastamentos como atestado e férias, e sobreaviso." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {canManage && <><Button variant="outline" onClick={() => setForm('oncall')}>Sobreaviso</Button><Button variant="outline" onClick={() => setForm('leave')}><HeartPulse className="size-4" />Afastamento</Button><Button onClick={() => setForm('allowance')}><Plus className="size-4" />Abono</Button></>}
      </>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-line p-0.5 text-sm">{([['allowances', 'Abonos'], ['leaves', 'Afastamentos']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn('h-9 rounded-full px-4', tab === k ? 'pill-light' : 'text-muted')}>{l}</button>)}</div>
        <input type="date" aria-label="De" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 rounded-xl border border-line bg-hover px-2 text-sm" />
        <span className="text-xs text-subtle">até</span>
        <input type="date" aria-label="Até" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 rounded-xl border border-line bg-hover px-2 text-sm" />
      </div>
      {rows.isLoading || !ok ? <Skeleton className="h-40 rounded-[28px]" /> : !(rows.data?.length) ? <Card><EmptyState icon={HeartPulse} title="Nada no período" body={tab === 'allowances' ? 'Nenhum abono lançado.' : 'Nenhum afastamento.'} /></Card> : (
        <Card className="overflow-hidden rounded-[28px] p-0">
          <ul className="divide-y divide-line">
            {tab === 'allowances' ? (allowances.data ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-24 font-mono text-sm">{dmy(a.date)}</span>
                <div className="min-w-0 flex-1"><p className="font-medium">{a.employment.name} <span className="text-xs text-subtle">· {a.employment.registration}</span></p><p className="text-xs text-muted">{a.justification.name} · {a.fullDay ? 'dia inteiro' : `${a.minutes} min`}{a.justification.disregardsDebits ? '' : ' · só justifica'}{a.note ? ` · ${a.note}` : ''}</p></div>
                {canManage && <Button variant="ghost" className="size-9 px-0 hover:text-danger" onClick={() => remove.mutate(`/allowances/${a.id}`)} aria-label="Remover abono"><Trash2 className="size-4" /></Button>}
              </li>
            )) : (leaves.data ?? []).map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-44 font-mono text-sm">{dmy(l.startDate)} – {dmy(l.endDate)}</span>
                <div className="min-w-0 flex-1"><p className="font-medium">{l.employment.name} <span className="text-xs text-subtle">· {l.employment.registration}</span></p><p className="text-xs text-muted">{LEAVE[l.type] ?? l.type}{l.note ? ` · ${l.note}` : ''}</p></div>
                {canManage && <Button variant="ghost" className="size-9 px-0 hover:text-danger" onClick={() => remove.mutate(`/leaves/${l.id}`)} aria-label="Remover afastamento"><Trash2 className="size-4" /></Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Sheet open={form === 'allowance'} onClose={() => setForm(null)} title="Lançar abono" wide>{form === 'allowance' && <AllowanceForm onDone={() => setForm(null)} />}</Sheet>
      <Sheet open={form === 'leave'} onClose={() => setForm(null)} title="Registrar afastamento">{form === 'leave' && <LeaveForm onDone={() => setForm(null)} />}</Sheet>
      <Sheet open={form === 'oncall'} onClose={() => setForm(null)} title="Lançar sobreaviso" wide>{form === 'oncall' && <OnCallForm onDone={() => setForm(null)} />}</Sheet>
    </Page>
  );
}
