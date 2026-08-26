import { useState } from 'react';
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

} from 'lucide-react';
import {
  useCommunicationAgents,
  type CommunicationAgent,
  type DiscoveredDevice,
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

  const equipmentName = (id?: string | null) =>
    equipmentList.find((item) => item.id === id)?.name ?? '—';

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
                              agent.token_rotation_status === 'pending' ? 'secondary' : 'outline'
                            }
                          >
                            {agent.token_rotation_status === 'pending'
                              ? 'Rotação pendente'
                              : agent.token_auto_rotation
                                ? 'Auto'
                                : 'Estável'}
                          </Badge>
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
              <CardTitle>Histórico de comandos</CardTitle>
              <CardDescription>Últimas 100 execuções.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {commands.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum comando executado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comando</TableHead>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Concluído</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commands.map((command) => (
                      <TableRow key={command.id}>
                        <TableCell className="font-medium">{command.command}</TableCell>
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

      <AgentTokenRotationDialog
        agent={rotationAgent}
        open={!!rotationAgent}
        onOpenChange={(value) => !value && setRotationAgentId(null)}
        onStart={(input) => startTokenRotationMutation.mutateAsync(input)}
        onCancel={(id) => cancelTokenRotationMutation.mutate(id)}
        onSavePolicy={(input) => setAutoRotationMutation.mutate(input)}
        isBusy={startTokenRotationMutation.isPending || cancelTokenRotationMutation.isPending}
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
