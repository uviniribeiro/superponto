import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { toast } from '@/hooks/use-toast';
import {
  Bot,
  Plus,
  Download,
  Radar,
  Copy,
  Trash2,
  RefreshCw,
  Clock,
  Power,
  CheckCircle2,
  Users,
  Terminal,
  Info,
  KeyRound,
  RotateCcw,
  Pause,
  Play,
  Ban,
  FileText,

} from 'lucide-react';
import {
  useCommunicationAgents,
  type CommunicationAgent,
  type DeviceCommand,
  type DiscoveredDevice,
  type RotationSimulation,
} from '@/hooks/useCommunicationAgents';
import { AgentTokenRotationDialog } from '@/components/equipment/AgentTokenRotationDialog';

const statusVariant = (status?: string | null) => {
  switch (status) {
    case 'online':
    case 'adopted':
    case 'done':
    case 'success':
      return 'default' as const;
    case 'error':
    case 'failed':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR') : '—';

const isOnline = (agent: CommunicationAgent) =>
  !!agent.last_heartbeat && Date.now() - new Date(agent.last_heartbeat).getTime() < 5 * 60 * 1000;

export default function CommunicationAgents() {
  const {
    agents,
    devices,
    commands,
    employeeSync,
    isLoading,
    createAgentMutation,
    updateAgentMutation,
    deleteAgentMutation,
    queueCommandMutation,
    commandActionMutation,
    toggleQueuePauseMutation,
    batchRetryMutation,
    simulateTokenRotationMutation,
    permissions,
    queueAudit,
    adoptDeviceMutation,
    ignoreDeviceMutation,
    syncEmployeesMutation,
    rotations,
    startTokenRotationMutation,
    cancelTokenRotationMutation,
    setAutoRotationMutation,
    releases,
    updateEvents,
    setUpdatePolicyMutation,
    rollbackAgentMutation,
  } = useCommunicationAgents();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [ranges, setRanges] = useState('192.168.0.0/24');
  const [autoAdopt, setAutoAdopt] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [syncEquipment, setSyncEquipment] = useState<string>('');
  const [rotationAgentId, setRotationAgentId] = useState<string | null>(null);
  const [commandSearch, setCommandSearch] = useState('');
  const [commandStatus, setCommandStatus] = useState('all');
  const [commandAgent, setCommandAgent] = useState('all');
  const [commandStartDate, setCommandStartDate] = useState('');
  const [commandEndDate, setCommandEndDate] = useState('');
  const [selectedCommandIds, setSelectedCommandIds] = useState<string[]>([]);
  const [logCommand, setLogCommand] = useState<DeviceCommand | null>(null);
  const [adoptionDevice, setAdoptionDevice] = useState<DiscoveredDevice | null>(null);
  const [simulation, setSimulation] = useState<RotationSimulation | null>(null);
  const alertedCommandIds = useRef(new Set<string>());
  const rotationAgent = agents.find((item) => item.id === rotationAgentId) ?? null;

  const { data: equipmentList = [] } = useQuery({
    queryKey: ['equipment-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_clock_equipment')
        .select('id, name, ip_address')
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; ip_address: string | null }[];
    },
  });

  const tokenExpired = (agent: CommunicationAgent) =>
    !!agent.token_expires_at && new Date(agent.token_expires_at).getTime() < Date.now();

  const equipmentName = (id?: string | null) =>
    equipmentList.find((item) => item.id === id)?.name ?? '—';

  const filteredCommands = commands.filter((command) => {
    const term = commandSearch.trim().toLowerCase();
    const payloadText = JSON.stringify(command.payload ?? {}).toLowerCase();
    const matchesTerm =
      !term ||
      command.id.toLowerCase().includes(term) ||
      command.command.toLowerCase().includes(term) ||
      equipmentName(command.equipment_id).toLowerCase().includes(term) ||
      payloadText.includes(term);
    const status = command.status ?? 'pending';
    const createdAt = new Date(command.created_at).getTime();
    const start = commandStartDate ? new Date(`${commandStartDate}T00:00:00`).getTime() : -Infinity;
    const end = commandEndDate ? new Date(`${commandEndDate}T23:59:59.999`).getTime() : Infinity;
    return (
      matchesTerm &&
      (commandStatus === 'all' || status === commandStatus) &&
      (commandAgent === 'all' || command.agent_id === commandAgent) &&
      createdAt >= start &&
      createdAt <= end
    );
  });

  const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const exportCommandsCsv = () => {
    const rows = [
      ['ID', 'Robô', 'Equipamento', 'Comando', 'Payload', 'Status', 'Criado em', 'Finalizado em'],
      ...filteredCommands.map((item) => [
        item.id,
        agents.find((agent) => agent.id === item.agent_id)?.name ?? '',
        equipmentName(item.equipment_id),
        item.command,
        JSON.stringify(item.payload ?? {}),
        item.status ?? 'pending',
        formatDate(item.created_at),
        formatDate(item.finished_at),
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pontomax-comandos.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportCommandsPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('Ponto Max — Comandos', 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [['ID', 'Robô', 'Equipamento', 'Comando', 'Status', 'Criado em']],
      body: filteredCommands.map((item) => [
        item.id.slice(0, 12),
        agents.find((agent) => agent.id === item.agent_id)?.name ?? '—',
        equipmentName(item.equipment_id),
        item.command,
        item.status ?? 'pending',
        formatDate(item.created_at),
      ]),
    });
    doc.save('pontomax-comandos.pdf');
  };

  useEffect(() => {
    const staleLimit = Date.now() - 15 * 60 * 1000;
    commands.forEach((command) => {
      const status = command.status ?? 'pending';
      const stale = status === 'pending' && new Date(command.created_at).getTime() < staleLimit;
      const alertKey = `${command.id}:${status}:${stale}`;
      if (alertedCommandIds.current.has(alertKey)) return;
      if (status === 'failed') {
        toast({ title: 'Comando falhou', description: `${command.command}: ${command.error_message ?? 'verifique os logs.'}`, variant: 'destructive' });
        alertedCommandIds.current.add(alertKey);
      } else if (status === 'cancelled') {
        toast({ title: 'Comando cancelado', description: command.command });
        alertedCommandIds.current.add(alertKey);
      } else if (stale) {
        toast({ title: 'Comando aguardando há muito tempo', description: command.command, variant: 'destructive' });
        alertedCommandIds.current.add(alertKey);
      }
    });
  }, [commands]);

  const toggleCommandSelection = (id: string, checked: boolean) => {
    setSelectedCommandIds((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  };

  const selectAllFiltered = (checked: boolean) => {
    setSelectedCommandIds(checked ? filteredCommands.map((item) => item.id) : []);
  };


  const handleCreate = async () => {
    const generated = await createAgentMutation.mutateAsync({
      name: name.trim(),
      discovery_ranges: ranges
        .split(',')
        .map((range) => range.trim())
        .filter(Boolean),
      auto_adopt: autoAdopt,
    });
    setToken(generated);
    setOpen(false);
    setName('');
  };

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    toast({ title: 'Token copiado', description: 'Cole no assistente de instalação do robô.' });
  };

  const downloadFile = (file: string) => {
    fetch(`/downloads/${file}`)
      .then((response) => {
        if (!response.ok) throw new Error('Arquivo indisponível');
        return response.blob();
      })
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = file;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch((error: Error) =>
        toast({ title: 'Erro no download', description: error.message, variant: 'destructive' }),
      );
  };

  const pendingDevices = devices.filter((device) => device.status !== 'ignored');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          icon={Bot}
          title="Robô de Comunicação"
          description="Agentes locais que descobrem relógios na rede, acompanham troca de IP (DHCP) e sincronizam funcionários"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadFile('install-pontomax-agent.bat')}>
            <Download className="mr-2 h-4 w-4" />
            Instalador Windows
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Agente
          </Button>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como instalar</AlertTitle>
        <AlertDescription>
          1) Crie o agente aqui e copie o token. 2) Baixe e execute o instalador na máquina/servidor local (como
          administrador) — ele configura o token, registra o serviço do Windows e inicia a varredura automática.
          3) Os relógios encontrados aparecem em <strong>Dispositivos Encontrados</strong> para adoção com um clique.
          Se o relógio trocar de IP por DHCP, o robô identifica pelo MAC/nº de série e atualiza o cadastro sozinho.
        </AlertDescription>
      </Alert>

      {token && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Token do agente (exibido apenas uma vez)</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="break-all rounded-lg bg-muted px-3 py-2 text-xs">{token}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyToken}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setToken(null)}>
                Ocultar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="agents">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="agents">Agentes</TabsTrigger>
          <TabsTrigger value="devices">Dispositivos Encontrados</TabsTrigger>
          <TabsTrigger value="commands">Comandos</TabsTrigger>
          <TabsTrigger value="employees">Funcionários no Relógio</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="updates">Atualizações</TabsTrigger>

          <TabsTrigger value="downloads">Downloads</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Agentes instalados</CardTitle>
              <CardDescription>Status em tempo real, faixas de rede e adoção automática.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum agente cadastrado. Crie um agente e instale o robô na máquina local.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agente</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>IP local</TableHead>
                      <TableHead>Versão</TableHead>
                      <TableHead>Último sinal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">
                          {agent.name}
                          <div className="text-xs text-muted-foreground">
                            {(agent.discovery_ranges ?? []).join(', ') || 'rede automática'}
                          </div>
                        </TableCell>
                        <TableCell>{agent.hostname ?? '—'}</TableCell>
                        <TableCell>{agent.local_ip ?? '—'}</TableCell>
                        <TableCell>{agent.agent_version ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(agent.last_heartbeat)}</TableCell>
                        <TableCell>
                          <Badge variant={isOnline(agent) ? 'default' : 'secondary'}>
                            {isOnline(agent) ? 'Online' : 'Offline'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tokenExpired(agent)
                                ? 'destructive'
                                : agent.token_rotation_status === 'pending'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {tokenExpired(agent)
                              ? 'Token expirado'
                              : agent.token_rotation_status === 'pending'
                                ? 'Rotação pendente'
                                : agent.token_auto_rotation
                                  ? 'Auto'
                                  : 'Estável'}
                          </Badge>
                          {agent.token_expires_at && (
                            <div className="text-xs text-muted-foreground">
                              Expira em {formatDate(agent.token_expires_at)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRotationAgentId(agent.id)}
                            >
                              <KeyRound className="mr-1 h-3.5 w-3.5" />
                              Token
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                queueCommandMutation.mutate({ agent_id: agent.id, command: 'discover' })
                              }
                            >
                              <Radar className="mr-1 h-3.5 w-3.5" />
                              Varrer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateAgentMutation.mutate({ id: agent.id, auto_adopt: !agent.auto_adopt })
                              }
                            >
                              {agent.auto_adopt ? 'Adoção auto: ON' : 'Adoção auto: OFF'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteAgentMutation.mutate(agent.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Relógios encontrados na rede</CardTitle>
              <CardDescription>
                Identificação automática de fabricante, modelo, MAC e protocolo. Adote para cadastrar no sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {pendingDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum dispositivo encontrado ainda. Use "Varrer" no agente para iniciar a busca.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP / Porta</TableHead>
                      <TableHead>Fabricante</TableHead>
                      <TableHead>Modelo / Série</TableHead>
                      <TableHead>MAC</TableHead>
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Visto em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDevices.map((device: DiscoveredDevice) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">
                          {device.ip_address}
                          {device.port ? `:${device.port}` : ''}
                        </TableCell>
                        <TableCell className="capitalize">{device.manufacturer ?? '—'}</TableCell>
                        <TableCell>
                          {device.model ?? '—'}
                          <div className="text-xs text-muted-foreground">{device.serial_number ?? ''}</div>
                        </TableCell>
                        <TableCell className="text-xs">{device.mac_address ?? '—'}</TableCell>
                        <TableCell>{device.protocol ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(device.last_seen)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(device.status)}>
                            {device.equipment_id ? 'Adotado' : (device.status ?? 'novo')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">

                            {!device.equipment_id && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => adoptDeviceMutation.mutate(device)}
                                  disabled={adoptDeviceMutation.isPending}
                                >
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  Adotar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => ignoreDeviceMutation.mutate(device.id)}
                                >
                                  Ignorar
                                </Button>
                              </>
                            )}
                            {device.equipment_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  queueCommandMutation.mutate({
                                    agent_id: device.agent_id,
                                    equipment_id: device.equipment_id,
                                    command: 'sync_time',
                                  })
                                }
                              >
                                <Clock className="mr-1 h-3.5 w-3.5" />
                                Sincronizar hora
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commands" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enviar comando</CardTitle>
              <CardDescription>Ações executadas pelo robô no relógio selecionado.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[
                { command: 'collect_records', label: 'Coletar marcações', icon: RefreshCw },
                { command: 'sync_time', label: 'Sincronizar hora', icon: Clock },
                { command: 'push_employees', label: 'Enviar funcionários', icon: Users },
                { command: 'test_connection', label: 'Testar conexão', icon: Terminal },
                { command: 'reboot', label: 'Reiniciar relógio', icon: Power },
              ].map(({ command, label, icon: Icon }) => (
                <Button
                  key={command}
                  variant="outline"
                  disabled={agents.length === 0}
                  onClick={() =>
                    queueCommandMutation.mutate({
                      agent_id: agents[0]?.id ?? null,
                      equipment_id: syncEquipment || null,
                      command,
                    })
                  }
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fila por robô</CardTitle>
              <CardDescription>
                Ao pausar, o robô deixa de receber novos comandos até a fila ser retomada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum robô cadastrado.</p>
              ) : (
                agents.map((agent: CommunicationAgent) => (
                  <div
                    key={agent.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 p-4"
                  >
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {commands.filter((c) => c.agent_id === agent.id && c.status === 'pending').length} pendente(s) ·{' '}
                        {commands.filter((c) => c.agent_id === agent.id && c.status === 'paused').length} pausado(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={agent.queue_paused ? 'destructive' : 'default'}>
                        {agent.queue_paused ? 'Fila pausada' : 'Fila ativa'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleQueuePauseMutation.isPending}
                        onClick={() =>
                          toggleQueuePauseMutation.mutate({ agent, paused: !agent.queue_paused })
                        }
                      >
                        {agent.queue_paused ? (
                          <>
                            <Play className="mr-1 h-3.5 w-3.5" /> Retomar fila
                          </>
                        ) : (
                          <>
                            <Pause className="mr-1 h-3.5 w-3.5" /> Pausar fila
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle>Fila e histórico de comandos</CardTitle>
                <CardDescription>Últimas 100 execuções, com pausa, reexecução e logs.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={commandSearch}
                  onChange={(event) => setCommandSearch(event.target.value)}
                  placeholder="Buscar por ID, comando, equipamento ou dados enviados"
                  className="w-full sm:w-72"
                />
                <Select value={commandAgent} onValueChange={setCommandAgent}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Robô" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os robôs</SelectItem>
                    {agents.map((agent: CommunicationAgent) => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={commandStatus} onValueChange={setCommandStatus}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="paused">Pausados</SelectItem>
                    <SelectItem value="running">Em execução</SelectItem>
                    <SelectItem value="done">Concluídos</SelectItem>
                    <SelectItem value="failed">Com falha</SelectItem>
                    <SelectItem value="cancelled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={commandStartDate}
                  onChange={(event) => setCommandStartDate(event.target.value)}
                  className="w-full sm:w-40"
                  aria-label="Data inicial"
                />
                <Input
                  type="date"
                  value={commandEndDate}
                  onChange={(event) => setCommandEndDate(event.target.value)}
                  className="w-full sm:w-40"
                  aria-label="Data final"
                />
                <Button variant="outline" onClick={exportCommandsCsv} disabled={filteredCommands.length === 0}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" onClick={exportCommandsPdf} disabled={filteredCommands.length === 0}>
                  <FileText className="mr-2 h-4 w-4" /> PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 overflow-x-auto">
              {selectedCommandIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 p-3">
                  <p className="text-sm">
                    {selectedCommandIds.length} comando(s) selecionado(s) — a reexecução respeita a ordem original da fila.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCommandIds([])}>
                      Limpar seleção
                    </Button>
                    <Button
                      size="sm"
                      disabled={!permissions.canRetry || batchRetryMutation.isPending}
                      onClick={() => {
                        const selected = filteredCommands.filter((item) => selectedCommandIds.includes(item.id));
                        if (!window.confirm(`Reexecutar ${selected.length} comando(s) na ordem original?`)) return;
                        batchRetryMutation.mutate(selected, { onSuccess: () => setSelectedCommandIds([]) });
                      }}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reexecutar em lote
                    </Button>
                  </div>
                </div>
              )}
              {filteredCommands.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum comando encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            filteredCommands.length > 0 &&
                            filteredCommands.every((item) => selectedCommandIds.includes(item.id))
                          }
                          onCheckedChange={(value) => selectAllFiltered(value === true)}
                          aria-label="Selecionar todos os comandos filtrados"
                        />
                      </TableHead>
                      <TableHead>Comando</TableHead>
                      <TableHead>Robô</TableHead>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Concluído</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommands.map((command) => (
                      <TableRow key={command.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCommandIds.includes(command.id)}
                            onCheckedChange={(value) => toggleCommandSelection(command.id, value === true)}
                            aria-label={`Selecionar comando ${command.command}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {command.command}
                          <div className="text-xs text-muted-foreground">{command.id.slice(0, 8)}</div>
                        </TableCell>
                        <TableCell>{agents.find((item) => item.id === command.agent_id)?.name ?? '—'}</TableCell>
                        <TableCell>{equipmentName(command.equipment_id)}</TableCell>
                        <TableCell>{command.attempts ?? 0}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(command.created_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(command.finished_at)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(command.status)}>{command.status ?? 'pendente'}</Badge>
                          {command.error_message && (
                            <div className="text-xs text-destructive">{command.error_message}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {command.status === 'pending' && permissions.canPause && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Pausar comando"
                                onClick={() => commandActionMutation.mutate({ command, action: 'pause' })}
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                            )}
                            {command.status === 'paused' && permissions.canResume && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Retomar comando"
                                onClick={() => commandActionMutation.mutate({ command, action: 'resume' })}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            {['done', 'failed', 'cancelled'].includes(command.status ?? '') && permissions.canRetry && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Reexecutar comando"
                                onClick={() => commandActionMutation.mutate({ command, action: 'retry' })}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            {['pending', 'paused', 'running'].includes(command.status ?? 'pending') && permissions.canCancel && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Cancelar comando"
                                onClick={() => commandActionMutation.mutate({ command, action: 'cancel' })}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Ver logs do comando"
                              onClick={() => setLogCommand(command)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle>Auditoria da fila</CardTitle>
                <CardDescription>Quem pausou, retomou, reexecutou ou cancelou cada comando.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const rows = [['Data', 'Usuário', 'Ação', 'Detalhe'], ...queueAudit.map((entry) => [formatDate(entry.created_at), entry.user_name ?? '', entry.action, entry.description ?? ''])];
                  const blob = new Blob([rows.map((row) => row.map(csvCell).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
                  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'pontomax-auditoria-comandos.csv'; link.click(); URL.revokeObjectURL(link.href);
                }} disabled={queueAudit.length === 0}><Download className="mr-1 h-4 w-4" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  const { default: jsPDF } = await import('jspdf');
                  const { default: autoTable } = await import('jspdf-autotable');
                  const doc = new jsPDF({ orientation: 'landscape' }); doc.text('Ponto Max — Auditoria de comandos', 14, 14);
                  autoTable(doc, { startY: 20, head: [['Data', 'Usuário', 'Ação', 'Detalhe']], body: queueAudit.map((entry) => [formatDate(entry.created_at), entry.user_name ?? '—', entry.action, entry.description ?? '—']) });
                  doc.save('pontomax-auditoria-comandos.pdf');
                }} disabled={queueAudit.length === 0}><FileText className="mr-1 h-4 w-4" /> PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {queueAudit.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ação registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueAudit.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(entry.created_at)}</TableCell>
                        <TableCell>{entry.user_name ?? '—'}</TableCell>
                        <TableCell>{entry.action}</TableCell>
                        <TableCell>{entry.description ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="employees" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enviar cadastro de funcionários</CardTitle>
              <CardDescription>
                Todos os funcionários ativos são enfileirados para gravação no relógio escolhido.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Equipamento</Label>
                <Select value={syncEquipment} onValueChange={setSyncEquipment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o relógio" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentList.map((equipment) => (
                      <SelectItem key={equipment.id} value={equipment.id}>
                        {equipment.name} {equipment.ip_address ? `(${equipment.ip_address})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={!syncEquipment || syncEmployeesMutation.isPending}
                onClick={() => syncEmployeesMutation.mutate(syncEquipment)}
              >
                <Users className="mr-2 h-4 w-4" />
                Enviar para o relógio
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fila de sincronização</CardTitle>
              <CardDescription>Situação de cada funcionário nos equipamentos.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {employeeSync.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>ID no relógio</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Biometria</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeSync.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{equipmentName(item.equipment_id)}</TableCell>
                        <TableCell>{item.device_user_id ?? '—'}</TableCell>
                        <TableCell>{item.operation ?? '—'}</TableCell>
                        <TableCell>{item.templates_synced ? 'Sim' : 'Não'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(item.updated_at)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(item.status)}>{item.status ?? 'pendente'}</Badge>
                          {item.error_message && (
                            <div className="text-xs text-destructive">{item.error_message}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de rotações de token</CardTitle>
              <CardDescription>
                Rotações manuais e automáticas, com janela de transição e validação pelo robô.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {rotations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma rotação registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agente</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Janela até</TableHead>
                      <TableHead>Validado em</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rotations.map((rotation) => (
                      <TableRow key={rotation.id}>
                        <TableCell>
                          {agents.find((item) => item.id === rotation.agent_id)?.name ?? '—'}
                        </TableCell>
                        <TableCell>{rotation.mode === 'automatic' ? 'Automática' : 'Manual'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(rotation.started_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(rotation.window_expires_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(rotation.validated_at)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(rotation.status === 'completed' ? 'done' : rotation.status)}>
                            {rotation.status === 'completed'
                              ? 'Concluída'
                              : rotation.status === 'cancelled'
                                ? 'Cancelada'
                                : 'Aguardando validação'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-atualização do robô</CardTitle>
              <CardDescription>
                O robô baixa a nova versão, confere o código de verificação e guarda o executável
                anterior. Se a nova versão não conseguir se conectar, ele volta sozinho para a
                versão anterior.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum agente cadastrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agente</TableHead>
                      <TableHead>Versão instalada</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Automática</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Versão anterior</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent: CommunicationAgent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell>{agent.agent_version ?? '—'}</TableCell>
                        <TableCell>
                          <Select
                            value={agent.update_channel ?? 'stable'}
                            onValueChange={(value) =>
                              setUpdatePolicyMutation.mutate({ agentId: agent.id, update_channel: value })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="stable">Estável</SelectItem>
                              <SelectItem value="beta">Beta</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={agent.auto_update !== false}
                            onCheckedChange={(checked) =>
                              setUpdatePolicyMutation.mutate({
                                agentId: agent.id,
                                auto_update: checked,
                                target_version: checked ? null : agent.target_version,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(agent.last_update_status === 'verified' ? 'done' : agent.last_update_status)}>
                            {agent.last_update_status === 'verified'
                              ? 'Atualizado'
                              : agent.last_update_status === 'rolled_back'
                                ? 'Revertido'
                                : agent.last_update_status === 'failed'
                                  ? 'Falhou'
                                  : agent.last_update_status === 'rollback_requested'
                                    ? 'Reversão pendente'
                                    : (agent.last_update_status ?? 'Em dia')}
                          </Badge>
                        </TableCell>
                        <TableCell>{agent.rollback_version ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!agent.rollback_version || rollbackAgentMutation.isPending}
                            onClick={() => rollbackAgentMutation.mutate(agent)}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Reverter versão
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Versões publicadas</CardTitle>
              <CardDescription>Instaladores disponíveis por canal e sistema operacional.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {releases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma versão publicada. Cadastre uma versão para liberar a atualização automática.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versão</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Sistema</TableHead>
                      <TableHead>Publicada em</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {releases.map((release) => (
                      <TableRow key={release.id}>
                        <TableCell className="font-medium">{release.version}</TableCell>
                        <TableCell className="capitalize">{release.channel}</TableCell>
                        <TableCell className="capitalize">{release.platform}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(release.published_at)}</TableCell>
                        <TableCell>
                          <Badge variant={release.is_active ? 'default' : 'secondary'}>
                            {release.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de atualizações</CardTitle>
              <CardDescription>Download, checksum, instalação e reversões por agente.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {updateEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atualização registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agente</TableHead>
                      <TableHead>De → Para</TableHead>
                      <TableHead>Checksum</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Conclusão</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {updateEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          {agents.find((item) => item.id === event.agent_id)?.name ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {(event.from_version ?? '—') + ' → ' + (event.to_version ?? '—')}
                        </TableCell>
                        <TableCell>
                          {event.checksum_ok === null
                            ? '—'
                            : event.checksum_ok
                              ? 'OK'
                              : 'Divergente'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(event.started_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(event.finished_at)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(event.status === 'verified' ? 'done' : event.status)}>
                            {event.status}
                          </Badge>
                          {event.error_message && (
                            <div className="text-xs text-destructive">{event.error_message}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="downloads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Arquivos do robô</CardTitle>
              <CardDescription>Instalação na máquina/servidor local do cliente.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                { file: 'install-pontomax-agent.bat', label: 'Instalador Windows (.bat)', hint: 'Instala e registra o serviço' },
                { file: 'pontomax-agent.py', label: 'Agente Ponto Max (Python)', hint: 'Multi-fabricante e descoberta de rede' },
                { file: 'pontomax-agent-service.py', label: 'Serviço do Windows', hint: 'Wrapper com reinício automático' },
                { file: 'build-pontomax-installer.py', label: 'Gerador do .exe / NSIS', hint: 'Compila o instalador oficial' },
                { file: 'install-pontomax-agent.sh', label: 'Instalador Linux (.sh)', hint: 'systemd com start automático' },
                { file: 'pontomax-agent.service', label: 'Unidade systemd', hint: 'Serviço Linux' },
              ].map((item) => (
                <button
                  key={item.file}
                  type="button"
                  onClick={() => downloadFile(item.file)}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition hover:border-primary/50"
                >
                  <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!logCommand} onOpenChange={(value) => !value && setLogCommand(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Logs do comando</DialogTitle>
            <DialogDescription>
              {logCommand ? logCommand.command + ' · ' + equipmentName(logCommand.equipment_id) : ''}
            </DialogDescription>
          </DialogHeader>
          {logCommand && (
            <div className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>Status: <Badge variant={statusVariant(logCommand.status)}>{logCommand.status ?? 'pendente'}</Badge></div>
                <div>Tentativas: {logCommand.attempts ?? 0}</div>
                <div>Criado em: {formatDate(logCommand.created_at)}</div>
                <div>Iniciado em: {formatDate(logCommand.started_at)}</div>
                <div>Concluído em: {formatDate(logCommand.finished_at)}</div>
                <div>Última ação: {logCommand.last_action ?? '—'} {logCommand.last_action_at ? '(' + formatDate(logCommand.last_action_at) + ')' : ''}</div>
              </div>
              {logCommand.error_message && (
                <p className="text-destructive">{logCommand.error_message}</p>
              )}
              <div>
                <p className="mb-1 font-medium">Dados enviados</p>
                <pre className="max-h-40 overflow-auto rounded-xl bg-muted p-3 text-xs">
                  {JSON.stringify(logCommand.payload ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-medium">Retorno do relógio</p>
                <pre className="max-h-40 overflow-auto rounded-xl bg-muted p-3 text-xs">
                  {JSON.stringify(logCommand.result ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogCommand(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AgentTokenRotationDialog
        agent={rotationAgent}
        open={!!rotationAgent}
        onOpenChange={(value) => !value && setRotationAgentId(null)}
        onStart={(input) => startTokenRotationMutation.mutateAsync(input)}
        onCancel={(id) => cancelTokenRotationMutation.mutate(id)}
        onSavePolicy={(input) => setAutoRotationMutation.mutate(input)}
        isBusy={
          startTokenRotationMutation.isPending ||
          cancelTokenRotationMutation.isPending ||
          setAutoRotationMutation.isPending
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agente</DialogTitle>
            <DialogDescription>
              O token é gerado agora e exibido apenas uma vez. Use-o no assistente de instalação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do agente</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Servidor Matriz"
              />
            </div>
            <div className="space-y-2">
              <Label>Faixas de rede a varrer</Label>
              <Input
                value={ranges}
                onChange={(event) => setRanges(event.target.value)}
                placeholder="192.168.0.0/24, 10.0.1.0/24"
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula. Deixe padrão para a rede local.</p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Adoção automática</p>
                <p className="text-xs text-muted-foreground">Cadastra o relógio no sistema assim que encontrado</p>
              </div>
              <Switch checked={autoAdopt} onCheckedChange={setAutoAdopt} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || createAgentMutation.isPending}>
              Criar agente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
