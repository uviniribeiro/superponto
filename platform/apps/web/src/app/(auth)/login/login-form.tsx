'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Button, Input } from '@/components/ui';

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(res.status === 429 ? 'Muitas tentativas. Aguarde um minuto.' : data.message ?? 'Não foi possível entrar');
        return;
      }
      try { sessionStorage.setItem('sp-intro', 'pending'); } catch { /* sem storage */ }
      router.replace(safeNext(params.get('next')));
      router.refresh();
    } catch {
      setError('Sem conexão com o servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Bem-vindo de volta" subtitle="Entre com seu e-mail e senha.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="E-mail" name="email" type="email" autoComplete="email" required autoFocus placeholder="voce@empresa.com.br" />
        <Input label="Senha" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="h-12 w-full">Entrar</Button>
        <div className="text-center">
          <Link href="/forgot-password" transitionTypes={['nav-forward']} className="text-sm text-muted hover:text-brand">Esqueci minha senha</Link>
        </div>
      </form>
    </AuthCard>
  );
}
