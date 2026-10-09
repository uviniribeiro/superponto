import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RecoveryShell } from '@/components/auth/RecoveryShell';
import { requestPasswordRecovery } from '@/lib/passwordRecovery';
import { z } from 'zod';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await requestPasswordRecovery(supabase.auth, email, window.location.origin);
      if (result.error) { setError('Não foi possível enviar agora. Aguarde alguns instantes e tente novamente.'); return; }
      setSent(true);
    } catch (err) { setError(err instanceof z.ZodError ? err.errors[0]?.message || 'E-mail inválido' : 'Verifique sua conexão e tente novamente.'); }
    finally { setBusy(false); }
  }
  return <RecoveryShell>
    <h1 className="text-2xl font-bold">{sent ? 'Confira seu e-mail' : 'Esqueci minha senha'}</h1>
    <p className="mb-8 mt-3 text-sm leading-relaxed text-muted-foreground">{sent ? 'Se este e-mail possui uma conta, você receberá um link para redefinir a senha. Confira também o spam.' : 'Receba um link seguro no e-mail cadastrado. Seu e-mail, empresa e permissões serão preservados.'}</p>
    {!sent && <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="recovery-email">E-mail de acesso</Label><Input id="recovery-email" type="email" autoComplete="email" maxLength={255} required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Mail />}Enviar link de recuperação</Button>
    </form>}
    <Button variant="link" className="mt-6 justify-start px-0" asChild><Link to="/super-admin-auth"><ArrowLeft />Voltar ao acesso SUPER ADMIN</Link></Button>
  </RecoveryShell>;
}