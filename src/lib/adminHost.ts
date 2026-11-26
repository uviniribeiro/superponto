// Endereço próprio do painel do Super Admin: o login de administração não aparece na tela de entrada
// normal. Vale para superponto-admin.vercel.app e para qualquer domínio que comece com "admin.".
export const ADMIN_URL = 'https://superponto-admin.vercel.app';

export function isAdminHost(hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  return /^superponto-admin(\.|-)/.test(hostname) || hostname.startsWith('admin.');
}
