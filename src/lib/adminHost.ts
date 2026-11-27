// Endereço próprio do painel do Super Admin: o login de administração não aparece na tela de entrada
// normal. Vale para superponto-admin.vercel.app e para qualquer domínio que comece com "admin.".
export const ADMIN_URL = 'https://superponto-admin.vercel.app';

export function isAdminHost(hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  return /^superponto-admin(\.|-)/.test(hostname) || hostname.startsWith('admin.');
}

/** App de terminal independente: superponto-terminal.vercel.app (ou domínio "terminal."). */
export const TERMINAL_URL = 'https://superponto-terminal.vercel.app';

export function isTerminalHost(hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  return /^superponto-terminal(\.|-)/.test(hostname) || hostname.startsWith('terminal.');
}

/** App do funcionário (PWA/celular): superponto-app.vercel.app (ou domínio "app."). */
export const EMPLOYEE_APP_URL = 'https://superponto-app.vercel.app';

export function isEmployeeAppHost(hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  return /^superponto-app(\.|-)/.test(hostname) || hostname.startsWith('app.');
}
