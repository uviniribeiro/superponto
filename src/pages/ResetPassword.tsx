import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RecoveryShell } from '@/components/auth/RecoveryShell';
import { finishPasswordRecovery, validatePasswordRecovery } from '@/lib/passwordRecovery';
import { z } from 'zod';

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const recoveryEvent = useRef(false);
  const validation = useRef<Promise<'ready' | 'invalid' | 'unavailable'> | null>(null);
  const recoveryUrl = useRef(window.location.href);
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') recoveryEvent.current = true;
    });
    // Reuse the pending exchange across StrictMode effects; recovery codes are single-use.
    validation.current ??= validatePasswordRecovery(supabase.auth, recoveryUrl.current, () => recoveryEvent.current);
    void validation.current.then(result => {
      if (!active) return;
      setReady(result === 'ready');
      setUnavailable(result === 'unavailable');
      setChecking(false);
      if (result === 'ready') window.history.replaceState(null, '', window.location.pathname);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!ready) return; setBusy(true); setError('');
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) { setReady(false); return; }
      const result = await finishPasswordRecovery(supabase.auth, password, confirmation);
      if (result.error) { setError('Não foi possível salvar. A senha pode ter sido recusada ou o link expirou; solicite um novo link.'); return; }
      setPassword(''); setConfirmation(''); setDone(true); await supabase.auth.signOut();
    } catch (err) { setError(err instanceof z.ZodError ? err.errors[0]?.message || 'Confira a senha' : 'Verifique sua conexão e tente novamente.'); }
    finally { setBusy(false); }
  }
  return <RecoveryShell>
    <h1 className="text-2xl font-bold">{done ? 'Senha redefinida' : 'Redefinir senha'}</h1>
    {checking ? <p className="mt-4 text-muted-foreground" role="status">Validando link...</p> : done ? <><p className="my-5 text-sm text-muted-foreground">Sua senha foi atualizada. E-mail, empresa e permissões permanecem os mesmos.</p><Button asChild><Link to="/super-admin-auth">Voltar ao login</Link></Button></> : !ready ? <><p role="alert" className="my-5 text-sm text-muted-foreground">{unavailable ? 'O servidor está indisponível. Tente novamente quando o serviço for restabelecido.' : 'Link inválido ou expirado. Solicite uma nova recuperação para continuar.'}</p>{unavailable ? <Button onClick={() => window.location.reload()}>Tentar novamente</Button> : <Button asChild><Link to="/forgot-password">Solicitar novo link</Link></Button>}</> : <form onSubmit={submit} className="mt-6 space-y-5">
      <p className="text-sm text-muted-foreground">Escolha uma nova senha com pelo menos 8 caracteres.</p>
      <div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={100} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar nova senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" maxLength={100} required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="w-full" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'}</Button>
    </form>}
  </RecoveryShell>;
}