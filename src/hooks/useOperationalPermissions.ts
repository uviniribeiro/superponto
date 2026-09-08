import { useAuth } from '@/contexts/AuthContext';

/**
 * Permissões do módulo Controle Operacional.
 * Enquanto o banco está pausado, administradores e gestores têm acesso total e
 * as demais pessoas ficam em modo leitura. A tela de Permissões grava a matriz
 * por usuário, que passará a valer quando o backend voltar.
 */
export function useOperationalPermissions() {
  const { isAdmin, isSuperAdmin, hasRole } = useAuth();
  const manager = hasRole('manager');
  const full = Boolean(isAdmin || isSuperAdmin || manager);

  return {
    canCreateSchedules: full,
    canSwapDrivers: full,
    canEditOccurrences: full,
    canManagePermissions: Boolean(isAdmin || isSuperAdmin),
    canViewReports: true,
  };
}
