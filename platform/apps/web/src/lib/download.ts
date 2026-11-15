/** Baixa um texto como arquivo (CSV/TXT), com BOM opcional para o Excel abrir acentos certos. */
export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8', bom = false) {
  const blob = new Blob([bom ? '﻿' : '', content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Baixa um arquivo que a API devolveu em base64 (relatórios, folha, AFD). */
export function downloadBase64(r: { filename: string; mime: string; base64: string }) {
  const bin = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bin], { type: r.mime }));
  const a = document.createElement('a');
  a.href = url; a.download = r.filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
