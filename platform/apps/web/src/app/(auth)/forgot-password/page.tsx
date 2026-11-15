'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Button, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/password/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (res.status === 429) { setError('Muitas tentativas. Aguarde um minuto.'); return; }
      if (!res.ok && res.status !== 202 && res.status !== 204) { setError('Informe um e-mail válido.'); return; }
      setSent(true);
    } catch {
      setError('Sem conexão com o servidor');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Confira seu e-mail" subtitle="Se o endereço estiver cadastrado, você receberá um link para criar uma nova senha. O link vale por 1 hora.">
        <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"><MailCheck className="size-7" /></div>
        <Link href="/login" transitionTypes={['nav-back']} className="text-sm text-muted hover:text-brand">← Voltar para o login</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Esqueci minha senha" subtitle="Enviaremos um link de redefinição para seu e-mail.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="E-mail" name="email" type="email" autoComplete="email" required autoFocus placeholder="voce@empresa.com.br" />
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="h-12 w-full">Enviar link</Button>
        <div className="text-center">
          <Link href="/login" transitionTypes={['nav-back']} className="text-sm text-muted hover:text-brand">← Voltar para o login</Link>
        </div>
      </form>
    </AuthCard>
  );
}
