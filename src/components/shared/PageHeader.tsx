import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão das telas internas: ícone em chip, título, descrição e ações.
 */
export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        {Icon && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[image:var(--gradient-brand)] text-brand-foreground shadow-sm">
            <Icon className="h-6 w-6 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-heading text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageHeader;
