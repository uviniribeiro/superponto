import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Permissões reais do módulo Controle Operacional.
 * Administradores e gestores têm acesso total; os demais usuários seguem a
 * matriz gravada na tela de Permissões (tabela op_user_permissions).
 */
export function useOperationalPermissions() {
  const { user, isAdmin, isSuperAdmin, hasRole } = useAuth();
  const manager = hasRole('manager');
  const full = Boolean(isAdmin || isSuperAdmin || manager);
  const [row, setRow] = useState<{
    can_create_schedules: boolean;
    can_swap_drivers: boolean;
    can_edit_occurrences: boolean;
    can_view_reports: boolean;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    if (!user?.id || full) return;
    void supabase
      .from('op_user_permissions')
      .select('can_create_schedules, can_swap_drivers, can_edit_occurrences, can_view_reports')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setRow(data ?? null);
      });
    return () => {
      alive = false;
    };
  }, [user?.id, full]);

  return {
    canCreateSchedules: full || Boolean(row?.can_create_schedules),
    canSwapDrivers: full || Boolean(row?.can_swap_drivers),
    canEditOccurrences: full || Boolean(row?.can_edit_occurrences),
    canManagePermissions: Boolean(isAdmin || isSuperAdmin),
    canViewReports: full || Boolean(row?.can_view_reports),
  };
}
