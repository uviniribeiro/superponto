/**
 * Modo de empacotamento do app, definido no build (VITE_APP_MODE):
 *   web         sistema completo no navegador (padrão)
 *   funcionario app do celular do funcionário: abre direto no registro de ponto
 *   terminal    app do tablet/terminal de ponto da empresa: abre direto no terminal
 */
export type AppMode = 'web' | 'funcionario' | 'terminal';

export function resolveAppMode(value: string | undefined): AppMode {
  return value === 'funcionario' || value === 'terminal' ? value : 'web';
}

export const APP_MODE: AppMode = resolveAppMode(import.meta.env.VITE_APP_MODE);

/** Primeira tela ao abrir o app. */
export function startPathFor(mode: AppMode): string {
  if (mode === 'terminal') return '/terminal';
  if (mode === 'funcionario') return '/time-clock';
  return '/home';
}

/** Tela após o login de um usuário comum. */
export function homePathFor(mode: AppMode): string {
  return mode === 'funcionario' ? '/time-clock' : '/dashboard';
}
