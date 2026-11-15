'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fieldCls, labelCls } from './company-actions';
import { Button, Skeleton, useToast } from './ui';

export interface PlanRow { id: string; key: string; name: string; priceCents: number; interval: string; isPublic: boolean; limits: Record<string, number> }
export const LIMIT_LABEL: Record<string, string> = { 'limit.employments': 'Funcionários ativos', 'limit.devices': 'Equipamentos', 'limit.users': 'Usuários' };
const STATUS: Array<[string, string]> = [['TRIALING', 'Em teste'], ['ACTIVE', 'Ativa'], ['PAST_DUE', 'Pagamento atrasado'], ['SUSPENDED', 'Suspensa (bloqueia o acesso)'], ['CANCELLED', 'Cancelada (bloqueia o acesso)']];

/** Plano do cliente (SuperAdmin): plano, situação, vigência e ajustes de limite deste contrato. */
export function TenantPlanForm({ tenantId, onSaved }: { tenantId: string; onSaved: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<PlanRow[]>('/platform/plans') });
  const cur = useQuery({ queryKey: ['tenant-sub', tenantId], queryFn: () => api<{ subscription: { planId: string; status: string; currentPeriodEnd: string; overrides: Record<string, number> } | null; limits: Record<string, number>; usage: Record<string, number> }>(`/platform/tenants/${tenantId}/subscription`) });
  const [f, setF] = useState({ planId: '', status: 'ACTIVE', currentPeriodEnd: '', overrides: {} as Record<string, string> });
  useEffect(() => {
    const s = cur.data?.subscription;
    const end = new Date(); end.setMonth(end.getMonth() + 1);
    setF({ planId: s?.planId ?? '', status: s?.status ?? 'TRIALING', currentPeriodEnd: s ? s.currentPeriodEnd.slice(0, 10) : end.toISOString().slice(0, 10), overrides: Object.fromEntries(Object.entries(s?.overrides ?? {}).map(([k, v]) => [k, String(v)])) });
  }, [cur.data]);
  const save = useMutation({
    mutationFn: () => api(`/platform/tenants/${tenantId}/subscription`, { method: 'PUT', json: { planId: f.planId, status: f.status, currentPeriodEnd: f.currentPeriodEnd, overrides: Object.fromEntries(Object.entries(f.overrides).filter(([, v]) => v.trim()).map(([k, v]) => [k, Number(v)])) } }),
    onSuccess: () => { toast('success', 'Plano do cliente salvo'); qc.invalidateQueries({ queryKey: ['tenant-sub'] }); qc.invalidateQueries({ queryKey: ['tenants'] }); onSaved(); },
    onError: (e: Error) => toast('error', e.message),
  });
  if (!plans.data || !cur.data) return <Skeleton className="h-60" />;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">{Object.entries(LIMIT_LABEL).map(([k, l]) => <div key={k} className="rounded-2xl bg-hover p-2"><p className="text-subtle">{l}</p><p className="text-lg font-semibold">{cur.data!.usage[k] ?? 0}{cur.data!.limits[k] !== undefined && <span className="text-sm text-muted"> / {cur.data!.limits[k]}</span>}</p></div>)}</div>
      <label className="block space-y-1.5"><span className={labelCls}>Plano</span><select required value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })} className={fieldCls}><option value="">Escolha…</option>{plans.data.map((p) => <option key={p.id} value={p.id}>{p.name} — R$ {(p.priceCents / 100).toFixed(2).replace('.', ',')}/{p.interval === 'year' ? 'ano' : 'mês'}</option>)}</select></label>
      <label className="block space-y-1.5"><span className={labelCls}>Situação</span><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={fieldCls}>{STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="block space-y-1.5"><span className={labelCls}>Vigência até</span><input type="date" required value={f.currentPeriodEnd} onChange={(e) => setF({ ...f, currentPeriodEnd: e.target.value })} className={fieldCls} /></label>
      <div className="space-y-2"><span className={labelCls}>Ajuste de limite só deste cliente (em branco = o do plano)</span>{Object.entries(LIMIT_LABEL).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><span className="w-40 text-muted">{l}</span><input inputMode="numeric" aria-label={`Ajuste ${l}`} value={f.overrides[k] ?? ''} onChange={(e) => setF({ ...f, overrides: { ...f.overrides, [k]: e.target.value.replace(/\D/g, '') } })} className="h-9 flex-1 rounded-xl border border-line bg-hover px-3 text-sm outline-none focus:border-brand" /></label>)}</div>
      <Button type="submit" loading={save.isPending} disabled={!f.planId} className="w-full">Salvar</Button>
    </form>
  );
}
