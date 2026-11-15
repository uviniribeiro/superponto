'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Clock3, Copy, Moon, Pencil, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { CYCLIC, hours, preset, span, TYPE_LABEL, useCompanyPick, WEEKDAYS, type RuleSet, type ScheduleDay, type WorkSchedule } from '@/lib/schedules';

const PRESETS: Array<[string, string]> = [['comercial', 'Comercial (seg–sex)'], ['sabado', 'Seg–sex + sábado'], ['12x36', '12x36 diurno'], ['12x36n', '12x36 noturno'], ['6x1', '6x1'], ['5x2', '5x2 em ciclo'], ['4x2', '4x2'], ['flex', 'Flexível']];
const dayExpected = (d: ScheduleDay) => (!d.isWorkday ? 0 : d.startTime && d.endTime ? Math.max(0, span(d.startTime, d.endTime) - d.breakMinutes) : d.expectedMinutes);
const NumIn = ({ label, value, onChange, hint, max = 600 }: { label: string; value: number; onChange: (n: number) => void; hint?: string; max?: number }) => (
  <Input label={label} inputMode="numeric" value={String(value)} onChange={(e) => onChange(Math.min(max, Number(e.target.value.replace(/\D/g, '') || 0)))} hint={hint} className="font-mono" />
);
const time = 'h-9 w-[64px] rounded-xl border border-line bg-hover px-2 text-center font-mono text-xs outline-none focus:border-brand disabled:opacity-40';

/** Hora HH:mm em campo de texto com máscara (o seletor nativo muda para 12h conforme o idioma do navegador). */
function Hm({ value, onChange, label }: { value: string | null; onChange: (v: string) => void; label: string }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => setText(value ?? ''), [value]);
  return (
    <input aria-label={label} inputMode="numeric" placeholder="--:--" maxLength={5} className={time} value={text}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '').slice(0, 4);
        const v = d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
        setText(v);
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) onChange(v); else if (!v) onChange('');
      }}
      onBlur={() => setText(value ?? '')} />
  );
}

function DayRow({ d, label, flexible, onChange }: { d: ScheduleDay; label: string; flexible: boolean; onChange: (d: ScheduleDay) => void }) {
  const night = d.isWorkday && d.startTime && d.endTime && d.endTime <= d.startTime;
  return (
    <div className={cn('grid grid-cols-[64px_1fr] items-center gap-2 rounded-2xl border px-3 py-2 sm:grid-cols-[64px_auto_1fr_auto]', d.isWorkday ? 'border-line bg-hover/40' : 'border-dashed border-line')}>
      <span className="text-xs font-semibold">{label}</span>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={d.isWorkday} onChange={(e) => onChange({ ...d, isWorkday: e.target.checked, ...(e.target.checked && !flexible && !d.startTime ? { startTime: '08:00', endTime: '17:00', breakMinutes: 60 } : {}) })} className="size-4 accent-[var(--brand)]" aria-label={`${label}: trabalha`} />
        {d.isWorkday ? 'Trabalha' : 'Folga'}
      </label>
      {d.isWorkday ? (
        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
          {flexible ? (
            <label className="flex items-center gap-1.5 text-xs text-muted">Carga <input aria-label={`${label}: carga em minutos`} className={time} value={d.expectedMinutes} onChange={(e) => onChange({ ...d, expectedMinutes: Number(e.target.value.replace(/\D/g, '') || 0) })} /> min</label>
          ) : (
            <>
              <Hm label={`${label}: entrada`} value={d.startTime} onChange={(v) => onChange({ ...d, startTime: v })} />
              <span className="text-xs text-subtle">às</span>
              <Hm label={`${label}: saída`} value={d.endTime} onChange={(v) => onChange({ ...d, endTime: v })} />
              {night && <Moon className="size-3.5 text-brand" aria-label="Atravessa a meia-noite" />}
              <span className="ml-1 text-xs text-subtle">intervalo</span>
              <input aria-label={`${label}: intervalo em minutos`} className={cn(time, 'w-14')} value={d.breakMinutes} onChange={(e) => onChange({ ...d, breakMinutes: Number(e.target.value.replace(/\D/g, '') || 0) })} />
              <span className="text-xs text-subtle">min às</span>
              <Hm label={`${label}: início do intervalo`} value={d.breakStart} onChange={(v) => onChange({ ...d, breakStart: v || null })} />
            </>
          )}
        </div>
      ) : <span className="col-span-2 text-xs text-subtle sm:col-span-1">—</span>}
      <span className="hidden text-right font-mono text-xs text-muted sm:block">{hours(dayExpected(d))}</span>
    </div>
  );
}

function ScheduleForm({ companyId, row, ruleSets, onDone }: { companyId: string; row: WorkSchedule | null; ruleSets: RuleSet[]; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState(() => ({
    name: row?.name ?? '', code: row?.code ?? '', type: row?.type ?? 'FIXED', cycleDays: row?.cycleDays ?? null,
    considerHolidays: row?.considerHolidays ?? true, inItinereMinutes: row?.inItinereMinutes ?? 0, entryMobilityMinutes: row?.entryMobilityMinutes ?? 0,
    breakMobilityMinutes: row?.breakMobilityMinutes ?? 0, ruleSetId: row?.ruleSetId ?? '', active: row?.active ?? true,
    days: row?.days ?? preset('comercial').days,
  }));
  const editId = row?.id || null; // cópia chega sem id: cria um novo
  const cyclic = CYCLIC.has(f.type);
  const flexible = f.type === 'FLEXIBLE';
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const applyPreset = (k: string) => { const p = preset(k); setF((x) => ({ ...x, type: p.type, cycleDays: p.cycleDays, days: p.days, considerHolidays: p.considerHolidays })); };
  const setCycle = (n: number) => setF((x) => ({ ...x, cycleDays: n, days: Array.from({ length: n }, (_, i) => x.days.find((d) => d.dayIndex === i) ?? { dayIndex: i, isWorkday: false, startTime: null, endTime: null, breakMinutes: 0, breakStart: null, expectedMinutes: 0 }) }));
  const changeType = (t: string) => setF((x) => {
    if (CYCLIC.has(t) && !CYCLIC.has(x.type)) { const n = 2; return { ...x, type: t, cycleDays: n, days: Array.from({ length: n }, (_, i) => ({ dayIndex: i, isWorkday: i === 0, startTime: i === 0 ? '07:00' : null, endTime: i === 0 ? '19:00' : null, breakMinutes: i === 0 ? 60 : 0, breakStart: null, expectedMinutes: 0 })) }; }
    if (!CYCLIC.has(t) && CYCLIC.has(x.type)) return { ...x, type: t, cycleDays: null, days: preset(t === 'FLEXIBLE' ? 'flex' : 'comercial').days };
    return { ...x, type: t };
  });
  const weekly = useMemo(() => { const total = f.days.reduce((s, d) => s + dayExpected(d), 0); return cyclic && f.cycleDays ? Math.round((total * 7) / f.cycleDays) : total; }, [f.days, cyclic, f.cycleDays]);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(), code: f.code.trim() || null, type: f.type, cycleDays: cyclic ? f.cycleDays : null, considerHolidays: f.considerHolidays,
        inItinereMinutes: f.inItinereMinutes, entryMobilityMinutes: f.entryMobilityMinutes, breakMobilityMinutes: f.breakMobilityMinutes, ruleSetId: f.ruleSetId || null, active: f.active,
        days: f.days.map((d) => ({
          dayIndex: d.dayIndex, isWorkday: d.isWorkday, breakMinutes: d.isWorkday ? d.breakMinutes : 0,
          ...(d.isWorkday && !flexible ? { startTime: d.startTime || null, endTime: d.endTime || null, breakStart: d.breakStart || null } : {}),
          ...(d.isWorkday && flexible ? { expectedMinutes: d.expectedMinutes } : {}),
        })),
      };
      return editId ? api(`/work-schedules/${editId}`, { method: 'PATCH', json: body }) : api('/work-schedules', { method: 'POST', json: { ...body, companyId } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-schedules'] }); toast('success', editId ? 'Horário atualizado' : 'Horário criado'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  const ordered = [...f.days].sort((a, b) => (cyclic ? a.dayIndex - b.dayIndex : ((a.dayIndex + 6) % 7) - ((b.dayIndex + 6) % 7)));
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
      {!row && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Começar de um modelo</span>
          <div className="flex flex-wrap gap-1.5">{PRESETS.map(([k, l]) => <button key={k} type="button" onClick={() => applyPreset(k)} className="rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors hover:border-brand/50 hover:text-fg">{l}</button>)}</div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Input label="Nome" value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={3} autoFocus placeholder="Ex.: Comercial 44h" />
        <Input label="Código" value={f.code} onChange={(e) => set('code', e.target.value)} maxLength={20} className="font-mono" placeholder="H01" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Tipo</span>
          <select value={f.type} onChange={(e) => changeType(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
            {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {cyclic && <NumIn label="Dias do ciclo" value={f.cycleDays ?? 2} onChange={(n) => setCycle(Math.max(2, Math.min(62, n)))} max={62} hint="Ex.: 12x36 = 2; 6x1 = 7; 4x2 = 6" />}
      </div>
      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">{cyclic ? 'Dias do ciclo' : 'Dias da semana'}</span>
          <span className="text-xs text-muted">Carga semanal{cyclic ? ' média' : ''}: <strong className="font-mono text-fg">{hours(weekly)}</strong>{weekly > 2640 && <span className="ml-2 text-warning">acima de 44h</span>}</span>
        </div>
        {ordered.map((d) => <DayRow key={d.dayIndex} d={d} flexible={flexible} label={cyclic ? `Dia ${d.dayIndex + 1}` : WEEKDAYS[d.dayIndex]!} onChange={(nd) => set('days', f.days.map((x) => (x.dayIndex === nd.dayIndex ? nd : x)))} />)}
      </div>
      <fieldset className="space-y-3 rounded-2xl border border-line p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-brand">Configuração avançada</legend>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span><span className="block">Feriado vira folga</span><span className="block text-xs text-subtle">Desmarque em escalas 12x36 e plantões, que seguem o ciclo no feriado</span></span>
          <input type="checkbox" checked={f.considerHolidays} onChange={(e) => set('considerHolidays', e.target.checked)} className="size-4 accent-[var(--brand)]" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumIn label="Hora in itinere (min)" value={f.inItinereMinutes} onChange={(n) => set('inItinereMinutes', n)} hint="Somada nos dias trabalhados, se a convenção prevê" />
          <NumIn label="Mobilidade da entrada (min)" value={f.entryMobilityMinutes} onChange={(n) => set('entryMobilityMinutes', n)} hint="A saída prevista acompanha a entrada" />
          <NumIn label="Mobilidade do intervalo (min)" value={f.breakMobilityMinutes} onChange={(n) => set('breakMobilityMinutes', n)} hint="Antes ou depois do início previsto" />
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Regra de apuração</span>
          <select value={f.ruleSetId} onChange={(e) => set('ruleSetId', e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
            <option value="">Padrão da empresa</option>
            {ruleSets.map((r) => <option key={r.id} value={r.id}>{r.name}{r.isDefault ? ' (padrão)' : ''}</option>)}
          </select>
        </label>
        {editId && (
          <label className="flex items-center justify-between text-sm"><span>Ativo (pode ser atribuído)</span><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} className="size-4 accent-[var(--brand)]" /></label>
        )}
      </fieldset>
      <Button type="submit" loading={save.isPending} className="h-12 w-full">{editId ? 'Salvar horário' : 'Criar horário'}</Button>
    </form>
  );
}

function Strip({ s }: { s: WorkSchedule }) {
  const ordered = CYCLIC.has(s.type) ? [...s.days].sort((a, b) => a.dayIndex - b.dayIndex) : [1, 2, 3, 4, 5, 6, 0].map((i) => s.days.find((d) => d.dayIndex === i)).filter(Boolean) as ScheduleDay[];
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {ordered.slice(0, 14).map((d) => (
        <span key={d.dayIndex} title={d.isWorkday ? `${d.startTime ?? ''}–${d.endTime ?? ''}` : 'Folga'} className={cn('grid h-11 w-12 place-items-center rounded-xl text-center text-[10px] leading-tight', d.isWorkday ? 'bg-brand-soft text-fg' : 'border border-dashed border-line text-subtle')}>
          <span className="font-semibold">{CYCLIC.has(s.type) ? `D${d.dayIndex + 1}` : WEEKDAYS[d.dayIndex]}</span>
          <span className="font-mono">{d.isWorkday ? (d.startTime ?? hours(d.expectedMinutes)) : 'folga'}</span>
        </span>
      ))}
      {ordered.length > 14 && <span className="self-center text-xs text-subtle">+{ordered.length - 14}</span>}
    </div>
  );
}

export default function HorariosPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = can(me, 'schedules.timetables:manage');
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const [editing, setEditing] = useState<WorkSchedule | null | 'new'>(null);
  const [copyOf, setCopyOf] = useState<WorkSchedule | null>(null);
  const [removing, setRemoving] = useState<WorkSchedule | null>(null);
  const list = useQuery({ queryKey: ['work-schedules', tenantId, companyId], queryFn: () => api<WorkSchedule[]>(`/work-schedules?companyId=${companyId}`), enabled: !!companyId });
  const ruleSets = useQuery({ queryKey: ['rule-sets', tenantId, companyId], queryFn: () => api<RuleSet[]>(`/rule-sets?companyId=${companyId}`), enabled: !!companyId });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/work-schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-schedules'] }); toast('success', 'Horário excluído'); setRemoving(null); },
    onError: (e: Error) => { toast('error', e.message); setRemoving(null); },
  });
  const rows = list.data ?? [];
  return (
    <Page>
      <PageHeader title="Horários" description="Jornadas semanais e escalas em ciclo (12x36, 6x1, 4x2…), com intervalo, in itinere e mobilidade. Depois, atribua em Escalas." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {companies.length > 1 && (
          <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="glass h-10 max-w-xs rounded-full px-4 text-sm outline-none [&>option]:bg-elevated">
            {companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}
          </select>
        )}
        {canManage && companyId && <Button onClick={() => { setCopyOf(null); setEditing('new'); }}><Plus className="size-4" />Novo horário</Button>}
      </>} />
      {!tenantId ? <Card><EmptyState icon={Clock3} title="Escolha uma organização" body="Selecione acima o cliente que você quer administrar." /></Card>
        : loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="Horários pertencem a uma empresa." /></Card>
        : list.isLoading || !companyId ? <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-[24px]" />)}</div>
        : !rows.length ? <Card><EmptyState icon={Clock3} title="Nenhum horário" body="Crie o primeiro a partir de um modelo pronto (comercial, 12x36, 6x1…)." action={canManage ? <Button onClick={() => setEditing('new')}><Plus className="size-4" />Novo horário</Button> : undefined} /></Card>
        : (
          <div className="grid gap-4 md:grid-cols-2">
            <AnimatePresence initial={false}>
              {rows.map((s, i) => (
                <motion.div key={s.id} layout initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { delay: Math.min(i, 8) * 0.04 } }} exit={{ opacity: 0 }}
                  className={cn('glass group rounded-[24px] p-5', !s.active && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold">{s.name}{s.code && <span className="ml-2 font-mono text-xs text-subtle">{s.code}</span>}{!s.active && <span className="ml-2 text-xs text-subtle">(inativo)</span>}</p>
                      <p className="text-xs text-muted">{TYPE_LABEL[s.type]} · {hours(s.weeklyMinutes)} por semana{s.considerHolidays ? '' : ' · trabalha em feriado'}{s.inItinereMinutes ? ` · in itinere ${s.inItinereMinutes} min` : ''}{s.entryMobilityMinutes ? ` · entrada móvel ${s.entryMobilityMinutes} min` : ''}</p>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-1 text-xs', s.inUse ? 'bg-brand-soft text-fg' : 'bg-hover text-muted')}>{s.inUse} em uso</span>
                  </div>
                  <Strip s={s} />
                  {canManage && (
                    <div className="mt-3 flex gap-1">
                      <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => setEditing(s)}><Pencil className="size-3.5" />Editar</Button>
                      <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => { setCopyOf(s); setEditing('new'); }}><Copy className="size-3.5" />Duplicar</Button>
                      <Button variant="ghost" className="ml-auto h-8 px-3 text-xs hover:text-danger" onClick={() => setRemoving(s)} aria-label={`Excluir ${s.name}`}><Trash2 className="size-3.5" /></Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? (copyOf ? `Duplicar: ${copyOf.name}` : 'Novo horário') : 'Editar horário'} wide>
        {editing !== null && companyId && (
          <ScheduleForm key={editing === 'new' ? `new-${copyOf?.id ?? ''}` : editing.id} companyId={companyId} ruleSets={ruleSets.data ?? []}
            row={editing === 'new' ? (copyOf ? { ...copyOf, name: `${copyOf.name} (cópia)`, code: null, id: '' } as WorkSchedule : null) : editing}
            onDone={() => setEditing(null)} />
        )}
      </Sheet>
      <Confirm open={!!removing} title="Excluir horário?" body={removing?.inUse ? `"${removing.name}" está em uso por ${removing.inUse} funcionário(s): atribua outro horário antes.` : `"${removing?.name}" deixa de aparecer. O histórico fica na auditoria.`} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => removing && remove.mutate(removing.id)} onCancel={() => setRemoving(null)} />
    </Page>
  );
}
