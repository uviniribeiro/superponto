import { z } from 'zod';

export const recoveryEmailSchema = z.string().trim().email('Informe um e-mail válido').max(255);
export const recoveryPasswordSchema = z.object({
  password: z.string().min(8, 'Use pelo menos 8 caracteres').max(100, 'Use no máximo 100 caracteres'),
  confirmation: z.string(),
}).refine(value => value.password === value.confirmation, { message: 'As senhas não coincidem', path: ['confirmation'] });

interface RecoveryAuth {
  resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<{ error: { message: string } | null }>;
  updateUser: (attributes: { password: string }) => Promise<{ error: { message: string } | null }>;
}

export async function requestPasswordRecovery(auth: RecoveryAuth, email: string, origin: string) {
  return auth.resetPasswordForEmail(recoveryEmailSchema.parse(email), { redirectTo: `${origin}/reset-password` });
}

export async function finishPasswordRecovery(auth: RecoveryAuth, password: string, confirmation: string) {
  const valid = recoveryPasswordSchema.parse({ password, confirmation });
  return auth.updateUser({ password: valid.password });
}

interface RecoverySession { access_token: string; user: { id: string } }
interface RecoveryValidationAuth {
  getSession: () => Promise<{ data: { session: RecoverySession | null }; error: { message: string } | null }>;
  exchangeCodeForSession: (code: string) => Promise<{ data: { session: RecoverySession | null }; error: { message: string } | null }>;
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
}

export async function validatePasswordRecovery(
  auth: RecoveryValidationAuth, url: string, hasRecoveryEvent: () => boolean,
): Promise<'ready' | 'invalid' | 'unavailable'> {
  const location = new URL(url);
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has('error') || location.searchParams.has('error')) return 'invalid';
  try {
    // Wait for the client's automatic token processing before judging the link.
    const initial = await auth.getSession();
    if (initial.error) return 'invalid';
    let session = initial.data.session;
    let recovery = hasRecoveryEvent() || (
      hash.get('type') === 'recovery' && !!hash.get('access_token') &&
      hash.get('access_token') === session?.access_token
    );
    const code = location.searchParams.get('code');
    if (code && !recovery) {
      const exchanged = await auth.exchangeCodeForSession(code);
      if (exchanged.error) return 'invalid';
      session = exchanged.data.session;
      recovery = !!session;
    }
    if (!recovery || !session) return 'invalid';
    const validated = await auth.getUser();
    if (validated.error) {
      return /fetch|network|load failed|timeout/i.test(validated.error.message) ? 'unavailable' : 'invalid';
    }
    return validated.data.user?.id === session.user.id ? 'ready' : 'invalid';
  } catch {
    return 'unavailable';
  }
}