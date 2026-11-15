'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CornerDownLeft, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { flattenNav, type NavSection } from './nav';

/** Busca de telas (⌘K / Ctrl+K), navegável pelo teclado. */
export function CommandPalette({ open, onClose, sections }: { open: boolean; onClose: () => void; sections: NavSection[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => {
    const all = flattenNav(sections);
    const q = query.trim().toLowerCase();
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all;
  }, [sections, query]);

  useEffect(() => {
    if (open) { setQuery(''); setIndex(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const go = (href: string) => { onClose(); router.push(href); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-4 pt-[14vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-label="Buscar telas"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="glass-strong w-full max-w-lg overflow-hidden rounded-[24px]"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-subtle" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
                  if (e.key === 'Enter' && items[index]) go(items[index].href);
                  if (e.key === 'Escape') onClose();
                }}
                placeholder="Buscar telas…"
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              />
              <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-subtle">ESC</kbd>
            </div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-subtle">Nenhuma tela encontrada</li>}
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button onMouseEnter={() => setIndex(i)} onClick={() => go(item.href)} className={cn('relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm', i === index ? 'text-fg' : 'text-muted')}>
                      {i === index && <motion.span layoutId="cmd-pill" className="absolute inset-0 rounded-xl bg-brand-soft" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                      {Icon && <Icon className="relative size-4" />}
                      <span className="relative flex-1">{item.label}</span>
                      {i === index && <CornerDownLeft className="relative size-3.5 text-subtle" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
