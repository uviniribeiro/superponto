import { z } from 'zod';

export const signInSchema = z.object({ email: z.email(), password: z.string().min(1).max(256) });
export type SignInDto = z.infer<typeof signInSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshDto = z.infer<typeof refreshSchema>;

export const forgotSchema = z.object({ email: z.email() });
export type ForgotDto = z.infer<typeof forgotSchema>;

/** Senha nova: 12+ caracteres (OWASP ASVS). Senhas antigas mais curtas continuam valendo no login. */
/** Política de senha: 6+ caracteres com maiúscula, minúscula, número e símbolo. */
export const strongPassword = z.string().min(6, 'A senha precisa de 6 ou mais caracteres, com letra maiúscula, minúscula, número e símbolo').max(128)
  .refine((v) => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v), 'A senha precisa de 6 ou mais caracteres, com letra maiúscula, minúscula, número e símbolo');
export const resetSchema = z.object({ token: z.string().min(1), password: strongPassword });
export type ResetDto = z.infer<typeof resetSchema>;
