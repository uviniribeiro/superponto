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