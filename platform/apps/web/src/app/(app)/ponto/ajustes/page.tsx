'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Adj { id: string; kind: 'INCLUDE' | 'DISREGARD'; status: string; justification: string; createdAt: string; employee: { id: string; registration: string; name: string }; when: { date: string; time: string } | null }
const STATUS: Array<[string, string]> = [['PENDING', 'Pendentes'], ['APPROVED', 'Aprovados'], ['REJECTED', 'Recusados'], ['CANCELLED', 'Cancelados']];

export default function AjustesPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('PENDING');
  const canApprove = can(me, 'time.adjustments:approve');
  const list = useQuery({ queryKey: ['adjustments', tenantId, status], queryFn: () => api<Adj[]>(`/time-adjustments?status=${status}`), enabled: !!tenantId });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api(`/time-adjustments/${id}/decide`, { method: 'POST', json: { approve } }),
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ['adjustments'] }); qc.invalidateQueries({ queryKey: ['mirror'] }); toast('success', v.approve ? 'Ajuste aprovado' : 'Ajuste recusado'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const rows = list.data ?? [];
  return (
    <Page>
      <PageHeader title="Ajustes de marcação" description="Inclusões e desconsiderações lançadas por quem não pode aprovar. A marcação original nunca é alterada." actions={isPlatform ? <TenantPicker value={tenantId} onChange={select} /> : undefined} />
      <div className="mb-4 flex w-fit rounded-full border border-line p-0.5 text-sm">{STATUS.map(([k, l]) => <button key={k} onClick={() => setStatus(k)} className={cn('h-9 rounded-full px-4', status === k ? 'pill-light' : 'text-muted')}>{l}</button>)}</div>
      {list.isLoading ? <Skeleton className="h-40 rounded-[28px]" /> : !rows.length ? <Card><EmptyState icon={ClipboardCheck} title="Nada por aqui" body={status === 'PENDING' ? 'Nenhum ajuste aguardando aprovação.' : 'Nenhum ajuste nesta situação.'} /></Card> : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {rows.map((a, i) => (
              <motion.div key={a.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.03 } }} exit={{ opacity: 0, x: 40 }} className="glass flex flex-wrap items-center gap-4 rounded-[22px] px-5 py-3">
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', a.kind === 'INCLUDE' ? 'bg-sky-500/15 text-sky-300' : 'bg-danger/15 text-danger')}>{a.kind === 'INCLUDE' ? 'Incluir' : 'Desconsiderar'}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.employee.name} <span className="text-xs text-subtle">· {a.employee.registration}</span></p>
                  <p className="text-xs text-muted">{a.when ? `${a.when.date.split('-').reverse().join('/')} às ${a.when.time}` : ''} · {a.justification}</p>
                </div>
                {status === 'PENDING' && canApprove && (
                  <div className="flex gap-1">
                    <Button variant="light" className="h-9" onClick={() => decide.mutate({ id: a.id, approve: true })}><Check className="size-4" />Aprovar</Button>
                    <Button variant="ghost" className="h-9 hover:text-danger" onClick={() => decide.mutate({ id: a.id, approve: false })}><X className="size-4" />Recusar</Button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Page>
  );
}
