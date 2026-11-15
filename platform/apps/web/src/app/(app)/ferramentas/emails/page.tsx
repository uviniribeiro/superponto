'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Eye, MailCheck, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CompanyActions, fieldCls, labelCls } from '@/components/company-actions';
import { Page, PageHeader } from '@/components/page';
import { useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick, WEEKDAYS } from '@/lib/schedules';

const KINDS: Array<[string, string]> = [['ABSENCES', 'Faltas de ontem'], ['LATE', 'Atrasados agora (sem entrada)'], ['PENDING_ADJUSTMENTS', 'Ajustes aguardando aprovação'], ['PENDING_REQUESTS', 'Solicitações pendentes'], ['DEVICES_OFFLINE', 'Relógios sem comunicação']];
interface Sched { id: string; companyId: string; name: string; kinds: string[]; time: string; weekdays: number[]; recipients: string[]; active: boolean; lastRunAt: string | null }
interface Digest { company: string; date: string; sections: Array<{ kind: string; title: string; lines: string[] }> }
type Form = { name: string; kinds: string[]; time: string; weekdays: number[]; recipients: string; active: boolean };

export default function EmailsPage() {
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['notif', tenantId, companyId], queryFn: () => api<Sched[]>(`/notification-schedules?companyId=${companyId}`), enabled: !!companyId });
  const [edit, setEdit] = useState<{ id: string | null; f: Form } | null>(null);
  const [del, setDel] = useState<Sched | null>(null);
  const [preview, setPreview] = useState<Sched | null>(null);
  const pv = useQuery({ queryKey: ['notif-preview', preview?.id], queryFn: () => api<Digest>(`/notification-schedules/${preview!.id}/preview`), enabled: !!preview });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notif'] });
  const save = useMutation({
    mutationFn: () => {
      const f = edit!.f;
      const json = { name: f.name, kinds: f.kinds, time: f.time, weekdays: f.weekdays, recipients: f.recipients.split(/[\s,;]+/).filter(Boolean), active: f.active };
      return edit!.id ? api(`/notification-schedules/${edit!.id}`, { method: 'PATCH', json }) : api('/notification-schedules', { method: 'POST', json: { ...json, companyId } });
    },
    onSuccess: () => { toast('success', 'Agendamento salvo'); setEdit(null); refresh(); },
    onError: (e: Error) => toast('error', e.message),
  });
  const send = useMutation({ mutationFn: (id: string) => api<{ sent: number; recipients: number }>(`/notification-schedules/${id}/send`, { method: 'POST' }), onSuccess: (r) => { toast('success', `Enviado para ${r.sent} de ${r.recipients} destinatário(s)`); refresh(); }, onError: (e: Error) => toast('error', e.message) });
  const remove = useMutation({ mutationFn: (id: string) => api(`/notification-schedules/${id}`, { method: 'DELETE' }), onSuccess: () => { setDel(null); refresh(); }, onError: (e: Error) => toast('error', e.message) });
  const set = (p: Partial<Form>) => setEdit((e) => e && { ...e, f: { ...e.f, ...p } });
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <Page>
      <PageHeader title="E-mails agendados" description="Resumo diário por e-mail para o RH e gestores: faltas, atrasos, pendências e relógios sem comunicação." actions={<>
        <CompanyActions {...{ isPlatform, tenantId, pickTenant, companies, companyId, setCompanyId }} />
        <Button onClick={() => setEdit({ id: null, f: { name: 'Resumo diário', kinds: ['ABSENCES', 'LATE'], time: '09:00', weekdays: [1, 2, 3, 4, 5], recipients: '', active: true } })} disabled={!companyId}><Plus className="size-4" />Novo agendamento</Button>
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="Os resumos são por empresa." /></Card> : !list.data ? <Skeleton className="h-64 rounded-[28px]" /> : !list.data.length ? <Card><EmptyState icon={MailCheck} title="Nenhum e-mail agendado" body="Crie um resumo para receber todo dia no horário escolhido." /></Card> : (
        <div className="space-y-3">
          {list.data.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center gap-4 rounded-[24px]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><h3 className="font-semibold">{s.name}</h3><span className={cn('rounded-full px-2 py-0.5 text-xs', s.active ? 'bg-success/15 text-success' : 'bg-hover text-muted')}>{s.active ? 'Ativo' : 'Pausado'}</span></div>
                <p className="text-sm text-muted">{s.time} · {s.weekdays.length ? s.weekdays.map((d) => WEEKDAYS[d]).join(', ') : 'todos os dias'} · {s.kinds.map((k) => KINDS.find((x) => x[0] === k)?.[1]).join(', ')}</p>
                <p className="text-xs text-subtle">Para: {s.recipients.join(', ')}{s.lastRunAt ? ` · último envio ${new Date(s.lastRunAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => setPreview(s)}><Eye className="size-4" />Prévia</Button>
                <Button variant="ghost" onClick={() => send.mutate(s.id)} loading={send.isPending && send.variables === s.id}><Send className="size-4" />Enviar agora</Button>
                <Button variant="ghost" aria-label="Editar" onClick={() => setEdit({ id: s.id, f: { name: s.name, kinds: s.kinds, time: s.time, weekdays: s.weekdays, recipients: s.recipients.join(', '), active: s.active } })}><Pencil className="size-4" /></Button>
                <Button variant="ghost" aria-label="Excluir" onClick={() => setDel(s)}><Trash2 className="size-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar agendamento' : 'Novo agendamento'}>
        {edit && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Input label="Nome" required value={edit.f.name} onChange={(e) => set({ name: e.target.value })} />
            <div className="space-y-1.5"><span className={labelCls}>O que enviar</span>{KINDS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.f.kinds.includes(k)} onChange={() => set({ kinds: toggle(edit.f.kinds, k) })} className="accent-[var(--brand)]" />{l}</label>)}</div>
            <label className="block space-y-1.5"><span className={labelCls}>Horário (Brasília)</span><input required pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="09:00" value={edit.f.time} onChange={(e) => set({ time: e.target.value })} className={fieldCls} /></label>
            <div className="space-y-1.5"><span className={labelCls}>Dias</span><div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((d, i) => <button type="button" key={d} onClick={() => set({ weekdays: toggle(edit.f.weekdays, i).sort() })} className={cn('h-9 w-12 rounded-full border text-sm', edit.f.weekdays.includes(i) ? 'border-brand/50 bg-brand-soft' : 'border-line text-muted')}>{d}</button>)}</div><span className="text-xs text-subtle">Nenhum marcado = todos os dias.</span></div>
            <label className="block space-y-1.5"><span className={labelCls}>Destinatários</span><textarea required rows={3} value={edit.f.recipients} onChange={(e) => set({ recipients: e.target.value })} placeholder="rh@empresa.com.br, gestor@empresa.com.br" className="w-full rounded-2xl border border-line bg-hover px-4 py-3 text-sm outline-none focus:border-brand" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.f.active} onChange={(e) => set({ active: e.target.checked })} className="accent-[var(--brand)]" />Ativo</label>
            <Button type="submit" loading={save.isPending} disabled={!edit.f.kinds.length} className="w-full">Salvar</Button>
          </form>
        )}
      </Sheet>
      <Sheet open={!!preview} onClose={() => setPreview(null)} title={`Prévia: ${preview?.name ?? ''}`} wide>
        {!pv.data ? <Skeleton className="h-60" /> : (
          <div className="space-y-4">
            <p className="text-sm text-muted">{pv.data.company} · {pv.data.date.split('-').reverse().join('/')}</p>
            {pv.data.sections.map((s) => <div key={s.kind}><h3 className="font-semibold">{s.title}</h3>{s.lines.length ? <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="text-sm text-subtle">Nada a informar.</p>}</div>)}
          </div>
        )}
      </Sheet>
      <Confirm open={!!del} title="Excluir agendamento?" body={`"${del?.name ?? ''}" deixa de ser enviado.`} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} onCancel={() => setDel(null)} />
    </Page>
  );
}
