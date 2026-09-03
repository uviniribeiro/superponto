import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Perfis e permissões do Robô de Comunicação.
 * A matriz é guardada em `system_configurations` (chave `agent_queue_permissions`),
 * permitindo que o administrador ajuste quem pausa, reexecuta e rotaciona tokens
 * sem nenhuma alteração de backend.
 */
export const AGENT_PERMISSION_KEYS = [
  'canPause',
  'canResume',
  'canRetry',
  'canCancel',
  'canManageTokens',
  'canAdoptDevices',
] as const;

export type AgentPermissionKey = (typeof AGENT_PERMISSION_KEYS)[number];
export type AgentPermissions = Record<AgentPermissionKey, boolean>;
export type AgentRoleKey = 'admin' | 'manager' | 'employee';
export type AgentPermissionMatrix = Record<AgentRoleKey, AgentPermissions>;

export const AGENT_PERMISSION_LABELS: Record<AgentPermissionKey, string> = {
  canPause: 'Pausar comandos e fila',
  canResume: 'Retomar comandos e fila',
  canRetry: 'Reexecutar comandos',
  canCancel: 'Cancelar comandos',
  canManageTokens: 'Rotacionar / simular tokens',
  canAdoptDevices: 'Adotar dispositivos descobertos',
};

export const AGENT_ROLE_LABELS: Record<AgentRoleKey, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  employee: 'Funcionário',
};

export const CONFIG_KEY = 'agent_queue_permissions';

const none: AgentPermissions = {
  canPause: false,
  canResume: false,
  canRetry: false,
  canCancel: false,
  canManageTokens: false,
  canAdoptDevices: false,
};

export const DEFAULT_AGENT_MATRIX: AgentPermissionMatrix = {
  admin: {
    canPause: true,
    canResume: true,
    canRetry: true,
    canCancel: true,
    canManageTokens: true,
    canAdoptDevices: true,
  },
  manager: {
    ...none,
    canPause: true,
    canResume: true,
    canRetry: true,
  },
  employee: { ...none },
};

const normalize = (value: unknown): AgentPermissionMatrix => {
  const source = (value ?? {}) as Partial<Record<AgentRoleKey, Partial<AgentPermissions>>>;
  const roles: AgentRoleKey[] = ['admin', 'manager', 'employee'];
  return roles.reduce((acc, role) => {
    acc[role] = AGENT_PERMISSION_KEYS.reduce((perms, key) => {
      perms[key] = Boolean(source?.[role]?.[key] ?? DEFAULT_AGENT_MATRIX[role][key]);
      return perms;
    }, {} as AgentPermissions);
    return acc;
  }, {} as AgentPermissionMatrix);
};

export function useAgentPermissions() {
  const queryClient = useQueryClient();
  const { profile, roles, isAdmin, isManager } = useAuth();
  const companyId = profile?.company_id ?? null;

  const matrixQuery = useQuery({
    queryKey: ['agent-permission-matrix', companyId],
    queryFn: async () => {
      if (!companyId) return DEFAULT_AGENT_MATRIX;
      const { data, error } = await supabase
        .from('system_configurations')
        .select('config_value')
        .eq('company_id', companyId)
        .eq('config_key', CONFIG_KEY)
        .maybeSingle();
      if (error) throw error;
      return normalize((data as { config_value?: unknown } | null)?.config_value);
    },
  });

  const matrix = matrixQuery.data ?? DEFAULT_AGENT_MATRIX;

  // Perfis efetivos do usuário: super admin e admin herdam admin; gerente herda manager.
  const effectiveRoles: AgentRoleKey[] = [
    ...(isAdmin ? (['admin'] as AgentRoleKey[]) : []),
    ...(isManager ? (['manager'] as AgentRoleKey[]) : []),
    ...(roles.includes('employee') ? (['employee'] as AgentRoleKey[]) : []),
  ];

  const permissions = AGENT_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = effectiveRoles.some((role) => matrix[role][key]);
    return acc;
  }, {} as AgentPermissions);

  const saveMatrixMutation = useMutation({
    mutationFn: async (next: AgentPermissionMatrix) => {
      if (!isAdmin) throw new Error('Apenas administradores podem alterar as permissões do robô.');
      if (!companyId) throw new Error('Empresa não identificada para salvar as permissões.');
      const { error } = await supabase
        .from('system_configurations')
        .upsert(
          {
            company_id: companyId,
            config_key: CONFIG_KEY,
            config_value: next as never,
            description: 'Perfis e permissões do Robô de Comunicação',
            updated_by: profile?.id ?? null,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: 'company_id,config_key' },
        );
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-permission-matrix'] });
      toast({ title: 'Permissões salvas', description: 'As regras do robô foram atualizadas.' });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao salvar permissões', description: error.message, variant: 'destructive' }),
  });

  return {
    matrix,
    permissions,
    isLoading: matrixQuery.isLoading,
    canEditMatrix: isAdmin,
    saveMatrixMutation,
  };
}
