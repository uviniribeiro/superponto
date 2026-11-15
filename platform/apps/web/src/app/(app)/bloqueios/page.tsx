'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldBan } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Card, EmptyState, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Block { id: string; reason: string; startsAt: string; endsAt: string | null; revokedAt: string | null; state: 'ACTIVE' | 'SCHEDULED' | 'ENDED' | 'REVOKED'; user: { id: string; displayName: string; email: string } }
const STATE: Record<Block['state'], [string, string]> = { ACTIVE: ['Vigente', 'bg-danger/15 text-danger'], SCHEDULED: ['Agendado', 'bg-brand-soft text-brand'], ENDED: ['Encerrado', 'bg-hover text-muted'], REVOKED: ['Revogado', 'bg-hover text-muted'] };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'indeterminado');

export default function BlocksPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const [ended, setEnded] = useState(false);
  const blocks = useQuery({ queryKey: ['access-blocks', tenantId, ended], queryFn: () => api<Block[]>(`/access-blocks?includeEnded=${ended}`), enabled: !!tenantId });
  const revoke = useMutation({
    mutationFn: (b: Block) => api(`/users/${b.user.id}/blocks/${b.id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['access-blocks'] }); qc.invalidateQueries({ queryKey: ['users'] }); toast('success', 'Bloqueio encerrado'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const canManage = can(me, 'admin.users:manage');
  return (
    <Page>
      <PageHeader title="Bloqueios de acesso" description="Usuários impedidos de entrar por um período, com motivo. Para bloquear alguém, abra o usuário em Administração › Usuários." actions={isPlatform ? <TenantPicker value={tenantId} onChange={select} /> : undefined} />
      {!tenantId ? (
        <Card><EmptyState icon={ShieldBan} title="Escolha uma organização" body="Selecione acima o cliente que você quer administrar." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="accent-[var(--brand)]" checked={ended} onChange={(e) => setEnded(e.target.checked)} />Mostrar encerrados e revogados</label>
            {blocks.data && <span className="ml-auto text-xs text-subtle">{blocks.data.length} bloqueio(s)</span>}
          </div>
          {blocks.isLoading ? <div className="space-y-3 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            : !blocks.data?.length ? <EmptyState icon={ShieldBan} title="Nenhum bloqueio" body={ended ? 'Ainda não houve bloqueios.' : 'Nenhum usuário bloqueado agora.'} action={<Link href="/usuarios" className="text-sm text-brand">Ir para Usuários</Link>} />
            : (
              <ul className="divide-y divide-line">
                {blocks.data.map((b, i) => (
                  <motion.li key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.02 } }} className="flex items-center gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.user.displayName} <span className="text-xs font-normal text-subtle">{b.user.email}</span></p>
                      <p className="truncate text-xs text-muted">{b.reason} · {fmt(b.startsAt)} até {fmt(b.endsAt)}</p>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-1 text-xs', STATE[b.state][1])}>{STATE[b.state][0]}</span>
                    {canManage && (b.state === 'ACTIVE' || b.state === 'SCHEDULED') && <button onClick={() => revoke.mutate(b)} className="text-xs text-brand">Encerrar</button>}
                  </motion.li>
                ))}
              </ul>
            )}
        </Card>
      )}
    </Page>
  );
}
