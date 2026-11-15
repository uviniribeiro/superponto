'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Smartphone, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';

interface Dev { id: string; name: string; approvedAt: string; lastUsedAt: string | null; revokedAt: string | null; user: { displayName: string; email: string } | null }
const dt = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function AparelhosAdminPage() {
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['app-devices', tenantId], queryFn: () => api<Dev[]>('/app-devices'), enabled: !!tenantId });
  const [revoke, setRevoke] = useState<Dev | null>(null);
  const rev = useMutation({ mutationFn: (id: string) => api(`/app-devices/${id}/revoke`, { method: 'POST' }), onSuccess: () => { setRevoke(null); qc.invalidateQueries({ queryKey: ['app-devices'] }); toast('success', 'Aparelho revogado'); }, onError: (e: Error) => toast('error', e.message) });
  return (
    <Page>
      <PageHeader title="Aparelhos do app" description="Celulares e tablets liberados pelos funcionários para marcar o ponto. Revogue um aparelho perdido ou trocado." actions={isPlatform ? <TenantPicker value={tenantId} onChange={pickTenant} /> : undefined} />
      <Card className="overflow-hidden rounded-[28px] p-0">
        {!list.data ? <Skeleton className="h-64" /> : !list.data.length ? <EmptyState icon={Smartphone} title="Nenhum aparelho liberado" body="Cada funcionário libera o seu em Meus aparelhos." /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="px-4 py-2">Usuário</th><th className="px-4 py-2">Aparelho</th><th className="px-4 py-2">Liberado</th><th className="px-4 py-2">Último uso</th><th className="px-4 py-2">Situação</th><th /></tr></thead>
            <tbody>{list.data.map((d) => (
              <tr key={d.id} className="border-t border-line">
                <td className="px-4 py-2">{d.user?.displayName ?? '—'}<span className="block text-xs text-subtle">{d.user?.email}</span></td>
                <td className="px-4 py-2">{d.name}</td><td className="px-4 py-2">{dt(d.approvedAt)}</td><td className="px-4 py-2">{dt(d.lastUsedAt)}</td>
                <td className="px-4 py-2">{d.revokedAt ? <span className="text-danger">Revogado</span> : <span className="text-success">Ativo</span>}</td>
                <td className="px-4 py-2 text-right">{!d.revokedAt && <Button variant="ghost" aria-label="Revogar" onClick={() => setRevoke(d)}><Trash2 className="size-4" /></Button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <Confirm open={!!revoke} title="Revogar aparelho?" body={`${revoke?.name ?? ''} de ${revoke?.user?.displayName ?? ''} não poderá mais marcar o ponto.`} confirmLabel="Revogar" loading={rev.isPending} onConfirm={() => revoke && rev.mutate(revoke.id)} onCancel={() => setRevoke(null)} />
    </Page>
  );
}
