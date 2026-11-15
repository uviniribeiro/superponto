'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, MessageSquarePlus, Send, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Page as Paged, type Ref } from '@/lib/api';
import { cn } from '@/lib/cn';
import { hhmm, todayBr } from '@/lib/timesheet';

interface Req {
  id: string; type: string; typeLabel: string; status: string; currentStep: number; steps: Array<{ label: string }>; refDate: string | null; payload: Record<string, unknown>; justification: string; createdAt: string;
  employee: { registration: string; name: string }; decisions: Array<{ step: number; decision: string; comment: string | null; createdAt: string }>;
}
const STATUS: Record<string, [string, string]> = { PENDING: ['Pendente', 'bg-brand-soft'], APPROVED: ['Aprovada', 'bg-success/15 text-success'], REJECTED: ['Recusada', 'bg-danger/15 text-danger'], CANCELLED: ['Cancelada', 'bg-hover text-muted'], NEEDS_INFO: ['Aguardando informação', 'bg-warning/15 text-warning'] };
const TYPES: Array<[string, string, string]> = [
  ['RECORD_CORRECTION', 'Esqueci de marcar', 'Inclui uma marcação no dia'],
  ['ABSENCE_JUSTIFICATION', 'Justificar falta ou atraso', 'Vira abono quando aprovado'],
  ['SCHEDULE_CHANGE', 'Trocar folga', 'Trabalhar numa folga e folgar num dia de trabalho'],
  ['OVERTIME_AUTHORIZATION', 'Autorização de hora extra', 'Pedido prévio para fazer extra'],
  ['OTHER', 'Outro pedido', 'Declarações e assuntos gerais'],
];
const dmy = (v: string) => v.split('-').reverse().join('/');

function describe(r: Req) {
  const p = r.payload;
  if (r.type === 'RECORD_CORRECTION') return `Marcação às ${p.time} em ${dmy(r.refDate!)}`;
  if (r.type === 'ABSENCE_JUSTIFICATION') return `${p.fullDay === false ? `${p.minutes} min` : 'Dia inteiro'} em ${dmy(r.refDate!)}`;
  if (r.type === 'SCHEDULE_CHANGE') return `Folgar em ${dmy(r.refDate!)} e trabalhar em ${dmy(String(p.offDate))}`;
  if (r.type === 'OVERTIME_AUTHORIZATION') return `Até ${hhmm(Number(p.maxMinutes))} de extra em ${dmy(r.refDate!)}`;
  return String(p.subject ?? '');
}

function Steps({ r }: { r: Req }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      {r.steps.map((s, i) => {
        const d = r.decisions.find((x) => x.step === i);
        const cls = d?.decision === 'APPROVED' ? 'bg-success/15 text-success' : d?.decision === 'REJECTED' ? 'bg-danger/15 text-danger' : i === r.currentStep && r.status === 'PENDING' ? 'bg-brand-soft' : 'bg-hover text-subtle';
        return <span key={i} className={cn('rounded-full px-2 py-0.5', cls)}>{i + 1}. {s.label}</span>;
      })}
    </div>
  );
}

function NewRequest({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState('RECORD_CORRECTION');
  const t = todayBr();
  const [f, setF] = useState({ refDate: t, time: '', justificationId: '', fullDay: true, minutes: '', offDate: '', maxMinutes: '60', subject: '', justification: '' });
  const js = useQuery({ queryKey: ['justifications'], queryFn: () => api<Paged<Ref & { active: boolean }>>('/justifications?pageSize=200'), enabled: type === 'ABSENCE_JUSTIFICATION', retry: false });
  const payload = () => {
    switch (type) {
      case 'RECORD_CORRECTION': return { time: f.time };
      case 'ABSENCE_JUSTIFICATION': return { justificationId: f.justificationId, fullDay: f.fullDay, ...(f.fullDay ? {} : { minutes: Number(f.minutes) }) };
      case 'SCHEDULE_CHANGE': return { offDate: f.offDate };
      case 'OVERTIME_AUTHORIZATION': return { maxMinutes: Number(f.maxMinutes) };
      default: return { subject: f.subject };
    }
  };
  const save = useMutation({
    mutationFn: () => api('/requests', { method: 'POST', json: { type, ...(type === 'OTHER' ? {} : { refDate: f.refDate }), payload: payload(), justification: f.justification } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); toast('success', 'Solicitação enviada'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4 text-sm">
      <div className="grid gap-2">
        {TYPES.map(([k, l, h]) => (
          <button key={k} type="button" onClick={() => setType(k)} className={cn('rounded-2xl border px-4 py-2.5 text-left transition-colors', type === k ? 'border-brand/60 bg-brand-soft' : 'border-line hover:bg-hover')}>
            <span className="block font-medium">{l}</span><span className="block text-xs text-muted">{h}</span>
          </button>
        ))}
      </div>
      {type !== 'OTHER' && <Input label={type === 'SCHEDULE_CHANGE' ? 'Dia em que quer folgar' : 'Dia'} type="date" value={f.refDate} onChange={(e) => setF({ ...f, refDate: e.target.value })} required />}
      {type === 'RECORD_CORRECTION' && <Input label="Horário que faltou" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} required />}
      {type === 'ABSENCE_JUSTIFICATION' && (
        <>
          <select required aria-label="Justificativa" value={f.justificationId} onChange={(e) => setF({ ...f, justificationId: e.target.value })} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 [&>option]:bg-elevated">
            <option value="">Motivo…</option>{(js.data?.data ?? []).filter((j) => j.active).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <div className="flex items-center gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={f.fullDay} onChange={(e) => setF({ ...f, fullDay: e.target.checked })} className="accent-[var(--brand)]" />Dia inteiro</label>{!f.fullDay && <input aria-label="Minutos" inputMode="numeric" placeholder="minutos" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value.replace(/\D/g, '') })} className="h-9 w-24 rounded-xl border border-line bg-hover px-2 text-center font-mono" />}</div>
        </>
      )}
      {type === 'SCHEDULE_CHANGE' && <Input label="Folga em que vai trabalhar" type="date" value={f.offDate} onChange={(e) => setF({ ...f, offDate: e.target.value })} required />}
      {type === 'OVERTIME_AUTHORIZATION' && <Input label="Máximo de extra (minutos)" inputMode="numeric" value={f.maxMinutes} onChange={(e) => setF({ ...f, maxMinutes: e.target.value.replace(/\D/g, '') })} required hint={hhmm(Number(f.maxMinutes))} />}
      {type === 'OTHER' && <Input label="Assunto" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required minLength={3} />}
      <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wider text-subtle">Explique</span>
        <textarea value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} required minLength={5} maxLength={500} rows={3} className="w-full rounded-2xl border border-line bg-hover p-3 outline-none focus:border-brand" />
      </label>
      <Button type="submit" loading={save.isPending} className="h-12 w-full"><Send className="size-4" />Enviar</Button>
    </form>
  );
}

function RequestCard({ r, actions }: { r: Req; actions?: React.ReactNode }) {
  const [label, cls] = STATUS[r.status] ?? [r.status, 'bg-hover'];
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="glass rounded-[22px] p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{r.typeLabel} <span className="text-xs font-normal text-subtle">· {r.employee.name} ({r.employee.registration})</span></p>
          <p className="text-sm">{describe(r)}</p>
          <p className="mt-1 text-xs text-muted">“{r.justification}”</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs', cls)}>{label}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Steps r={r} />{actions}</div>
      {r.decisions.filter((d) => d.comment).map((d, i) => <p key={i} className="mt-2 text-xs text-muted">Etapa {d.step + 1}: {d.comment}</p>)}
    </motion.div>
  );
}

export default function SolicitacoesPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'mine' | 'inbox' | 'all'>('mine');
  const [creating, setCreating] = useState(false);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [comment, setComment] = useState('');
  const canSeeAll = can(me, 'requests.requests:read');
  const mine = useQuery({ queryKey: ['requests', 'mine', tenantId], queryFn: () => api<Req[]>('/requests/mine'), enabled: !!tenantId });
  const inbox = useQuery({ queryKey: ['requests', 'inbox', tenantId], queryFn: () => api<Req[]>('/requests/inbox'), enabled: !!tenantId });
  const all = useQuery({ queryKey: ['requests', 'all', tenantId], queryFn: () => api<Req[]>('/requests'), enabled: !!tenantId && canSeeAll && tab === 'all' });
  useEffect(() => { if (inbox.data?.length && !mine.data?.length) setTab('inbox'); }, [inbox.data, mine.data]);
  const decide = useMutation({
    mutationFn: ({ id, decision, comment: c }: { id: string; decision: string; comment?: string }) => api(`/requests/${id}/decide`, { method: 'POST', json: { decision, comment: c || undefined } }),
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['mirror'] }); toast('success', v.decision === 'APPROVED' ? 'Aprovada' : 'Recusada'); setRejecting(null); setComment(''); },
    onError: (e: Error) => toast('error', e.message),
  });
  const cancel = useMutation({ mutationFn: (id: string) => api(`/requests/${id}/cancel`, { method: 'POST' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); toast('success', 'Solicitação cancelada'); }, onError: (e: Error) => toast('error', e.message) });
  const list = tab === 'mine' ? mine : tab === 'inbox' ? inbox : all;
  const rows = list.data ?? [];
  return (
    <Page>
      <PageHeader title="Solicitações" description="Pedidos de ajuste, justificativa, troca de folga e hora extra, com aprovação em etapas. Ao aprovar a última etapa, o sistema aplica o pedido." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        <Button onClick={() => setCreating(true)}><MessageSquarePlus className="size-4" />Nova solicitação</Button>
      </>} />
      <div className="mb-4 flex w-fit rounded-full border border-line p-0.5 text-sm">
        {([['mine', 'Minhas'], ['inbox', `Para aprovar${inbox.data?.length ? ` (${inbox.data.length})` : ''}`], ...(canSeeAll ? [['all', 'Todas']] : [])] as Array<[typeof tab, string]>).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn('h-9 rounded-full px-4', tab === k ? 'pill-light' : 'text-muted')}>{l}</button>)}
      </div>
      {list.isLoading ? <Skeleton className="h-40 rounded-[28px]" /> : list.error ? <Card><EmptyState icon={Inbox} title="Indisponível" body={(list.error as Error).message} /></Card> : !rows.length ? <Card><EmptyState icon={Inbox} title={tab === 'inbox' ? 'Nada para aprovar' : 'Nenhuma solicitação'} body={tab === 'mine' ? 'Use "Nova solicitação" para pedir um ajuste, justificar uma falta ou trocar uma folga.' : 'Tudo em dia.'} /></Card> : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <RequestCard key={r.id} r={r} actions={
                tab === 'inbox' ? (
                  <div className="flex gap-1">
                    <Button variant="light" className="h-9" onClick={() => decide.mutate({ id: r.id, decision: 'APPROVED' })} loading={decide.isPending && decide.variables?.id === r.id}><Check className="size-4" />Aprovar</Button>
                    <Button variant="ghost" className="h-9 hover:text-danger" onClick={() => setRejecting(r)}><X className="size-4" />Recusar</Button>
                  </div>
                ) : tab === 'mine' && r.status === 'PENDING' ? <Button variant="ghost" className="h-8 text-xs" onClick={() => cancel.mutate(r.id)}>Cancelar</Button> : undefined
              } />
            ))}
          </AnimatePresence>
        </div>
      )}
      <Sheet open={creating} onClose={() => setCreating(false)} title="Nova solicitação">{creating && <NewRequest onDone={() => setCreating(false)} />}</Sheet>
      <Sheet open={!!rejecting} onClose={() => setRejecting(null)} title="Recusar solicitação">
        {rejecting && (
          <form onSubmit={(e) => { e.preventDefault(); decide.mutate({ id: rejecting.id, decision: 'REJECTED', comment }); }} className="space-y-4 text-sm">
            <p className="text-muted">{rejecting.typeLabel} de {rejecting.employee.name}: {describe(rejecting)}</p>
            <Input label="Motivo da recusa" value={comment} onChange={(e) => setComment(e.target.value)} required minLength={3} />
            <Button type="submit" variant="danger" loading={decide.isPending} className="h-12 w-full">Recusar</Button>
          </form>
        )}
      </Sheet>
    </Page>
  );
}
