import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  token_expires_at: string | null;
  token_max_age_days: number | null;
  token_renew_before_days: number | null;
  token_expired_at: string | null;
  auto_update: boolean | null;
  update_channel: string | null;
  target_version: string | null;
  rollback_version: string | null;
  last_update_status: string | null;
  last_update_at: string | null;
  queue_paused: boolean | null;
  queue_paused_at: string | null;
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
  started_by: string | null;
  started_by_name?: string | null;
}

/** Resultado do teste em modo simulado da troca de token. */
export interface RotationSimulation {
  agentName: string;
  checksumOk: boolean;
  sampleHashPrefix: string;
  gatewayReachable: boolean;
  gatewayRejectedFakeToken: boolean;
  agentOnline: boolean;
  currentTokenExpiresAt: string | null;
  blockingReason: string | null;
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
  started_at?: string | null;
  updated_at?: string | null;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  paused_at?: string | null;
  last_action?: string | null;
  last_action_at?: string | null;
}

export interface QueueAuditEntry {
  id: string;
  action: string;
  description: string | null;
  user_name: string | null;
  created_at: string;
  record_id: string | null;
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

/** Dados mínimos do robô usados na validação da adoção de um dispositivo. */
export interface AdoptionAgentCheck {
  name?: string | null;
  is_active?: boolean | null;
  token_expires_at?: string | null;
  token_rotation_status?: string | null;
}

/** Motivo de reprovação da adoção, ou null quando o robô está apto. */
export const adoptionBlockReason = (agent: AdoptionAgentCheck | null): string | null => {
  if (!agent) return 'Robô de origem não encontrado — não é possível validar o token.';
  if (agent.is_active === false) return `O robô ${agent.name ?? ''} está inativo.`.trim();
  if (agent.token_expires_at && new Date(agent.token_expires_at).getTime() < Date.now()) {
    return 'Token do robô expirado. Gere um novo token antes de adotar o dispositivo.';
  }
  if (agent.token_rotation_status === 'expired') {
    return 'Token do robô marcado como expirado pelo gateway. Gere um novo token.';
  }
  if (agent.token_rotation_status === 'pending') {
    return 'Rotação de token em andamento: aguarde o robô validar o novo token antes de adotar.';
  }
  return null;
};


export function useCommunicationAgents() {
  const queryClient = useQueryClient();
  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key] });
  const { isAdmin, isManager } = useAuth();

  /** Permissões da fila: gerentes operam a fila, apenas admin encerra/cancela e mexe em token. */
  const permissions = {
    canPause: isManager,
    canResume: isManager,
    canRetry: isManager,
    canCancel: isAdmin,
    canManageTokens: isAdmin,
    canAdoptDevices: isAdmin,
  };

  const assertPermission = (allowed: boolean, action: string) => {
    if (!allowed) {
      throw new Error(`Seu perfil não tem permissão para ${action}.`);
    }
  };

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
        token_expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
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

  /** Registra em auditoria toda ação do operador sobre a fila de comandos. */
  const auditQueueAction = async (params: {
    action: string;
    recordId: string;
    description: string;
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
    companyId?: string | null;
    table?: string;
  }) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    let companyId = params.companyId ?? null;
    let userName = auth.user?.email ?? 'Sistema';
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, full_name, email')
        .eq('user_id', userId)
        .maybeSingle();
      companyId = companyId ?? profile?.company_id ?? null;
      userName = profile?.full_name ?? profile?.email ?? userName;
    }
    await supabase.from('audit_logs').insert({
      company_id: companyId,
      user_id: userId,
      user_name: userName,
      action: params.action,
      table_name: params.table ?? 'device_commands',
      record_id: params.recordId,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
      menu_section: 'Robô de Comunicação',
      description: params.description,
    } as never);
  };

  /** Pausar, retomar, reexecutar ou cancelar um comando da fila. */
  const commandActionMutation = useMutation({
    mutationFn: async (input: {
      command: DeviceCommand;
      action: 'pause' | 'resume' | 'retry' | 'cancel';
    }) => {
      const { command, action } = input;
      const permissionMap = {
        pause: [permissions.canPause, 'pausar comandos'],
        resume: [permissions.canResume, 'retomar comandos'],
        retry: [permissions.canRetry, 'reexecutar comandos'],
        cancel: [permissions.canCancel, 'cancelar comandos'],
      } as const;
      assertPermission(permissionMap[action][0], permissionMap[action][1]);

      const nowIso = new Date().toISOString();
      const base: Record<string, unknown> = { last_action: action, last_action_at: nowIso };


      if (action === 'pause') {
        if (command.status !== 'pending') throw new Error('Só é possível pausar comandos pendentes.');
        Object.assign(base, { status: 'paused', paused_at: nowIso });
      } else if (action === 'resume') {
        Object.assign(base, { status: 'pending', paused_at: null, error_message: null });
      } else if (action === 'retry') {
        Object.assign(base, {
          status: 'pending',
          paused_at: null,
          error_message: null,
          result: null,
          started_at: null,
          finished_at: null,
        });
      } else {
        Object.assign(base, { status: 'cancelled', finished_at: nowIso });
      }

      const { error } = await supabase.from('device_commands').update(base as never).eq('id', command.id);
      if (error) throw error;

      const labels: Record<string, string> = {
        pause: 'Comando pausado na fila',
        resume: 'Comando retomado na fila',
        retry: 'Comando reenviado para execução',
        cancel: 'Comando cancelado',
      };
      await auditQueueAction({
        action: 'command_' + action,
        recordId: command.id,
        description: labels[action] + ': ' + command.command,
        oldData: { status: command.status },
        newData: { status: base.status },
      });
      return labels[action];
    },
    onSuccess: (label) => {
      invalidate('device-commands');
      invalidate('device-commands-audit');
      toast({ title: label });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro na fila de comandos', description: error.message, variant: 'destructive' }),
  });

  /** Pausa ou retoma a fila inteira de um agente. */
  const toggleQueuePauseMutation = useMutation({
    mutationFn: async (input: { agent: CommunicationAgent; paused: boolean }) => {
      assertPermission(
        input.paused ? permissions.canPause : permissions.canResume,
        input.paused ? 'pausar a fila' : 'retomar a fila',
      );
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('communication_agents')
        .update({
          queue_paused: input.paused,
          queue_paused_at: input.paused ? new Date().toISOString() : null,
          queue_paused_by: input.paused ? (auth.user?.id ?? null) : null,
        } as never)
        .eq('id', input.agent.id);
      if (error) throw error;

      await auditQueueAction({
        action: input.paused ? 'queue_paused' : 'queue_resumed',
        table: 'communication_agents',
        recordId: input.agent.id,
        companyId: input.agent.company_id,
        description:
          (input.paused ? 'Fila de comandos pausada' : 'Fila de comandos retomada') +
          ' no robô ' + input.agent.name,
        oldData: { queue_paused: input.agent.queue_paused },
        newData: { queue_paused: input.paused },
      });
      return input.paused;
    },
    onSuccess: (paused) => {
      invalidate('communication-agents');
      invalidate('device-commands-audit');
      toast({
        title: paused ? 'Fila pausada' : 'Fila retomada',
        description: paused
          ? 'O robô não receberá novos comandos até ser retomado.'
          : 'Os comandos pendentes voltarão a ser executados.',
      });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro ao alterar a fila', description: error.message, variant: 'destructive' }),
  });

  /** Reexecuta em lote, preservando a ordem de criação dos comandos. */
  const batchRetryMutation = useMutation({
    mutationFn: async (commands: DeviceCommand[]) => {
      assertPermission(permissions.canRetry, 'reexecutar comandos');
      const ordered = [...commands].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      let succeeded = 0;
      const failures: string[] = [];
      for (const command of ordered) {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from('device_commands')
          .update({
            status: 'pending',
            paused_at: null,
            error_message: null,
            result: null,
            started_at: null,
            finished_at: null,
            last_action: 'retry',
            last_action_at: nowIso,
          } as never)
          .eq('id', command.id);
        if (error) {
          failures.push(`${command.command}: ${error.message}`);
          continue;
        }
        succeeded += 1;
      }

      await auditQueueAction({
        action: 'command_batch_retry',
        recordId: ordered[0]?.id ?? 'lote',
        description:
          `Reexecução em lote de ${succeeded} comando(s), na ordem original de criação` +
          (failures.length ? ` — ${failures.length} falha(s)` : ''),
        newData: { commands: ordered.map((item) => item.id), failures },
      });

      return { succeeded, failures };
    },
    onSuccess: ({ succeeded, failures }) => {
      invalidate('device-commands');
      invalidate('device-commands-audit');
      toast({
        title: `${succeeded} comando(s) reenviado(s)`,
        description: failures.length
          ? `${failures.length} não puderam ser reenviados.`
          : 'A ordem original da fila foi preservada.',
        variant: failures.length ? 'destructive' : undefined,
      });
    },
    onError: (error: Error) =>
      toast({ title: 'Erro na reexecução em lote', description: error.message, variant: 'destructive' }),
  });

  /** Auditoria das ações do operador sobre a fila. */
  const queueAuditQuery = useQuery({
    queryKey: ['device-commands-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, description, user_name, created_at, record_id')
        .eq('menu_section', 'Robô de Comunicação')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as QueueAuditEntry[];
    },
  });




  /** Adota um relógio encontrado na rede, criando o equipamento no sistema.
   *  Só prossegue com token do robô válido (nem expirado, nem em janela de transição pendente). */
  const adoptDeviceMutation = useMutation({
    mutationFn: async (device: DiscoveredDevice) => {
      assertPermission(permissions.canAdoptDevices, 'adotar dispositivos');

      const { data: agent } = await supabase
        .from('communication_agents')
        .select('company_id, name, token_expires_at, token_rotation_status, is_active')
        .eq('id', device.agent_id ?? '')
        .maybeSingle();

      const reason = adoptionBlockReason(agent as AdoptionAgentCheck | null);
      if (reason) throw new Error(reason);

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

      const rows = (data ?? []) as unknown as AgentTokenRotation[];
      const authorIds = Array.from(
        new Set(rows.map((row) => row.started_by).filter((value): value is string => !!value)),
      );
      if (authorIds.length === 0) return rows;

      const { data: authors } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', authorIds);
      const nameById = new Map(
        (authors ?? []).map((author) => [
          author.user_id as string,
          (author.full_name as string) || (author.email as string) || null,
        ]),
      );
      return rows.map((row) => ({
        ...row,
        started_by_name: row.started_by ? (nameById.get(row.started_by) ?? null) : null,
      }));
    },
  });

  /** Teste em modo simulado: valida o hash SHA-256 e a conectividade antes de trocar o token. */
  const simulateTokenRotationMutation = useMutation({
    mutationFn: async (agent: CommunicationAgent): Promise<RotationSimulation> => {
      assertPermission(permissions.canManageTokens, 'testar a rotação de token');

      // 1) Checksum: gera um token de amostra e confere que o hash é reproduzível.
      const sample = randomToken();
      const hashA = await sha256(sample);
      const hashB = await sha256(sample);
      const checksumOk = hashA === hashB && /^[0-9a-f]{64}$/.test(hashA);

      // 2) Conectividade: o gateway deve responder e recusar um token falso.
      let gatewayReachable = false;
      let gatewayRejectedFakeToken = false;
      try {
        const { error } = await supabase.functions.invoke('agent-gateway', {
          body: { action: 'handshake' },
          headers: { 'x-agent-token': `simulacao-${hashA.slice(0, 32)}` },
        });
        gatewayReachable = true;
        gatewayRejectedFakeToken = !!error;
      } catch {
        gatewayReachable = false;
      }

      // 3) Robô local: precisa ter dado sinal de vida recente para adotar o novo token.
      const agentOnline =
        !!agent.last_heartbeat &&
        Date.now() - new Date(agent.last_heartbeat).getTime() < 5 * 60 * 1000;

      const expired =
        !!agent.token_expires_at && new Date(agent.token_expires_at).getTime() < Date.now();

      let blockingReason: string | null = null;
      if (!checksumOk) blockingReason = 'Falha na verificação do hash SHA-256 neste navegador.';
      else if (!gatewayReachable) blockingReason = 'O gateway de comunicação não respondeu.';
      else if (!gatewayRejectedFakeToken)
        blockingReason = 'O gateway aceitou um token inválido — revise a configuração antes de rotacionar.';
      else if (!agentOnline)
        blockingReason = 'O robô local está offline: ele não conseguiria validar o novo token na janela de transição.';
      else if (expired)
        blockingReason = 'O token atual já expirou: a rotação vai exigir reconfiguração manual do robô.';

      return {
        agentName: agent.name,
        checksumOk,
        sampleHashPrefix: hashA.slice(0, 16),
        gatewayReachable,
        gatewayRejectedFakeToken,
        agentOnline,
        currentTokenExpiresAt: agent.token_expires_at,
        blockingReason,
      };
    },
    onError: (error: Error) =>
      toast({ title: 'Erro no teste simulado', description: error.message, variant: 'destructive' }),
  });

  /** Inicia a rotação manual: gera o token novo e abre a janela de transição.
   *  O token antigo continua válido até o agente autenticar com o novo. */
  const startTokenRotationMutation = useMutation({
    mutationFn: async (input: { agent: CommunicationAgent; windowMinutes: number }) => {
      assertPermission(permissions.canManageTokens, 'rotacionar tokens');
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
    mutationFn: async (input: {
      agentId: string;
      enabled: boolean;
      intervalDays: number;
      maxAgeDays: number;
      renewBeforeDays: number;
    }) => {
      const { data: current, error: readError } = await supabase
        .from('communication_agents')
        .select('token_expires_at')
        .eq('id', input.agentId)
        .maybeSingle();
      if (readError) throw readError;

      const next = input.enabled
        ? new Date(Date.now() + input.intervalDays * 86_400_000).toISOString()
        : null;
      const patch: Record<string, unknown> = {
        token_auto_rotation: input.enabled,
        token_rotation_interval_days: input.intervalDays,
        next_token_rotation_at: next,
        token_max_age_days: input.maxAgeDays,
        token_renew_before_days: Math.min(input.renewBeforeDays, Math.max(1, input.maxAgeDays - 1)),
      };
      if (!current?.token_expires_at) {
        patch.token_expires_at = new Date(Date.now() + input.maxAgeDays * 86_400_000).toISOString();
      }

      const { error } = await supabase
        .from('communication_agents')
        .update(patch as never)
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
    commandActionMutation,
    toggleQueuePauseMutation,
    batchRetryMutation,
    simulateTokenRotationMutation,
    permissions,
    queueAudit: queueAuditQuery.data ?? [],

    adoptDeviceMutation,
    ignoreDeviceMutation,
    syncEmployeesMutation,
  };
}
