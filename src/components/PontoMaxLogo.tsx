import clockAsset from '@/assets/pontomax-blueprint-clock.png.asset.json';
import { cn } from '@/lib/utils';

export function PontoMaxLogo({ compact = false, inverse = false, className }: { compact?: boolean; inverse?: boolean; className?: string }) {
  return <div className={cn('inline-flex shrink-0 items-center gap-2.5', className)}>
    <img src={clockAsset.url} alt={compact ? 'PontoMax' : ''} className="h-10 w-10 shrink-0 object-contain" />
    {!compact && <div><span className={cn('text-2xl font-bold leading-none', inverse ? 'text-sidebar-foreground' : 'text-foreground')}>Ponto<span className="text-accent">Max</span></span><p className={cn('mt-1 text-[11px]', inverse ? 'text-sidebar-foreground/70' : 'text-muted-foreground')}>Sistema de Ponto e Acesso</p></div>}
  </div>;
}