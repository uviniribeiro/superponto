import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CommunicationServer {
  id: string;
  company_id: string | null;
  name: string;
  manufacturer: string;
  host: string;
  port: number;
  timeout_ms: number;
  allow_private_network: boolean;
  connection_mode: string;
  api_base_url: string | null;
  api_username: string | null;
  api_password: string | null;
  cloud_token: string | null;
  cloud_organization_id: string | null;
  use_https: boolean;
  command_map: Record<string, string> | null;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
  created_at: string;
  updated_at: string;
}

export const defaultServer: Partial<CommunicationServer> = {
  name: '',
  manufacturer: 'henry',
  host: '',
  port: 3000,
  timeout_ms: 8000,
  allow_private_network: false,
  connection_mode: 'tcp',
  api_base_url: '',
  api_username: 'admin',
  api_password: '',
  cloud_token: '',
  cloud_organization_id: '',
  use_https: false,
  description: '',
  is_default: false,
  is_active: true,
};

export function useCommunicationServers() {
  const queryClient = useQueryClient();
  const { profile } = useAuth() as { profile?: { company_id?: string | null } };
  const companyId = profile?.company_id ?? null;

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['communication-servers', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_servers')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as CommunicationServer[];
    },
  });

  const resolveFunction = (params: { serverId?: string; manufacturer?: string; equipmentId?: string }) => {
    const server = params.serverId ? servers.find((s) => s.id === params.serverId) : undefined;
    const manufacturer = params.manufacturer ?? server?.manufacturer ?? 'henry';
    return manufacturer === 'control_id' ? 'controlid-api' : 'henry-tcp';
  };

  const defaultServerRow = servers.find((s) => s.is_default && s.is_active) ?? servers.find((s) => s.is_active) ?? null;

  const saveMutation = useMutation({
    mutationFn: async (server: Partial<CommunicationServer>) => {
      const payload = {
        name: server.name?.trim(),
        manufacturer: server.manufacturer || 'henry',
        host: server.host?.trim(),
        port: Number(server.port) || 3000,
        timeout_ms: Number(server.timeout_ms) || 8000,
        allow_private_network: !!server.allow_private_network,
        connection_mode: server.connection_mode || (server.manufacturer === 'control_id' ? 'device' : 'tcp'),
        api_base_url: server.api_base_url?.trim() || null,
        api_username: server.api_username?.trim() || null,
        cloud_organization_id: server.cloud_organization_id?.trim() || null,
        use_https: !!server.use_https,
        ...(server.api_password ? { api_password: server.api_password } : {}),
        ...(server.cloud_token ? { cloud_token: server.cloud_token } : {}),
        description: server.description || null,
        is_default: !!server.is_default,
        is_active: server.is_active !== false,
        company_id: companyId,
      };

      if (payload.is_default) {
        await supabase
          .from('communication_servers')
          .update({ is_default: false })
          .neq('id', server.id ?? '00000000-0000-0000-0000-000000000000');
      }

      if (server.id) {
        const { error } = await supabase.from('communication_servers').update(payload).eq('id', server.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('communication_servers').insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-servers'] });
      toast.success('Servidor de comunicação salvo');
    },
    onError: (error: Error) => toast.error(`Erro ao salvar servidor: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('communication_servers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-servers'] });
      toast.success('Servidor removido');
    },
    onError: (error: Error) => toast.error(`Erro ao remover servidor: ${error.message}`),
  });

  const testMutation = useMutation({
    mutationFn: async (params: { serverId?: string; equipmentId?: string; host?: string; port?: number; manufacturer?: string }) => {
      const { data, error } = await supabase.functions.invoke(resolveFunction(params), {
        body: { action: 'test', ...params },
      });
      if (error) throw error;
      return data as { online: boolean; latencyMs?: number; error?: string; host?: string; port?: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['communication-servers'] });
      if (data?.online) {
        toast.success(
          data.host
            ? `Conectado a ${data.host}:${data.port} em ${data.latencyMs ?? '?'}ms`
            : `Conectado à nuvem em ${data.latencyMs ?? '?'}ms`,
        );
      } else {
        toast.error(`Falha na conexão: ${data?.error ?? 'sem resposta'}`);
      }
    },
    onError: (error: Error) => toast.error(`Erro no teste: ${error.message}`),
  });

  const readRecordsMutation = useMutation({
    mutationFn: async (params: { serverId?: string; equipmentId?: string; start?: string; end?: string; manufacturer?: string }) => {
      const { data, error } = await supabase.functions.invoke(resolveFunction(params), {
        body: { action: 'read_records', ...params },
      });
      if (error) throw error;
      return data as { success: boolean; recordsFound?: number; recordsStored?: number; error?: string };
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(`${data.recordsFound ?? 0} marcações lidas (${data.recordsStored ?? 0} importadas)`);
      } else {
        toast.error(`Falha ao ler marcações: ${data?.error ?? 'sem resposta'}`);
      }
    },
    onError: (error: Error) => toast.error(`Erro na leitura: ${error.message}`),
  });

  const syncClockMutation = useMutation({
    mutationFn: async (params: { serverId?: string; equipmentId?: string; manufacturer?: string }) => {
      const { data, error } = await supabase.functions.invoke(resolveFunction(params), {
        body: { action: 'set_time', ...params },
      });
      if (error) throw error;
      return data as { success: boolean; error?: string };
    },
    onSuccess: (data) =>
      data?.success ? toast.success('Relógio sincronizado') : toast.error(data?.error ?? 'Falha ao ajustar relógio'),
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const cloudDevicesMutation = useMutation({
    mutationFn: async (params: { serverId: string }) => {
      const { data, error } = await supabase.functions.invoke('controlid-api', {
        body: { action: 'list_devices', mode: 'cloud', ...params },
      });
      if (error) throw error;
      return data as { success: boolean; devices?: unknown; error?: string };
    },
    onSuccess: (data) =>
      data?.success
        ? toast.success('Dispositivos da iD Cloud carregados')
        : toast.error(data?.error ?? 'Falha ao consultar a iD Cloud'),
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  return {
    servers,
    cloudDevicesMutation,
    defaultServer: defaultServerRow,
    isLoading,
    saveMutation,
    deleteMutation,
    testMutation,
    readRecordsMutation,
    syncClockMutation,
  };
}
