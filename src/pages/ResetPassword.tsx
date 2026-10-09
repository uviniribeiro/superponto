import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RecoveryShell } from '@/components/auth/RecoveryShell';
import { finishPasswordRecovery } from '@/lib/passwordRecovery';
import { z } from 'zod';

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    const hashRecovery = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
    async function validate(recoveryEvent = false) {
      const { data, error } = await supabase.auth.getUser();
      const recoveryId = sessionStorage.getItem('pontomax.password-recovery-user');
      if (active) { setReady(!error && !!data.user && (recoveryEvent || hashRecovery || recoveryId === data.user.id)); setChecking(false); }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setTimeout(() => { void validate(true); }, 0);
    });
    void validate();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!ready) return; setBusy(true); setError('');
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) { setReady(false); return; }
      const result = await finishPasswordRecovery(supabase.auth, password, confirmation);
      if (result.error) { setError('Não foi possível salvar. A senha pode ter sido recusada ou o link expirou; solicite um novo link.'); return; }
      sessionStorage.removeItem('pontomax.password-recovery-user');
      setPassword(''); setConfirmation(''); setDone(true); await supabase.auth.signOut();
    } catch (err) { setError(err instanceof z.ZodError ? err.errors[0]?.message || 'Confira a senha' : 'Verifique sua conexão e tente novamente.'); }
    finally { setBusy(false); }
  }
  return <RecoveryShell>
    <h1 className="text-2xl font-bold">{done ? 'Senha redefinida' : 'Redefinir senha'}</h1>
    {checking ? <p className="mt-4 text-muted-foreground" role="status">Validando link...</p> : done ? <><p className="my-5 text-sm text-muted-foreground">Sua senha foi atualizada. E-mail, empresa e permissões permanecem os mesmos.</p><Button asChild><Link to="/super-admin-auth">Voltar ao login</Link></Button></> : !ready ? <><p role="alert" className="my-5 text-sm text-muted-foreground">Link inválido ou expirado. Solicite uma nova recuperação para continuar.</p><Button asChild><Link to="/forgot-password">Solicitar novo link</Link></Button></> : <form onSubmit={submit} className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">Escolha uma nova senha com pelo menos 8 caracteres.</p>
      <div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={100} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar nova senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" maxLength={100} required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="w-full" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'}</Button>
    </form>}
  </RecoveryShell>;
}