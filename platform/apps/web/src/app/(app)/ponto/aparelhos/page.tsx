'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Smartphone, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { Button, Card, Confirm, EmptyState, Input, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';

interface Dev { id: string; name: string; approvedAt: string | null; lastUsedAt: string | null; revokedAt: string | null; createdAt: string; codeExpires: string | null }
const dt = (v: string) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function MeusAparelhosPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['my-app-devices'], queryFn: () => api<Dev[]>('/app-devices/mine') });
  const [name, setName] = useState('');
  const [pending, setPending] = useState<Dev | null>(null);
  const [code, setCode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [revoke, setRevoke] = useState<Dev | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['my-app-devices'] });
  const request = useMutation({ mutationFn: () => api<Dev>('/app-devices/request', { method: 'POST', json: { name } }), onSuccess: (d) => { setPending(d); setCode(''); setToken(null); toast('success', 'Enviamos um código para o seu e-mail'); refresh(); }, onError: (e: Error) => toast('error', e.message) });
  const confirm = useMutation({ mutationFn: () => api<Dev & { token: string }>(`/app-devices/${pending!.id}/confirm`, { method: 'POST', json: { code } }), onSuccess: (d) => { setToken(d.token); setPending(null); setName(''); refresh(); }, onError: (e: Error) => toast('error', e.message) });
  const rev = useMutation({ mutationFn: (id: string) => api(`/app-devices/mine/${id}/revoke`, { method: 'POST' }), onSuccess: () => { setRevoke(null); refresh(); toast('success', 'Aparelho revogado'); }, onError: (e: Error) => toast('error', e.message) });
  const approved = (list.data ?? []).filter((d) => d.approvedAt);

  return (
    <Page>
      <PageHeader title="Meus aparelhos" description="Libere o celular ou tablet que você usa para marcar o ponto pelo app. A liberação é confirmada por um código enviado ao seu e-mail." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="space-y-4 rounded-[28px]">
          {token ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 font-semibold text-success"><Check className="size-4" />Aparelho liberado</p>
              <p className="text-sm text-muted">Cole este token no app do aparelho. Ele aparece <b>só agora</b>; se perder, libere de novo.</p>
              <code className="block break-all rounded-2xl bg-hover p-3 text-xs">{token}</code>
              <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(token); toast('success', 'Copiado'); }}><Copy className="size-4" />Copiar</Button>
            </div>
          ) : pending ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); confirm.mutate(); }}>
              <p className="text-sm text-muted">Digite o código de 6 dígitos enviado ao seu e-mail para liberar <b>{pending.name}</b>. Vale por 10 minutos.</p>
              <Input label="Código" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <div className="flex gap-2"><Button type="submit" loading={confirm.isPending}>Confirmar</Button><Button type="button" variant="ghost" onClick={() => setPending(null)}>Cancelar</Button></div>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); request.mutate(); }}>
              <Input label="Nome do aparelho" placeholder="Ex.: Meu celular" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" loading={request.isPending}><Smartphone className="size-4" />Enviar código por e-mail</Button>
            </form>
          )}
        </Card>
        <Card className="rounded-[28px]">
          <h2 className="mb-3 font-semibold">Aparelhos liberados</h2>
          {!list.data ? <Skeleton className="h-32" /> : !approved.length ? <EmptyState icon={Smartphone} title="Nenhum aparelho" body="Libere o aparelho ao lado." /> : (
            <ul className="divide-y divide-line">
              {approved.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <Smartphone className="size-5 text-muted" />
                  <div className="flex-1 text-sm"><p className="font-medium">{d.name}{d.revokedAt && <span className="ml-2 text-xs text-danger">revogado</span>}</p><p className="text-xs text-subtle">Liberado em {dt(d.approvedAt!)}{d.lastUsedAt ? ` · usado em ${dt(d.lastUsedAt)}` : ''}</p></div>
                  {!d.revokedAt && <Button variant="ghost" aria-label="Revogar" onClick={() => setRevoke(d)}><Trash2 className="size-4" /></Button>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Confirm open={!!revoke} title="Revogar aparelho?" body={`${revoke?.name ?? ''} não poderá mais marcar o ponto pelo app.`} confirmLabel="Revogar" loading={rev.isPending} onConfirm={() => revoke && rev.mutate(revoke.id)} onCancel={() => setRevoke(null)} />
    </Page>
  );
}
