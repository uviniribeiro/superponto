'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronLeft, ChevronRight, HeartPulse, Plus, Repeat, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CompanyActions, fieldCls, labelCls } from '@/components/company-actions';
import { useCompanyOptions } from '@/components/module-opts';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick } from '@/lib/schedules';
import { addDays, todayBr } from '@/lib/timesheet';

interface Shift { id: string; unit: string; kind: string; startsAt: string; endsAt: string; requiredProfessionals: number; covered: number; missing: number; notes: string | null; assignments: Array<{ id: string; employmentId: string; name: string; registration: string; status: string; pendingSubstitution: string | null }> }
const KIND: Record<string, string> = { DAY: 'Diurno', NIGHT: 'Noturno', H12: '12 horas', H24: '24 horas', ON_CALL: 'Sobreaviso', EXTRA: 'Extra', COVERAGE: 'Cobertura' };
const ST: Record<string, string> = { SCHEDULED: 'Escalado', CONFIRMED: 'Confirmado', IN_PROGRESS: 'Em plantão', COMPLETED: 'Concluído', ABSENT: 'Faltou', SUBSTITUTED: 'Substituído' };
const hm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
const dmy = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

export default function PlantoesPage() {
  const { me } = useSession();
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const { units, employees } = useCompanyOptions(companyId);
  const toast = useToast();
  const qc = useQueryClient();
  const manage = can(me, 'health.shifts:manage');
  const [unitId, setUnitId] = useState('');
  const [start, setStart] = useState('');
  useEffect(() => setStart(todayBr()), []);
  useEffect(() => { if (units.length && !units.some((u) => u.id === unitId)) setUnitId(units[0]!.id); }, [units, unitId]);
  const end = start ? addDays(start, 6) : '';
  const list = useQuery({ queryKey: ['shifts', tenantId, unitId, start], queryFn: () => api<Shift[]>(`/health/shifts?unitId=${unitId}&from=${start}&to=${end}`), enabled: !!unitId && !!start });
  const [form, setForm] = useState<{ date: string; startTime: string; endTime: string; kind: string; required: number; repeatDays: number } | null>(null);
  const [assignTo, setAssignTo] = useState<{ shift: Shift; employmentId: string } | null>(null);
  const [subOf, setSubOf] = useState<{ assignmentId: string; name: string; substitute: string; reason: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['shifts'] });
  const err = (e: Error) => toast('error', e.message);
  const create = useMutation({
    mutationFn: () => {
      const f = form!;
      const s = new Date(`${f.date}T${f.startTime}:00-03:00`);
      let e = new Date(`${f.date}T${f.endTime}:00-03:00`);
      if (e <= s) e = new Date(e.getTime() + 86_400_000);
      return api<{ created: number }>('/health/shifts', { method: 'POST', json: { unitId, kind: f.kind, startsAt: s.toISOString(), endsAt: e.toISOString(), requiredProfessionals: f.required, repeatDays: f.repeatDays } });
    },
    onSuccess: (r) => { toast('success', `${r.created} plantão(ões) criado(s)`); setForm(null); refresh(); }, onError: err,
  });
  const assign = useMutation({ mutationFn: () => api(`/health/shifts/${assignTo!.shift.id}/assign`, { method: 'POST', json: { employmentId: assignTo!.employmentId } }), onSuccess: () => { setAssignTo(null); refresh(); toast('success', 'Profissional escalado'); }, onError: err });
  const status = useMutation({ mutationFn: (v: { id: string; status: string }) => api(`/health/assignments/${v.id}/status`, { method: 'POST', json: { status: v.status } }), onSuccess: refresh, onError: err });
  const sub = useMutation({ mutationFn: () => api(`/health/assignments/${subOf!.assignmentId}/substitution`, { method: 'POST', json: { substituteEmploymentId: subOf!.substitute, reason: subOf!.reason } }), onSuccess: () => { setSubOf(null); refresh(); toast('success', 'Troca pedida: aprove na lista'); }, onError: err });
  const decide = useMutation({ mutationFn: (v: { id: string; approve: boolean }) => api(`/health/substitutions/${v.id}/decide`, { method: 'POST', json: { approve: v.approve } }), onSuccess: refresh, onError: err });
  const shifts = list.data ?? [];
  const missing = shifts.reduce((t, s) => t + s.missing, 0);

  return (
    <Page>
      <PageHeader title="Plantões" description="Escala de plantonistas por unidade: cobertura, conflitos de horário e trocas com aprovação. Só dados administrativos." actions={<>
        <CompanyActions {...{ isPlatform, tenantId, pickTenant, companies, companyId, setCompanyId }} />
        {units.length > 1 && <select aria-label="Unidade" value={unitId} onChange={(e) => setUnitId(e.target.value)} className="glass h-10 rounded-full px-4 text-sm [&>option]:bg-elevated">{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
        {manage && <Button onClick={() => setForm({ date: start, startTime: '19:00', endTime: '07:00', kind: 'NIGHT', required: 1, repeatDays: 0 })} disabled={!unitId}><Plus className="size-4" />Novo plantão</Button>}
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="Os plantões são por unidade da empresa." /></Card>
        : !units.length && loaded ? <Card><EmptyState icon={Building2} title="Cadastre uma unidade" body="Em Organização › Unidades e locais (ex.: Pronto-socorro, UTI)." /></Card> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="glass flex h-10 items-center rounded-full px-1"><Button variant="ghost" className="size-8 rounded-full px-0" aria-label="Semana anterior" onClick={() => setStart(addDays(start, -7))}><ChevronLeft className="size-4" /></Button><span className="min-w-44 text-center text-sm">{start && `${start.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')}`}</span><Button variant="ghost" className="size-8 rounded-full px-0" aria-label="Próxima semana" onClick={() => setStart(addDays(start, 7))}><ChevronRight className="size-4" /></Button></div>
            {!!shifts.length && <span className={cn('rounded-full px-3 py-1.5 text-sm', missing ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success')}>{missing ? `${missing} vaga(s) sem plantonista` : 'Todos os plantões cobertos'}</span>}
          </div>
          {!list.data ? <Skeleton className="h-64 rounded-[28px]" /> : !shifts.length ? <Card><EmptyState icon={HeartPulse} title="Nenhum plantão nesta semana" body="Crie os plantões (pode repetir por vários dias) e escale os profissionais." /></Card> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shifts.map((s) => (
                <Card key={s.id} className={cn('space-y-2 rounded-[22px] p-4', s.missing && 'border-danger/40')}>
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-semibold capitalize">{dmy(s.startsAt)} · {hm(s.startsAt)}–{hm(s.endsAt)}</p><p className="text-xs text-subtle">{KIND[s.kind] ?? s.kind} · {s.covered}/{s.requiredProfessionals}</p></div>
                    {manage && <Button variant="ghost" className="h-8" onClick={() => setAssignTo({ shift: s, employmentId: '' })}><UserPlus className="size-4" /></Button>}
                  </div>
                  <ul className="space-y-1 text-sm">
                    {s.assignments.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-2">
                        <span className={cn('flex-1', a.status === 'SUBSTITUTED' || a.status === 'ABSENT' ? 'text-muted line-through' : '')}>{a.name}</span>
                        {manage && !['SUBSTITUTED', 'COMPLETED'].includes(a.status) ? (
                          <select aria-label={`Situação de ${a.name}`} value={a.status} onChange={(e) => status.mutate({ id: a.id, status: e.target.value })} className="h-7 rounded-lg border border-line bg-hover px-1 text-xs [&>option]:bg-elevated">{['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'ABSENT'].map((k) => <option key={k} value={k}>{ST[k]}</option>)}</select>
                        ) : <span className="text-xs text-subtle">{ST[a.status] ?? a.status}</span>}
                        {manage && a.pendingSubstitution && <><Button variant="outline" className="h-7 px-2 text-xs" onClick={() => decide.mutate({ id: a.pendingSubstitution!, approve: true })}>Aprovar troca</Button><Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => decide.mutate({ id: a.pendingSubstitution!, approve: false })}>Recusar</Button></>}
                        {manage && !a.pendingSubstitution && ['SCHEDULED', 'CONFIRMED'].includes(a.status) && <button aria-label={`Trocar ${a.name}`} onClick={() => setSubOf({ assignmentId: a.id, name: a.name, substitute: '', reason: '' })} className="text-muted hover:text-fg"><Repeat className="size-3.5" /></button>}
                      </li>
                    ))}
                    {!s.assignments.length && <li className="text-xs text-danger">Sem plantonista</li>}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      <Sheet open={!!form} onClose={() => setForm(null)} title="Novo plantão">
        {form && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <label className="block space-y-1.5"><span className={labelCls}>Data de início</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={fieldCls} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5"><span className={labelCls}>Entrada</span><input required pattern="([01][0-9]|2[0-3]):[0-5][0-9]" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={fieldCls} /></label>
              <label className="space-y-1.5"><span className={labelCls}>Saída</span><input required pattern="([01][0-9]|2[0-3]):[0-5][0-9]" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={fieldCls} /></label>
            </div>
            <label className="block space-y-1.5"><span className={labelCls}>Tipo</span><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={fieldCls}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5"><span className={labelCls}>Profissionais</span><input type="number" min={1} max={50} value={form.required} onChange={(e) => setForm({ ...form, required: Number(e.target.value) })} className={fieldCls} /></label>
              <label className="space-y-1.5"><span className={labelCls}>Repetir por mais (dias)</span><input type="number" min={0} max={62} value={form.repeatDays} onChange={(e) => setForm({ ...form, repeatDays: Number(e.target.value) })} className={fieldCls} /></label>
            </div>
            <p className="text-xs text-subtle">Saída menor que a entrada termina no dia seguinte.</p>
            <Button type="submit" loading={create.isPending} className="w-full">Criar</Button>
          </form>
        )}
      </Sheet>
      <Sheet open={!!assignTo} onClose={() => setAssignTo(null)} title="Escalar profissional">
        {assignTo && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); assign.mutate(); }}>
            <p className="text-sm capitalize text-muted">{dmy(assignTo.shift.startsAt)} · {hm(assignTo.shift.startsAt)}–{hm(assignTo.shift.endsAt)}</p>
            <select required aria-label="Profissional" value={assignTo.employmentId} onChange={(e) => setAssignTo({ ...assignTo, employmentId: e.target.value })} className={fieldCls}><option value="">Escolha…</option>{employees.filter((x) => !assignTo.shift.assignments.some((a) => a.employmentId === x.id && a.status !== 'SUBSTITUTED')).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <Button type="submit" loading={assign.isPending} className="w-full">Escalar</Button>
          </form>
        )}
      </Sheet>
      <Sheet open={!!subOf} onClose={() => setSubOf(null)} title={`Troca: ${subOf?.name ?? ''}`}>
        {subOf && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); sub.mutate(); }}>
            <select required aria-label="Substituto" value={subOf.substitute} onChange={(e) => setSubOf({ ...subOf, substitute: e.target.value })} className={fieldCls}><option value="">Substituto…</option>{employees.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <textarea required minLength={5} aria-label="Motivo" placeholder="Motivo da troca" value={subOf.reason} onChange={(e) => setSubOf({ ...subOf, reason: e.target.value })} className="w-full rounded-2xl border border-line bg-hover px-4 py-3 text-sm outline-none focus:border-brand" />
            <Button type="submit" loading={sub.isPending} className="w-full">Pedir troca</Button>
          </form>
        )}
      </Sheet>
    </Page>
  );
}
