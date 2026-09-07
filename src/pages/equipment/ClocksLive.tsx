import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, MonitorSmartphone, RefreshCw, Terminal, Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClockRow {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  ip_address: string | null;
  port: number | null;
  location: string | null;
  is_active: boolean | null;
  is_online: boolean | null;
  last_communication: string | null;
}

interface CommandRow {
  id: string;
  equipment_id: string | null;
  command: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
}

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600',
  running: 'bg-blue-500/15 text-blue-600',
  done: 'bg-emerald-500/15 text-emerald-600',
  failed: 'bg-red-500/15 text-red-600',
  canceled: 'bg-muted text-muted-foreground',
  paused: 'bg-muted text-muted-foreground',
};

export default function ClocksLive() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [, setTick] = useState(0);

  const { data: clocks = [], isLoading, refetch } = useQuery({
    queryKey: ['clocks-live'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_clock_equipment')
        .select('id, name, manufacturer, model, ip_address, port, location, is_active, is_online, last_communication')
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as ClockRow[];
    },
    refetchInterval: 20000,
  });

  const { data: commands = [] } = useQuery({
    queryKey: ['clocks-live-commands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_commands')
        .select('id, equipment_id, command, status, created_at, finished_at, error_message')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as CommandRow[];
    },
    refetchInterval: 20000,
  });

  // Tempo real: relógios e comandos sem recarregar a página.
  useEffect(() => {
    const channel = supabase
      .channel('clocks-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_clock_equipment' }, () =>
        queryClient.invalidateQueries({ queryKey: ['clocks-live'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'device_commands' }, () =>
        queryClient.invalidateQueries({ queryKey: ['clocks-live-commands'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const commandsByClock = useMemo(() => {
    return commands.reduce<Record<string, CommandRow[]>>((acc, command) => {
      if (!command.equipment_id) return acc;
      (acc[command.equipment_id] ||= []).push(command);
      return acc;
    }, {});
  }, [commands]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clocks;
    return clocks.filter((clock) =>
      [clock.name, clock.ip_address, clock.location, clock.manufacturer]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [clocks, search]);

  const onlineCount = clocks.filter((clock) => clock.is_online && clock.is_active).length;

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Relógios em Tempo Real"
        description="Status, última comunicação e comandos recebidos por cada relógio, atualizando sozinho."
        icon={MonitorSmartphone}
        actions={
          <>
            <Badge variant="outline" className="font-mono">
              {onlineCount}/{clocks.length} online
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar
            </Button>
          </>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por nome, IP ou local"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Carregando relógios...</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Nenhum relógio encontrado.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((clock) => {
            const live = Boolean(clock.is_online && clock.is_active);
            const recent = (commandsByClock[clock.id] ?? []).slice(0, 5);
            return (
              <Card key={clock.id} className="relative overflow-hidden">
                <div className={`absolute inset-x-0 top-0 h-1 ${live ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate text-base">{clock.name}</CardTitle>
                    <Badge variant={live ? 'default' : 'destructive'} className={live ? 'bg-emerald-500' : ''}>
                      {live ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
                      {clock.is_active ? (live ? 'Online' : 'Offline') : 'Desativado'}
                    </Badge>
                  </div>
                  <CardDescription className="truncate">
                    {clock.manufacturer ?? '—'} {clock.model ? `· ${clock.model}` : ''} · {clock.ip_address ?? '—'}
                    {clock.port ? `:${clock.port}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Última comunicação:</span>
                    <span className={live ? '' : 'text-red-500'}>
                      {clock.last_communication
                        ? formatDistanceToNow(new Date(clock.last_communication), { locale: ptBR, addSuffix: true })
                        : 'nunca'}
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-border/60 pt-3">
                    <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Terminal className="h-3 w-3" /> Comandos recebidos
                    </p>
                    {recent.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum comando enviado a este relógio.</p>
                    ) : (
                      recent.map((command) => (
                        <div key={command.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-mono">{command.command}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-muted-foreground">
                              {formatDistanceToNow(new Date(command.created_at), { locale: ptBR, addSuffix: true })}
                            </span>
                            <Badge
                              variant="outline"
                              className={statusStyle[command.status] ?? 'bg-muted text-muted-foreground'}
                            >
                              {command.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                    {recent.some((command) => command.status === 'failed' && command.error_message) && (
                      <p className="text-xs text-red-500">
                        {recent.find((command) => command.status === 'failed')?.error_message}
                      </p>
                    )}
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
