'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ClipboardList, Plus, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CompanyActions, fieldCls, labelCls } from '@/components/company-actions';
import { useCompanyOptions } from '@/components/module-opts';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick } from '@/lib/schedules';
import { addDays, todayBr } from '@/lib/timesheet';

interface Occ { id: string; unit: string; type: string; title: string; description: string | null; occurredAt: string; status: string; employment: string | null; responsible: string | null; events: Array<{ action: string; notes: string | null; at: string; by: string }> }
const TYPE: Record<string, string> = { ABSENCE: 'Falta', LATE: 'Atraso', EARLY_LEAVE: 'Saída antecipada', MISSING_RECORD: 'Marcação incompleta', OVERTIME: 'Hora extra', INSUFFICIENT_BREAK: 'Intervalo curto', UNCOVERED_SHIFT: 'Plantão descoberto', INCOMPLETE_TEAM: 'Equipe incompleta', OPERATIONAL_ISSUE: 'Problema operacional', PROFESSIONAL_SWAP: 'Troca de profissional', SCHEDULE_CHANGE: 'Mudança de escala', EQUIPMENT_UNAVAILABLE: 'Equipamento indisponível', OTHER: 'Outro' };
const STATUS: Record<string, string> = { OPEN: 'Aberta', IN_PROGRESS: 'Em tratamento', RESOLVED: 'Resolvida', DISMISSED: 'Descartada' };
const ACTION: Record<string, string> = { CREATE: 'Registrada', START: 'Em tratamento', RESOLVE: 'Resolvida', DISMISS: 'Descartada', REOPEN: 'Reaberta', COMMENT: 'Comentário' };

export default function OcorrenciasPage() {
  const { me } = useSession();
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const { units, employees } = useCompanyOptions(companyId);
  const toast = useToast();
  const qc = useQueryClient();
  const manage = can(me, 'operational.occurrences:manage');
  const [status, setStatus] = useState('ACTIVE');
  const list = useQuery({ queryKey: ['occurrences', tenantId, status], queryFn: () => api<Occ[]>(`/operational/occurrences?status=${status}`), enabled: !!tenantId });
  const [form, setForm] = useState<{ unitId: string; type: string; title: string; description: string; employmentId: string } | null>(null);
  const [open, setOpen] = useState<Occ | null>(null);
  const [notes, setNotes] = useState('');
  const [genDate, setGenDate] = useState('');
  useEffect(() => setGenDate(addDays(todayBr(), -1)), []);
  const refresh = () => qc.invalidateQueries({ queryKey: ['occurrences'] });
  const err = (e: Error) => toast('error', e.message);
  const create = useMutation({ mutationFn: () => api('/operational/occurrences', { method: 'POST', json: { ...form, description: form!.description || null, employmentId: form!.employmentId || null, occurredAt: new Date().toISOString() } }), onSuccess: () => { setForm(null); refresh(); toast('success', 'Ocorrência registrada'); }, onError: err });
  const act = useMutation({ mutationFn: (action: string) => api(`/operational/occurrences/${open!.id}/actions`, { method: 'POST', json: { action, ...(notes ? { notes } : {}) } }), onSuccess: () => { setOpen(null); setNotes(''); refresh(); }, onError: err });
  const gen = useMutation({ mutationFn: () => api<{ created: number; skipped: number; noUnit: number }>('/operational/occurrences/generate', { method: 'POST', json: { companyId, date: genDate } }), onSuccess: (r) => { refresh(); toast('success', `${r.created} criada(s), ${r.skipped} já existiam${r.noUnit ? `, ${r.noUnit} sem unidade` : ''}`); }, onError: err });

  return (
    <Page>
      <PageHeader title="Ocorrências" description="Registre e trate ocorrências da operação, com histórico. Faltas, atrasos e marcações incompletas podem ser geradas do espelho diário." actions={<>
        <CompanyActions {...{ isPlatform, tenantId, pickTenant, companies, companyId, setCompanyId }} />
        {manage && <Button onClick={() => setForm({ unitId: units[0]?.id ?? '', type: 'OPERATIONAL_ISSUE', title: '', description: '', employmentId: '' })} disabled={!units.length}><Plus className="size-4" />Nova ocorrência</Button>}
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="As ocorrências são por unidade." /></Card> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[['ACTIVE', 'Abertas'], ['RESOLVED', 'Resolvidas'], ['DISMISSED', 'Descartadas']].map(([k, l]) => <button key={k} onClick={() => setStatus(k!)} className={cn('rounded-full border px-3 py-1.5 text-sm', status === k ? 'border-brand/50 bg-brand-soft' : 'border-line text-muted')}>{l}</button>)}
            {manage && <div className="ml-auto flex items-center gap-2"><input type="date" aria-label="Dia do espelho" value={genDate} onChange={(e) => setGenDate(e.target.value)} className="h-10 rounded-2xl border border-line bg-hover px-3 text-sm" /><Button variant="outline" onClick={() => gen.mutate()} loading={gen.isPending} disabled={!companyId}><Wand2 className="size-4" />Gerar do espelho</Button></div>}
          </div>
          {!list.data ? <Skeleton className="h-64 rounded-[28px]" /> : !list.data.length ? <Card><EmptyState icon={ClipboardList} title="Nenhuma ocorrência" body="Nada para tratar aqui." /></Card> : (
            <div className="space-y-2">
              {list.data.map((o) => (
                <Card key={o.id} className="flex cursor-pointer flex-wrap items-center gap-3 rounded-[22px] p-4 hover:bg-hover" onClick={() => setOpen(o)}>
                  <span className="rounded-full bg-hover px-2 py-0.5 text-xs">{TYPE[o.type] ?? o.type}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{o.title}</p><p className="text-xs text-subtle">{o.unit} · {new Date(o.occurredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{o.responsible ? ` · resp. ${o.responsible}` : ''}</p></div>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', o.status === 'OPEN' ? 'bg-danger/15 text-danger' : o.status === 'IN_PROGRESS' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success')}>{STATUS[o.status]}</span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      <Sheet open={!!form} onClose={() => setForm(null)} title="Nova ocorrência">
        {form && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <label className="block space-y-1.5"><span className={labelCls}>Unidade</span><select required value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className={fieldCls}>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
            <label className="block space-y-1.5"><span className={labelCls}>Tipo</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={fieldCls}>{Object.entries(TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <Input label="Título" required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <label className="block space-y-1.5"><span className={labelCls}>Descrição</span><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-2xl border border-line bg-hover px-4 py-3 text-sm outline-none focus:border-brand" /></label>
            <label className="block space-y-1.5"><span className={labelCls}>Funcionário envolvido (opcional)</span><select value={form.employmentId} onChange={(e) => setForm({ ...form, employmentId: e.target.value })} className={fieldCls}><option value="">Nenhum</option>{employees.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <Button type="submit" loading={create.isPending} className="w-full">Registrar</Button>
          </form>
        )}
      </Sheet>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && (
          <div className="space-y-4 text-sm">
            <p className="text-muted">{TYPE[open.type]} · {open.unit}{open.employment ? ` · ${open.employment}` : ''}</p>
            {open.description && <p className="whitespace-pre-line">{open.description}</p>}
            <ol className="space-y-2 border-l border-line pl-4">{open.events.map((e, i) => <li key={i}><b>{ACTION[e.action] ?? e.action}</b> <span className="text-xs text-subtle">{new Date(e.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {e.by}</span>{e.notes && <p className="text-muted">{e.notes}</p>}</li>)}</ol>
            {manage && (
              <div className="space-y-2">
                <textarea aria-label="Observação" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observação (obrigatória para resolver ou descartar)" className="w-full rounded-2xl border border-line bg-hover px-4 py-3 text-sm outline-none focus:border-brand" />
                <div className="flex flex-wrap gap-2">
                  {open.status === 'OPEN' && <Button variant="outline" onClick={() => act.mutate('START')}>Iniciar tratamento</Button>}
                  {['OPEN', 'IN_PROGRESS'].includes(open.status) && <><Button onClick={() => act.mutate('RESOLVE')}>Resolver</Button><Button variant="ghost" onClick={() => act.mutate('DISMISS')}>Descartar</Button></>}
                  {['RESOLVED', 'DISMISSED'].includes(open.status) && <Button variant="outline" onClick={() => act.mutate('REOPEN')}>Reabrir</Button>}
                  <Button variant="ghost" onClick={() => act.mutate('COMMENT')} disabled={!notes}>Comentar</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </Page>
  );
}
