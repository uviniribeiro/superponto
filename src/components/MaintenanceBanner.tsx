import { Wrench } from 'lucide-react';
import { useMaintenanceStatus } from '@/hooks/useMaintenanceStatus';

/**
 * Aviso não bloqueante de manutenção automática.
 * A conexão permanece estável e o registro de ponto continua liberado.
 */
export function MaintenanceBanner() {
  const maintenance = useMaintenanceStatus();
  if (!maintenance) return null;

  const end = maintenance.expected_end_at
    ? new Date(maintenance.expected_end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="w-full bg-warning/15 border-b border-warning/30 px-4 py-2 text-center text-xs text-warning-foreground">
      <span className="inline-flex items-center gap-2">
        <Wrench className="h-3.5 w-3.5 shrink-0" />
        Manutenção automática em andamento{end ? ` — previsão de término às ${end}` : ''}. O sistema continua no ar e o registro de ponto segue funcionando normalmente.
      </span>
    </div>
  );
}
