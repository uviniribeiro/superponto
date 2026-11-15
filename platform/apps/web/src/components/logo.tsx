import { useId } from 'react';
import { cn } from '@/lib/cn';

/** Marca SuperPonto: relógio estilizado no amarelo da identidade. */
export function LogoMark({ className }: { className?: string }) {
  // id único por instância: com o mesmo id, uma cópia oculta (display:none) apagava o degradê das outras.
  const gradient = `sp-g-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 40 40" className={cn('size-9', className)} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#f0a800" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${gradient})`} />
      <circle cx="20" cy="21" r="11" fill="none" stroke="#121212" strokeWidth="2.6" />
      <path d="M20 14.5V21l4.5 3" fill="none" stroke="#121212" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 7.5h8" stroke="#121212" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="29.5" cy="12" r="2.2" fill="#121212" />
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark />
      <div className="leading-tight">
        <div className="font-brand text-[17px] font-bold tracking-tight">
          Super<span className="text-brand">Ponto</span>
        </div>
        {subtitle && <div className="text-xs text-subtle">{subtitle}</div>}
      </div>
    </div>
  );
}
