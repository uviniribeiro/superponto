import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CommunicationAgent {
  id: string;
  company_id: string;
  name: string;
  hostname: string | null;
  os_info: string | null;
  agent_version: string | null;
  local_ip: string | null;
  public_ip: string | null;
  mac_address: string | null;
  status: string | null;
  last_heartbeat: string | null;
  auto_discovery: boolean | null;
  discovery_ranges: string[] | null;
  auto_adopt: boolean | null;
  sync_interval_seconds: number | null;
  is_active: boolean | null;
  created_at: string;
  token_rotation_status: string | null;
  token_rotation_started_at: string | null;
  token_rotated_at: string | null;
  pending_token_expires_at: string | null;
  previous_token_expires_at: string | null;
  token_auto_rotation: boolean | null;
  token_rotation_interval_days: number | null;
  next_token_rotation_at: string | null;
  auto_update: boolean | null;
  update_channel: string | null;
  target_version: string | null;
  rollback_version: string | null;
  last_update_status: string | null;
  last_update_at: string | null;
}

export interface AgentRelease {
  id: string;
  version: string;
  channel: string;
  platform: string;
  download_url: string;
  checksum_sha256: string;
  min_supported_version: string | null;
  notes: string | null;
  is_active: boolean;
  published_at: string;
}

export interface AgentUpdateEvent {
  id: string;
  agent_id: string;
  release_id: string | null;
  from_version: string | null;
  to_version: string | null;
  status: string;
  checksum_ok: boolean | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}


export interface AgentTokenRotation {
  id: string;
  agent_id: string;
  mode: string;
  status: string;
  started_at: string;
  window_expires_at: string | null;
  validated_at: string | null;
  finished_at: string | null;
  notes: string | null;
}

export interface DiscoveredDevice {
  id: string;
  agent_id: string | null;
  equipment_id: string | null;
  ip_address: string;
  port: number | null;
  mac_address: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  firmware_version: string | null;
  protocol: string | null;
  device_name: string | null;
  status: string | null;
  reachable: boolean | null;
  last_seen: string | null;
}

export interface DeviceCommand {
  id: string;
  agent_id: string | null;
  equipment_id: string | null;
  command: string;
  status: string | null;
  attempts: number | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface EmployeeDeviceSync {
  id: string;
  profile_id: string | null;
  equipment_id: string | null;
  device_user_id: string | null;
  operation: string | null;
  status: string | null;
  templates_synced: boolean | null;
  error_message: string | null;
  updated_at: string | null;
}

const randomToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export function useCommunicationAgents() {
  const queryClient = useQueryClient();
  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key] });

  const agentsQuery = useQuery({
    queryKey: ['communication-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_agents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CommunicationAgent[];
    },
    refetchInterval: 30000,
  });

  const devicesQuery = useQuery({
    queryKey: ['discovered-devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovered_devices')
        .select('*')
        .order('last_seen', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DiscoveredDevice[];
    },
    refetchInterval: 30000,
  });

  const commandsQuery = useQuery({
    queryKey: ['device-commands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_commands')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as DeviceCommand[];
    },
    refetchInterval: 15000,
  });

  const syncQuery = useQuery({
    queryKey: ['employee-device-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_device_sync')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as EmployeeDeviceSync[];
    },
    refetchInterval: 20000,
  });

  /** Cria o agente e devolve o token em texto puro (exibido uma única vez). */
  const createAgentMutation = useMutation({
    mutationFn: async (input: { name: string; discovery_ranges: string[]; auto_adopt: boolean }) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
        .maybeSingle();

      const token = randomToken();
      const token_hash = await sha256(token);

      const { error } = await supabase.from('communication_agents').insert({
        company_id: profile?.company_id,
        name: input.name,
        token_hash,
        discovery_ranges: input.discovery_ranges,
        auto_adopt: input.auto_adopt,
        auto_discovery: true,
        status: 'pending',
      } as never);
      if (error) throw error;
      return token;
    },
    onSuccess: () => {
      invalidate('communication-agents');
      toast({ title: 'Agente criado', description: 'Copie o token e use na instalação do robô.' });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao criar agente', description: error.message, variant: 'destructive' }),
  });

  const updateAgentMutation = useMutation({
    mutationFn: async ({ id, ...values }: Partial<CommunicationAgent> & { id: string }) => {
      const { error } = await supabase.from('communication_agents').update(values as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('communication-agents');
      toast({ title: 'Agente atualizado' });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }),
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('communication_agents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('communication-agents');
      toast({ title: 'Agente removido' });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' }),
  });

  /** Enfileira um comando para o robô executar no equipamento. */
  const queueCommandMutation = useMutation({
    mutationFn: async (input: {
      agent_id: string | null;
      equipment_id?: string | null;
      command: string;
      payload?: Record<string, unknown>;
    }) => {
      const { data: agent } = await supabase
        .from('communication_agents')
        .select('company_id')
        .eq('id', input.agent_id ?? '')
        .maybeSingle();

      const { error } = await supabase.from('device_commands').insert({
        company_id: (agent as { company_id?: string } | null)?.company_id,
        agent_id: input.agent_id,
        equipment_id: input.equipment_id ?? null,
        command: input.command,
        payload: input.payload ?? {},
        status: 'pending',
        created_by: (await supabase.auth.getUser()).data.user?.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('device-commands');
      toast({ title: 'Comando enviado', description: 'O robô executará na próxima verificação.' });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao enviar comando', description: error.message, variant: 'destructive' }),
  });

  /** Adota um relógio encontrado na rede, criando o equipamento no sistema. */
  const adoptDeviceMutation = useMutation({
    mutationFn: async (device: DiscoveredDevice) => {
      const { data: agent } = await supabase
        .from('communication_agents')
        .select('company_id')
        .eq('id', device.agent_id ?? '')
        .maybeSingle();
      const companyId = (agent as { company_id?: string } | null)?.company_id;

      const { data: equipment, error } = await supabase
        .from('time_clock_equipment')
        .insert({
          company_id: companyId,
          name: device.device_name || `${device.manufacturer ?? 'REP'} ${device.ip_address}`,
          manufacturer: device.manufacturer ?? 'generic',
          model: device.model ?? null,
          serial_number: device.serial_number ?? null,
          ip_address: device.ip_address,
          port: device.port ?? 3000,
          mac_address: device.mac_address ?? null,
          is_active: true,
        } as never)
        .select('id')
        .single();
      if (error) throw error;

      const { error: linkError } = await supabase
        .from('discovered_devices')
        .update({ equipment_id: (equipment as { id: string }).id, status: 'adopted' } as never)
        .eq('id', device.id);
      if (linkError) throw linkError;
    },
    onSuccess: () => {
      invalidate('discovered-devices');
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast({ title: 'Relógio adotado', description: 'Equipamento cadastrado automaticamente.' });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao adotar relógio', description: error.message, variant: 'destructive' }),
  });

  const ignoreDeviceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('discovered_devices')
        .update({ status: 'ignored' } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('discovered-devices'),
  });

  /** Enfileira o envio de todos os funcionários ativos para um equipamento. */
  const syncEmployeesMutation = useMutation({
    mutationFn: async (equipmentId: string) => {
      const { data: equipment } = await supabase
        .from('time_clock_equipment')
        .select('company_id')
        .eq('id', equipmentId)
        .maybeSingle();
      const companyId = (equipment as { company_id?: string } | null)?.company_id;

      const { data: employees, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId ?? '')
        .eq('is_active', true);
      if (error) throw error;

      const rows = (employees ?? []).map((employee) => ({
        company_id: companyId,
        profile_id: (employee as { id: string }).id,
        equipment_id: equipmentId,
        operation: 'upsert',
        status: 'pending',
      }));
      if (rows.length === 0) return 0;

      const { error: insertError } = await supabase.from('employee_device_sync').insert(rows as never);
      if (insertError) throw insertError;
      return rows.length;
    },
    onSuccess: (count) => {
      invalidate('employee-device-sync');
      toast({ title: 'Envio agendado', description: `${count} funcionários na fila do relógio.` });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao agendar envio', description: error.message, variant: 'destructive' }),
  });

  const rotationsQuery = useQuery({
    queryKey: ['agent-token-rotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_token_rotations')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as AgentTokenRotation[];
    },
  });

  /** Inicia a rotação manual: gera o token novo e abre a janela de transição.
   *  O token antigo continua válido até o agente autenticar com o novo. */
  const startTokenRotationMutation = useMutation({
    mutationFn: async (input: { agent: CommunicationAgent; windowMinutes: number }) => {
      const token = randomToken();
      const token_hash = await sha256(token);
      const expiresAt = new Date(Date.now() + input.windowMinutes * 60_000).toISOString();

      const { error } = await supabase
        .from('communication_agents')
        .update({
          pending_token_hash: token_hash,
          pending_token_expires_at: expiresAt,
          token_rotation_status: 'pending',
          token_rotation_started_at: new Date().toISOString(),
        } as never)
        .eq('id', input.agent.id);
      if (error) throw error;

      const { error: logError } = await supabase.from('agent_token_rotations').insert({
        company_id: input.agent.company_id,
        agent_id: input.agent.id,
        mode: 'manual',
        status: 'pending',
        window_expires_at: expiresAt,
        started_by: (await supabase.auth.getUser()).data.user?.id,
        notes: `Janela de transição de ${input.windowMinutes} minuto(s)`,
      } as never);
      if (logError) throw logError;

      return { token, expiresAt };
    },
    onSuccess: () => {
      invalidate('communication-agents');
      invalidate('agent-token-rotations');
      toast({
        title: 'Rotação iniciada',
        description: 'O token antigo segue válido até o robô validar o novo.',
      });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao iniciar rotação', description: error.message, variant: 'destructive' }),
  });

  /** Cancela a rotação em andamento (mantém o token atual). */
  const cancelTokenRotationMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase
        .from('communication_agents')
        .update({
          pending_token_hash: null,
          pending_token_expires_at: null,
          token_rotation_status: 'idle',
        } as never)
        .eq('id', agentId);
      if (error) throw error;

      await supabase
        .from('agent_token_rotations')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() } as never)
        .eq('agent_id', agentId)
        .eq('status', 'pending');
    },
    onSuccess: () => {
      invalidate('communication-agents');
      invalidate('agent-token-rotations');
      toast({ title: 'Rotação cancelada', description: 'O token atual continua em uso.' });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao cancelar rotação', description: error.message, variant: 'destructive' }),
  });

  /** Liga/desliga a rotação automática periódica do token. */
  const setAutoRotationMutation = useMutation({
    mutationFn: async (input: { agentId: string; enabled: boolean; intervalDays: number }) => {
      const next = input.enabled
        ? new Date(Date.now() + input.intervalDays * 86_400_000).toISOString()
        : null;
      const { error } = await supabase
        .from('communication_agents')
        .update({
          token_auto_rotation: input.enabled,
          token_rotation_interval_days: input.intervalDays,
          next_token_rotation_at: next,
        } as never)
        .eq('id', input.agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('communication-agents');
      toast({ title: 'Política de rotação atualizada' });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao salvar política', description: error.message, variant: 'destructive' }),
  });

  const releasesQuery = useQuery({
    queryKey: ['agent-releases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_releases')
        .select('*')
        .order('published_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AgentRelease[];
    },
  });

  const updateEventsQuery = useQuery({
    queryKey: ['agent-update-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_update_events')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AgentUpdateEvent[];
    },
  });

  /** Política de auto-atualização do executável (canal e versão fixada). */
  const setUpdatePolicyMutation = useMutation({
    mutationFn: async (input: {
      agentId: string;
      auto_update?: boolean;
      update_channel?: string;
      target_version?: string | null;
    }) => {
      const { agentId, ...values } = input;
      const { error } = await supabase
        .from('communication_agents')
        .update(values as never)
        .eq('id', agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('communication-agents');
      toast({ title: 'Política de atualização salva' });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao salvar atualização', description: error.message, variant: 'destructive' }),
  });

  /** Reversão segura: fixa a versão anterior e desliga a auto-atualização. */
  const rollbackAgentMutation = useMutation({
    mutationFn: async (agent: CommunicationAgent) => {
      if (!agent.rollback_version) throw new Error('Não há versão anterior registrada para este agente.');
      const { error } = await supabase
        .from('communication_agents')
        .update({
          target_version: agent.rollback_version,
          auto_update: false,
          last_update_status: 'rollback_requested',
        } as never)
        .eq('id', agent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('communication-agents');
      toast({
        title: 'Reversão solicitada',
        description: 'O robô voltará para a versão anterior no próximo ciclo.',
      });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao reverter', description: error.message, variant: 'destructive' }),
  });

  // Tempo real: status/heartbeat dos agentes, descobertas, fila de comandos e de funcionários.
  useEffect(() => {
    const channel = supabase
      .channel('communication-robot-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communication_agents' }, () => {
        queryClient.invalidateQueries({ queryKey: ['communication-agents'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discovered_devices' }, () => {
        queryClient.invalidateQueries({ queryKey: ['discovered-devices'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'device_commands' }, () => {
        queryClient.invalidateQueries({ queryKey: ['device-commands'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_device_sync' }, () => {
        queryClient.invalidateQueries({ queryKey: ['employee-device-sync'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_token_rotations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['agent-token-rotations'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_update_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['agent-update-events'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);


  return {
    agents: agentsQuery.data ?? [],
    rotations: rotationsQuery.data ?? [],
    releases: releasesQuery.data ?? [],
    updateEvents: updateEventsQuery.data ?? [],
    setUpdatePolicyMutation,
    rollbackAgentMutation,

    startTokenRotationMutation,
    cancelTokenRotationMutation,
    setAutoRotationMutation,
    devices: devicesQuery.data ?? [],
    commands: commandsQuery.data ?? [],
    employeeSync: syncQuery.data ?? [],
    isLoading: agentsQuery.isLoading,
    createAgentMutation,
    updateAgentMutation,
    deleteAgentMutation,
    queueCommandMutation,
    adoptDeviceMutation,
    ignoreDeviceMutation,
    syncEmployeesMutation,
  };
}
