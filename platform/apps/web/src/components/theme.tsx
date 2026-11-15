'use client';

import { useCallback, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

/** Tema escuro (principal) ou claro, com transição suave e lembrado por navegador. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);
  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    const apply = () => {
      if (next === 'light') document.documentElement.dataset.theme = 'light';
      else delete document.documentElement.dataset.theme;
      setTheme(next);
      try { localStorage.setItem('sp-theme', next); } catch { /* sem storage */ }
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(apply);
    else apply();
  }, []);
  return { theme, toggle };
}
