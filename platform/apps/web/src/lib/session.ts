// Sessão do navegador (BFF): tokens só em cookies httpOnly no domínio do app; o JavaScript da
// página nunca os vê. O servidor Next repassa as chamadas à API com o Bearer.
export const ACCESS_COOKIE = 'sp_at';
export const REFRESH_COOKIE = 'sp_rt';
export const API_URL = process.env.SUPERPONTO_API_URL ?? 'http://localhost:3000';

export const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}
