'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Fingerprint, MapPin, ShieldCheck, UserX } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { Button, Card, EmptyState, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { SOURCE_LABEL } from '@/lib/timesheet';

interface Me { today: string; employments: Array<{ id: string; registration: string; company: string; geofence: { name: string; radiusM: number } | null }>; punches: Array<{ id: string; employmentId: string; time: string; source: string; hash: string }> }
interface Receipt { id: string; date: string; time: string; hash: string; employee: string; registration: string; company: string; cnpj: string | null; appDevice?: string | null; footer?: string | null }

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const f = (o: Intl.DateTimeFormatOptions) => (now ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...o }).format(now) : '');
  return (
    <div className="text-center">
      <div className="font-mono text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl">{f({ hour: '2-digit', minute: '2-digit' })}<span className="text-3xl text-muted">:{f({ second: '2-digit' }).padStart(2, '0')}</span></div>
      <div className="mt-1 text-sm capitalize text-muted">{f({ weekday: 'long', day: 'numeric', month: 'long' })} · horário de Brasília</div>
    </div>
  );
}

function position(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }), () => resolve(null), { enableHighAccuracy: true, timeout: 8000 });
  });
}

export default function RegistrarPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const me = useQuery({ queryKey: ['punch-me'], queryFn: () => api<Me>('/punch/me'), retry: false });
  const [employmentId, setEmploymentId] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  useEffect(() => { if (me.data?.employments.length && !employmentId) setEmploymentId(me.data.employments[0]!.id); }, [me.data, employmentId]);
  const emp = me.data?.employments.find((e) => e.id === employmentId);
  const punch = useMutation({
    mutationFn: async () => {
      const { token } = await api<{ token: string }>('/punch/challenge', { method: 'POST' });
      const loc = emp?.geofence ? await position() : null;
      return api<Receipt>('/punch', { method: 'POST', json: { token, employmentId, ...(loc ?? {}) } });
    },
    onSuccess: (r) => { setReceipt(r); qc.invalidateQueries({ queryKey: ['punch-me'] }); },
    onError: (e: Error) => toast('error', e.message),
  });
  const today = (me.data?.punches ?? []).filter((p) => p.employmentId === employmentId);
  const labels = ['Entrada', 'Saída para o intervalo', 'Volta do intervalo', 'Saída'];

  return (
    <Page>
      <PageHeader title="Registrar ponto" description="Marque entrada, intervalo e saída. Cada marcação gera um comprovante e não pode ser apagada." />
      {me.isLoading ? <Skeleton className="h-96 rounded-[28px]" />
        : me.error ? <Card><EmptyState icon={UserX} title="Sem vínculo para marcar" body={(me.error as Error).message} /></Card>
        : (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card className="flex flex-col items-center gap-6 rounded-[28px] py-10">
              <Clock />
              {(me.data?.employments.length ?? 0) > 1 && (
                <select aria-label="Vínculo" value={employmentId} onChange={(e) => setEmploymentId(e.target.value)} className="h-10 rounded-full border border-line bg-hover px-4 text-sm [&>option]:bg-elevated">
                  {me.data!.employments.map((e) => <option key={e.id} value={e.id}>{e.company} · matrícula {e.registration}</option>)}
                </select>
              )}
              <motion.button whileTap={{ scale: 0.94 }} whileHover={{ scale: 1.03 }} onClick={() => punch.mutate()} disabled={punch.isPending || !employmentId}
                className="hero-brand relative grid size-44 place-items-center rounded-full text-center disabled:opacity-60" aria-label="Marcar ponto agora">
                <motion.span className="absolute inset-0 rounded-full border-4 border-white/40" animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2.4, repeat: Infinity }} />
                <span className="flex flex-col items-center gap-1">
                  <Fingerprint className="size-12" />
                  <span className="text-lg font-semibold">{punch.isPending ? 'Registrando…' : 'Marcar agora'}</span>
                  <span className="text-xs opacity-70">{labels[today.length] ?? 'Marcação extra'}</span>
                </span>
              </motion.button>
              <p className="flex items-center gap-1.5 text-xs text-subtle">
                {emp?.geofence ? <><MapPin className="size-3.5" />Precisa estar a até {emp.geofence.radiusM} m de {emp.geofence.name}: o navegador vai pedir sua localização</> : <><ShieldCheck className="size-3.5" />Marcação protegida contra robôs e repetição</>}
              </p>
            </Card>
            <div className="space-y-4">
              <AnimatePresence>
                {receipt && (
                  <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="glass rounded-[28px] p-5">
                    <div className="flex items-center gap-2 text-success"><CheckCircle2 className="size-5" /><span className="font-semibold">Comprovante de marcação</span></div>
                    <dl className="mt-3 space-y-1 text-sm">
                      {[['Funcionário', `${receipt.employee} · matrícula ${receipt.registration}`], ['Empresa', `${receipt.company}${receipt.cnpj ? ` · CNPJ ${receipt.cnpj}` : ''}`], ['Data e hora', `${receipt.date.split('-').reverse().join('/')} às ${receipt.time}`]].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
                      ))}
                    </dl>
                    <p className="mt-3 break-all rounded-xl bg-hover p-2 font-mono text-[10px] text-muted">Código: {receipt.hash}</p>
                    {receipt.footer && <p className="mt-2 whitespace-pre-line text-xs text-muted">{receipt.footer}</p>}
                  </motion.div>
                )}
              </AnimatePresence>
              <Card delay={0.05} className="rounded-[28px]">
                <h2 className="font-semibold">Hoje</h2>
                {today.length ? (
                  <ol className="mt-3 space-y-2">
                    {today.map((p, i) => (
                      <motion.li key={p.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2">
                        <span className={cn('grid size-8 place-items-center rounded-full text-xs font-bold', i % 2 ? 'bg-hover' : 'bg-brand text-brand-fg')}>{i + 1}</span>
                        <span className="flex-1 text-sm">{labels[i] ?? 'Extra'}</span>
                        <span className="font-mono font-semibold">{p.time}</span>
                        <span className="text-[11px] text-subtle">{SOURCE_LABEL[p.source] ?? p.source}</span>
                      </motion.li>
                    ))}
                  </ol>
                ) : <p className="mt-2 text-sm text-subtle">Nenhuma marcação hoje.</p>}
              </Card>
            </div>
          </div>
        )}
    </Page>
  );
}
