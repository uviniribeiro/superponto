'use client';

import { useQuery } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { Page, PageHeader } from '@/components/page';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Sub { plan: { name: string; status: string; currentPeriodEnd: string; trialEndsAt: string | null } | null; limits: Record<string, number>; usage: Record<string, number>; labels: Record<string, string> }
const STATUS: Record<string, string> = { TRIALING: 'Em teste', ACTIVE: 'Ativa', PAST_DUE: 'Pagamento atrasado' };

export default function MeuPlanoPage() {
  const { tenantId, select, isPlatform } = useActiveTenant();
  const q = useQuery({ queryKey: ['my-subscription', tenantId], queryFn: () => api<Sub>('/subscription'), enabled: !!tenantId });
  const d = q.data;
  return (
    <Page>
      <PageHeader title="Plano e uso" description="Seu plano no SuperPonto e quanto de cada limite está em uso." actions={isPlatform ? <TenantPicker value={tenantId} onChange={select} /> : undefined} />
      {!d ? <Skeleton className="h-48 rounded-[28px]" /> : (
        <div className="space-y-4">
          {d.plan ? (
            <Card className="rounded-[24px]"><p className="text-sm text-muted">Plano</p><p className="text-2xl font-semibold">{d.plan.name}</p><p className={cn('text-sm', d.plan.status === 'PAST_DUE' ? 'text-warning' : 'text-muted')}>{STATUS[d.plan.status] ?? d.plan.status} · vigente até {new Date(d.plan.currentPeriodEnd).toLocaleDateString('pt-BR')}</p></Card>
          ) : <Card><EmptyState icon={Layers} title="Sem plano contratado" body="Sua organização não tem limites configurados." /></Card>}
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(d.labels).map(([k, label]) => {
              const max = d.limits[k], used = d.usage[k] ?? 0, pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
              return (
                <Card key={k} className="space-y-2 rounded-[24px]">
                  <p className="text-sm capitalize text-muted">{label}</p>
                  <p className="text-2xl font-semibold">{used}{max !== undefined && <span className="text-base text-muted"> de {max}</span>}</p>
                  {max !== undefined ? <div className="h-2 overflow-hidden rounded-full bg-hover"><div className={cn('h-full rounded-full', pct >= 90 ? 'bg-danger' : pct >= 75 ? 'bg-warning' : 'bg-brand')} style={{ width: `${pct}%` }} /></div> : <p className="text-xs text-subtle">sem limite</p>}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </Page>
  );
}
