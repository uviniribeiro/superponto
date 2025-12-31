import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Wifi, WifiOff, RefreshCw, Settings, Trash2, Edit, Activity, Clock, Server } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MANUFACTURERS = [
  { value: 'henry', label: 'Henry', protocol: 'SOAP/REP-C' },
  { value: 'dimep', label: 'Dimep', protocol: 'REST API' },
  { value: 'controlid', label: 'Control iD', protocol: 'REST API' },
  { value: 'topdata', label: 'Topdata', protocol: 'Inner REP' },
  { value: 'madis', label: 'Madis', protocol: 'REST API' },
  { value: 'secullum', label: 'Secullum', protocol: 'SOAP' },
  { value: 'zkteco', label: 'ZKTeco', protocol: 'PUSH/HTTP' },
  { value: 'anviz', label: 'Anviz', protocol: 'REST API' },
  { value: 'suprema', label: 'Suprema (BioStar)', protocol: 'REST API' },
  { value: 'trix', label: 'Trix', protocol: 'REST API' },
  { value: 'rwtech', label: 'RWTech', protocol: 'REST API' },
  { value: 'hikvision', label: 'Hikvision', protocol: 'ISAPI' },
  { value: 'intelbras', label: 'Intelbras', protocol: 'REST API' },
  { value: 'generic', label: 'Genérico (HTTP)', protocol: 'HTTP/REST' },
];

interface Equipment {
  id: string;
  company_id: string | null;
  name: string;
  manufacturer: string;
  model: string;
  serial_number: string | null;
  ip_address: string;
  port: number;
  protocol: string;
  communication_type: string;
  api_endpoint: string | null;
  username: string | null;
  password: string | null;
  is_active: boolean;
  is_online: boolean;
  last_communication: string | null;
  last_sync: string | null;
  sync_interval_seconds: number;
  firmware_version: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CommunicationLog {
  id: string;
  equipment_id: string;
  status: string;
  message: string | null;
  request_type: string | null;
  records_synced: number;
  created_at: string;
}

const defaultEquipment: Partial<Equipment> = {
  name: '',
  manufacturer: 'generic',
  model: '',
  serial_number: '',
  ip_address: '',
  port: 80,
  protocol: 'http',
  communication_type: 'webservice',
  api_endpoint: '',
  username: '',
  password: '',
  is_active: true,
  sync_interval_seconds: 60,
  location: '',
  notes: '',
};

export default function Equipment() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Partial<Equipment>>(defaultEquipment);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);

  // Fetch equipment list
  const { data: equipments = [], isLoading } = useQuery({
    queryKey: ['equipment', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_clock_equipment')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Equipment[];
    },
    enabled: !!profile,
  });

  // Fetch communication logs
  const { data: logs = [] } = useQuery({
    queryKey: ['equipment-logs', selectedEquipmentId],
    queryFn: async () => {
      if (!selectedEquipmentId) return [];
      const { data, error } = await supabase
        .from('equipment_communication_logs')
        .select('*')
        .eq('equipment_id', selectedEquipmentId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as CommunicationLog[];
    },
    enabled: !!selectedEquipmentId,
  });

  // Real-time subscription for equipment status updates
  useEffect(() => {
    const channel = supabase
      .channel('equipment-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'time_clock_equipment',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['equipment'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Save equipment mutation
  const saveMutation = useMutation({
    mutationFn: async (equipment: Partial<Equipment>) => {
      const { id, created_at, updated_at, is_online, last_communication, last_sync, ...equipmentData } = equipment;
      if (id) {
        const { error } = await supabase
          .from('time_clock_equipment')
          .update({
            ...equipmentData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('time_clock_equipment')
          .insert([{
            name: equipmentData.name || '',
            manufacturer: equipmentData.manufacturer || 'generic',
            model: equipmentData.model || '',
            serial_number: equipmentData.serial_number,
            ip_address: equipmentData.ip_address || '',
            port: equipmentData.port || 80,
            protocol: equipmentData.protocol || 'http',
            communication_type: equipmentData.communication_type || 'webservice',
            api_endpoint: equipmentData.api_endpoint,
            username: equipmentData.username,
            password: equipmentData.password,
            is_active: equipmentData.is_active ?? true,
            sync_interval_seconds: equipmentData.sync_interval_seconds || 60,
            location: equipmentData.location,
            notes: equipmentData.notes,
            company_id: profile?.company_id,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      setIsDialogOpen(false);
      setEditingEquipment(defaultEquipment);
      toast.success('Equipamento salvo com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao salvar equipamento: ${error.message}`);
    },
  });

  // Delete equipment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('time_clock_equipment')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipamento removido com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao remover equipamento: ${error.message}`);
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (equipmentId: string) => {
      const { data, error } = await supabase.functions.invoke('equipment-sync', {
        body: { action: 'test_connection', equipmentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      if (data.online) {
        toast.success(data.message || 'Conexão estabelecida com sucesso');
      } else {
        toast.error(data.message || 'Falha na conexão');
      }
    },
    onError: (error) => {
      toast.error(`Erro ao testar conexão: ${error.message}`);
    },
  });

  // Sync all equipment mutation
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('equipment-sync', {
        body: { action: 'sync_all', companyId: profile?.company_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      const online = data.results?.filter((r: any) => r.online).length || 0;
      const offline = data.results?.filter((r: any) => !r.online).length || 0;
      toast.success(`Sincronização concluída: ${online} online, ${offline} offline`);
    },
    onError: (error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  const handleEdit = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingEquipment.name || !editingEquipment.ip_address) {
      toast.error('Nome e endereço IP são obrigatórios');
      return;
    }
    saveMutation.mutate(editingEquipment);
  };

  const getManufacturerLabel = (value: string) => {
    return MANUFACTURERS.find(m => m.value === value)?.label || value;
  };

  const onlineCount = equipments.filter(e => e.is_online).length;
  const offlineCount = equipments.filter(e => !e.is_online && e.is_active).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Equipamentos REP</h1>
          <p className="text-muted-foreground">Gerenciamento de relógios de ponto</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
            Sincronizar Todos
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingEquipment(defaultEquipment)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Equipamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEquipment.id ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle>
                <DialogDescription>Configure os dados do relógio de ponto</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={editingEquipment.name || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, name: e.target.value })}
                      placeholder="REP Entrada Principal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Fabricante</Label>
                    <Select
                      value={editingEquipment.manufacturer || 'generic'}
                      onValueChange={(value) => setEditingEquipment({ ...editingEquipment, manufacturer: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUFACTURERS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label} ({m.protocol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      value={editingEquipment.model || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, model: e.target.value })}
                      placeholder="Prisma Super Fácil"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serial_number">Número de Série</Label>
                    <Input
                      id="serial_number"
                      value={editingEquipment.serial_number || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, serial_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="protocol">Protocolo</Label>
                    <Select
                      value={editingEquipment.protocol || 'http'}
                      onValueChange={(value) => setEditingEquipment({ ...editingEquipment, protocol: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http">HTTP</SelectItem>
                        <SelectItem value="https">HTTPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ip_address">Endereço IP *</Label>
                    <Input
                      id="ip_address"
                      value={editingEquipment.ip_address || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, ip_address: e.target.value })}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Porta</Label>
                    <Input
                      id="port"
                      type="number"
                      value={editingEquipment.port || 80}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, port: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_endpoint">Endpoint da API (opcional)</Label>
                  <Input
                    id="api_endpoint"
                    value={editingEquipment.api_endpoint || ''}
                    onChange={(e) => setEditingEquipment({ ...editingEquipment, api_endpoint: e.target.value })}
                    placeholder="/api/v1/records"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuário</Label>
                    <Input
                      id="username"
                      value={editingEquipment.username || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={editingEquipment.password || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, password: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sync_interval">Intervalo de Sincronização (segundos)</Label>
                    <Input
                      id="sync_interval"
                      type="number"
                      value={editingEquipment.sync_interval_seconds || 60}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, sync_interval_seconds: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Localização</Label>
                    <Input
                      id="location"
                      value={editingEquipment.location || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, location: e.target.value })}
                      placeholder="Portaria Principal"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={editingEquipment.notes || ''}
                    onChange={(e) => setEditingEquipment({ ...editingEquipment, notes: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={editingEquipment.is_active ?? true}
                    onCheckedChange={(checked) => setEditingEquipment({ ...editingEquipment, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Ativo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Equipamentos</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <WifiOff className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{offlineCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipments.filter(e => e.is_active).length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="equipment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="equipment">Equipamentos</TabsTrigger>
          <TabsTrigger value="logs">Logs de Comunicação</TabsTrigger>
        </TabsList>

        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Equipamentos</CardTitle>
              <CardDescription>Relógios de ponto cadastrados no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : equipments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum equipamento cadastrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Fabricante</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>IP:Porta</TableHead>
                      <TableHead>Última Comunicação</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipments.map((equipment) => (
                      <TableRow key={equipment.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {equipment.is_online ? (
                              <Badge variant="default" className="bg-green-500">
                                <Wifi className="h-3 w-3 mr-1" />
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <WifiOff className="h-3 w-3 mr-1" />
                                Offline
                              </Badge>
                            )}
                            {!equipment.is_active && (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{equipment.name}</TableCell>
                        <TableCell>{getManufacturerLabel(equipment.manufacturer)}</TableCell>
                        <TableCell>{equipment.model || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {equipment.ip_address}:{equipment.port}
                        </TableCell>
                        <TableCell>
                          {equipment.last_communication
                            ? format(new Date(equipment.last_communication), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                            : 'Nunca'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => testConnectionMutation.mutate(equipment.id)}
                              disabled={testConnectionMutation.isPending}
                              title="Testar conexão"
                            >
                              <RefreshCw className={`h-4 w-4 ${testConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedEquipmentId(equipment.id);
                              }}
                              title="Ver logs"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(equipment)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja remover este equipamento?')) {
                                  deleteMutation.mutate(equipment.id);
                                }
                              }}
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Comunicação</CardTitle>
              <CardDescription>
                {selectedEquipmentId
                  ? `Logs do equipamento: ${equipments.find(e => e.id === selectedEquipmentId)?.name}`
                  : 'Selecione um equipamento para ver os logs'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedEquipmentId ? (
                <div className="text-center py-8 text-muted-foreground">
                  Clique no ícone de relógio em um equipamento para ver seus logs
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log encontrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Registros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                            {log.status === 'success' ? 'Sucesso' : 'Erro'}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.request_type || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.message || '-'}</TableCell>
                        <TableCell>{log.records_synced}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
