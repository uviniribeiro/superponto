// Aviso para instalar o app: no iPhone/iPad (Safari) explica o "Adicionar à Tela de Início"; no Android
// usa o pedido de instalação do navegador. Some depois de instalado ou dispensado.
import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { isIos, isStandalone, pwaProfile } from '@/lib/pwa';

const KEY = 'superponto.installHint.dismissed';

export function InstallHint() {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState<any>(null);
  const profile = pwaProfile();

  useEffect(() => {
    if (profile === 'web' || isStandalone()) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === '1'; } catch { /* ignora */ }
    if (dismissed) return;
    if (isIos()) setShow(true);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [profile]);

  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem(KEY, '1'); } catch { /* ignora */ } };
  const name = profile === 'terminal' ? 'SuperPonto Terminal' : 'SuperPonto';

  return (
    <div className="fixed inset-x-3 z-[80] rounded-2xl border bg-background/95 p-4 shadow-2xl backdrop-blur" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }} role="dialog" aria-label="Instalar o app">
      <button type="button" onClick={close} className="absolute right-3 top-3 text-muted-foreground" aria-label="Fechar"><X className="h-4 w-4" /></button>
      <div className="flex items-start gap-3 pr-6">
        <img src="/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
        <div className="text-sm">
          <p className="font-semibold">Instale o {name}</p>
          {isIos() ? (
            <p className="mt-1 text-muted-foreground">
              Toque em <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Compartilhar</strong> e depois em <SquarePlus className="inline h-4 w-4 align-text-bottom" /> <strong>Adicionar à Tela de Início</strong>. Ele abre em tela cheia, como um app.
            </p>
          ) : (
            <button type="button" onClick={async () => { await prompt?.prompt?.(); close(); }} className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground">
              <Download className="h-4 w-4" /> Instalar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
