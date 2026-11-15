'use client';

import { motion } from 'motion/react';
import { ViewTransition } from 'react';
import { LogoMark } from './logo';

/** Cartão das telas públicas; a troca entre login/esqueci/redefinir anima o conteúdo. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="glass-strong w-full max-w-[420px] rounded-[28px] p-7 sm:p-9"
      >
        <LogoMark className="mb-6 size-11 lg:hidden" />
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </motion.div>
    </ViewTransition>
  );
}
