import { ViewTransition } from 'react';

/** Conteúdo de cada tela: entra com desfoque e leve subida; a barra lateral fica parada (âncora). */
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="mx-auto w-full max-w-[1400px]">{children}</div>
    </ViewTransition>
  );
}

export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-[34px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 [&>*]:max-w-full">{actions}</div>}
    </div>
  );
}
