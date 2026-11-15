'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Building2, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock3, Search, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Page as Paged, type Ref } from '@/lib/api';
import { cn } from '@/lib/cn';
import { hours, span, useCompanyPick, WEEKDAYS, type ExpectedDay, type WorkSchedule } from '@/lib/schedules';

interface Grid { from: string; to: string; truncated: boolean; rows: Array<{ employmentId: string; registration: string; name: string; days: ExpectedDay[] }> }
type Dept = Ref & { depth: number };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const add = (v: string, n: number) => iso(new Date(Date.parse(`${v}T00:00:00Z`) + n * 86_400_000));
const monday = (v: string) => { const d = new Date(`${v}T00:00:00Z`); return add(v, -((d.getUTCDay() + 6) % 7)); };
const dm = (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`;
const wd = (v: string) => WEEKDAYS[new Date(`${v}T00:00:00Z`).getUTCDay()]!;
const todayBr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const select = 'h-10 rounded-full border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated';

function Cell({ d, onOpen }: { d: ExpectedDay; onOpen: () => void }) {
  const title = [d.holidayName && `Feriado: ${d.holidayName}`, d.isWorkday ? `${d.start ?? hours(d.expectedMinutes)}${d.end ? `–${d.end}` : ''}` : 'Folga', d.scheduleName, d.origin === 'TROCA' ? `Troca: ${d.note ?? ''}` : d.origin === 'AGENDADA' ? `Escala agendada${d.note ? `: ${d.note}` : ''}` : null].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={onOpen} title={title} className={cn(
      'relative flex h-12 w-full min-w-[68px] flex-col items-center justify-center rounded-xl text-[11px] leading-tight transition-transform hover:-translate-y-0.5',
      d.isWorkday ? 'bg-brand-soft text-fg' : d.isHoliday ? 'bg-sky-500/10 text-sky-300' : 'border border-dashed border-line text-subtle',
      d.origin === 'AGENDADA' && 'ring-2 ring-brand/70', d.origin === 'TROCA' && 'ring-2 ring-sky-400/80',
    )}>
      {d.isWorkday ? (d.start ? <><span className="font-mono font-semibold">{d.start}</span><span className="font-mono opacity-70">{d.end}</span></> : <span className="font-mono">{hours(d.expectedMinutes)}</span>)
        : <span>{d.isHoliday ? 'feriado' : 'folga'}</span>}
      {d.origin && <span className={cn('absolute -right-1 -top-1 size-2.5 rounded-full', d.origin === 'TROCA' ? 'bg-sky-400' : 'bg-brand')} />}
    </button>
  );
}

function AssignForm({ companyId, ids, onDone }: { companyId: string; ids: string[]; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const schedules = useQuery({ queryKey: ['work-schedules', 'x', companyId], queryFn: () => api<WorkSchedule[]>(`/work-schedules?companyId=${companyId}`) });
  const active = (schedules.data ?? []).filter((s) => s.active);
  const [scheduleId, setScheduleId] = useState('');
  const [validFrom, setValidFrom] = useState(todayBr());
  const [cycleStart, setCycleStart] = useState('');
  const chosen = active.find((s) => s.id === scheduleId);
  const save = useMutation({
    mutationFn: () => api<{ assigned: number }>('/schedule-assignments', { method: 'POST', json: { employmentIds: ids, scheduleId, validFrom, ...(cycleStart ? { cycleStart } : {}) } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['schedule-grid'] }); qc.invalidateQueries({ queryKey: ['work-schedules'] }); toast('success', `Horário atribuído a ${r.assigned} funcionário(s)`); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <p className="text-sm text-muted">{ids.length} funcionário(s) selecionado(s). A jornada anterior de cada um termina na véspera; o histórico é preservado.</p>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Horário</span>
        <select required value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none [&>option]:bg-elevated">
          <option value="">Escolha…</option>
          {active.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''} · {hours(s.weeklyMinutes)}/sem</option>)}
        </select>
      </label>
      {schedules.data && !active.length && <p className="text-xs text-warning">Nenhum horário ativo nesta empresa: crie em Jornada › Horários.</p>}
      <Input label="Vale a partir de" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
      {chosen?.cycleDays && <Input label="Primeiro dia do ciclo" type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} hint={`Dia em que começa o “Dia 1” do ciclo de ${chosen.cycleDays} dias (padrão: a data de início)`} />}
      <Button type="submit" loading={save.isPending} disabled={!scheduleId} className="h-12 w-full">Atribuir horário</Button>
    </form>
  );
}

function OverrideForm({ ids, from: initialFrom, onDone }: { ids: string[]; from: string; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ from: initialFrom, to: initialFrom, weekdays: [] as number[], isWorkday: true, startTime: '07:00', endTime: '13:00', breakMinutes: 0, breakStart: '', note: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = useMutation({
    mutationFn: () => api<{ created: number }>('/schedule-overrides', { method: 'POST', json: {
      employmentIds: ids, from: f.from, to: f.to, weekdays: f.weekdays, isWorkday: f.isWorkday, note: f.note || undefined,
      ...(f.isWorkday ? { startTime: f.startTime, endTime: f.endTime, breakMinutes: f.breakMinutes, breakStart: f.breakStart || null } : {}),
    } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['schedule-grid'] }); toast('success', `${r.created} dia(s) lançado(s)`); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <p className="text-sm text-muted">Define trabalho ou folga em dias específicos para {ids.length} funcionário(s). Vale sobre o horário e sobre o feriado.</p>
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line p-1">
        {([[true, 'Trabalho'], [false, 'Folga']] as const).map(([v, l]) => <button key={l} type="button" aria-pressed={f.isWorkday === v} onClick={() => set('isWorkday', v)} className={cn('h-9 rounded-xl text-sm', f.isWorkday === v ? 'pill-light' : 'text-muted')}>{l}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="De" type="date" value={f.from} onChange={(e) => setF((p) => ({ ...p, from: e.target.value, to: p.to < e.target.value ? e.target.value : p.to }))} required />
        <Input label="Até" type="date" value={f.to} min={f.from} onChange={(e) => set('to', e.target.value)} required />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-subtle">Só nestes dias da semana</legend>
        <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((d, i) => { const on = f.weekdays.includes(i); return <button key={d} type="button" aria-pressed={on} onClick={() => set('weekdays', on ? f.weekdays.filter((x) => x !== i) : [...f.weekdays, i])} className={cn('h-9 w-12 rounded-xl border text-xs', on ? 'border-brand/50 bg-brand-soft' : 'border-line text-muted')}>{d}</button>; })}</div>
        <span className="text-xs text-subtle">{f.weekdays.length ? 'Os demais dias do período ficam como estão.' : 'Nenhum marcado: todos os dias do período.'}</span>
      </fieldset>
      {f.isWorkday && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input label="Entrada" type="time" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} required />
          <Input label="Saída" type="time" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} required />
          <Input label="Intervalo (min)" inputMode="numeric" value={String(f.breakMinutes)} onChange={(e) => set('breakMinutes', Number(e.target.value.replace(/\D/g, '') || 0))} />
          <Input label="Início do intervalo" type="time" value={f.breakStart} onChange={(e) => set('breakStart', e.target.value)} />
        </div>
      )}
      {f.isWorkday && f.startTime && f.endTime && <p className="text-xs text-muted">Jornada do dia: <strong className="font-mono text-fg">{hours(Math.max(0, span(f.startTime, f.endTime) - f.breakMinutes))}</strong>{f.endTime <= f.startTime ? ' (atravessa a meia-noite)' : ''}</p>}
      <Input label="Observação" value={f.note} onChange={(e) => set('note', e.target.value)} maxLength={300} placeholder="Ex.: mutirão de vacinação" />
      <Button type="submit" loading={save.isPending} className="h-12 w-full">Lançar escala agendada</Button>
    </form>
  );
}

function SwapForm({ rows, ids, date, onDone }: { rows: Grid['rows']; ids: string[]; date: string; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const two = ids.length === 2;
  const [d, setD] = useState({ date, workDate: date, offDate: add(date, 1), note: '' });
  const name = (id: string) => rows.find((r) => r.employmentId === id)?.name ?? '';
  const save = useMutation({
    mutationFn: () => api('/schedule-overrides/swap', { method: 'POST', json: two
      ? { kind: 'SHIFT', date: d.date, employmentIdA: ids[0], employmentIdB: ids[1], note: d.note }
      : { kind: 'DAY_OFF', employmentId: ids[0], workDate: d.workDate, offDate: d.offDate, note: d.note } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule-grid'] }); toast('success', 'Troca registrada'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      {two ? (
        <>
          <p className="text-sm text-muted"><strong className="text-fg">{name(ids[0]!)}</strong> e <strong className="text-fg">{name(ids[1]!)}</strong> trocam a escala do dia: cada um faz o horário do outro.</p>
          <Input label="Dia" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} required />
        </>
      ) : (
        <>
          <p className="text-sm text-muted"><strong className="text-fg">{name(ids[0]!)}</strong> folga num dia de trabalho e trabalha numa folga, no mesmo horário.</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Folgar em (dia de trabalho)" type="date" value={d.workDate} onChange={(e) => setD({ ...d, workDate: e.target.value })} required />
            <Input label="Trabalhar em (folga)" type="date" value={d.offDate} onChange={(e) => setD({ ...d, offDate: e.target.value })} required />
          </div>
        </>
      )}
      <Input label="Motivo" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} required minLength={3} maxLength={300} placeholder="Ex.: pedido do funcionário, aprovado pela coordenação" />
      <Button type="submit" loading={save.isPending} className="h-12 w-full"><ArrowLeftRight className="size-4" />Registrar troca</Button>
    </form>
  );
}

export default function EscalasPage() {
  const { me } = useSession();
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const canAssign = can(me, 'schedules.schedules:manage');
  const canSchedule = can(me, 'schedules.scheduled:manage');
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  // Data de hoje só no navegador (fuso de Brasília): a página é pré-renderizada sem relógio.
  const [today, setToday] = useState('');
  const [start, setStart] = useState('');
  useEffect(() => { const t = todayBr(); setToday(t); setStart((s) => s || monday(t)); }, []);
  const [days, setDays] = useState(14);
  const [departmentId, setDepartmentId] = useState('');
  const [groupingId, setGroupingId] = useState('');
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<null | 'assign' | 'override' | 'swap'>(null);
  const [cell, setCell] = useState<{ name: string; d: ExpectedDay } | null>(null);
  const to = start ? add(start, days - 1) : '';
  const depts = useQuery({ queryKey: ['opt', 'departments', companyId], queryFn: () => api<Dept[]>(`/departments?companyId=${companyId}`), enabled: !!companyId, retry: false });
  const groupings = useQuery({ queryKey: ['opt', 'groupings', tenantId], queryFn: () => api<Paged<Ref>>('/groupings?pageSize=200'), enabled: !!tenantId, retry: false });
  const grid = useQuery({
    queryKey: ['schedule-grid', tenantId, companyId, start, days, departmentId, groupingId, q],
    queryFn: () => api<Grid>(`/schedule-grid?companyId=${companyId}&from=${start}&to=${to}${departmentId ? `&departmentId=${departmentId}` : ''}${groupingId ? `&groupingId=${groupingId}` : ''}${q ? `&search=${encodeURIComponent(q)}` : ''}`),
    enabled: !!companyId && !!start, placeholderData: (p) => p,
  });
  const removeOverride = useMutation({
    mutationFn: (id: string) => api(`/schedule-overrides/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule-grid'] }); toast('success', 'Lançamento removido: o dia volta ao horário normal'); setCell(null); },
    onError: (e: Error) => toast('error', e.message),
  });
  const rows = grid.data?.rows ?? [];
  const dates = useMemo(() => (start ? Array.from({ length: days }, (_, i) => add(start, i)) : []), [start, days]);
  const holidayByDate = useMemo(() => new Map((rows[0]?.days ?? []).filter((d) => d.holidayName).map((d) => [d.date, d.holidayName!])), [rows]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Page>
      <PageHeader title="Escalas" description="Quem trabalha em cada dia. Selecione funcionários para atribuir horário, lançar escala agendada ou registrar trocas." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={pickTenant} />}
        {companies.length > 1 && <select aria-label="Empresa" value={companyId} onChange={(e) => { setCompanyId(e.target.value); setSelected([]); setDepartmentId(''); }} className={cn(select, 'glass max-w-xs')}>{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select>}
      </>} />
      {!tenantId ? <Card><EmptyState icon={CalendarDays} title="Escolha uma organização" body="Selecione acima o cliente." /></Card>
        : loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="Escalas pertencem a uma empresa." /></Card>
        : (
          <Card className="overflow-hidden rounded-[28px] p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <div className="flex items-center gap-1">
                <Button variant="ghost" className="size-9 px-0" onClick={() => setStart(add(start, -7))} aria-label="Semana anterior"><ChevronLeft className="size-4" /></Button>
                <input type="date" aria-label="Início do período" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className="h-9 rounded-xl border border-line bg-hover px-2 text-sm" />
                <Button variant="ghost" className="size-9 px-0" onClick={() => setStart(add(start, 7))} aria-label="Próxima semana"><ChevronRight className="size-4" /></Button>
                <Button variant="ghost" className="h-9 px-3 text-xs" onClick={() => setStart(monday(today))}>Hoje</Button>
              </div>
              <div className="flex rounded-full border border-line p-0.5 text-xs">
                {[7, 14, 28].map((n) => <button key={n} onClick={() => setDays(n)} className={cn('h-8 rounded-full px-3', days === n ? 'pill-light' : 'text-muted')}>{n} dias</button>)}
              </div>
              <select aria-label="Departamento" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={cn(select, 'h-9 max-w-[200px] text-xs')}>
                <option value="">Todos os departamentos</option>
                {(depts.data ?? []).map((d) => <option key={d.id} value={d.id}>{' '.repeat(d.depth * 2)}{d.name}</option>)}
              </select>
              <select aria-label="Agrupamento" value={groupingId} onChange={(e) => setGroupingId(e.target.value)} className={cn(select, 'h-9 max-w-[180px] text-xs')}>
                <option value="">Todos os agrupamentos</option>
                {(groupings.data?.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <div className="flex min-w-40 flex-1 items-center gap-2"><Search className="size-4 text-subtle" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou matrícula…" aria-label="Buscar funcionário" className="h-9 flex-1 bg-transparent text-sm outline-none" /></div>
            </div>
            <div className="flex flex-wrap gap-4 border-b border-line px-4 py-2 text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-brand-soft" />Trabalho</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-dashed border-line" />Folga</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-sky-500/20" />Feriado</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded ring-2 ring-brand/70" />Escala agendada</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded ring-2 ring-sky-400/80" />Troca</span>
            </div>
            {grid.isLoading || !companyId || !start ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
              : !rows.length ? <EmptyState icon={Clock3} title="Nenhum funcionário" body={q || departmentId || groupingId ? 'Nada com esses filtros.' : 'Cadastre funcionários nesta empresa para montar a escala.'} />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-1 px-2 py-2 text-sm">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 min-w-[200px] bg-[var(--bg-elevated)]/80 px-2 text-left backdrop-blur">
                          <label className="flex items-center gap-2 text-xs font-medium text-muted"><input type="checkbox" checked={selected.length === rows.length} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.employmentId) : [])} className="size-4 accent-[var(--brand)]" aria-label="Selecionar todos" />Funcionário</label>
                        </th>
                        {dates.map((d) => (
                          <th key={d} title={holidayByDate.get(d)} className={cn('px-0.5 text-center text-[11px] font-medium', d === today ? 'text-brand' : holidayByDate.has(d) ? 'text-sky-300' : 'text-muted')}>
                            <div>{wd(d)}</div><div className="font-mono">{dm(d)}</div>
                          </th>
                        ))}
                        <th className="px-2 text-right text-[11px] font-medium text-muted">Previsto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const on = selected.includes(r.employmentId);
                        return (
                          <tr key={r.employmentId}>
                            <td className="sticky left-0 z-10 bg-[var(--bg-elevated)]/80 px-2 backdrop-blur">
                              <label className={cn('flex cursor-pointer items-center gap-2 rounded-xl px-1 py-1', on && 'bg-brand-soft/60')}>
                                <input type="checkbox" checked={on} onChange={() => toggle(r.employmentId)} className="size-4 accent-[var(--brand)]" aria-label={`Selecionar ${r.name}`} />
                                <span className="min-w-0"><span className="block truncate font-medium">{r.name}</span><span className="block text-[11px] text-subtle">Matrícula {r.registration}{r.days[0]?.scheduleName ? ` · ${r.days.at(-1)?.scheduleName ?? ''}` : ' · sem horário'}</span></span>
                              </label>
                            </td>
                            {r.days.map((d) => <td key={d.date}><Cell d={d} onOpen={() => setCell({ name: r.name, d })} /></td>)}
                            <td className="px-2 text-right font-mono text-xs text-muted">{hours(r.days.reduce((s, d) => s + d.expectedMinutes, 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {grid.data?.truncated && <p className="px-4 pb-3 text-xs text-warning">Mostrando os primeiros 300 funcionários: use os filtros.</p>}
                </div>
              )}
          </Card>
        )}

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="glass-strong fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-full py-2 pl-5 pr-2 text-sm">
            <span className="font-medium">{selected.length} selecionado(s)</span>
            {canAssign && <Button variant="light" className="h-9" onClick={() => setAction('assign')}><Clock3 className="size-4" />Atribuir horário</Button>}
            {canSchedule && <Button variant="light" className="h-9" onClick={() => setAction('override')}><CalendarClock className="size-4" />Escala agendada</Button>}
            {canSchedule && selected.length <= 2 && <Button variant="light" className="h-9" onClick={() => setAction('swap')}><ArrowLeftRight className="size-4" />{selected.length === 2 ? 'Trocar escala' : 'Trocar folga'}</Button>}
            <Button variant="ghost" className="size-9 rounded-full px-0" onClick={() => setSelected([])} aria-label="Limpar seleção"><X className="size-4" /></Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={action === 'assign'} onClose={() => setAction(null)} title="Atribuir horário">{action === 'assign' && <AssignForm companyId={companyId} ids={selected} onDone={() => { setAction(null); setSelected([]); }} />}</Sheet>
      <Sheet open={action === 'override'} onClose={() => setAction(null)} title="Escala agendada" wide>{action === 'override' && <OverrideForm ids={selected} from={start < today && to >= today ? today : start} onDone={() => { setAction(null); setSelected([]); }} />}</Sheet>
      <Sheet open={action === 'swap'} onClose={() => setAction(null)} title={selected.length === 2 ? 'Troca de escala' : 'Troca de folga'}>{action === 'swap' && <SwapForm rows={rows} ids={selected} date={start < today && to >= today ? today : start} onDone={() => { setAction(null); setSelected([]); }} />}</Sheet>
      <Sheet open={!!cell} onClose={() => setCell(null)} title={cell ? `${cell.name} · ${wd(cell.d.date)} ${dm(cell.d.date)}` : ''}>
        {cell && (
          <div className="space-y-4 text-sm">
            <div className={cn('rounded-2xl p-4', cell.d.isWorkday ? 'hero-brand-soft' : 'border border-dashed border-line')}>
              <p className="text-2xl font-semibold">{cell.d.isWorkday ? (cell.d.start ? `${cell.d.start} – ${cell.d.end}` : hours(cell.d.expectedMinutes)) : cell.d.isHoliday ? 'Feriado' : 'Folga'}</p>
              {cell.d.isWorkday && <p className="opacity-75">{hours(cell.d.expectedMinutes)} previstas{cell.d.breakMinutes ? ` · intervalo de ${cell.d.breakMinutes} min` : ''}{cell.d.overnight ? ' · atravessa a meia-noite' : ''}</p>}
            </div>
            <dl className="space-y-1.5">
              {cell.d.holidayName && <div className="flex justify-between gap-3"><dt className="text-muted">Feriado</dt><dd>{cell.d.holidayName}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-muted">Horário atribuído</dt><dd>{cell.d.scheduleName ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Origem do dia</dt><dd>{cell.d.origin === 'TROCA' ? 'Troca' : cell.d.origin === 'AGENDADA' ? 'Escala agendada' : 'Horário'}</dd></div>
              {cell.d.note && <div className="flex justify-between gap-3"><dt className="text-muted">Observação</dt><dd className="text-right">{cell.d.note}</dd></div>}
            </dl>
            {cell.d.overrideId && canSchedule && <Button variant="outline" className="w-full" loading={removeOverride.isPending} onClick={() => removeOverride.mutate(cell.d.overrideId!)}><Trash2 className="size-4" />Remover lançamento deste dia</Button>}
          </div>
        )}
      </Sheet>
    </Page>
  );
}
