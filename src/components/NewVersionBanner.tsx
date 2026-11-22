import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const KEY = 'sp.v2-banner-closed';
const V2_URL = 'https://superponto-v2.vercel.app';

/** Aviso da nova versão do SuperPonto (v2) para quem usa a versão atual. Fecha e fica lembrado no aparelho. */
export function NewVersionBanner() {
  const [closed, setClosed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  if (closed) return null;
  const close = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* sem armazenamento */ }
    setClosed(true);
  };
  return (
    <div className="w-full bg-primary/15 border-b border-primary/30 px-4 py-2 text-center text-xs">
      <span className="inline-flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        Nova versão do SuperPonto disponível: visual novo, mais rápida e com tour guiado. Entre com o mesmo usuário, CNPJ e senha.
        <a href={V2_URL} className="font-semibold underline">Conhecer a nova versão</a>
        <button type="button" onClick={close} aria-label="Fechar aviso" className="ml-1 opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
      </span>
    </div>
  );
}
