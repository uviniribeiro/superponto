import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MaintenanceWindow {
  id: string;
  job: string | null;
  reason: string | null;
  started_at: string;
  expected_end_at: string | null;
}

/**
 * Consulta a janela de manutenção ativa.
 * O sistema NUNCA sai do ar: a manutenção apenas exibe um aviso,
 * e o registro de ponto continua funcionando normalmente.
 */
export function useMaintenanceStatus(pollMs = 60_000) {
  const [maintenance, setMaintenance] = useState<MaintenanceWindow | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('system_maintenance')
        .select('id, job, reason, started_at, expected_end_at')
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setMaintenance(data ?? null);
    };

    load();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, pollMs);
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [pollMs]);

  return maintenance;
}
