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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Plus, Wifi, WifiOff, RefreshCw, Trash2, Edit, Activity, Clock, Server, HelpCircle, Copy, Check, Info, FileWarning, CheckCircle2, XCircle, User, Link, Users, Upload, Download, UserMinus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';

// Equipment manufacturers and their models
const EQUIPMENT_CATALOG = [
  {
    manufacturer: 'henry',
    label: 'Henry',
    models: [
      { value: 'prisma_super_facil', label: 'Prisma Super Fácil', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc' },
      { value: 'orion_6', label: 'Orion 6', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc' },
      { value: 'hexa', label: 'Hexa', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc' },
      { value: 'primme', label: 'Primme', port: 80, protocol: 'http', endpoint: '/iDClass/SyncDataService.svc' },
    ],
  },
  {
    manufacturer: 'dimep',
    label: 'Dimep',
    models: [
      { value: 'printpoint_iii', label: 'PrintPoint III', port: 80, protocol: 'http', endpoint: '/api/v1/records' },
      { value: 'smart_print', label: 'Smart Print', port: 80, protocol: 'http', endpoint: '/api/v1/records' },
      { value: 'face_plus', label: 'FacePlus', port: 80, protocol: 'http', endpoint: '/api/v1/records' },
      { value: 'biopoint_ii', label: 'BioPoint II', port: 80, protocol: 'http', endpoint: '/api/v1/records' },
    ],
  },
  {
    manufacturer: 'controlid',
    label: 'Control iD',
    models: [
      { value: 'idclass', label: 'iDClass', port: 80, protocol: 'http', endpoint: '/api/v1/afd' },
      { value: 'idface', label: 'iDFace', port: 80, protocol: 'http', endpoint: '/api/v1/afd' },
      { value: 'idbox', label: 'iDBox', port: 80, protocol: 'http', endpoint: '/api/v1/afd' },
      { value: 'idflex', label: 'iDFlex', port: 80, protocol: 'http', endpoint: '/api/v1/afd' },
    ],
  },
  {
    manufacturer: 'topdata',
    label: 'Topdata',
    models: [
      { value: 'inner_rep', label: 'Inner Rep', port: 80, protocol: 'http', endpoint: '/inner/api' },
      { value: 'inner_rep_plus', label: 'Inner Rep Plus', port: 80, protocol: 'http', endpoint: '/inner/api' },
      { value: 'inner_bio', label: 'Inner Bio', port: 80, protocol: 'http', endpoint: '/inner/api' },
    ],
  },
  {
    manufacturer: 'madis',
    label: 'Madis',
    models: [
      { value: 'md_6705', label: 'MD 6705', port: 80, protocol: 'http', endpoint: '/api/records' },
      { value: 'md_6710', label: 'MD 6710', port: 80, protocol: 'http', endpoint: '/api/records' },
      { value: 'md_faceid', label: 'MD FaceID', port: 80, protocol: 'http', endpoint: '/api/records' },
    ],
  },
  {
    manufacturer: 'secullum',
    label: 'Secullum',
    models: [
      { value: 'rep_4', label: 'REP 4', port: 80, protocol: 'http', endpoint: '/webservice/ponto' },
      { value: 'rep_bio', label: 'REP Bio', port: 80, protocol: 'http', endpoint: '/webservice/ponto' },
      { value: 'rep_facial', label: 'REP Facial', port: 80, protocol: 'http', endpoint: '/webservice/ponto' },
    ],
  },
  {
    manufacturer: 'zkteco',
    label: 'ZKTeco',
    models: [
      { value: 'k40', label: 'K40', port: 80, protocol: 'http', endpoint: '/iclock/cdata' },
      { value: 'k50', label: 'K50', port: 80, protocol: 'http', endpoint: '/iclock/cdata' },
      { value: 'mb10', label: 'MB10-VL', port: 80, protocol: 'http', endpoint: '/iclock/cdata' },
      { value: 'speedface', label: 'SpeedFace', port: 80, protocol: 'http', endpoint: '/iclock/cdata' },
      { value: 'uface800', label: 'UFace 800', port: 80, protocol: 'http', endpoint: '/iclock/cdata' },
    ],
  },
  {
    manufacturer: 'anviz',
    label: 'Anviz',
    models: [
      { value: 'c2pro', label: 'C2 Pro', port: 80, protocol: 'http', endpoint: '/api/transaction' },
      { value: 'facepass7', label: 'FacePass 7', port: 80, protocol: 'http', endpoint: '/api/transaction' },
      { value: 'w2pro', label: 'W2 Pro', port: 80, protocol: 'http', endpoint: '/api/transaction' },
    ],
  },
  {
    manufacturer: 'suprema',
    label: 'Suprema (BioStar)',
    models: [
      { value: 'biostation2', label: 'BioStation 2', port: 443, protocol: 'https', endpoint: '/api/v2/events' },
      { value: 'bioentry', label: 'BioEntry W2', port: 443, protocol: 'https', endpoint: '/api/v2/events' },
      { value: 'facelite', label: 'FaceLite', port: 443, protocol: 'https', endpoint: '/api/v2/events' },
    ],
  },
  {
    manufacturer: 'trix',
    label: 'Trix',
    models: [
      { value: 'ss_710', label: 'SS 710', port: 80, protocol: 'http', endpoint: '/api/v1/marcacoes' },
      { value: 'ss_810', label: 'SS 810', port: 80, protocol: 'http', endpoint: '/api/v1/marcacoes' },
    ],
  },
  {
    manufacturer: 'rwtech',
    label: 'RWTech',
    models: [
      { value: 'rw_bio', label: 'RW Bio', port: 80, protocol: 'http', endpoint: '/api/records' },
      { value: 'rw_facial', label: 'RW Facial', port: 80, protocol: 'http', endpoint: '/api/records' },
    ],
  },
  {
    manufacturer: 'hikvision',
    label: 'Hikvision',
    models: [
      { value: 'ds_k1t671m', label: 'DS-K1T671M', port: 80, protocol: 'http', endpoint: '/ISAPI/AccessControl/AcsEvent' },
      { value: 'ds_k1t341', label: 'DS-K1T341', port: 80, protocol: 'http', endpoint: '/ISAPI/AccessControl/AcsEvent' },
    ],
  },
  {
    manufacturer: 'intelbras',
    label: 'Intelbras',
    models: [
      { value: 'ss_411', label: 'SS 411', port: 80, protocol: 'http', endpoint: '/api/records' },
      { value: 'ss_611', label: 'SS 611', port: 80, protocol: 'http', endpoint: '/api/records' },
    ],
  },
  {
    manufacturer: 'generic',
    label: 'Genérico (HTTP)',
    models: [
      { value: 'generic_http', label: 'HTTP/REST Genérico', port: 80, protocol: 'http', endpoint: '/' },
      { value: 'generic_https', label: 'HTTPS/REST Genérico', port: 443, protocol: 'https', endpoint: '/' },
    ],
  },
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

interface PendingRecord {
  id: string;
  equipment_id: string;
  employee_identifier: string;
  recorded_at: string;
  record_type: string | null;
  is_processed: boolean;
  processed_at: string | null;
  profile_id: string | null;
  created_at: string;
  time_clock_equipment?: {
    name: string;
  };
  profiles?: {
    full_name: string;
    registration_number: string | null;
  } | null;
}

interface EmployeeProfile {
  id: string;
  full_name: string;
  registration_number: string | null;
  pis: string | null;
  cpf: string | null;
}

const defaultEquipment: Partial<Equipment> = {
  name: '',
  manufacturer: '',
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
  const [copied, setCopied] = useState(false);
  const [selectedEquipmentForEmployees, setSelectedEquipmentForEmployees] = useState<string | null>(null);
  const [selectedEmployeesToSend, setSelectedEmployeesToSend] = useState<string[]>([]);
  const [deviceEmployees, setDeviceEmployees] = useState<any[]>([]);

  // Get server URL for configuration help
  const serverUrl = 'https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/equipment-sync';

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

  // Fetch pending records
  const { data: pendingRecords = [], refetch: refetchPendingRecords } = useQuery({
    queryKey: ['pending-records', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_pending_records')
        .select(`
          *,
          time_clock_equipment (name),
          profiles (full_name, registration_number)
        `)
        .order('recorded_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      return data as PendingRecord[];
    },
    enabled: !!profile,
  });

  // Fetch employees for linking
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-linking', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, registration_number, pis, cpf')
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      return data as EmployeeProfile[];
    },
    enabled: !!profile,
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipment_pending_records',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-records'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Get selected manufacturer and model info
  const selectedManufacturer = EQUIPMENT_CATALOG.find(m => m.manufacturer === editingEquipment.manufacturer);
  const selectedModel = selectedManufacturer?.models.find(m => m.value === editingEquipment.model);

  // Update equipment settings when model changes
  const handleModelChange = (modelValue: string) => {
    const model = selectedManufacturer?.models.find(m => m.value === modelValue);
    if (model) {
      setEditingEquipment({
        ...editingEquipment,
        model: modelValue,
        port: model.port,
        protocol: model.protocol,
        api_endpoint: model.endpoint,
      });
    }
  };

  // Handle manufacturer change
  const handleManufacturerChange = (manufacturerValue: string) => {
    const manufacturer = EQUIPMENT_CATALOG.find(m => m.manufacturer === manufacturerValue);
    setEditingEquipment({
      ...editingEquipment,
      manufacturer: manufacturerValue,
      model: '',
      port: manufacturer?.models[0]?.port || 80,
      protocol: manufacturer?.models[0]?.protocol || 'http',
      api_endpoint: manufacturer?.models[0]?.endpoint || '',
    });
  };

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

  // Link pending record to employee mutation
  const linkEmployeeMutation = useMutation({
    mutationFn: async ({ recordId, profileId }: { recordId: string; profileId: string }) => {
      const { error } = await supabase
        .from('equipment_pending_records')
        .update({ 
          profile_id: profileId,
          is_processed: false // Mark as not processed so it can be re-processed
        })
        .eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-records'] });
      toast.success('Funcionário vinculado com sucesso. O registro será processado na próxima sincronização.');
    },
    onError: (error) => {
      toast.error(`Erro ao vincular funcionário: ${error.message}`);
    },
  });

  // Delete pending record mutation
  const deletePendingRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment_pending_records')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-records'] });
      toast.success('Registro removido com sucesso');
    },
    onError: (error) => {
      toast.error(`Erro ao remover registro: ${error.message}`);
    },
  });

  // Send employees to device mutation
  const sendEmployeesMutation = useMutation({
    mutationFn: async ({ equipmentId, profileIds }: { equipmentId: string; profileIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke('equipment-sync', {
        body: { action: 'send_employees', equipmentId, profileIds },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Enviados ${data.sent} funcionários, ${data.errors} erros`);
      setSelectedEmployeesToSend([]);
    },
    onError: (error) => {
      toast.error(`Erro ao enviar funcionários: ${error.message}`);
    },
  });

  // Receive employees from device mutation
  const receiveEmployeesMutation = useMutation({
    mutationFn: async (equipmentId: string) => {
      const { data, error } = await supabase.functions.invoke('equipment-sync', {
        body: { action: 'receive_employees', equipmentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setDeviceEmployees(data.employees || []);
        toast.success(`Recebidos ${data.employees?.length || 0} funcionários do dispositivo`);
      } else {
        toast.error(data.error || 'Erro ao receber funcionários');
      }
    },
    onError: (error) => {
      toast.error(`Erro ao receber funcionários: ${error.message}`);
    },
  });

  // Delete employee from device mutation
  const deleteFromDeviceMutation = useMutation({
    mutationFn: async ({ equipmentId, identifier }: { equipmentId: string; identifier: string }) => {
      const { data, error } = await supabase.functions.invoke('equipment-sync', {
        body: { action: 'delete_employee', equipmentId, identifier },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Funcionário removido do dispositivo');
        // Refresh device employees list
        if (selectedEquipmentForEmployees) {
          receiveEmployeesMutation.mutate(selectedEquipmentForEmployees);
        }
      } else {
        toast.error(data.error || 'Erro ao remover funcionário');
      }
    },
    onError: (error) => {
      toast.error(`Erro ao remover funcionário: ${error.message}`);
    },
  });

  const handleEdit = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingEquipment.name || !editingEquipment.ip_address || !editingEquipment.manufacturer) {
      toast.error('Nome, fabricante e endereço IP são obrigatórios');
      return;
    }
    saveMutation.mutate(editingEquipment);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copiado para a área de transferência');
  };

  const getManufacturerLabel = (value: string) => {
    return EQUIPMENT_CATALOG.find(m => m.manufacturer === value)?.label || value;
  };

  const getModelLabel = (manufacturer: string, model: string) => {
    const mfr = EQUIPMENT_CATALOG.find(m => m.manufacturer === manufacturer);
    return mfr?.models.find(m => m.value === model)?.label || model;
  };

  const onlineCount = equipments.filter(e => e.is_online).length;
  const offlineCount = equipments.filter(e => !e.is_online && e.is_active).length;
  const pendingWithoutEmployee = pendingRecords.filter(r => !r.profile_id && !r.is_processed).length;
  const pendingProcessed = pendingRecords.filter(r => r.is_processed).length;
  const pendingNotProcessed = pendingRecords.filter(r => !r.is_processed).length;

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
                {/* Name - Text input */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Equipamento *</Label>
                  <Input
                    id="name"
                    value={editingEquipment.name || ''}
                    onChange={(e) => setEditingEquipment({ ...editingEquipment, name: e.target.value })}
                    placeholder="REP Entrada Principal"
                  />
                </div>

                {/* Manufacturer - Dropdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Fabricante *</Label>
                    <Select
                      value={editingEquipment.manufacturer || ''}
                      onValueChange={handleManufacturerChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fabricante" />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_CATALOG.map((m) => (
                          <SelectItem key={m.manufacturer} value={m.manufacturer}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Model - Dropdown (depends on manufacturer) */}
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo *</Label>
                    <Select
                      value={editingEquipment.model || ''}
                      onValueChange={handleModelChange}
                      disabled={!editingEquipment.manufacturer}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedManufacturer?.models.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Serial Number - Text input */}
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Número de Série</Label>
                  <Input
                    id="serial_number"
                    value={editingEquipment.serial_number || ''}
                    onChange={(e) => setEditingEquipment({ ...editingEquipment, serial_number: e.target.value })}
                    placeholder="Ex: ABC123456"
                  />
                </div>

                {/* IP Address - Text input */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ip_address">Endereço IP do Equipamento *</Label>
                    <Input
                      id="ip_address"
                      value={editingEquipment.ip_address || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, ip_address: e.target.value })}
                      placeholder="192.168.1.100"
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

                {/* Credentials (optional) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuário (se necessário)</Label>
                    <Input
                      id="username"
                      value={editingEquipment.username || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, username: e.target.value })}
                      placeholder="admin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha (se necessário)</Label>
                    <Input
                      id="password"
                      type="password"
                      value={editingEquipment.password || ''}
                      onChange={(e) => setEditingEquipment({ ...editingEquipment, password: e.target.value })}
                    />
                  </div>
                </div>

                {/* Auto-configured fields (read-only info) */}
                {selectedModel && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Configuração Automática</AlertTitle>
                    <AlertDescription>
                      Os seguintes parâmetros foram configurados automaticamente para o modelo selecionado:
                      <ul className="mt-2 text-sm space-y-1">
                        <li><strong>Porta:</strong> {selectedModel.port}</li>
                        <li><strong>Protocolo:</strong> {selectedModel.protocol.toUpperCase()}</li>
                        <li><strong>Endpoint:</strong> {selectedModel.endpoint}</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={editingEquipment.is_active ?? true}
                    onCheckedChange={(checked) => setEditingEquipment({ ...editingEquipment, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Equipamento Ativo</Label>
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
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="equipment">Equipamentos</TabsTrigger>
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-1" />
            Funcionários no REP
          </TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            <FileWarning className="h-4 w-4 mr-1" />
            Registros Pendentes
            {pendingWithoutEmployee > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5 text-xs">
                {pendingWithoutEmployee}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">Logs de Comunicação</TabsTrigger>
          <TabsTrigger value="help">
            <HelpCircle className="h-4 w-4 mr-1" />
            Ajuda de Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Equipamentos</CardTitle>
              <CardDescription>
                Relógios de ponto cadastrados no sistema. A sincronização automática ocorre a cada minuto.
              </CardDescription>
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
                      <TableHead>Fabricante / Modelo</TableHead>
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
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{getManufacturerLabel(equipment.manufacturer)}</span>
                            <span className="text-sm text-muted-foreground">
                              {getModelLabel(equipment.manufacturer, equipment.model)}
                            </span>
                          </div>
                        </TableCell>
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

        <TabsContent value="employees">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Send Employees to Device */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Enviar Funcionários para o REP
                </CardTitle>
                <CardDescription>
                  Selecione o equipamento e os funcionários para enviar ao relógio de ponto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecione o Equipamento</Label>
                  <Select
                    value={selectedEquipmentForEmployees || ''}
                    onValueChange={(value) => {
                      setSelectedEquipmentForEmployees(value);
                      setDeviceEmployees([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um equipamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipments.filter(e => e.is_active).map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.name} ({eq.ip_address})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEquipmentForEmployees && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Funcionários do Sistema</Label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedEmployeesToSend(employees.map(e => e.id))}
                          >
                            Selecionar Todos
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedEmployeesToSend([])}
                          >
                            Limpar
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-lg max-h-64 overflow-y-auto">
                        {employees.map((emp) => (
                          <div
                            key={emp.id}
                            className="flex items-center gap-3 p-2 hover:bg-muted/50 border-b last:border-b-0"
                          >
                            <Checkbox
                              checked={selectedEmployeesToSend.includes(emp.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedEmployeesToSend([...selectedEmployeesToSend, emp.id]);
                                } else {
                                  setSelectedEmployeesToSend(selectedEmployeesToSend.filter(id => id !== emp.id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{emp.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {emp.registration_number ? `Mat: ${emp.registration_number}` : ''}
                                {emp.pis ? ` | PIS: ${emp.pis}` : ''}
                                {emp.cpf ? ` | CPF: ${emp.cpf}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        if (selectedEquipmentForEmployees && selectedEmployeesToSend.length > 0) {
                          sendEmployeesMutation.mutate({
                            equipmentId: selectedEquipmentForEmployees,
                            profileIds: selectedEmployeesToSend,
                          });
                        }
                      }}
                      disabled={sendEmployeesMutation.isPending || selectedEmployeesToSend.length === 0}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {sendEmployeesMutation.isPending ? 'Enviando...' : `Enviar ${selectedEmployeesToSend.length} Funcionário(s)`}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Receive/Delete Employees from Device */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Funcionários no Dispositivo
                </CardTitle>
                <CardDescription>
                  Visualize e gerencie os funcionários cadastrados no relógio de ponto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedEquipmentForEmployees ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Selecione um equipamento para visualizar os funcionários cadastrados.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        if (selectedEquipmentForEmployees) {
                          receiveEmployeesMutation.mutate(selectedEquipmentForEmployees);
                        }
                      }}
                      disabled={receiveEmployeesMutation.isPending}
                      variant="outline"
                      className="w-full"
                    >
                      <Download className={`h-4 w-4 mr-2 ${receiveEmployeesMutation.isPending ? 'animate-spin' : ''}`} />
                      {receiveEmployeesMutation.isPending ? 'Buscando...' : 'Buscar Funcionários do Dispositivo'}
                    </Button>

                    {deviceEmployees.length > 0 ? (
                      <div className="border rounded-lg max-h-80 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Identificador</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead>Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {deviceEmployees.map((emp, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-sm">{emp.identifier}</TableCell>
                                <TableCell>{emp.name || '-'}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      if (confirm(`Tem certeza que deseja remover ${emp.name || emp.identifier} do dispositivo?`)) {
                                        deleteFromDeviceMutation.mutate({
                                          equipmentId: selectedEquipmentForEmployees!,
                                          identifier: emp.identifier,
                                        });
                                      }
                                    }}
                                    disabled={deleteFromDeviceMutation.isPending}
                                    title="Remover do dispositivo"
                                  >
                                    <UserMinus className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        Clique em "Buscar Funcionários" para listar os funcionários cadastrados no dispositivo
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Instructions */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Como Funciona
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <Upload className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h5 className="font-medium">Enviar Funcionários</h5>
                    <p className="text-sm text-muted-foreground">
                      Envia o cadastro dos funcionários selecionados para o relógio de ponto, usando a matrícula como identificador principal.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                    <Download className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h5 className="font-medium">Receber Funcionários</h5>
                    <p className="text-sm text-muted-foreground">
                      Busca a lista de funcionários cadastrados diretamente no relógio de ponto.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
                    <UserMinus className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <h5 className="font-medium">Remover Funcionários</h5>
                    <p className="text-sm text-muted-foreground">
                      Remove o cadastro de um funcionário específico do relógio de ponto.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5" />
                Registros Pendentes dos Equipamentos
              </CardTitle>
              <CardDescription>
                Registros importados dos relógios de ponto. Vincule funcionários aos registros que não foram identificados automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Status cards for pending records */}
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Registros</p>
                        <p className="text-2xl font-bold">{pendingRecords.length}</p>
                      </div>
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 dark:bg-green-950">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Processados</p>
                        <p className="text-2xl font-bold text-green-600">{pendingProcessed}</p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 dark:bg-orange-950">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Sem Funcionário</p>
                        <p className="text-2xl font-bold text-orange-600">{pendingWithoutEmployee}</p>
                      </div>
                      <XCircle className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {pendingWithoutEmployee > 0 && (
                <Alert className="mb-4">
                  <User className="h-4 w-4" />
                  <AlertTitle>Registros sem funcionário vinculado</AlertTitle>
                  <AlertDescription>
                    Existem {pendingWithoutEmployee} registros que não foram vinculados automaticamente. 
                    A vinculação é feita prioritariamente pelo <strong>número de matrícula</strong>, seguido pelo PIS e CPF.
                    Você pode vincular manualmente selecionando o funcionário na coluna "Ações".
                  </AlertDescription>
                </Alert>
              )}

              {pendingRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro pendente encontrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Identificador</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRecords.map((record) => (
                      <TableRow key={record.id} className={!record.profile_id && !record.is_processed ? 'bg-orange-50 dark:bg-orange-950/30' : ''}>
                        <TableCell>
                          {record.is_processed ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Processado
                            </Badge>
                          ) : record.profile_id ? (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Aguardando
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Sem Funcionário
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.time_clock_equipment?.name || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.employee_identifier}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.recorded_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {record.profiles ? (
                            <div className="flex flex-col">
                              <span>{record.profiles.full_name}</span>
                              {record.profiles.registration_number && (
                                <span className="text-xs text-muted-foreground">
                                  Matrícula: {record.profiles.registration_number}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Não identificado</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!record.profile_id && !record.is_processed && (
                              <Select
                                onValueChange={(value) => {
                                  linkEmployeeMutation.mutate({ recordId: record.id, profileId: value });
                                }}
                              >
                                <SelectTrigger className="w-[180px] h-8">
                                  <SelectValue placeholder="Vincular funcionário" />
                                </SelectTrigger>
                                <SelectContent>
                                  {employees.map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                      <div className="flex flex-col">
                                        <span>{emp.full_name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {emp.registration_number ? `Mat: ${emp.registration_number}` : ''}
                                          {emp.pis ? ` | PIS: ${emp.pis}` : ''}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja remover este registro pendente?')) {
                                  deletePendingRecordMutation.mutate(record.id);
                                }
                              }}
                              title="Remover registro"
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

        <TabsContent value="help">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Configuração do Relógio de Ponto
                </CardTitle>
                <CardDescription>
                  Siga as instruções abaixo para configurar seu relógio de ponto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>URL do Servidor</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">Configure o seguinte endereço no seu relógio de ponto:</p>
                    <div className="flex items-center gap-2 bg-muted p-3 rounded-md font-mono text-sm">
                      <span className="flex-1 break-all">{serverUrl}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(serverUrl)}
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <h4 className="font-semibold">Passos para Configuração:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Acesse o menu de configurações do seu relógio de ponto</li>
                    <li>Localize a opção de comunicação (WebService, HTTP, PUSH, etc.)</li>
                    <li>Configure a URL do servidor conforme mostrado acima</li>
                    <li>Defina o intervalo de comunicação (recomendado: 1 minuto)</li>
                    <li>Salve as configurações e reinicie o equipamento</li>
                    <li>Cadastre o equipamento neste sistema com o IP do relógio</li>
                    <li>Teste a conexão usando o botão de sincronização</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Sincronização Automática
                </CardTitle>
                <CardDescription>
                  Como funciona a comunicação 24h
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                      <RefreshCw className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h5 className="font-medium">Sincronização a Cada Minuto</h5>
                      <p className="text-sm text-muted-foreground">
                        O sistema verifica automaticamente todos os equipamentos ativos a cada minuto, 24 horas por dia.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h5 className="font-medium">Importação Automática</h5>
                      <p className="text-sm text-muted-foreground">
                        Os registros de ponto são importados automaticamente para o sistema e vinculados aos funcionários.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-full">
                      <Wifi className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h5 className="font-medium">Monitoramento em Tempo Real</h5>
                      <p className="text-sm text-muted-foreground">
                        O status de cada equipamento é atualizado em tempo real na interface.
                      </p>
                    </div>
                  </div>
                </div>

                <Alert variant="default">
                  <HelpCircle className="h-4 w-4" />
                  <AlertTitle>Dica</AlertTitle>
                  <AlertDescription>
                    Certifique-se de que o relógio de ponto está na mesma rede ou tem acesso à internet para se comunicar com o servidor.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Fabricantes Suportados</CardTitle>
                <CardDescription>
                  Lista de fabricantes e modelos compatíveis com o sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {EQUIPMENT_CATALOG.map((manufacturer) => (
                    <div key={manufacturer.manufacturer} className="border rounded-lg p-3">
                      <h5 className="font-semibold mb-2">{manufacturer.label}</h5>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {manufacturer.models.map((model) => (
                          <li key={model.value}>• {model.label}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
