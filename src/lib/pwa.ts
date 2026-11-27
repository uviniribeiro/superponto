// PWA dos apps (Android e Apple): cada endereço instala como um app próprio, com nome, ícone e cor.
//  - superponto-terminal.vercel.app → "SuperPonto Terminal" (tela cheia, qualquer orientação)
//  - superponto-app.vercel.app      → "SuperPonto" (app do funcionário, retrato)
// No iPhone/iPad (Safari) a instalação é por Compartilhar › Adicionar à Tela de Início.
import { isEmployeeAppHost, isTerminalHost } from '@/lib/adminHost';
import { APP_MODE } from '@/lib/appMode';

export type PwaProfile = 'terminal' | 'app' | 'web';

export function pwaProfile(): PwaProfile {
  if (isTerminalHost() || APP_MODE === 'terminal') return 'terminal';
  if (isEmployeeAppHost() || APP_MODE === 'funcionario') return 'app';
  return 'web';
}

function meta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

export function setupPwa() {
  const profile = pwaProfile();
  if (profile === 'web') return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link) link.href = profile === 'terminal' ? '/terminal.webmanifest' : '/app.webmanifest';
  document.title = profile === 'terminal' ? 'SuperPonto Terminal' : 'SuperPonto';
  meta('apple-mobile-web-app-title', profile === 'terminal' ? 'Terminal' : 'SuperPonto');
  meta('apple-mobile-web-app-capable', 'yes');
  meta('apple-mobile-web-app-status-bar-style', 'black-translucent'); // conteúdo por baixo da barra (área segura)
  meta('theme-color', '#0b1220');
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => undefined); });
  }
}

/** Rodando como app instalado (tela de início)? */
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || (navigator as any).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
