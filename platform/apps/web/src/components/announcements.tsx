'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Info, Megaphone } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCustomText } from './mirror-ack';
import { Button } from './ui';

interface Ann { id: string; title: string; body: string; level: 'INFO' | 'IMPORTANT'; requireAck: boolean; readAt: string | null }

/** Mensagem do cliente e avisos vigentes para quem está logado, com "li e entendi". */
export function Announcements({ tenantId }: { tenantId: string | null }) {
  const qc = useQueryClient();
  const message = useCustomText('DASHBOARD_MESSAGE', !!tenantId);
  const list = useQuery({ queryKey: ['announcements-active', tenantId], queryFn: () => api<Ann[]>('/announcements/active'), enabled: !!tenantId });
  const read = useMutation({ mutationFn: (id: string) => api(`/announcements/${id}/read`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements-active'] }) });
  const items = (list.data ?? []).filter((a) => !a.readAt || a.level === 'IMPORTANT');
  if (!message && !items.length) return null;
  return (
    <div className="mb-6 space-y-2">
      {message && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass flex items-start gap-3 rounded-[22px] px-5 py-3 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-brand" /><p className="whitespace-pre-line">{message}</p></motion.div>}
      {items.map((a, i) => (
        <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.05 * (i + 1) } }} className={cn('flex flex-wrap items-start gap-3 rounded-[22px] px-5 py-3 text-sm', a.level === 'IMPORTANT' ? 'hero-brand-soft' : 'glass')}>
          <Megaphone className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1"><p className="font-semibold">{a.title}</p><p className="whitespace-pre-line opacity-80">{a.body}</p></div>
          {a.readAt ? <span className="flex items-center gap-1 text-xs opacity-70"><Check className="size-3.5" />Lido</span> : <Button variant="outline" className="h-8" onClick={() => read.mutate(a.id)} loading={read.isPending && read.variables === a.id}>{a.requireAck ? 'Li e entendi' : 'Ok'}</Button>}
        </motion.div>
      ))}
    </div>
  );
}
