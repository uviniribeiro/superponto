'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Button, Input } from '@/components/ui';

/** Recebe ?token=… do e-mail; o servidor valida o token (uso único, 1 hora). */
export function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') ?? '');
    if (password.length < 12) { setError('A senha precisa ter pelo menos 12 caracteres.'); return; }
    if (password !== form.get('confirm')) { setError('As senhas não conferem.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      if (!res.ok) { setError('Link inválido ou expirado. Peça um novo.'); return; }
      setDone(true);
      setTimeout(() => router.replace('/login'), 1800);
    } catch {
      setError('Sem conexão com o servidor');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Link incompleto" subtitle="Abra o link exatamente como chegou no e-mail ou peça um novo.">
        <Link href="/forgot-password" className="text-sm text-brand">Pedir novo link</Link>
      </AuthCard>
    );
  }
  if (done) return <AuthCard title="Senha alterada" subtitle="Tudo certo. Levando você ao login…">{null}</AuthCard>;

  return (
    <AuthCard title="Criar nova senha" subtitle="Use pelo menos 12 caracteres.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Nova senha" name="password" type="password" autoComplete="new-password" required minLength={12} autoFocus />
        <Input label="Repita a senha" name="confirm" type="password" autoComplete="new-password" required minLength={12} />
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="h-12 w-full">Salvar senha</Button>
      </form>
    </AuthCard>
  );
}
