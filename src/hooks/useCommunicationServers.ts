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
    mutationFn: async (params: { serverId?: string; equipmentId?: string; host?: string; port?: number }) => {
      const { data, error } = await supabase.functions.invoke('henry-tcp', {
        body: { action: 'test', ...params },
      });
      if (error) throw error;
      return data as { online: boolean; latencyMs?: number; error?: string; host?: string; port?: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['communication-servers'] });
      if (data?.online) {
        toast.success(`Conectado a ${data.host}:${data.port} em ${data.latencyMs ?? '?'}ms`);
      } else {
        toast.error(`Falha na conexão TCP/IP: ${data?.error ?? 'sem resposta'}`);
      }
    },
    onError: (error: Error) => toast.error(`Erro no teste: ${error.message}`),
  });

  const readRecordsMutation = useMutation({
    mutationFn: async (params: { serverId?: string; equipmentId?: string; start?: string; end?: string }) => {
      const { data, error } = await supabase.functions.invoke('henry-tcp', {
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
    mutationFn: async (params: { serverId?: string; equipmentId?: string }) => {
      const { data, error } = await supabase.functions.invoke('henry-tcp', {
        body: { action: 'set_time', ...params },
      });
      if (error) throw error;
      return data as { success: boolean; error?: string };
    },
    onSuccess: (data) =>
      data?.success ? toast.success('Relógio sincronizado') : toast.error(data?.error ?? 'Falha ao ajustar relógio'),
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  return {
    servers,
    defaultServer: defaultServerRow,
    isLoading,
    saveMutation,
    deleteMutation,
    testMutation,
    readRecordsMutation,
    syncClockMutation,
  };
}
