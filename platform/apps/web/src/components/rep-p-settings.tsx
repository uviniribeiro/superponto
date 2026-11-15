'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, useToast } from './ui';

/** Número do REP-P no INPI (usado no AFD e no AEJ) e último NSR das marcações pelo navegador/app. */
export function RepPSettings({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['rep-p', companyId], queryFn: () => api<{ inpiNumber: string | null; lastNsr: number }>(`/timesheet/rep-p?companyId=${companyId}`) });
  const [inpi, setInpi] = useState('');
  useEffect(() => setInpi(q.data?.inpiNumber ?? ''), [q.data]);
  const save = useMutation({ mutationFn: () => api('/timesheet/rep-p', { method: 'PUT', json: { companyId, inpiNumber: inpi || null } }), onSuccess: () => { toast('success', 'Número do REP-P salvo'); qc.invalidateQueries({ queryKey: ['rep-p'] }); }, onError: (e: Error) => toast('error', e.message) });
  if (!q.data) return null;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line p-3 text-sm">
      <label className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-subtle">REP-P: número no INPI</span>
        <input aria-label="Número do REP-P no INPI" value={inpi} onChange={(e) => setInpi(e.target.value.replace(/\D/g, '').slice(0, 17))} disabled={!canEdit} placeholder="17 dígitos" className="h-10 w-56 rounded-2xl border border-line bg-hover px-3 font-mono text-sm outline-none focus:border-brand" />
      </label>
      {canEdit && <Button variant="outline" onClick={() => save.mutate()} loading={save.isPending} disabled={inpi === (q.data.inpiNumber ?? '') || (inpi.length > 0 && inpi.length !== 17)}>Salvar</Button>}
      <span className="text-xs text-muted">Marcações pelo navegador/app: último NSR {q.data.lastNsr}</span>
    </div>
  );
}
