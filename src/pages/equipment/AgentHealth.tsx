import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Activity, Cpu, HardDrive, MemoryStick, Plug, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface AgentMetrics {
  cpu_percent?: number;
  memory_percent?: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
  disk_percent?: number;
  uptime_seconds?: number;
  platform?: string;
  hostname?: string;
  agent_version?: string;
  collected_at?: string;
  gateway_ok?: boolean;
}

interface AgentRow {
  id: string;
  name: string;
  hostname: string | null;
  os_info: string | null;
  agent_version: string | null;
  target_version: string | null;
  local_ip: string | null;
  public_ip: string | null;
  status: string | null;
  last_heartbeat: string | null;
  is_active: boolean | null;
  queue_paused: boolean | null;
  settings: Record<string, unknown> | null;
}

const isOnline = (agent: AgentRow) => {
  if (!agent.last_heartbeat) return false;
  return Date.now() - new Date(agent.last_heartbeat).getTime() < 3 * 60_000;
};

const formatUptime = (seconds?: number) => {
  if (!seconds && seconds !== 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const Meter = ({
  label,
  value,
  icon: Icon,
  suffix,
}: { label: string; value?: number; icon: React.ComponentType<{ className?: string }>; suffix?: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="font-mono text-foreground">{value != null ? `${value}%` : '—'}</span>
    </div>
    <Progress value={value ?? 0} className="h-1.5" />
    {suffix && <p className="text-[11px] text-muted-foreground">{suffix}</p>}
  </div>
);

export default function AgentHealth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tick, setTick] = useState(Date.now());

  const { data: agents = [], isLoading, refetch } = useQuery({
    queryKey: ['agent-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_agents')
        .select(
          'id, name, hostname, os_info, agent_version, target_version, local_ip, public_ip, status, last_heartbeat, is_active, queue_paused, settings',
        )
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as AgentRow[];
    },
    refetchInterval: 15000,
  });

  // Atualização em tempo real, sem recarregar a tela.
  useEffect(() => {
    const channel = supabase
      .channel('agent-health-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'communication_agents' },
        () => queryClient.invalidateQueries({ queryKey: ['agent-health'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const online = useMemo(() => agents.filter(isOnline).length, [agents, tick]);

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Saúde do Robô Local"
        description="CPU, memória, conexão com o gateway e versão instalada, atualizando sozinho."
        icon={Activity}
        actions={
          <>
            <Badge variant="outline" className="font-mono">
              {online}/{agents.length} online
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar
            </Button>
            <Button size="sm" onClick={() => navigate('/equipment/agents')}>
              <Server className="mr-1 h-3.5 w-3.5" /> Gerenciar robôs
            </Button>
          </>
        }
      />

      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Carregando robôs...</p>
      ) : agents.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Nenhum robô instalado até agora.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => {
            const metrics = ((agent.settings?.metrics ?? {}) as AgentMetrics) || {};
            const live = isOnline(agent);
            const gatewayFresh = metrics.collected_at
              ? Date.now() - new Date(metrics.collected_at).getTime() < 3 * 60_000
              : false;
            return (
              <Card key={agent.id} className="relative overflow-hidden">
                <div className={`absolute inset-x-0 top-0 h-1 ${live ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate text-base">{agent.name}</CardTitle>
                    <Badge variant={live ? 'default' : 'destructive'} className={live ? 'bg-emerald-500' : ''}>
                      {live ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
                      {live ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  <CardDescription className="truncate">
                    {agent.hostname || metrics.hostname || 'Host desconhecido'} · {agent.os_info || metrics.platform || '—'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Meter label="CPU" value={metrics.cpu_percent} icon={Cpu} />
                  <Meter
                    label="Memória"
                    value={metrics.memory_percent}
                    icon={MemoryStick}
                    suffix={
                      metrics.memory_used_mb != null && metrics.memory_total_mb != null
                        ? `${metrics.memory_used_mb} MB de ${metrics.memory_total_mb} MB`
                        : undefined
                    }
                  />
                  <Meter label="Disco" value={metrics.disk_percent} icon={HardDrive} />

                  <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Versão instalada</p>
                      <p className="font-mono">{agent.agent_version || metrics.agent_version || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Versão alvo</p>
                      <p className="font-mono">{agent.target_version || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">IP local</p>
                      <p className="font-mono">{agent.local_ip || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tempo ligado</p>
                      <p className="font-mono">{formatUptime(metrics.uptime_seconds)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs">
                    <Badge variant={gatewayFresh ? 'outline' : 'secondary'}>
                      <Plug className="mr-1 h-3 w-3" />
                      {gatewayFresh ? 'Gateway conectado' : 'Sem telemetria recente'}
                    </Badge>
                    {agent.queue_paused && <Badge variant="secondary">Fila pausada</Badge>}
                    <span className="text-muted-foreground">
                      Último sinal:{' '}
                      {agent.last_heartbeat
                        ? formatDistanceToNow(new Date(agent.last_heartbeat), { locale: ptBR, addSuffix: true })
                        : 'nunca'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
