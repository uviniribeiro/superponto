'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileClock, Lock, Plus, Printer, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useDeferredValue, useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Employee, type Page as Paged, type Ref } from '@/lib/api';
import { cn } from '@/lib/cn';
import { addDays, BAD_FLAGS, br, FLAG_LABEL, hhmm, monthRange, SOURCE_LABEL, todayBr, wd, type Mirror, type MirrorDay } from '@/lib/timesheet';

const PUNCH_CLS: Record<string, string> = {
  ORIGINAL: 'bg-hover', INCLUDED: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/40', DISREGARDED: 'line-through opacity-50',
  PENDING_INCLUDE: 'border border-dashed border-brand/60 text-brand', PENDING_DISREGARD: 'line-through decoration-brand',
};

function DayActions({ d, employmentId, canAdjust, canAllow, onDone }: { d: MirrorDay; employmentId: string; canAdjust: boolean; canAllow: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [time, setTime] = useState('');
  const [just, setJust] = useState('');
  const [allow, setAllow] = useState({ justificationId: '', fullDay: true, minutes: '' });
  const justifications = useQuery({ queryKey: ['justifications'], queryFn: () => api<Paged<Ref & { active: boolean; disregardsDebits: boolean; usageLimit: number | null }>>('/justifications?pageSize=200'), enabled: canAllow });
  const done = (msg: string) => { qc.invalidateQueries({ queryKey: ['mirror'] }); toast('success', msg); onDone(); };
  const include = useMutation({ mutationFn: () => api<{ status: string }>('/time-adjustments', { method: 'POST', json: { kind: 'INCLUDE', employmentId, date: d.date, time, justification: just } }), onSuccess: (a) => done(a.status === 'APPROVED' ? 'Marcação incluída' : 'Inclusão enviada para aprovação'), onError: (e: Error) => toast('error', e.message) });
  const disregard = useMutation({ mutationFn: (timeRecordId: string) => api<{ status: string }>('/time-adjustments', { method: 'POST', json: { kind: 'DISREGARD', employmentId, timeRecordId, justification: just } }), onSuccess: (a) => done(a.status === 'APPROVED' ? 'Marcação desconsiderada' : 'Pedido enviado para aprovação'), onError: (e: Error) => toast('error', e.message) });
  const cancel = useMutation({ mutationFn: (id: string) => api(`/time-adjustments/${id}`, { method: 'DELETE' }), onSuccess: () => done('Ajuste cancelado'), onError: (e: Error) => toast('error', e.message) });
  const abonar = useMutation({ mutationFn: () => api('/allowances', { method: 'POST', json: { employmentIds: [employmentId], from: d.date, to: d.date, justificationId: allow.justificationId, fullDay: allow.fullDay, onlyWorkdays: false, ...(allow.fullDay ? {} : { minutes: Number(allow.minutes) }) } }), onSuccess: () => done('Abono lançado'), onError: (e: Error) => toast('error', e.message) });
  const removeAllowance = useMutation({ mutationFn: () => api(`/allowances/${d.allowance!.id}`, { method: 'DELETE' }), onSuccess: () => done('Abono removido'), onError: (e: Error) => toast('error', e.message) });
  const r = d.result;
  return (
    <div className="space-y-5 text-sm">
      <div className="grid grid-cols-3 gap-2">
        {[['Previsto', hhmm(r?.expectedMinutes ?? d.expected.expectedMinutes)], ['Trabalhado', hhmm(r?.workedMinutes)], ['Saldo', hhmm(r?.balanceMinutes, true)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-hover p-3"><div className="text-xs text-muted">{k}</div><div className="font-mono text-lg font-semibold">{v}</div></div>
        ))}
      </div>
      {!!r?.flags.length && <div className="flex flex-wrap gap-1.5">{r.flags.map((f) => <span key={f} className={cn('rounded-full px-2.5 py-1 text-xs', BAD_FLAGS.has(f) ? 'bg-danger/15 text-danger' : 'bg-hover text-muted')}>{FLAG_LABEL[f] ?? f}</span>)}</div>}
      {r?.unauthorizedOvertimeMinutes ? <p className="text-xs text-warning">{hhmm(r.unauthorizedOvertimeMinutes)} de extra sem autorização prévia (continua sendo paga; confira).</p> : null}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">Marcações</h3>
        {d.punches.length ? d.punches.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2">
            <span className={cn('rounded-lg px-2 py-0.5 font-mono font-semibold', PUNCH_CLS[p.status])}>{p.time}</span>
            <span className="flex-1 text-xs text-muted">{SOURCE_LABEL[p.source] ?? p.source}{p.status !== 'ORIGINAL' && ` · ${({ INCLUDED: 'incluída', DISREGARDED: 'desconsiderada', PENDING_INCLUDE: 'inclusão pendente', PENDING_DISREGARD: 'desconsiderar pendente' } as Record<string, string>)[p.status]}`}{p.justification && ` · ${p.justification}`}</span>
            {!d.closed && canAdjust && p.status === 'ORIGINAL' && <Button variant="ghost" className="h-8 px-2 text-xs" disabled={just.trim().length < 5} onClick={() => disregard.mutate(p.id)} title={just.trim().length < 5 ? 'Escreva a justificativa abaixo' : ''}>Desconsiderar</Button>}
            {!d.closed && canAdjust && p.adjustmentId && p.status.startsWith('PENDING') && <Button variant="ghost" className="size-8 px-0" onClick={() => cancel.mutate(p.adjustmentId!)} aria-label="Cancelar ajuste"><X className="size-4" /></Button>}
          </div>
        )) : <p className="text-xs text-subtle">Sem marcações neste dia.</p>}
      </section>
      {d.closed ? <p className="flex items-center gap-2 rounded-2xl bg-hover p-3 text-xs text-muted"><Lock className="size-4" />Período fechado: reabra o fechamento para ajustar.</p> : (
        <>
          {canAdjust && (
            <section className="space-y-2 rounded-2xl border border-line p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">Incluir ou desconsiderar</h3>
              <Input label="Justificativa" value={just} onChange={(e) => setJust(e.target.value)} placeholder="Ex.: esqueceu de marcar a saída" hint="Obrigatória (mín. 5 caracteres); fica no histórico" />
              <div className="flex items-end gap-2">
                <Input label="Horário a incluir" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                <Button onClick={() => include.mutate()} loading={include.isPending} disabled={!time || just.trim().length < 5}><Plus className="size-4" />Incluir</Button>
              </div>
            </section>
          )}
          {canAllow && (
            <section className="space-y-2 rounded-2xl border border-line p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">Abono</h3>
              {d.allowance ? (
                <div className="flex items-center justify-between gap-2"><span>{d.allowance.justification} · {d.allowance.fullDay ? 'dia inteiro' : `${d.allowance.minutes} min`}{d.allowance.disregardsDebits ? '' : ' (sem abonar)'}</span><Button variant="ghost" className="h-8 px-2 text-xs hover:text-danger" onClick={() => removeAllowance.mutate()}>Remover</Button></div>
              ) : (
                <>
                  <select aria-label="Justificativa do abono" value={allow.justificationId} onChange={(e) => setAllow({ ...allow, justificationId: e.target.value })} className="h-10 w-full rounded-2xl border border-line bg-hover px-3 text-sm [&>option]:bg-elevated">
                    <option value="">Escolha a justificativa…</option>
                    {(justifications.data?.data ?? []).filter((j) => j.active).map((j) => <option key={j.id} value={j.id}>{j.name}{j.disregardsDebits ? '' : ' (só justifica)'}{j.usageLimit ? ` · limite ${j.usageLimit}` : ''}</option>)}
                  </select>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={allow.fullDay} onChange={(e) => setAllow({ ...allow, fullDay: e.target.checked })} className="accent-[var(--brand)]" />Dia inteiro</label>
                    {!allow.fullDay && <input aria-label="Minutos abonados" inputMode="numeric" placeholder="minutos" value={allow.minutes} onChange={(e) => setAllow({ ...allow, minutes: e.target.value.replace(/\D/g, '') })} className="h-9 w-24 rounded-xl border border-line bg-hover px-2 text-center font-mono text-xs" />}
                    <Button className="ml-auto h-9" onClick={() => abonar.mutate()} loading={abonar.isPending} disabled={!allow.justificationId || (!allow.fullDay && !allow.minutes)}>Abonar</Button>
                  </div>
                  {!justifications.data?.data.length && <p className="text-xs text-subtle">Cadastre justificativas em Ponto › Justificativas.</p>}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EmployeePicker({ value, onChange }: { value: { id: string; name: string } | null; onChange: (v: { id: string; name: string }) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const q = useDeferredValue(search.trim());
  const list = useQuery({ queryKey: ['employees', 'pick', q], queryFn: () => api<Paged<Employee>>(`/employees?pageSize=20&status=ALL${q ? `&search=${encodeURIComponent(q)}` : ''}`), enabled: open });
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="glass flex h-10 min-w-[240px] items-center gap-2 rounded-full px-4 text-sm"><Search className="size-4 text-subtle" />{value?.name ?? 'Escolha o funcionário…'}</button>
      {open && (
        <div className="glass-strong absolute right-0 z-30 mt-2 w-80 rounded-2xl p-2">
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, matrícula ou CPF…" aria-label="Buscar funcionário" className="h-9 w-full rounded-xl bg-hover px-3 text-sm outline-none" />
          <ul className="mt-2 max-h-72 overflow-y-auto">
            {(list.data?.data ?? []).map((e) => <li key={e.id}><button onClick={() => { onChange({ id: e.id, name: `${e.socialName ?? e.fullName} · ${e.registration}` }); setOpen(false); }} className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-hover">{e.socialName ?? e.fullName}<span className="ml-2 text-xs text-subtle">{e.registration} · {e.company.tradeName ?? e.company.legalName}</span></button></li>)}
            {list.data && !list.data.data.length && <li className="px-3 py-2 text-xs text-subtle">Nada encontrado</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function EspelhoPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const canTeam = can(me, 'time.calculations:read');
  const [emp, setEmp] = useState<{ id: string; name: string } | null>(null);
  const [month, setMonth] = useState('');
  const [open, setOpen] = useState<MirrorDay | null>(null);
  useEffect(() => setMonth(todayBr().slice(0, 7) + '-01'), []);
  const range = month ? monthRange(month) : null;
  const mirror = useQuery({
    queryKey: ['mirror', tenantId, emp?.id ?? 'me', range?.from],
    queryFn: () => api<Mirror>(canTeam ? `/timesheet?employmentId=${emp!.id}&from=${range!.from}&to=${range!.to}` : `/timesheet/me?from=${range!.from}&to=${range!.to}`),
    enabled: !!tenantId && !!range && (!canTeam || !!emp), retry: false,
  });
  const m = mirror.data;
  const s = m?.summary;
  const shift = (n: number) => { const [y, mm] = month.split('-').map(Number) as [number, number]; const d = new Date(Date.UTC(y, mm - 1 + n, 1)); setMonth(d.toISOString().slice(0, 10)); };
  const monthLabel = month ? new Date(`${month}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
  const fresh = open && m ? m.days.find((d) => d.date === open.date) ?? open : open;

  return (
    <Page>
      <PageHeader title="Espelho de ponto" description="Dia a dia: horário previsto, marcações, horas trabalhadas, saldo e ocorrências. Clique num dia para ajustar ou abonar." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {canTeam && <EmployeePicker value={emp} onChange={setEmp} />}
        <div className="glass flex h-10 items-center rounded-full px-1">
          <Button variant="ghost" className="size-8 rounded-full px-0" onClick={() => shift(-1)} aria-label="Mês anterior"><ChevronLeft className="size-4" /></Button>
          <span className="min-w-36 text-center text-sm capitalize">{monthLabel}</span>
          <Button variant="ghost" className="size-8 rounded-full px-0" onClick={() => shift(1)} aria-label="Próximo mês"><ChevronRight className="size-4" /></Button>
        </div>
        {m && <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" />Imprimir</Button>}
      </>} />
      {canTeam && !emp ? <Card><EmptyState icon={FileClock} title="Escolha um funcionário" body="Use a busca acima para abrir o espelho do mês." /></Card>
        : mirror.error ? <Card><EmptyState icon={FileClock} title="Espelho indisponível" body={(mirror.error as Error).message} /></Card>
        : !m ? <Skeleton className="h-96 rounded-[28px]" />
        : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ['Previsto', hhmm(s!.expectedMinutes)], ['Trabalhado', hhmm(s!.workedMinutes)], ['Saldo', hhmm(s!.balanceMinutes, true)],
                ['Extras', `${hhmm(s!.overtimeMinutes)}${s!.overtimeByPercent.length ? ` (${s!.overtimeByPercent.map((o) => `${o.percent}%`).join('/')})` : ''}`],
                ['Noturno', hhmm(s!.nightReducedMinutes)], ['Faltas', `${s!.absenceDays} dia(s)`],
              ].map(([k, v], i) => (
                <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }} className={cn('rounded-[20px] p-4', k === 'Saldo' ? 'hero-brand-soft' : 'glass')}>
                  <div className={cn('text-xs', k === 'Saldo' ? 'opacity-70' : 'text-muted')}>{k}</div><div className="font-mono text-lg font-semibold">{v}</div>
                </motion.div>
              ))}
            </div>
            {(s!.pendingAdjustments > 0 || s!.unauthorizedOvertimeMinutes > 0 || s!.onCallMinutes > 0 || s!.incompleteDays > 0) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {s!.incompleteDays > 0 && <span className="rounded-full bg-danger/15 px-3 py-1 text-danger">{s!.incompleteDays} dia(s) com marcação ímpar</span>}
                {s!.pendingAdjustments > 0 && <span className="rounded-full bg-brand-soft px-3 py-1">{s!.pendingAdjustments} ajuste(s) aguardando aprovação</span>}
                {s!.unauthorizedOvertimeMinutes > 0 && <span className="rounded-full bg-warning/15 px-3 py-1 text-warning">{hhmm(s!.unauthorizedOvertimeMinutes)} de extra sem autorização</span>}
                {s!.onCallMinutes > 0 && <span className="rounded-full bg-hover px-3 py-1">Sobreaviso {hhmm(s!.onCallMinutes)} (paga {hhmm(s!.onCallPaidMinutes)})</span>}
              </div>
            )}
            <Card className="overflow-hidden rounded-[28px] p-0">
              <div className="border-b border-line px-5 py-3 text-sm"><strong>{m.employment.name}</strong> · matrícula {m.employment.registration}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr><th className="px-4 py-2">Dia</th><th className="px-2">Previsto</th><th className="px-2">Marcações</th><th className="px-2 text-right">Trabalhado</th><th className="px-2 text-right">Saldo</th><th className="px-4">Ocorrências</th></tr>
                  </thead>
                  <tbody>
                    {m.days.map((d) => {
                      const r = d.result;
                      const today = d.date === todayBr();
                      return (
                        <tr key={d.date} onClick={() => setOpen(d)} className={cn('cursor-pointer border-t border-line transition-colors hover:bg-hover', !d.expected.isWorkday && 'text-muted', today && 'bg-brand-soft/40')}>
                          <td className="whitespace-nowrap px-4 py-2"><span className="font-mono">{br(d.date)}</span> <span className="text-xs text-subtle">{wd(d.date)}</span>{d.closed && <Lock className="ml-1 inline size-3 text-subtle" />}</td>
                          <td className="whitespace-nowrap px-2 font-mono text-xs">{d.leave ? d.leave.label : d.expected.isHoliday ? (d.expected.holidayName ?? 'Feriado') : d.expected.isWorkday ? (d.expected.start ? `${d.expected.start}–${d.expected.end}` : hhmm(d.expected.expectedMinutes)) : 'folga'}</td>
                          <td className="px-2 py-1.5"><div className="flex flex-wrap gap-1">{d.punches.map((p) => <span key={p.id} className={cn('rounded-md px-1.5 py-0.5 font-mono text-xs', ({ ORIGINAL: 'bg-hover', INCLUDED: 'bg-sky-500/15 text-sky-300', DISREGARDED: 'line-through opacity-50', PENDING_INCLUDE: 'border border-dashed border-brand/60', PENDING_DISREGARD: 'line-through decoration-brand' } as Record<string, string>)[p.status])}>{p.time}</span>)}</div></td>
                          <td className="px-2 text-right font-mono text-xs">{r && r.workedMinutes ? hhmm(r.workedMinutes) : '—'}</td>
                          <td className={cn('px-2 text-right font-mono text-xs font-semibold', (r?.balanceMinutes ?? 0) > 0 && 'text-success', (r?.balanceMinutes ?? 0) < 0 && 'text-danger')}>{r && r.balanceMinutes ? hhmm(r.balanceMinutes, true) : ''}</td>
                          <td className="px-4 py-1.5"><div className="flex flex-wrap gap-1">{d.allowance && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-300">{d.allowance.justification}</span>}{r?.flags.filter((f) => f !== 'LEAVE_FULL' || !d.allowance).filter((f) => f !== 'WITHIN_TOLERANCE').map((f) => <span key={f} className={cn('rounded-full px-2 py-0.5 text-[11px]', BAD_FLAGS.has(f) ? 'bg-danger/15 text-danger' : 'bg-hover text-muted')}>{FLAG_LABEL[f] ?? f}</span>)}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={fresh ? `${wd(fresh.date)} ${br(fresh.date)}` : ''}>
        {fresh && m && <DayActions d={fresh} employmentId={m.employment.id} canAdjust={can(me, 'time.adjustments:create')} canAllow={can(me, 'time.allowances:create')} onDone={() => undefined} />}
      </Sheet>
    </Page>
  );
}
