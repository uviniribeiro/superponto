import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Stethoscope, 
  Users, 
  Clock, 
  Calendar as CalendarIcon,
  Settings,
  LayoutGrid,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Activity
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';
import DoctorConfigurations from './DoctorConfigurations';
import DoctorAssignments from './DoctorAssignments';
import DoctorScheduleBoard from '@/components/doctors/DoctorScheduleBoard';

interface ShiftConfiguration {
  id: string;
  name: string;
  duration_hours: number;
  hourly_rate: number | null;
  description: string | null;
  is_active: boolean;
  night_shift_start: string | null;
  night_shift_end: string | null;
  night_shift_rate_multiplier: number | null;
  weekend_rate_multiplier: number | null;
  holiday_rate_multiplier: number | null;
  max_consecutive_hours: number | null;
  min_rest_hours: number | null;
}

interface WorkSchedule {
  id: string;
  name: string;
  scale_type: string | null;
  workload_type: string | null;
}

interface DoctorAssignment {
  id: string;
  profile_id: string;
  shift_configuration_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  contract_weekly_hours: number | null;
  contract_monthly_hours: number | null;
  contract_type: string | null;
  work_schedule_id: string | null;
  specialty: string | null;
  crm: string | null;
  crm_state: string | null;
  health_unit: string | null;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
  shift_configuration?: ShiftConfiguration;
  work_schedule?: WorkSchedule;
}

interface ShiftRecord {
  id: string;
  profile_id: string;
  shift_configuration_id: string;
  shift_date: string;
  total_hours: number;
  shift_type: string | null;
  is_night_shift: boolean;
  is_weekend: boolean;
  is_holiday: boolean;
  notes: string | null;
  profile?: {
    full_name: string;
  };
  shift_configuration?: ShiftConfiguration;
}

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
  pis: string | null;
  cpf: string | null;
  position: string | null;
  department: string | null;
}

interface DoctorModuleProps {
  defaultTab?: string;
}

export default function DoctorModule({ defaultTab = 'overview' }: DoctorModuleProps) {
  const { profile } = useAuth();
  
  useSEO({
    title: 'Módulo Médico | SuperPonto',
    description: 'Gestão completa de médicos: plantões, sobreaviso, quadro de horários e espelho de ponto.',
  });

  const [configurations, setConfigurations] = useState<ShiftConfiguration[]>([]);
  const [assignments, setAssignments] = useState<DoctorAssignment[]>([]);
  const [records, setRecords] = useState<ShiftRecord[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [filterMonth, setFilterMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [filterMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

      const [configsRes, assignmentsRes, recordsRes, employeesRes, schedulesRes] = await Promise.all([
        supabase.from('medical_shift_configurations').select('*').order('name'),
        supabase.from('doctor_assignments').select(`
          *,
          profile:profiles(full_name, registration_number),
          shift_configuration:medical_shift_configurations(*),
          work_schedule:work_schedules(id, name, scale_type, workload_type)
        `).order('created_at', { ascending: false }),
        supabase.from('medical_shift_records').select(`
          *,
          profile:profiles(full_name),
          shift_configuration:medical_shift_configurations(*)
        `).gte('shift_date', startDate).lte('shift_date', endDate).order('shift_date', { ascending: false }),
        supabase.from('profiles').select('id, full_name, registration_number, pis, cpf, position, department').eq('is_active', true).order('full_name'),
        supabase.from('work_schedules').select('id, name, scale_type, workload_type').order('name'),
      ]);

      if (configsRes.data) setConfigurations(configsRes.data as unknown as ShiftConfiguration[]);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as DoctorAssignment[]);
      if (recordsRes.data) setRecords(recordsRes.data as unknown as ShiftRecord[]);
      if (employeesRes.data) setEmployees(employeesRes.data as unknown as Profile[]);
      if (schedulesRes.data) setSchedules(schedulesRes.data as unknown as WorkSchedule[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalDoctors = assignments.length;
    const totalShifts = records.length;
    const totalHours = records.reduce((sum, r) => sum + r.total_hours, 0);
    const activeConfigs = configurations.filter(c => c.is_active).length;

    return { totalDoctors, totalShifts, totalHours, activeConfigs };
  }, [assignments, records, configurations]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(filterMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setFilterMonth(newDate);
  };

  if (loading && configurations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando módulo médico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Stethoscope className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Módulo Médico
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de médicos, plantões e quadro de horários
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-8 px-3 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={filterMonth}
                  onSelect={(date) => date && setFilterMonth(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData()}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Médicos</p>
                <p className="text-2xl lg:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.totalDoctors}
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plantões</p>
                <p className="text-2xl lg:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalShifts}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Activity className="h-5 w-5 lg:h-6 lg:w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Totais</p>
                <p className="text-2xl lg:text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.totalHours.toFixed(1)}h
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Configurações</p>
                <p className="text-2xl lg:text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.activeConfigs}
                </p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/10">
                <Settings className="h-5 w-5 lg:h-6 lg:w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <TabsList className="bg-muted/50 p-1 h-auto flex-wrap justify-start">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="doctors" className="gap-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Médicos</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2 data-[state=active]:bg-background">
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Quadro</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-background">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar médico, especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Médicos Atribuídos
                </CardTitle>
                <CardDescription>
                  Médicos com configuração de plantão ativa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {assignments.slice(0, 5).map((assignment) => (
                    <div 
                      key={assignment.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {assignment.profile?.full_name?.charAt(0) || 'M'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {assignment.profile?.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {assignment.specialty || 'Especialidade não definida'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {assignment.crm ? `CRM ${assignment.crm}/${assignment.crm_state}` : 'CRM não informado'}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {assignment.contract_weekly_hours ? `${assignment.contract_weekly_hours}h/sem` : 'Plantonista'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {assignments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum médico atribuído</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Plantões Recentes
                </CardTitle>
                <CardDescription>
                  Registros de plantões do período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {records.slice(0, 5).map((record) => (
                    <div 
                      key={record.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{record.profile?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(record.shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{record.total_hours}h</p>
                        <div className="flex gap-1 mt-1">
                          {record.is_night_shift && <Badge variant="secondary" className="text-xs">Noturno</Badge>}
                          {record.is_weekend && <Badge variant="outline" className="text-xs">FDS</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {records.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum plantão registrado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configurations Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configurações de Plantão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {configurations.slice(0, 6).map((config) => (
                  <div key={config.id} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{config.name}</p>
                      <Badge variant={config.is_active ? 'default' : 'secondary'}>
                        {config.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span>{config.duration_hours}h</span>
                      {config.hourly_rate && <span>R$ {config.hourly_rate.toFixed(2)}/h</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctors Tab */}
        <TabsContent value="doctors" className="mt-0">
          <DoctorAssignments 
            assignments={assignments}
            configurations={configurations}
            employees={employees}
            schedules={schedules}
            onRefresh={fetchData}
          />
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-0">
          <DoctorScheduleBoard 
            assignments={assignments}
            employees={employees}
            onRefresh={fetchData}
          />
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="mt-0">
          <DoctorConfigurations 
            configurations={configurations}
            onRefresh={fetchData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}