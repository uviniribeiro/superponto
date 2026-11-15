'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, useToast } from './ui';

interface Ack { canSign: boolean; reason: string | null; term: string; currentHash: string; acknowledgment: { decision: 'AGREE' | 'DISAGREE'; comment: string | null; createdAt: string; contentHash: string; changedSince: boolean } | null }

/** Ciência eletrônica do espelho pelo próprio funcionário (de acordo ou com ressalva; não muda depois). */
export function MirrorAck({ from, to, employmentId }: { from: string; to: string; employmentId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const q = `from=${from}&to=${to}&employmentId=${employmentId}`;
  const st = useQuery({ queryKey: ['mirror-ack', q], queryFn: () => api<Ack>(`/timesheet/me/ack?${q}`) });
  const [mode, setMode] = useState<'AGREE' | 'DISAGREE' | null>(null);
  const [comment, setComment] = useState('');
  const sign = useMutation({
    mutationFn: () => api('/timesheet/me/ack', { method: 'POST', json: { from, to, employmentId, decision: mode, ...(comment.trim() ? { comment: comment.trim() } : {}) } }),
    onSuccess: () => { toast('success', 'Ciência registrada'); setMode(null); qc.invalidateQueries({ queryKey: ['mirror-ack'] }); },
    onError: (e: Error) => toast('error', e.message),
  });
  const s = st.data;
  if (!s) return null;
  const a = s.acknowledgment;
  return (
    <Card className="no-print space-y-3 rounded-[24px]">
      <div className="flex items-center gap-2 font-semibold"><FileSignature className="size-4" />Ciência do espelho</div>
      {a ? (
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">{a.decision === 'AGREE' ? <ShieldCheck className="size-4 text-success" /> : <ShieldAlert className="size-4 text-warning" />}{a.decision === 'AGREE' ? 'Você deu ciência e concordou' : 'Você deu ciência com ressalva'} em {new Date(a.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</p>
          {a.comment && <p className="text-muted">Ressalva: {a.comment}</p>}
          {a.changedSince && <p className="text-warning">O espelho mudou depois da sua ciência (ajuste ou abono posterior). O RH vê essa diferença.</p>}
          <p className="break-all font-mono text-[10px] text-subtle">Código: {a.contentHash}</p>
        </div>
      ) : !s.canSign ? <p className="text-sm text-muted">{s.reason ?? 'Indisponível'}: a ciência fica disponível depois do último dia do período.</p> : mode ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); sign.mutate(); }}>
          <p className="rounded-2xl bg-hover p-3 text-sm">{s.term}</p>
          {mode === 'DISAGREE' && <textarea aria-label="Ressalva" required minLength={5} maxLength={1000} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Explique o que está diferente" className="w-full rounded-2xl border border-line bg-hover px-4 py-3 text-sm outline-none focus:border-brand" />}
          <p className="text-xs text-subtle">Depois de registrada, a ciência não pode ser alterada.</p>
          <div className="flex gap-2"><Button type="submit" loading={sign.isPending}>{mode === 'AGREE' ? 'Confirmar ciência' : 'Registrar com ressalva'}</Button><Button type="button" variant="ghost" onClick={() => setMode(null)}>Cancelar</Button></div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2"><Button onClick={() => setMode('AGREE')}>Dar ciência (de acordo)</Button><Button variant="outline" onClick={() => setMode('DISAGREE')}>Dar ciência com ressalva</Button></div>
      )}
    </Card>
  );
}

/** Texto personalizado do cliente (vazio quando não configurado). */
export function useCustomText(key: string, enabled = true) {
  const q = useQuery({ queryKey: ['custom-texts'], queryFn: () => api<Array<{ key: string; text: string }>>('/custom-texts'), enabled, staleTime: 300_000 });
  return q.data?.find((t) => t.key === key)?.text ?? '';
}
