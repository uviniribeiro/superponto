import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Equipment manufacturers and their models
export const EQUIPMENT_CATALOG = [
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
  // BIOMTECH - Brazilian manufacturer (facial recognition pioneer)
  {
    manufacturer: 'biomtech',
    label: 'Biomtech',
    models: [
      { value: 'faceschool', label: 'faceSchool', port: 443, protocol: 'https', endpoint: '/api/v1/attendance' },
      { value: 'facejus', label: 'faceJus', port: 443, protocol: 'https', endpoint: '/api/v1/attendance' },
      { value: 'facepoint', label: 'facePoint', port: 443, protocol: 'https', endpoint: '/api/v1/attendance' },
      { value: 'facecorp', label: 'faceCorp', port: 443, protocol: 'https', endpoint: '/api/v1/attendance' },
      { value: 'facepass', label: 'facePass', port: 443, protocol: 'https', endpoint: '/api/v1/access' },
      { value: 'biomtech_terminal', label: 'Terminal Biomtech', port: 443, protocol: 'https', endpoint: '/api/v1/attendance' },
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

export interface Equipment {
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
  // Portaria compliance fields
  portaria_compliance?: 'portaria_671' | 'portaria_1510' | 'portaria_373' | null;
  rep_number?: string | null;
}

export interface CommunicationLog {
  id: string;
  equipment_id: string;
  status: string;
  message: string | null;
  request_type: string | null;
  records_synced: number;
  created_at: string;
}

export interface PendingRecord {
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

export interface EmployeeProfile {
  id: string;
  full_name: string;
  registration_number: string | null;
  pis: string | null;
  cpf: string | null;
}

export const defaultEquipment: Partial<Equipment> = {
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
  portaria_compliance: 'portaria_671',
  rep_number: '',
};

// Portaria compliance options
export const PORTARIA_OPTIONS = [
  { value: 'portaria_671', label: 'Portaria 671 (REP-P/REP-A/REP-C)' },
  { value: 'portaria_1510', label: 'Portaria 1510 (REP Convencional)' },
  { value: 'portaria_373', label: 'Portaria 373 (Alternativo)' },
];

export function getManufacturerLabel(value: string) {
  return EQUIPMENT_CATALOG.find(m => m.manufacturer === value)?.label || value;
}

export function getModelLabel(manufacturer: string, model: string) {
  const mfr = EQUIPMENT_CATALOG.find(m => m.manufacturer === manufacturer);
  return mfr?.models.find(m => m.value === model)?.label || model;
}

export function useEquipmentData() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

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
    refetchInterval: 30000, // Refetch every 30 seconds for real-time status
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
          is_processed: false
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
    onError: (error) => {
      toast.error(`Erro ao remover funcionário: ${error.message}`);
    },
  });

  const onlineCount = equipments.filter(e => e.is_online).length;
  const offlineCount = equipments.filter(e => !e.is_online && e.is_active).length;
  const pendingWithoutEmployee = pendingRecords.filter(r => !r.profile_id && !r.is_processed).length;
  const pendingProcessed = pendingRecords.filter(r => r.is_processed).length;
  const pendingNotProcessed = pendingRecords.filter(r => !r.is_processed).length;

  return {
    equipments,
    isLoading,
    pendingRecords,
    refetchPendingRecords,
    employees,
    onlineCount,
    offlineCount,
    pendingWithoutEmployee,
    pendingProcessed,
    pendingNotProcessed,
    saveMutation,
    deleteMutation,
    testConnectionMutation,
    syncAllMutation,
    linkEmployeeMutation,
    deletePendingRecordMutation,
    sendEmployeesMutation,
    receiveEmployeesMutation,
    deleteFromDeviceMutation,
    profile,
    queryClient,
  };
}

export function useEquipmentLogs(equipmentId: string | null) {
  const { data: logs = [] } = useQuery({
    queryKey: ['equipment-logs', equipmentId],
    queryFn: async () => {
      if (!equipmentId) return [];
      const { data, error } = await supabase
        .from('equipment_communication_logs')
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as CommunicationLog[];
    },
    enabled: !!equipmentId,
  });

  return { logs };
}

export function useAllEquipmentLogs() {
  const { profile } = useAuth();
  
  const { data: logs = [] } = useQuery({
    queryKey: ['all-equipment-logs', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_communication_logs')
        .select(`
          *,
          time_clock_equipment (name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  return { logs };
}
