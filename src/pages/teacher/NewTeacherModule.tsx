import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  GraduationCap, 
  Users, 
  Clock, 
  Calendar as CalendarIcon,
  FileText,
  Settings,
  BookOpen,
  LayoutGrid,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';

// Sub-components
import TeacherConfigurations from './TeacherConfigurations';
import TeacherAssignments from './TeacherAssignments';
import TeacherScheduleBoard, { educatorTypes, teachingLevels } from '@/components/teachers/TeacherScheduleBoard';

interface TeacherConfiguration {
  id: string;
  name: string;
  duration_minutes: number;
  hourly_rate: number | null;
  description: string | null;
  is_active: boolean;
  contract_type: string | null;
  weekly_class_hours: number | null;
  monthly_class_hours: number | null;
  min_interval_between_classes: number | null;
  max_consecutive_classes: number | null;
  night_class_start: string | null;
  night_class_end: string | null;
  night_class_rate_multiplier: number | null;
  activity_hours_percent: number | null;
  preparation_minutes_per_class: number | null;
}

interface WorkSchedule {
  id: string;
  name: string;
  scale_type: string | null;
  workload_type: string | null;
}

interface TeacherAssignment {
  id: string;
  profile_id: string;
  class_hour_configuration_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  contract_weekly_hours: number | null;
  contract_monthly_hours: number | null;
  contract_type: string | null;
  work_schedule_id: string | null;
  educator_type: string | null;
  teaching_level: string | null;
  subject: string | null;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
  class_hour_configuration?: TeacherConfiguration;
  work_schedule?: WorkSchedule;
}

interface ClassRecord {
  id: string;
  profile_id: string;
  class_hour_configuration_id: string;
  class_date: string;
  number_of_classes: number;
  total_minutes: number;
  notes: string | null;
  profile?: {
    full_name: string;
  };
  class_hour_configuration?: TeacherConfiguration;
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

interface NewTeacherModuleProps {
  defaultTab?: string;
}

export default function NewTeacherModule({ defaultTab = 'overview' }: NewTeacherModuleProps) {
  const { profile } = useAuth();
  
  useSEO({
    title: 'Módulo Professor | Ponto Max',
    description: 'Gestão completa de professores: hora aula, hora atividade, quadro de horários e espelho de ponto.',
  });

  const [configurations, setConfigurations] = useState<TeacherConfiguration[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [records, setRecords] = useState<ClassRecord[]>([]);
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
        supabase.from('class_hour_configurations').select('*').order('name'),
        supabase.from('employee_class_hour_assignments').select(`
          *,
          profile:profiles(full_name, registration_number),
          class_hour_configuration:class_hour_configurations(*),
          work_schedule:work_schedules(id, name, scale_type, workload_type)
        `).order('created_at', { ascending: false }),
        supabase.from('class_records').select(`
          *,
          profile:profiles(full_name),
          class_hour_configuration:class_hour_configurations(*)
        `).gte('class_date', startDate).lte('class_date', endDate).order('class_date', { ascending: false }),
        supabase.from('profiles').select('id, full_name, registration_number, pis, cpf, position, department').eq('is_active', true).order('full_name'),
        supabase.from('work_schedules').select('id, name, scale_type, workload_type').order('name'),
      ]);

      if (configsRes.data) setConfigurations(configsRes.data as unknown as TeacherConfiguration[]);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as TeacherAssignment[]);
      if (recordsRes.data) setRecords(recordsRes.data as unknown as ClassRecord[]);
      if (employeesRes.data) setEmployees(employeesRes.data as unknown as Profile[]);
      if (schedulesRes.data) setSchedules(schedulesRes.data as unknown as WorkSchedule[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const totalTeachers = assignments.length;
    const totalClasses = records.reduce((sum, r) => sum + r.number_of_classes, 0);
    const totalHours = records.reduce((sum, r) => sum + r.total_minutes, 0) / 60;
    const activeConfigs = configurations.filter(c => c.is_active).length;

    return { totalTeachers, totalClasses, totalHours, activeConfigs };
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
          <p className="text-muted-foreground">Carregando módulo professor...</p>
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
              <GraduationCap className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Módulo Professor
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de professores, hora aula e quadro de horários
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Navigation */}
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
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Professores</p>
                <p className="text-2xl lg:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalTeachers}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Aulas</p>
                <p className="text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.totalClasses}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <BookOpen className="h-5 w-5 lg:h-6 lg:w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Aula</p>
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
            <TabsTrigger value="teachers" className="gap-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Professores</span>
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

          {/* Search */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar professor, disciplina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Teachers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Professores Atribuídos
                </CardTitle>
                <CardDescription>
                  Professores com configuração de hora aula ativa
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
                            {assignment.profile?.full_name?.charAt(0) || 'P'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {assignment.profile?.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {assignment.subject || 'Disciplina não definida'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {assignment.educator_type 
                            ? educatorTypes[assignment.educator_type as keyof typeof educatorTypes]?.split(' - ')[0] || assignment.educator_type
                            : 'PEB'
                          }
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {assignment.contract_weekly_hours ? `${assignment.contract_weekly_hours}h/sem` : 'Horista'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {assignments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum professor atribuído</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Classes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Aulas Recentes
                </CardTitle>
                <CardDescription>
                  Registros de aulas do período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {records.slice(0, 5).map((record) => (
                    <div 
                      key={record.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-green-600">
                            {record.number_of_classes}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {record.profile?.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {record.class_hour_configuration?.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {format(new Date(record.class_date), 'dd/MM', { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {record.total_minutes} min
                        </p>
                      </div>
                    </div>
                  ))}
                  {records.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum registro de aula</p>
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
                Configurações de Hora Aula
              </CardTitle>
              <CardDescription>
                Parâmetros configurados para cálculo de hora aula
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {configurations.map((config) => (
                  <div 
                    key={config.id} 
                    className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{config.name}</h4>
                      <Badge variant={config.is_active ? 'default' : 'secondary'} className="text-xs">
                        {config.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Duração:</span>
                        <span className="font-medium text-foreground">{config.duration_minutes} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Hora Atividade:</span>
                        <span className="font-medium text-foreground">{config.activity_hours_percent || 33.33}%</span>
                      </div>
                      {config.hourly_rate && (
                        <div className="flex justify-between">
                          <span>Valor/hora:</span>
                          <span className="font-medium text-foreground">R$ {config.hourly_rate.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {configurations.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma configuração cadastrada</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teachers Tab */}
        <TabsContent value="teachers" className="mt-0">
          <TeacherAssignments
            assignments={assignments}
            configurations={configurations}
            employees={employees}
            schedules={schedules}
            onRefresh={fetchData}
          />
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-0">
          <TeacherScheduleBoard
            assignments={assignments}
            employees={employees}
            onRefresh={fetchData}
          />
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="mt-0">
          <TeacherConfigurations
            configurations={configurations}
            onRefresh={fetchData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
