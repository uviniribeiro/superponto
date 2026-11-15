'use client';

import { animate, AnimatePresence, motion, useInView, useMotionValue, useTransform } from 'motion/react';
import { CheckCircle2, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

// ----------------------------------------------------------------- botão
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline' | 'light' | 'dark';
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, className, children, disabled, ...props }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' && 'bg-brand text-brand-fg shadow-[0_8px_24px_-8px_var(--brand-glow)] hover:bg-brand-strong',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-fg',
        variant === 'outline' && 'border border-line-strong text-fg hover:bg-hover',
        variant === 'danger' && 'bg-danger/90 text-white hover:bg-danger',
        variant === 'light' && 'pill-light rounded-full hover:brightness-95',
        variant === 'dark' && 'pill-dark rounded-full hover:brightness-125',
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

// ----------------------------------------------------------------- campo
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, className, id, ...props }, ref) {
  const inputId = id ?? props.name;
  return (
    <label htmlFor={inputId} className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-subtle">{label}</span>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={cn(
          'h-11 w-full rounded-2xl border bg-hover px-4 text-sm text-fg outline-none transition-colors placeholder:text-subtle focus:border-brand',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </label>
  );
});

// ----------------------------------------------------------------- cartão
export function Card({ className, children, delay = 0, ...props }: React.HTMLAttributes<HTMLDivElement> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={{ y: -3, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      className={cn('glass rounded-panel p-5', className)}
      {...(props as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}

/** Número que conta até o valor ao aparecer (como nos painéis de referência). */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('pt-BR') }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 1.1, ease: [0.2, 0.8, 0.2, 1] });
    return () => controls.stop();
  }, [inView, value, mv]);
  return <motion.span ref={ref}>{text}</motion.span>;
}

/**
 * Número com dígitos que rolam como num contador mecânico (efeito do vídeo de referência):
 * cada dígito gira até o valor com mola e leve desfoque, da direita para a esquerda.
 */
export function RollingNumber({ value, format = (n) => n.toLocaleString('pt-BR'), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const text = format(value);
  const chars = [...text];
  const digitCount = chars.filter((c) => /\d/.test(c)).length;
  let seen = 0;
  return (
    <span ref={ref} className={cn('inline-flex tabular-nums', className)} aria-label={text}>
      {chars.map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i} aria-hidden>{ch}</span>;
        const order = digitCount - 1 - seen++;
        const d = Number(ch);
        return (
          <span key={i} aria-hidden className="relative inline-block h-[1em] overflow-hidden leading-none" style={{ width: '0.62em' }}>
            <motion.span
              className="absolute inset-x-0 top-0 flex flex-col items-center"
              initial={{ y: '0em', filter: 'blur(0px)' }}
              animate={inView ? { y: `${-(d + 10)}em`, filter: ['blur(0px)', 'blur(3px)', 'blur(0px)'] } : undefined}
              transition={{ y: { type: 'spring', stiffness: 70, damping: 16, delay: 0.15 + order * 0.08 }, filter: { duration: 0.9, delay: 0.15 + order * 0.08 } }}
            >
              {Array.from({ length: 20 }, (_, n) => <span key={n} className="block h-[1em] leading-none">{n % 10}</span>)}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

/** Minigráfico de linha que se desenha ao aparecer (série real; sem série, nada é desenhado). */
export function Sparkline({ values, className, color = 'currentColor' }: { values: number[]; className?: string; color?: string }) {
  if (values.length < 2) return null;
  const w = 100, h = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-8 w-24 overflow-visible', className)} aria-hidden>
      <motion.path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1], delay: 0.3 }} />
      <motion.circle cx={last[0]} cy={last[1]} r="2.6" fill={color} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.3 }} />
    </svg>
  );
}

// ----------------------------------------------------------------- painel lateral
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className={cn('glass-strong fixed inset-y-3 right-3 z-50 flex flex-col rounded-[28px]', wide ? 'w-[min(760px,calc(100vw-24px))]' : 'w-[min(460px,calc(100vw-24px))]')}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <button onClick={onClose} className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg" aria-label="Fechar"><X className="size-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ----------------------------------------------------------------- confirmação
export function Confirm({ open, title, body, confirmLabel, onConfirm, onCancel, loading }: {
  open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div role="alertdialog" aria-modal initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="glass-strong w-full max-w-sm rounded-[24px] p-6">
            <h3 className="font-display text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm text-muted">{body}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
              <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ----------------------------------------------------------------- avisos
type Toast = { id: number; kind: 'success' | 'error'; text: string };
const ToastContext = createContext<(kind: Toast['kind'], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 24 }} className="glass-strong pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm">
              {t.kind === 'success' ? <CheckCircle2 className="size-4 text-success" /> : <TriangleAlert className="size-4 text-danger" />}
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ----------------------------------------------------------------- estados
export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon className="size-6" /></div>
      <h3 className="mt-4 font-display text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-hover', className)} />;
}
