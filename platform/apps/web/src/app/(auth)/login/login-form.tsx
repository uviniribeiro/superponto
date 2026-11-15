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
  // Verificação em duas etapas: guarda e-mail e senha enquanto pede o código.
  const [mfa, setMfa] = useState<{ email: string; password: string; recovery: boolean } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mfa
          ? { email: mfa.email, password: mfa.password, ...(mfa.recovery ? { recoveryCode: String(form.get('code') ?? '').trim() } : { code: String(form.get('code') ?? '').replace(/\D/g, '') }) }
          : { email: form.get('email'), password: form.get('password') }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.mfaRequired) {
          if (!mfa) { setMfa({ email: String(form.get('email')), password: String(form.get('password')), recovery: false }); return; }
          setError(data.message ?? 'Código incorreto');
          return;
        }
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
        {mfa ? (
          <>
            <p className="text-sm text-muted">{mfa.recovery ? 'Digite um dos códigos de recuperação que você guardou.' : 'Abra o aplicativo autenticador e digite o código de 6 dígitos.'}</p>
            <Input key={mfa.recovery ? 'r' : 'c'} label={mfa.recovery ? 'Código de recuperação' : 'Código do aplicativo'} name="code" required autoFocus autoComplete="one-time-code" inputMode={mfa.recovery ? 'text' : 'numeric'} {...(mfa.recovery ? {} : { pattern: '[0-9 ]{6,7}', maxLength: 7 })} />
            <button type="button" onClick={() => { setMfa({ ...mfa, recovery: !mfa.recovery }); setError(''); }} className="text-xs text-muted hover:text-brand">{mfa.recovery ? 'Usar o código do aplicativo' : 'Perdi o celular: usar código de recuperação'}</button>
          </>
        ) : (
          <>
            <Input label="E-mail" name="email" type="email" autoComplete="email" required autoFocus placeholder="voce@empresa.com.br" />
            <Input label="Senha" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
          </>
        )}
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="h-12 w-full">{mfa ? 'Confirmar' : 'Entrar'}</Button>
        {mfa && <button type="button" onClick={() => { setMfa(null); setError(''); }} className="block w-full text-center text-xs text-muted hover:text-fg">Voltar</button>}
        <div className="text-center">
          <Link href="/forgot-password" transitionTypes={['nav-forward']} className="text-sm text-muted hover:text-brand">Esqueci minha senha</Link>
        </div>
      </form>
    </AuthCard>
  );
}
