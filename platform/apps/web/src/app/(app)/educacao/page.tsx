'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Building2, CalendarClock, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CompanyActions, fieldCls, labelCls } from '@/components/company-actions';
import { useCompanyOptions } from '@/components/module-opts';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick, WEEKDAYS } from '@/lib/schedules';
import { monthRange, todayBr } from '@/lib/timesheet';

interface Overview {
  courses: Array<{ id: string; name: string }>; subjects: Array<{ id: string; name: string; courseId: string | null }>; periods: Array<{ id: string; name: string; startsOn: string; endsOn: string }>;
  classes: Array<{ id: string; name: string; shift: string | null; course: string | null; periodId: string; assignments: Array<{ id: string; teacher: string; subject: string; weeklyLessons: number | null; slots: Array<{ id: string; weekday: number; startTime: string; endTime: string }> }> }>;
}
interface Lesson { scheduleId: string; startTime: string; endTime: string; className: string; subject: string; teacher: string; status: string; substitute: string | null }
const ST: Record<string, string> = { SCHEDULED: 'Prevista', HELD: 'Dada', NOT_HELD: 'Não dada', SUBSTITUTED: 'Substituída', CANCELLED: 'Cancelada' };
type Dialog = { kind: 'course' | 'subject' | 'period' | 'class' | 'assign' | 'slot'; data: Record<string, string> } | null;

export default function EducacaoPage() {
  const { me } = useSession();
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const { units, employees } = useCompanyOptions(companyId);
  const toast = useToast();
  const qc = useQueryClient();
  const manage = can(me, 'education.academic:manage');
  const canSession = can(me, 'education.sessions:manage');
  const [tab, setTab] = useState<'turmas' | 'dia' | 'resumo'>('turmas');
  const [date, setDate] = useState('');
  useEffect(() => setDate(todayBr()), []);
  const ov = useQuery({ queryKey: ['edu', tenantId, companyId], queryFn: () => api<Overview>(`/education?companyId=${companyId}`), enabled: !!companyId });
  const day = useQuery({ queryKey: ['edu-day', companyId, date], queryFn: () => api<Lesson[]>(`/education/day?companyId=${companyId}&date=${date}`), enabled: !!companyId && !!date && tab === 'dia' });
  const range = date ? monthRange(date) : null;
  const sum = useQuery({ queryKey: ['edu-sum', companyId, range?.from], queryFn: () => api<Array<{ teacher: string; registration: string; held: number; notHeld: number; substitutedOut: number; substitutedIn: number; minutes: number }>>(`/education/summary?companyId=${companyId}&from=${range!.from}&to=${range!.to}`), enabled: !!companyId && !!range && tab === 'resumo' });
  const [dlg, setDlg] = useState<Dialog>(null);
  const [subFor, setSubFor] = useState<{ scheduleId: string; substitute: string } | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['edu'] }); qc.invalidateQueries({ queryKey: ['edu-day'] }); qc.invalidateQueries({ queryKey: ['edu-sum'] }); };
  const err = (e: Error) => toast('error', e.message);
  const save = useMutation({
    mutationFn: () => {
      const d = dlg!.data;
      const n = (v?: string) => (v ? v : null);
      switch (dlg!.kind) {
        case 'course': return api('/education/courses', { method: 'POST', json: { companyId, name: d.name } });
        case 'subject': return api('/education/subjects', { method: 'POST', json: { companyId, name: d.name, courseId: n(d.courseId), weeklyLessons: d.weeklyLessons ? Number(d.weeklyLessons) : null } });
        case 'period': return api('/education/periods', { method: 'POST', json: { companyId, name: d.name, startsOn: d.startsOn, endsOn: d.endsOn } });
        case 'class': return api('/education/classes', { method: 'POST', json: { unitId: d.unitId, periodId: d.periodId, courseId: n(d.courseId), name: d.name, shift: n(d.shift) } });
        case 'assign': return api('/education/assignments', { method: 'POST', json: { classId: d.classId, subjectId: d.subjectId, employmentId: d.employmentId, validFrom: d.validFrom } });
        case 'slot': return api('/education/slots', { method: 'POST', json: { assignmentId: d.assignmentId, weekday: Number(d.weekday), startTime: d.startTime, endTime: d.endTime } });
      }
    },
    onSuccess: () => { toast('success', 'Salvo'); setDlg(null); refresh(); }, onError: err,
  });
  const removeSlot = useMutation({ mutationFn: (id: string) => api(`/education/slots/${id}`, { method: 'DELETE' }), onSuccess: refresh, onError: err });
  const record = useMutation({ mutationFn: (v: { scheduleId: string; status: string; substituteEmploymentId?: string }) => api('/education/sessions', { method: 'POST', json: { date, ...v } }), onSuccess: () => { setSubFor(null); refresh(); }, onError: err });
  const o = ov.data;
  const f = (k: string) => dlg?.data[k] ?? '';
  const set = (k: string, v: string) => setDlg((x) => x && { ...x, data: { ...x.data, [k]: v } });
  const sel = (k: string, label: string, opts: Array<{ id: string; name: string }>, required = true) => <label className="block space-y-1.5"><span className={labelCls}>{label}</span><select required={required} value={f(k)} onChange={(e) => set(k, e.target.value)} className={fieldCls}><option value="">{required ? 'Escolha…' : 'Nenhum'}</option>{opts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>;

  return (
    <Page>
      <PageHeader title="Educação" description="Cursos, disciplinas, turmas, professores e grade horária; registro das aulas do dia e resumo de aulas por professor." actions={<CompanyActions {...{ isPlatform, tenantId, pickTenant, companies, companyId, setCompanyId }} />} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="A escola é uma empresa com unidades." /></Card> : !o ? <Skeleton className="h-96 rounded-[28px]" /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([['turmas', 'Turmas e grade'], ['dia', 'Aulas do dia'], ['resumo', 'Resumo do mês']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn('rounded-full border px-4 py-1.5 text-sm', tab === k ? 'border-brand/50 bg-brand-soft' : 'border-line text-muted')}>{l}</button>)}
            {tab !== 'turmas' && <input type="date" aria-label="Data" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-full border border-line bg-hover px-3 text-sm" />}
          </div>
          {tab === 'turmas' && (
            <>
              {manage && <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setDlg({ kind: 'period', data: { name: String(new Date().getFullYear()), startsOn: '', endsOn: '' } })}><Plus className="size-4" />Período letivo</Button>
                <Button variant="outline" onClick={() => setDlg({ kind: 'course', data: {} })}><Plus className="size-4" />Curso</Button>
                <Button variant="outline" onClick={() => setDlg({ kind: 'subject', data: {} })}><Plus className="size-4" />Disciplina</Button>
                <Button onClick={() => setDlg({ kind: 'class', data: { periodId: o.periods[0]?.id ?? '', unitId: units[0]?.id ?? '' } })} disabled={!o.periods.length || !units.length}><Plus className="size-4" />Turma</Button>
              </div>}
              <p className="text-xs text-subtle">{o.periods.length} período(s) · {o.courses.length} curso(s) · {o.subjects.length} disciplina(s){!units.length ? ' · cadastre uma unidade em Organização › Unidades' : ''}</p>
              {!o.classes.length ? <Card><EmptyState icon={BookOpen} title="Nenhuma turma" body="Crie o período letivo, as disciplinas e as turmas; depois aloque os professores e monte a grade." /></Card> : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {o.classes.map((c) => (
                    <Card key={c.id} className="space-y-3 rounded-[24px]">
                      <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{c.name}</h3><p className="text-xs text-subtle">{[c.course, c.shift?.toLowerCase(), o.periods.find((p) => p.id === c.periodId)?.name].filter(Boolean).join(' · ')}</p></div>{manage && <Button variant="ghost" className="h-8" onClick={() => setDlg({ kind: 'assign', data: { classId: c.id, validFrom: todayBr() } })}><Plus className="size-4" />Professor</Button>}</div>
                      {c.assignments.map((a) => (
                        <div key={a.id} className="rounded-2xl bg-hover p-3 text-sm">
                          <div className="flex items-center justify-between gap-2"><span><b>{a.subject}</b> · {a.teacher}</span>{manage && <button className="text-xs text-muted hover:text-fg" onClick={() => setDlg({ kind: 'slot', data: { assignmentId: a.id, weekday: '1', startTime: '07:30', endTime: '08:20' } })}>+ horário</button>}</div>
                          <div className="mt-1 flex flex-wrap gap-1">{a.slots.map((s) => <span key={s.id} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-0.5 font-mono text-xs">{WEEKDAYS[s.weekday]} {s.startTime}–{s.endTime}{manage && <button aria-label="Remover horário" onClick={() => removeSlot.mutate(s.id)} className="text-subtle hover:text-danger"><Trash2 className="size-3" /></button>}</span>)}{!a.slots.length && <span className="text-xs text-subtle">sem horário na grade{a.weeklyLessons ? ` (${a.weeklyLessons} aulas/semana)` : ''}</span>}</div>
                        </div>
                      ))}
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
          {tab === 'dia' && (!day.data ? <Skeleton className="h-48 rounded-[28px]" /> : !day.data.length ? <Card><EmptyState icon={CalendarClock} title="Nenhuma aula prevista" body="A grade não tem aulas neste dia da semana." /></Card> : (
            <Card className="overflow-hidden rounded-[24px] p-0">
              <table className="w-full text-sm"><thead className="text-left text-xs text-muted"><tr><th className="px-4 py-2">Horário</th><th>Turma</th><th>Disciplina</th><th>Professor</th><th>Situação</th><th /></tr></thead>
                <tbody>{day.data.map((l) => (
                  <tr key={l.scheduleId} className="border-t border-line">
                    <td className="px-4 py-2 font-mono text-xs">{l.startTime}–{l.endTime}</td><td>{l.className}</td><td>{l.subject}</td><td>{l.teacher}{l.substitute && <span className="block text-xs text-subtle">subst.: {l.substitute}</span>}</td>
                    <td><span className={cn('rounded-full px-2 py-0.5 text-xs', l.status === 'HELD' ? 'bg-success/15 text-success' : l.status === 'NOT_HELD' ? 'bg-danger/15 text-danger' : 'bg-hover')}>{ST[l.status]}</span></td>
                    <td className="px-2 text-right">{canSession && <div className="flex justify-end gap-1"><Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => record.mutate({ scheduleId: l.scheduleId, status: 'HELD' })}>Dada</Button><Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => record.mutate({ scheduleId: l.scheduleId, status: 'NOT_HELD' })}>Não dada</Button><Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSubFor({ scheduleId: l.scheduleId, substitute: '' })}>Substituída</Button></div>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
          ))}
          {tab === 'resumo' && (!sum.data ? <Skeleton className="h-48 rounded-[28px]" /> : !sum.data.length ? <Card><EmptyState icon={BookOpen} title="Nenhuma aula registrada no mês" body="Registre as aulas em Aulas do dia." /></Card> : (
            <Card className="overflow-hidden rounded-[24px] p-0">
              <table className="w-full text-sm"><thead className="text-left text-xs text-muted"><tr><th className="px-4 py-2">Professor</th><th className="text-right">Dadas</th><th className="text-right">Não dadas</th><th className="text-right">Substituído</th><th className="text-right">Substituiu</th><th className="px-4 text-right">Horas-aula</th></tr></thead>
                <tbody>{sum.data.map((r) => <tr key={r.registration} className="border-t border-line"><td className="px-4 py-2">{r.teacher} <span className="text-xs text-subtle">{r.registration}</span></td><td className="text-right">{r.held}</td><td className="text-right">{r.notHeld}</td><td className="text-right">{r.substitutedOut}</td><td className="text-right">{r.substitutedIn}</td><td className="px-4 text-right font-mono text-xs">{Math.floor(r.minutes / 60)}h{String(r.minutes % 60).padStart(2, '0')}</td></tr>)}</tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={!!dlg} onClose={() => setDlg(null)} title={{ course: 'Novo curso', subject: 'Nova disciplina', period: 'Novo período letivo', class: 'Nova turma', assign: 'Alocar professor', slot: 'Horário na grade' }[dlg?.kind ?? 'course']}>
        {dlg && o && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            {['course', 'subject', 'period', 'class'].includes(dlg.kind) && <Input label="Nome" required value={f('name')} onChange={(e) => set('name', e.target.value)} />}
            {dlg.kind === 'subject' && <>{sel('courseId', 'Curso', o.courses, false)}<Input label="Aulas por semana" inputMode="numeric" value={f('weeklyLessons')} onChange={(e) => set('weeklyLessons', e.target.value.replace(/\D/g, ''))} /></>}
            {dlg.kind === 'period' && <div className="grid grid-cols-2 gap-3"><label className="space-y-1.5"><span className={labelCls}>Início</span><input type="date" required value={f('startsOn')} onChange={(e) => set('startsOn', e.target.value)} className={fieldCls} /></label><label className="space-y-1.5"><span className={labelCls}>Fim</span><input type="date" required value={f('endsOn')} onChange={(e) => set('endsOn', e.target.value)} className={fieldCls} /></label></div>}
            {dlg.kind === 'class' && <>{sel('periodId', 'Período letivo', o.periods)}{sel('unitId', 'Unidade', units)}{sel('courseId', 'Curso', o.courses, false)}<label className="block space-y-1.5"><span className={labelCls}>Turno</span><select value={f('shift')} onChange={(e) => set('shift', e.target.value)} className={fieldCls}><option value="">—</option><option value="MANHA">Manhã</option><option value="TARDE">Tarde</option><option value="NOITE">Noite</option><option value="INTEGRAL">Integral</option></select></label></>}
            {dlg.kind === 'assign' && <>{sel('subjectId', 'Disciplina', o.subjects)}{sel('employmentId', 'Professor', employees)}<label className="block space-y-1.5"><span className={labelCls}>A partir de</span><input type="date" required value={f('validFrom')} onChange={(e) => set('validFrom', e.target.value)} className={fieldCls} /></label></>}
            {dlg.kind === 'slot' && <><label className="block space-y-1.5"><span className={labelCls}>Dia</span><select value={f('weekday')} onChange={(e) => set('weekday', e.target.value)} className={fieldCls}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><Input label="Início" required pattern="([01][0-9]|2[0-3]):[0-5][0-9]" value={f('startTime')} onChange={(e) => set('startTime', e.target.value)} /><Input label="Fim" required pattern="([01][0-9]|2[0-3]):[0-5][0-9]" value={f('endTime')} onChange={(e) => set('endTime', e.target.value)} /></div></>}
            <Button type="submit" loading={save.isPending} className="w-full">Salvar</Button>
          </form>
        )}
      </Sheet>
      <Sheet open={!!subFor} onClose={() => setSubFor(null)} title="Aula substituída">
        {subFor && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); record.mutate({ scheduleId: subFor.scheduleId, status: 'SUBSTITUTED', substituteEmploymentId: subFor.substitute }); }}>
            <select required aria-label="Professor substituto" value={subFor.substitute} onChange={(e) => setSubFor({ ...subFor, substitute: e.target.value })} className={fieldCls}><option value="">Professor substituto…</option>{employees.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <Button type="submit" loading={record.isPending} className="w-full">Salvar</Button>
          </form>
        )}
      </Sheet>
    </Page>
  );
}
