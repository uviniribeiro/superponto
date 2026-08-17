import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity,
  MapPin, 
  Users, 
  UserCheck, 
  UserX, 
  Search, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Clock,
  AlertTriangle,
  Building2
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

interface EmployeePresence {
  id: string;
  full_name: string;
  department: string;
  position: string;
  is_present: boolean;
  last_record_time?: string;
  last_record_type?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export default function PresenceMonitoring() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  // Fetch employees with today's records
  const { data: employees = [], isLoading, refetch } = useQuery({
    queryKey: ['presence-monitoring', profile?.company_id],
    queryFn: async () => {
      // Get all active employees
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, department, position')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Get today's time records
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: records, error: recordsError } = await supabase
        .from('time_records')
        .select('profile_id, recorded_at, record_type, latitude, longitude, address')
        .eq('company_id', profile?.company_id)
        .gte('recorded_at', `${today}T00:00:00`)
        .order('recorded_at', { ascending: false });

      if (recordsError) throw recordsError;

      // Map employees with their presence status
      const employeePresence: EmployeePresence[] = (profiles || []).map(emp => {
        const empRecords = records?.filter(r => r.profile_id === emp.id) || [];
        const lastRecord = empRecords[0];
        
        // Determine if present: has entry and no final exit
        const entryCount = empRecords.filter(r => r.record_type === 'entry').length;
        const exitCount = empRecords.filter(r => r.record_type === 'exit').length;
        const isPresent = entryCount > exitCount;

        return {
          ...emp,
          is_present: isPresent,
          last_record_time: lastRecord?.recorded_at,
          last_record_type: lastRecord?.record_type,
          latitude: lastRecord?.latitude,
          longitude: lastRecord?.longitude,
          address: lastRecord?.address
        };
      });

      return employeePresence;
    },
    enabled: !!profile?.company_id,
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch equipment status
  const { data: equipmentStatus = { online: 0, offline: 0, maintenance: 0 } } = useQuery({
    queryKey: ['equipment-status-summary', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_clock_equipment')
        .select('is_online, is_active')
        .eq('company_id', profile?.company_id);

      if (error) throw error;

      const online = data?.filter(e => e.is_online && e.is_active).length || 0;
      const offline = data?.filter(e => !e.is_online && e.is_active).length || 0;
      const maintenance = data?.filter(e => !e.is_active).length || 0;

      return { online, offline, maintenance };
    },
    enabled: !!profile?.company_id
  });

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           emp.department?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'present' && emp.is_present) ||
                           (filterStatus === 'absent' && !emp.is_present);
      const matchesDepartment = filterDepartment === 'all' || emp.department === filterDepartment;
      
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [employees, searchTerm, filterStatus, filterDepartment]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts);
  }, [employees]);

  const presentCount = employees.filter(e => e.is_present).length;
  const absentCount = employees.filter(e => !e.is_present).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <PageHeader
          icon={Activity}
          title="Central de Monitoramento"
          description="Acompanhamento em tempo real da presença dos servidores"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              Presentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{presentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-600" />
              Ausentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{absentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-600" />
              REP Online
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{equipmentStatus.online}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-red-600" />
              REP Offline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{equipmentStatus.offline}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou departamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="present">Presentes</SelectItem>
                <SelectItem value="absent">Ausentes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Departamentos</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept || 'sem-depto'}>{dept || 'Sem Departamento'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle>Servidores</CardTitle>
          <CardDescription>
            Mostrando {filteredEmployees.length} de {employees.length} servidores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum servidor encontrado com os filtros aplicados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Último Registro</TableHead>
                  <TableHead>Localização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      {emp.is_present ? (
                        <Badge className="bg-green-500">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Presente
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <UserX className="h-3 w-3 mr-1" />
                          Ausente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {emp.department || '-'}
                      </div>
                    </TableCell>
                    <TableCell>{emp.position || '-'}</TableCell>
                    <TableCell>
                      {emp.last_record_time ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(emp.last_record_time), 'HH:mm', { locale: ptBR })}
                          <Badge variant="outline" className="ml-1 text-xs">
                            {emp.last_record_type === 'entry' ? 'Entrada' : 'Saída'}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sem registro</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.latitude && emp.longitude ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">
                            {emp.address || `${emp.latitude.toFixed(4)}, ${emp.longitude.toFixed(4)}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
