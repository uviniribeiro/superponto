import { z } from 'zod';

export const signInSchema = z.object({ email: z.email(), password: z.string().min(1).max(256) });
export type SignInDto = z.infer<typeof signInSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshDto = z.infer<typeof refreshSchema>;

export const forgotSchema = z.object({ email: z.email() });
export type ForgotDto = z.infer<typeof forgotSchema>;

/** Senha nova: 12+ caracteres (OWASP ASVS). Senhas antigas mais curtas continuam valendo no login. */
export const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(12).max(128) });
export type ResetDto = z.infer<typeof resetSchema>;
