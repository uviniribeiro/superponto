'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fieldCls, labelCls } from '@/components/company-actions';
import { Page, PageHeader } from '@/components/page';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Company, type Page as Paged, type Ref } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Ann { id: string; title: string; body: string; level: 'INFO' | 'IMPORTANT'; companyId: string | null; groupingId: string | null; startsAt: string; endsAt: string | null; requireAck: boolean; reads: number }
type Form = { title: string; body: string; level: 'INFO' | 'IMPORTANT'; companyId: string; groupingId: string; startsAt: string; endsAt: string; requireAck: boolean };
const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const dt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function AvisosPage() {
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['announcements', tenantId], queryFn: () => api<Ann[]>('/announcements'), enabled: !!tenantId });
  const companies = useQuery({ queryKey: ['companies', tenantId, 'all'], queryFn: () => api<Paged<Company>>('/companies?pageSize=200'), enabled: !!tenantId });
  const groupings = useQuery({ queryKey: ['opt', 'groupings', tenantId], queryFn: () => api<Paged<Ref>>('/groupings?pageSize=200'), enabled: !!tenantId, retry: false });
  const [edit, setEdit] = useState<{ id: string | null; f: Form } | null>(null);
  const [del, setDel] = useState<Ann | null>(null);
  const [readsOf, setReadsOf] = useState<Ann | null>(null);
  const reads = useQuery({ queryKey: ['ann-reads', readsOf?.id], queryFn: () => api<Array<{ readAt: string; user: { displayName: string; email: string } | null }>>(`/announcements/${readsOf!.id}/reads`), enabled: !!readsOf });
  const save = useMutation({
    mutationFn: () => {
      const f = edit!.f;
      const json = { title: f.title, body: f.body, level: f.level, companyId: f.companyId || null, groupingId: f.groupingId || null, startsAt: new Date(f.startsAt).toISOString(), endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null, requireAck: f.requireAck };
      return edit!.id ? api(`/announcements/${edit!.id}`, { method: 'PUT', json }) : api('/announcements', { method: 'POST', json });
    },
    onSuccess: () => { toast('success', 'Aviso salvo'); setEdit(null); qc.invalidateQueries({ queryKey: ['announcements'] }); },
    onError: (e: Error) => toast('error', e.message),
  });
  const remove = useMutation({ mutationFn: (id: string) => api(`/announcements/${id}`, { method: 'DELETE' }), onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['announcements'] }); toast('success', 'Aviso removido'); }, onError: (e: Error) => toast('error', e.message) });
  const blank = (): Form => ({ title: '', body: '', level: 'INFO', companyId: '', groupingId: '', startsAt: toLocal(new Date().toISOString()), endsAt: '', requireAck: false });
  // Hora atual só no navegador (o prerender não pode usar o relógio).
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), [list.data]);
  const status = (a: Ann) => !now ? '' : Date.parse(a.startsAt) > now ? 'Agendado' : a.endsAt && Date.parse(a.endsAt) <= now ? 'Encerrado' : 'No ar';
  const set = (p: Partial<Form>) => setEdit((e) => e && { ...e, f: { ...e.f, ...p } });

  return (
    <Page>
      <PageHeader title="Avisos" description="Recados para os funcionários: aparecem na visão geral de quem está no público escolhido, com registro de quem leu." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={pickTenant} />}
        <Button onClick={() => setEdit({ id: null, f: blank() })} disabled={!tenantId}><Plus className="size-4" />Novo aviso</Button>
      </>} />
      {!list.data ? <Skeleton className="h-64 rounded-[28px]" /> : !list.data.length ? <Card><EmptyState icon={Megaphone} title="Nenhum aviso" body="Publique um recado: feriado, mudança de escala, campanha interna…" /></Card> : (
        <div className="space-y-3">
          {list.data.map((a) => (
            <Card key={a.id} className="flex flex-wrap items-start gap-4 rounded-[24px]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{a.title}</h3>
                  {a.level === 'IMPORTANT' && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger">Importante</span>}
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', status(a) === 'No ar' ? 'bg-success/15 text-success' : 'bg-hover text-muted')}>{status(a)}</span>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted">{a.body}</p>
                <p className="mt-2 text-xs text-subtle">{dt(a.startsAt)}{a.endsAt ? ` até ${dt(a.endsAt)}` : ''} · {a.companyId ? companies.data?.data.find((c) => c.id === a.companyId)?.legalName ?? 'Empresa' : 'Todas as empresas'}{a.groupingId ? ` · ${groupings.data?.data.find((g) => g.id === a.groupingId)?.name ?? 'Agrupamento'}` : ''}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" onClick={() => setReadsOf(a)}><Users className="size-4" />{a.reads} leram</Button>
                <Button variant="ghost" aria-label="Editar" onClick={() => setEdit({ id: a.id, f: { title: a.title, body: a.body, level: a.level, companyId: a.companyId ?? '', groupingId: a.groupingId ?? '', startsAt: toLocal(a.startsAt), endsAt: a.endsAt ? toLocal(a.endsAt) : '', requireAck: a.requireAck } })}><Pencil className="size-4" /></Button>
                <Button variant="ghost" aria-label="Excluir" onClick={() => setDel(a)}><Trash2 className="size-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar aviso' : 'Novo aviso'}>
        {edit && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Input label="Título" required maxLength={120} value={edit.f.title} onChange={(e) => set({ title: e.target.value })} />
            <label className="block space-y-1.5"><span className={labelCls}>Mensagem</span><textarea required maxLength={5000} rows={6} value={edit.f.body} onChange={(e) => set({ body: e.target.value })} className="w-full rounded-2xl border border-line bg-hover px-4 py-3 text-sm outline-none focus:border-brand" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5"><span className={labelCls}>Início</span><input type="datetime-local" required value={edit.f.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className={fieldCls} /></label>
              <label className="space-y-1.5"><span className={labelCls}>Fim (opcional)</span><input type="datetime-local" value={edit.f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className={fieldCls} /></label>
            </div>
            <label className="block space-y-1.5"><span className={labelCls}>Empresa</span><select value={edit.f.companyId} onChange={(e) => set({ companyId: e.target.value })} className={fieldCls}><option value="">Todas</option>{companies.data?.data.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select></label>
            <label className="block space-y-1.5"><span className={labelCls}>Agrupamento</span><select value={edit.f.groupingId} onChange={(e) => set({ groupingId: e.target.value })} className={fieldCls}><option value="">Todos</option>{groupings.data?.data.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.f.level === 'IMPORTANT'} onChange={(e) => set({ level: e.target.checked ? 'IMPORTANT' : 'INFO' })} className="accent-[var(--brand)]" />Importante (aparece em destaque)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.f.requireAck} onChange={(e) => set({ requireAck: e.target.checked })} className="accent-[var(--brand)]" />Pedir confirmação de leitura</label>
            <Button type="submit" loading={save.isPending} className="w-full">Salvar</Button>
          </form>
        )}
      </Sheet>
      <Sheet open={!!readsOf} onClose={() => setReadsOf(null)} title={`Quem leu: ${readsOf?.title ?? ''}`}>
        {!reads.data ? <Skeleton className="h-40" /> : !reads.data.length ? <p className="text-sm text-muted">Ninguém confirmou a leitura ainda.</p> : (
          <ul className="divide-y divide-line">{reads.data.map((r, i) => <li key={i} className="flex justify-between gap-2 py-2 text-sm"><span>{r.user?.displayName ?? '—'}<span className="block text-xs text-subtle">{r.user?.email}</span></span><span className="text-xs text-muted">{dt(r.readAt)}</span></li>)}</ul>
        )}
      </Sheet>
      <Confirm open={!!del} title="Excluir aviso?" body={`"${del?.title ?? ''}" deixa de aparecer para os funcionários.`} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} onCancel={() => setDel(null)} />
    </Page>
  );
}
