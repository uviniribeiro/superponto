/** Baixa um texto como arquivo (CSV/TXT), com BOM opcional para o Excel abrir acentos certos. */
export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8', bom = false) {
  const blob = new Blob([bom ? '﻿' : '', content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
