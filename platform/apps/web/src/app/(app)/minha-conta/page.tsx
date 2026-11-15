'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { MfaCard } from '@/components/mfa-card';
import { Page, PageHeader } from '@/components/page';
import { useSession } from '@/components/providers';
import { Button, Card, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';

/** Minha conta: troca de senha (também atende a troca obrigatória no próximo acesso). */
export default function MyAccountPage() {
  const { me } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const change = useMutation({
    mutationFn: () => api('/api/auth/password/change', { method: 'POST', json: { currentPassword: f.current, newPassword: f.next } }),
    onSuccess: () => { setF({ current: '', next: '', confirm: '' }); qc.invalidateQueries({ queryKey: ['me'] }); toast('success', 'Senha alterada'); },
    onError: (e: Error) => setError(e.message),
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (f.next.length < 12) { setError('A nova senha precisa de 12 caracteres ou mais'); return; }
    if (f.next !== f.confirm) { setError('As senhas novas não conferem'); return; }
    change.mutate();
  }
  return (
    <Page>
      <PageHeader title="Minha conta" description={me ? `${me.displayName} · ${me.email}` : undefined} />
      <div className="max-w-lg space-y-4">
        {me?.mustChangePassword && (
          <Card className="flex items-start gap-3 border-brand/40 p-4 text-sm">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-brand" />
            <p>O administrador pediu que você troque sua senha antes de continuar.</p>
          </Card>
        )}
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold"><KeyRound className="size-5 text-brand" />Trocar senha</h2>
          <form onSubmit={submit} className="space-y-4">
            <Input label="Senha atual" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
            <Input label="Nova senha" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} hint="12 caracteres ou mais" required />
            <Input label="Repita a nova senha" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
            {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" loading={change.isPending} className="h-12 w-full">Salvar nova senha</Button>
          </form>
        </Card>
        <MfaCard />
      </div>
    </Page>
  );
}
