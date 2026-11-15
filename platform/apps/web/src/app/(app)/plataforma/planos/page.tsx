'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { labelCls } from '@/components/company-actions';
import { Page, PageHeader } from '@/components/page';
import { useSession } from '@/components/providers';
import { LIMIT_LABEL, type PlanRow } from '@/components/tenant-plan';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';

type Form = { key: string; name: string; price: string; interval: 'month' | 'year'; isPublic: boolean; limits: Record<string, string> };

export default function PlanosPage() {
  const { me, loading } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['plans'], queryFn: () => api<PlanRow[]>('/platform/plans'), enabled: !!me?.isPlatformAdmin });
  const [edit, setEdit] = useState<{ id: string | null; f: Form } | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const f = edit!.f;
      const limits = Object.fromEntries(Object.keys(LIMIT_LABEL).map((k) => [k, f.limits[k]?.trim() ? Number(f.limits[k]) : null]));
      const json = { name: f.name, priceCents: Math.round(Number(f.price.replace(',', '.')) * 100), interval: f.interval, isPublic: f.isPublic, limits };
      return edit!.id ? api(`/platform/plans/${edit!.id}`, { method: 'PUT', json }) : api('/platform/plans', { method: 'POST', json: { ...json, key: f.key } });
    },
    onSuccess: () => { toast('success', 'Plano salvo'); setEdit(null); qc.invalidateQueries({ queryKey: ['plans'] }); },
    onError: (e: Error) => toast('error', e.message),
  });
  if (!loading && !me?.isPlatformAdmin) return <Page><Card><EmptyState icon={ShieldCheck} title="Acesso restrito" body="Esta área é exclusiva da equipe SuperPonto." /></Card></Page>;
  const set = (p: Partial<Form>) => setEdit((e) => e && { ...e, f: { ...e.f, ...p } });
  return (
    <Page>
      <PageHeader title="Planos" description="Preço e limites de cada plano. O plano de cada cliente é escolhido em Clientes. A cobrança em si fica com o meio de pagamento contratado." actions={<Button onClick={() => setEdit({ id: null, f: { key: '', name: '', price: '0', interval: 'month', isPublic: true, limits: {} } })}><Plus className="size-4" />Novo plano</Button>} />
      {!list.data ? <Skeleton className="h-48 rounded-[28px]" /> : !list.data.length ? <Card><EmptyState icon={Layers} title="Nenhum plano" body="Crie os planos com os limites de funcionários, equipamentos e usuários." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((p) => (
            <Card key={p.id} className="space-y-3 rounded-[24px]">
              <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{p.name}</h3><p className="text-xs text-subtle">{p.key}{p.isPublic ? '' : ' · privado'}</p></div><Button variant="ghost" aria-label="Editar" onClick={() => setEdit({ id: p.id, f: { key: p.key, name: p.name, price: (p.priceCents / 100).toFixed(2).replace('.', ','), interval: p.interval as Form['interval'], isPublic: p.isPublic, limits: Object.fromEntries(Object.entries(p.limits).map(([k, v]) => [k, String(v)])) } })}><Pencil className="size-4" /></Button></div>
              <p className="text-2xl font-semibold">R$ {(p.priceCents / 100).toFixed(2).replace('.', ',')}<span className="text-sm text-muted">/{p.interval === 'year' ? 'ano' : 'mês'}</span></p>
              <ul className="space-y-1 text-sm">{Object.entries(LIMIT_LABEL).map(([k, l]) => <li key={k} className="flex justify-between"><span className="text-muted">{l}</span><b>{p.limits[k] ?? 'sem limite'}</b></li>)}</ul>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar plano' : 'Novo plano'}>
        {edit && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            {!edit.id && <Input label="Identificador" required pattern="[a-z0-9-]{2,40}" value={edit.f.key} onChange={(e) => set({ key: e.target.value.toLowerCase() })} hint="letras minúsculas, números e hífen" />}
            <Input label="Nome" required value={edit.f.name} onChange={(e) => set({ name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Preço (R$)" required inputMode="decimal" value={edit.f.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d,.]/g, '') })} />
              <label className="space-y-1.5"><span className={labelCls}>Cobrança</span><select value={edit.f.interval} onChange={(e) => set({ interval: e.target.value as Form['interval'] })} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm [&>option]:bg-elevated"><option value="month">Mensal</option><option value="year">Anual</option></select></label>
            </div>
            <div className="space-y-2"><span className={labelCls}>Limites (em branco = sem limite)</span>{Object.entries(LIMIT_LABEL).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><span className="w-40 text-muted">{l}</span><input inputMode="numeric" aria-label={l} value={edit.f.limits[k] ?? ''} onChange={(e) => set({ limits: { ...edit.f.limits, [k]: e.target.value.replace(/\D/g, '') } })} className="h-9 flex-1 rounded-xl border border-line bg-hover px-3 text-sm outline-none focus:border-brand" /></label>)}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.f.isPublic} onChange={(e) => set({ isPublic: e.target.checked })} className="accent-[var(--brand)]" />Plano público (oferecido a novos clientes)</label>
            <Button type="submit" loading={save.isPending} className="w-full">Salvar</Button>
          </form>
        )}
      </Sheet>
    </Page>
  );
}
