import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Plus, Pencil, Trash2, CalendarIcon, Clock, Users, BookOpen, 
  DollarSign, GraduationCap, Moon, AlertCircle, FileText, School
} from 'lucide-react';

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
}

const contractTypeLabels: Record<string, string> = {
  'hourly': 'Horista',
  'part_time': 'Tempo Parcial',
  'full_time': 'Tempo Integral',
};

export default function TeacherModule() {
  const { profile } = useAuth();
  
  const [configurations, setConfigurations] = useState<TeacherConfiguration[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [records, setRecords] = useState<ClassRecord[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);

  const [editingConfig, setEditingConfig] = useState<TeacherConfiguration | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<TeacherAssignment | null>(null);

  const [configForm, setConfigForm] = useState({
    name: '',
    duration_minutes: 50,
    hourly_rate: '',
    description: '',
    contract_type: 'hourly',
    weekly_class_hours: '',
    monthly_class_hours: '',
    min_interval_between_classes: 10,
    max_consecutive_classes: 4,
    night_class_start: '18:00',
    night_class_end: '22:00',
    night_class_rate_multiplier: 1.2,
    activity_hours_percent: 33.33,
    preparation_minutes_per_class: 10,
    has_night_classes: false,
  });

  const [assignmentForm, setAssignmentForm] = useState({
    profile_id: '',
    class_hour_configuration_id: '',
    start_date: new Date(),
    contract_type: 'hourly',
    contract_weekly_hours: '',
    contract_monthly_hours: '',
    work_schedule_id: '',
  });

  const [recordForm, setRecordForm] = useState({
    profile_id: '',
    class_hour_configuration_id: '',
    class_date: new Date(),
    number_of_classes: 1,
    notes: '',
  });

  const [filterMonth, setFilterMonth] = useState(new Date());

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
        supabase.from('profiles').select('id, full_name, registration_number').eq('is_active', true).order('full_name'),
        supabase.from('work_schedules').select('id, name, scale_type, workload_type').order('name'),
      ]);

      if (configsRes.data) setConfigurations(configsRes.data as unknown as TeacherConfiguration[]);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as TeacherAssignment[]);
      if (recordsRes.data) setRecords(recordsRes.data as unknown as ClassRecord[]);
      if (employeesRes.data) setEmployees(employeesRes.data);
      if (schedulesRes.data) setSchedules(schedulesRes.data as unknown as WorkSchedule[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!configForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const data = {
        name: configForm.name,
        duration_minutes: configForm.duration_minutes,
        hourly_rate: configForm.hourly_rate ? parseFloat(configForm.hourly_rate) : null,
        description: configForm.description || null,
        contract_type: configForm.contract_type,
        weekly_class_hours: configForm.weekly_class_hours ? parseFloat(configForm.weekly_class_hours) : null,
        monthly_class_hours: configForm.monthly_class_hours ? parseFloat(configForm.monthly_class_hours) : null,
        min_interval_between_classes: configForm.min_interval_between_classes,
        max_consecutive_classes: configForm.max_consecutive_classes,
        night_class_start: configForm.has_night_classes ? configForm.night_class_start : null,
        night_class_end: configForm.has_night_classes ? configForm.night_class_end : null,
        night_class_rate_multiplier: configForm.night_class_rate_multiplier,
        activity_hours_percent: configForm.activity_hours_percent,
        preparation_minutes_per_class: configForm.preparation_minutes_per_class,
        company_id: profile?.company_id,
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('class_hour_configurations')
          .update(data)
          .eq('id', editingConfig.id);
        if (error) throw error;
        toast.success('Configuração atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('class_hour_configurations')
          .insert(data);
        if (error) throw error;
        toast.success('Configuração criada com sucesso!');
      }

      setConfigDialogOpen(false);
      resetConfigForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configuração: ' + error.message);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração?')) return;
    try {
      const { error } = await supabase.from('class_hour_configurations').delete().eq('id', id);
      if (error) throw error;
      toast.success('Configuração excluída com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting config:', error);
      toast.error('Erro ao excluir configuração: ' + error.message);
    }
  };

  const handleSaveAssignment = async () => {
    if (!assignmentForm.profile_id || !assignmentForm.class_hour_configuration_id) {
      toast.error('Selecione o professor e a configuração');
      return;
    }

    try {
      const data = {
        profile_id: assignmentForm.profile_id,
        class_hour_configuration_id: assignmentForm.class_hour_configuration_id,
        start_date: format(assignmentForm.start_date, 'yyyy-MM-dd'),
        contract_type: assignmentForm.contract_type,
        contract_weekly_hours: assignmentForm.contract_weekly_hours ? parseFloat(assignmentForm.contract_weekly_hours) : null,
        contract_monthly_hours: assignmentForm.contract_monthly_hours ? parseFloat(assignmentForm.contract_monthly_hours) : null,
        work_schedule_id: assignmentForm.work_schedule_id || null,
        company_id: profile?.company_id,
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('employee_class_hour_assignments')
          .update(data)
          .eq('id', editingAssignment.id);
        if (error) throw error;
        toast.success('Atribuição atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('employee_class_hour_assignments')
          .insert(data);
        if (error) throw error;
        toast.success('Professor atribuído com sucesso!');
      }

      setAssignmentDialogOpen(false);
      resetAssignmentForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving assignment:', error);
      toast.error('Erro ao salvar atribuição: ' + error.message);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta atribuição?')) return;
    try {
      const { error } = await supabase.from('employee_class_hour_assignments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Atribuição removida com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      toast.error('Erro ao remover atribuição: ' + error.message);
    }
  };

  const handleSaveRecord = async () => {
    if (!recordForm.profile_id || !recordForm.class_hour_configuration_id) {
      toast.error('Selecione o professor e a configuração');
      return;
    }

    try {
      const config = configurations.find(c => c.id === recordForm.class_hour_configuration_id);
      const totalMinutes = recordForm.number_of_classes * (config?.duration_minutes || 50);

      const { error } = await supabase.from('class_records').insert({
        profile_id: recordForm.profile_id,
        class_hour_configuration_id: recordForm.class_hour_configuration_id,
        class_date: format(recordForm.class_date, 'yyyy-MM-dd'),
        number_of_classes: recordForm.number_of_classes,
        total_minutes: totalMinutes,
        notes: recordForm.notes || null,
        company_id: profile?.company_id,
      });
      if (error) throw error;
      toast.success('Aulas registradas com sucesso!');
      setRecordDialogOpen(false);
      resetRecordForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving record:', error);
      toast.error('Erro ao registrar aulas: ' + error.message);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      const { error } = await supabase.from('class_records').delete().eq('id', id);
      if (error) throw error;
      toast.success('Registro excluído com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting record:', error);
      toast.error('Erro ao excluir registro: ' + error.message);
    }
  };

  const resetConfigForm = () => {
    setConfigForm({
      name: '',
      duration_minutes: 50,
      hourly_rate: '',
      description: '',
      contract_type: 'hourly',
      weekly_class_hours: '',
      monthly_class_hours: '',
      min_interval_between_classes: 10,
      max_consecutive_classes: 4,
      night_class_start: '18:00',
      night_class_end: '22:00',
      night_class_rate_multiplier: 1.2,
      activity_hours_percent: 33.33,
      preparation_minutes_per_class: 10,
      has_night_classes: false,
    });
    setEditingConfig(null);
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      profile_id: '',
      class_hour_configuration_id: '',
      start_date: new Date(),
      contract_type: 'hourly',
      contract_weekly_hours: '',
      contract_monthly_hours: '',
      work_schedule_id: '',
    });
    setEditingAssignment(null);
  };

  const resetRecordForm = () => {
    setRecordForm({
      profile_id: '',
      class_hour_configuration_id: '',
      class_date: new Date(),
      number_of_classes: 1,
      notes: '',
    });
  };

  const openEditConfig = (config: TeacherConfiguration) => {
    setEditingConfig(config);
    setConfigForm({
      name: config.name,
      duration_minutes: config.duration_minutes,
      hourly_rate: config.hourly_rate?.toString() || '',
      description: config.description || '',
      contract_type: config.contract_type || 'hourly',
      weekly_class_hours: config.weekly_class_hours?.toString() || '',
      monthly_class_hours: config.monthly_class_hours?.toString() || '',
      min_interval_between_classes: config.min_interval_between_classes || 10,
      max_consecutive_classes: config.max_consecutive_classes || 4,
      night_class_start: config.night_class_start || '18:00',
      night_class_end: config.night_class_end || '22:00',
      night_class_rate_multiplier: config.night_class_rate_multiplier || 1.2,
      activity_hours_percent: config.activity_hours_percent || 33.33,
      preparation_minutes_per_class: config.preparation_minutes_per_class || 10,
      has_night_classes: !!config.night_class_start,
    });
    setConfigDialogOpen(true);
  };

  const openEditAssignment = (assignment: TeacherAssignment) => {
    setEditingAssignment(assignment);
    setAssignmentForm({
      profile_id: assignment.profile_id,
      class_hour_configuration_id: assignment.class_hour_configuration_id,
      start_date: new Date(assignment.start_date),
      contract_type: assignment.contract_type || 'hourly',
      contract_weekly_hours: assignment.contract_weekly_hours?.toString() || '',
      contract_monthly_hours: assignment.contract_monthly_hours?.toString() || '',
      work_schedule_id: assignment.work_schedule_id || '',
    });
    setAssignmentDialogOpen(true);
  };

  const calculateMonthSummary = (profileId: string) => {
    const profileRecords = records.filter(r => r.profile_id === profileId);
    const totalClasses = profileRecords.reduce((sum, r) => sum + r.number_of_classes, 0);
    const totalMinutes = profileRecords.reduce((sum, r) => sum + r.total_minutes, 0);
    
    let totalValue = 0;
    let activityHours = 0;
    
    profileRecords.forEach(r => {
      if (r.class_hour_configuration?.hourly_rate) {
        const hours = r.total_minutes / 60;
        totalValue += hours * r.class_hour_configuration.hourly_rate;
        
        // Calculate activity hours (preparation time)
        const activityPercent = r.class_hour_configuration.activity_hours_percent || 33.33;
        activityHours += (r.total_minutes * activityPercent) / 100;
      }
    });

    return { totalClasses, totalMinutes, totalValue, activityHours };
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.slice(0, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            Módulo Professor
          </h1>
          <p className="text-muted-foreground">
            Gerencie jornadas, escalas e aulas de professores conforme Portarias 1510 e 671
          </p>
        </div>
      </div>

      <Tabs defaultValue="configurations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configurations" className="gap-2">
            <School className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Users className="h-4 w-4" />
            Professores
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Aulas
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Resumo
          </TabsTrigger>
        </TabsList>

        {/* Configurations Tab */}
        <TabsContent value="configurations" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetConfigForm(); setConfigDialogOpen(true); }} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Nova Configuração
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {configurations.map((config) => (
              <Card key={config.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription>{config.description}</CardDescription>
                    </div>
                    <Badge variant={config.is_active ? 'default' : 'secondary'}>
                      {contractTypeLabels[config.contract_type || 'hourly']}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duração da aula:</span>
                      <span className="font-medium">{config.duration_minutes} min</span>
                    </div>
                    {config.hourly_rate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor hora:</span>
                        <span className="font-medium">R$ {config.hourly_rate.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hora atividade:</span>
                      <span className="font-medium">{config.activity_hours_percent || 33.33}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Máx. consecutivas:</span>
                      <span className="font-medium">{config.max_consecutive_classes || 4} aulas</span>
                    </div>
                    {config.night_class_start && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Moon className="h-3 w-3" /> Noturno:
                        </span>
                        <span className="font-medium">
                          {formatTime(config.night_class_start)} - {formatTime(config.night_class_end)}
                        </span>
                      </div>
                    )}
                  </div>
                  <Separator className="my-4" />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditConfig(config)} className="flex-1">
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteConfig(config.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {configurations.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <School className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma configuração cadastrada</p>
                <Button className="mt-4" onClick={() => { resetConfigForm(); setConfigDialogOpen(true); }}>
                  Criar primeira configuração
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetAssignmentForm(); setAssignmentDialogOpen(true); }} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Atribuir Professor
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Professor</TableHead>
                    <TableHead>Configuração</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Carga Horária</TableHead>
                    <TableHead>Jornada</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.profile?.full_name}
                        {assignment.profile?.registration_number && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            #{assignment.profile.registration_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {assignment.class_hour_configuration?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {contractTypeLabels[assignment.contract_type || 'hourly']}
                      </TableCell>
                      <TableCell>
                        {assignment.contract_weekly_hours 
                          ? `${assignment.contract_weekly_hours}h/semana`
                          : assignment.contract_monthly_hours 
                            ? `${assignment.contract_monthly_hours}h/mês`
                            : 'Horista'
                        }
                      </TableCell>
                      <TableCell>
                        {assignment.work_schedule?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(assignment.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditAssignment(assignment)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteAssignment(assignment.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {assignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum professor atribuído
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Mês:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filterMonth}
                    onSelect={(date) => date && setFilterMonth(date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={() => { resetRecordForm(); setRecordDialogOpen(true); }} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Aulas
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Configuração</TableHead>
                    <TableHead>Aulas</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {format(new Date(record.class_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{record.profile?.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {record.class_hour_configuration?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.number_of_classes}</TableCell>
                      <TableCell>
                        {Math.floor(record.total_minutes / 60)}h {record.total_minutes % 60}min
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRecord(record.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma aula registrada neste mês
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>Mês:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filterMonth}
                  onSelect={(date) => date && setFilterMonth(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {employees
              .filter(emp => records.some(r => r.profile_id === emp.id))
              .map((emp) => {
                const summary = calculateMonthSummary(emp.id);
                return (
                  <Card key={emp.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{emp.full_name}</CardTitle>
                      {emp.registration_number && (
                        <CardDescription>#{emp.registration_number}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Total de aulas:</span>
                          <Badge>{summary.totalClasses}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Horas aula:</span>
                          <span className="font-medium">
                            {Math.floor(summary.totalMinutes / 60)}h {summary.totalMinutes % 60}min
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Hora atividade:</span>
                          <span className="font-medium">
                            {Math.floor(summary.activityHours / 60)}h {Math.round(summary.activityHours % 60)}min
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Total horas:</span>
                          <span className="font-bold">
                            {Math.floor((summary.totalMinutes + summary.activityHours) / 60)}h {Math.round((summary.totalMinutes + summary.activityHours) % 60)}min
                          </span>
                        </div>
                        {summary.totalValue > 0 && (
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-muted-foreground">Valor estimado:</span>
                            <span className="font-bold text-primary">
                              R$ {summary.totalValue.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          {!employees.some(emp => records.some(r => r.profile_id === emp.id)) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum registro de aula neste mês</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Editar Configuração' : 'Nova Configuração de Professor'}
            </DialogTitle>
            <DialogDescription>
              Configure parâmetros de hora aula conforme Portarias 1510 e 671 do MTE
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Configuração *</Label>
                <Input
                  value={configForm.name}
                  onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                  placeholder="Ex: Professor Ensino Fundamental"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Contrato</Label>
                <Select
                  value={configForm.contract_type}
                  onValueChange={(v) => setConfigForm({ ...configForm, contract_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Horista</SelectItem>
                    <SelectItem value="part_time">Tempo Parcial</SelectItem>
                    <SelectItem value="full_time">Tempo Integral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={configForm.description}
                onChange={(e) => setConfigForm({ ...configForm, description: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>

            {/* Class Configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Configuração de Aula
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Duração da Aula (min)</Label>
                    <Input
                      type="number"
                      value={configForm.duration_minutes}
                      onChange={(e) => setConfigForm({ ...configForm, duration_minutes: parseInt(e.target.value) || 50 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Hora (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={configForm.hourly_rate}
                      onChange={(e) => setConfigForm({ ...configForm, hourly_rate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. Aulas Consecutivas</Label>
                    <Input
                      type="number"
                      value={configForm.max_consecutive_classes}
                      onChange={(e) => setConfigForm({ ...configForm, max_consecutive_classes: parseInt(e.target.value) || 4 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo Entre Aulas (min)</Label>
                    <Input
                      type="number"
                      value={configForm.min_interval_between_classes}
                      onChange={(e) => setConfigForm({ ...configForm, min_interval_between_classes: parseInt(e.target.value) || 10 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Workload Configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Carga Horária Máxima
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Carga Semanal (h)</Label>
                    <Input
                      type="number"
                      value={configForm.weekly_class_hours}
                      onChange={(e) => setConfigForm({ ...configForm, weekly_class_hours: e.target.value })}
                      placeholder="Ex: 20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Carga Mensal (h)</Label>
                    <Input
                      type="number"
                      value={configForm.monthly_class_hours}
                      onChange={(e) => setConfigForm({ ...configForm, monthly_class_hours: e.target.value })}
                      placeholder="Ex: 80"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Hours (Lei 11.738/2008) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Hora Atividade (Lei 11.738/2008)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Percentual Hora Atividade (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={configForm.activity_hours_percent}
                      onChange={(e) => setConfigForm({ ...configForm, activity_hours_percent: parseFloat(e.target.value) || 33.33 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lei 11.738/2008: mínimo 33,33% para preparação de aulas
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo Preparação/Aula (min)</Label>
                    <Input
                      type="number"
                      value={configForm.preparation_minutes_per_class}
                      onChange={(e) => setConfigForm({ ...configForm, preparation_minutes_per_class: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Night Classes */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Aulas Noturnas (Art. 73 CLT)
                  </CardTitle>
                  <Switch
                    checked={configForm.has_night_classes}
                    onCheckedChange={(checked) => setConfigForm({ ...configForm, has_night_classes: checked })}
                  />
                </div>
              </CardHeader>
              {configForm.has_night_classes && (
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Início Noturno</Label>
                      <Input
                        type="time"
                        value={configForm.night_class_start}
                        onChange={(e) => setConfigForm({ ...configForm, night_class_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim Noturno</Label>
                      <Input
                        type="time"
                        value={configForm.night_class_end}
                        onChange={(e) => setConfigForm({ ...configForm, night_class_end: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Multiplicador</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={configForm.night_class_rate_multiplier}
                        onChange={(e) => setConfigForm({ ...configForm, night_class_rate_multiplier: parseFloat(e.target.value) || 1.2 })}
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveConfig} className="gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Editar Atribuição' : 'Atribuir Professor'}
            </DialogTitle>
            <DialogDescription>
              Configure a jornada e escala específica para o professor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Professor *</Label>
                <Select
                  value={assignmentForm.profile_id}
                  onValueChange={(v) => setAssignmentForm({ ...assignmentForm, profile_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o professor" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} {emp.registration_number ? `(${emp.registration_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Configuração *</Label>
                <Select
                  value={assignmentForm.class_hour_configuration_id}
                  onValueChange={(v) => setAssignmentForm({ ...assignmentForm, class_hour_configuration_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a configuração" />
                  </SelectTrigger>
                  <SelectContent>
                    {configurations.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Contrato</Label>
                <Select
                  value={assignmentForm.contract_type}
                  onValueChange={(v) => setAssignmentForm({ ...assignmentForm, contract_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Horista</SelectItem>
                    <SelectItem value="part_time">Tempo Parcial</SelectItem>
                    <SelectItem value="full_time">Tempo Integral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jornada/Escala (opcional)</Label>
                <Select
                  value={assignmentForm.work_schedule_id}
                  onValueChange={(v) => setAssignmentForm({ ...assignmentForm, work_schedule_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {schedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {schedule.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carga Semanal (h)</Label>
                <Input
                  type="number"
                  value={assignmentForm.contract_weekly_hours}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, contract_weekly_hours: e.target.value })}
                  placeholder="Ex: 20"
                />
              </div>
              <div className="space-y-2">
                <Label>Carga Mensal (h)</Label>
                <Input
                  type="number"
                  value={assignmentForm.contract_monthly_hours}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, contract_monthly_hours: e.target.value })}
                  placeholder="Ex: 80"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !assignmentForm.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {assignmentForm.start_date ? format(assignmentForm.start_date, 'PPP', { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={assignmentForm.start_date}
                    onSelect={(date) => date && setAssignmentForm({ ...assignmentForm, start_date: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAssignment} className="gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Dialog */}
      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Aulas</DialogTitle>
            <DialogDescription>
              Registre as aulas ministradas pelo professor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Professor *</Label>
              <Select
                value={recordForm.profile_id}
                onValueChange={(v) => setRecordForm({ ...recordForm, profile_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o professor" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Configuração *</Label>
              <Select
                value={recordForm.class_hour_configuration_id}
                onValueChange={(v) => setRecordForm({ ...recordForm, class_hour_configuration_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a configuração" />
                </SelectTrigger>
                <SelectContent>
                  {configurations.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name} ({config.duration_minutes}min/aula)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !recordForm.class_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {recordForm.class_date ? format(recordForm.class_date, 'PPP', { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={recordForm.class_date}
                      onSelect={(date) => date && setRecordForm({ ...recordForm, class_date: date })}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Número de Aulas</Label>
                <Input
                  type="number"
                  min={1}
                  value={recordForm.number_of_classes}
                  onChange={(e) => setRecordForm({ ...recordForm, number_of_classes: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={recordForm.notes}
                onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                placeholder="Observações opcionais"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRecord} className="gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
