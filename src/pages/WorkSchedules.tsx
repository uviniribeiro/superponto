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
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Plus, Pencil, Trash2, CalendarIcon, Users, Settings2, 
  CalendarDays, Clock, AlertCircle, Info, Moon, Sun
} from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';

interface WorkSchedule {
  id: string;
  name: string;
  description: string | null;
  scale_type: 'standard' | '5x1' | '6x1' | '12x36';
  workload_type: 'daily' | 'weekly' | 'monthly';
  work_days: number;
  off_days: number;
  work_hours_per_day: number;
  weekly_hours: number;
  monthly_hours: number;
  holiday_treatment: 'normal' | 'overtime' | 'off';
  is_active: boolean;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
  break_duration_minutes: number | null;
  tolerance_minutes: number | null;
  night_shift_start: string | null;
  night_shift_end: string | null;
  night_shift_reduction_percent: number | null;
  overtime_50_percent_limit: number | null;
  overtime_100_percent_limit: number | null;
  interjornada_hours: number | null;
  intrajornada_minutes: number | null;
}

interface EmployeeScheduleAssignment {
  id: string;
  profile_id: string;
  schedule_id: string;
  start_date: string;
  end_date: string | null;
  profile?: {
    full_name: string;
    registration_number: string | null;
    hire_date: string | null;
  };
  schedule?: WorkSchedule;
}

interface EmployeeOffDay {
  id: string;
  profile_id: string;
  off_date: string;
  reason: string | null;
  is_manual_override: boolean;
  profile?: {
    full_name: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
  hire_date: string | null;
}

const DAYS = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const scaleTypeLabels: Record<string, string> = {
  'standard': 'Padrão (CLT)',
  '5x1': '5x1 (5 dias trabalho, 1 folga)',
  '6x1': '6x1 (6 dias trabalho, 1 folga)',
  '12x36': '12x36 (12h trabalho, 36h folga)',
};

const workloadTypeLabels: Record<string, string> = {
  'daily': 'Diária (horas/dia)',
  'weekly': 'Semanal (44h CLT)',
  'monthly': 'Mensal (220h)',
};

const holidayTreatmentLabels: Record<string, string> = {
  'normal': 'Dia normal de trabalho',
  'overtime': 'Hora extra (100%)',
  'off': 'Folga obrigatória',
};

type ScaleType = 'standard' | '5x1' | '6x1' | '12x36';
type WorkloadType = 'daily' | 'weekly' | 'monthly';
type HolidayTreatment = 'normal' | 'overtime' | 'off';

interface ScheduleFormData {
  name: string;
  description: string;
  scale_type: ScaleType;
  workload_type: WorkloadType;
  work_days: number;
  off_days: number;
  work_hours_per_day: number;
  weekly_hours: number;
  monthly_hours: number;
  holiday_treatment: HolidayTreatment;
  monday_start: string;
  monday_end: string;
  tuesday_start: string;
  tuesday_end: string;
  wednesday_start: string;
  wednesday_end: string;
  thursday_start: string;
  thursday_end: string;
  friday_start: string;
  friday_end: string;
  saturday_start: string;
  saturday_end: string;
  sunday_start: string;
  sunday_end: string;
  break_duration_minutes: number;
  tolerance_minutes: number;
  night_shift_start: string;
  night_shift_end: string;
  night_shift_reduction_percent: number;
  overtime_50_percent_limit: number;
  overtime_100_percent_limit: number;
  interjornada_hours: number;
  intrajornada_minutes: number;
  is_night_shift: boolean;
}

const defaultScheduleForm: ScheduleFormData = {
  name: '',
  description: '',
  scale_type: 'standard',
  workload_type: 'weekly',
  work_days: 5,
  off_days: 2,
  work_hours_per_day: 8,
  weekly_hours: 44,
  monthly_hours: 220,
  holiday_treatment: 'normal',
  monday_start: '08:00',
  monday_end: '17:00',
  tuesday_start: '08:00',
  tuesday_end: '17:00',
  wednesday_start: '08:00',
  wednesday_end: '17:00',
  thursday_start: '08:00',
  thursday_end: '17:00',
  friday_start: '08:00',
  friday_end: '17:00',
  saturday_start: '',
  saturday_end: '',
  sunday_start: '',
  sunday_end: '',
  break_duration_minutes: 60,
  tolerance_minutes: 10,
  night_shift_start: '22:00',
  night_shift_end: '05:00',
  night_shift_reduction_percent: 14.28,
  overtime_50_percent_limit: 2,
  overtime_100_percent_limit: 0,
  interjornada_hours: 11,
  intrajornada_minutes: 60,
  is_night_shift: false,
};

export default function WorkSchedules() {
  const { profile } = useAuth();
  
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [assignments, setAssignments] = useState<EmployeeScheduleAssignment[]>([]);
  const [offDays, setOffDays] = useState<EmployeeOffDay[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [offDayDialogOpen, setOffDayDialogOpen] = useState(false);

  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<EmployeeScheduleAssignment | null>(null);

  const [scheduleForm, setScheduleForm] = useState(defaultScheduleForm);

  const [assignmentForm, setAssignmentForm] = useState({
    profile_id: '',
    schedule_id: '',
    start_date: new Date(),
    scale_start_day: new Date(),
  });

  const [offDayForm, setOffDayForm] = useState({
    profile_id: '',
    off_date: new Date(),
    reason: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schedulesRes, assignmentsRes, offDaysRes, employeesRes] = await Promise.all([
        supabase.from('work_schedules').select('*').order('name'),
        supabase.from('employee_schedules').select(`
          *,
          profile:profiles(full_name, registration_number, hire_date),
          schedule:work_schedules(*)
        `).order('start_date', { ascending: false }),
        supabase.from('employee_off_days').select(`
          *,
          profile:profiles(full_name)
        `).order('off_date', { ascending: false }),
        supabase.from('profiles').select('id, full_name, registration_number, hire_date').eq('is_active', true).order('full_name'),
      ]);

      if (schedulesRes.data) setSchedules(schedulesRes.data as unknown as WorkSchedule[]);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as EmployeeScheduleAssignment[]);
      if (offDaysRes.data) setOffDays(offDaysRes.data as unknown as EmployeeOffDay[]);
      if (employeesRes.data) setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const updateFormByScaleType = (type: 'standard' | '5x1' | '6x1' | '12x36') => {
    switch (type) {
      case '5x1':
        setScheduleForm(prev => ({
          ...prev,
          scale_type: type,
          work_days: 5,
          off_days: 1,
          work_hours_per_day: 7.33,
          weekly_hours: 44,
          saturday_start: prev.monday_start,
          saturday_end: prev.monday_end,
        }));
        break;
      case '6x1':
        setScheduleForm(prev => ({
          ...prev,
          scale_type: type,
          work_days: 6,
          off_days: 1,
          work_hours_per_day: 7.33,
          weekly_hours: 44,
          saturday_start: prev.monday_start,
          saturday_end: prev.monday_end,
        }));
        break;
      case '12x36':
        setScheduleForm(prev => ({
          ...prev,
          scale_type: type,
          work_days: 1,
          off_days: 1,
          work_hours_per_day: 12,
          weekly_hours: 44,
          workload_type: 'monthly',
          monthly_hours: 180,
        }));
        break;
      default:
        setScheduleForm(prev => ({
          ...prev,
          scale_type: type,
          work_days: 5,
          off_days: 2,
          work_hours_per_day: 8,
          weekly_hours: 44,
          saturday_start: '',
          saturday_end: '',
        }));
    }
  };

  const updateFormByWorkloadType = (type: 'daily' | 'weekly' | 'monthly') => {
    switch (type) {
      case 'daily':
        setScheduleForm(prev => ({ ...prev, workload_type: type }));
        break;
      case 'weekly':
        setScheduleForm(prev => ({ 
          ...prev, 
          workload_type: type,
          weekly_hours: 44,
        }));
        break;
      case 'monthly':
        setScheduleForm(prev => ({ 
          ...prev, 
          workload_type: type,
          monthly_hours: 220,
        }));
        break;
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const scheduleData = {
        name: scheduleForm.name,
        description: scheduleForm.description || null,
        scale_type: scheduleForm.scale_type,
        workload_type: scheduleForm.workload_type,
        work_days: scheduleForm.work_days,
        off_days: scheduleForm.off_days,
        work_hours_per_day: scheduleForm.work_hours_per_day,
        weekly_hours: scheduleForm.weekly_hours,
        monthly_hours: scheduleForm.monthly_hours,
        holiday_treatment: scheduleForm.holiday_treatment,
        monday_start: scheduleForm.monday_start || null,
        monday_end: scheduleForm.monday_end || null,
        tuesday_start: scheduleForm.tuesday_start || null,
        tuesday_end: scheduleForm.tuesday_end || null,
        wednesday_start: scheduleForm.wednesday_start || null,
        wednesday_end: scheduleForm.wednesday_end || null,
        thursday_start: scheduleForm.thursday_start || null,
        thursday_end: scheduleForm.thursday_end || null,
        friday_start: scheduleForm.friday_start || null,
        friday_end: scheduleForm.friday_end || null,
        saturday_start: scheduleForm.saturday_start || null,
        saturday_end: scheduleForm.saturday_end || null,
        sunday_start: scheduleForm.sunday_start || null,
        sunday_end: scheduleForm.sunday_end || null,
        break_duration_minutes: scheduleForm.break_duration_minutes,
        tolerance_minutes: scheduleForm.tolerance_minutes,
        night_shift_start: scheduleForm.is_night_shift ? scheduleForm.night_shift_start : null,
        night_shift_end: scheduleForm.is_night_shift ? scheduleForm.night_shift_end : null,
        night_shift_reduction_percent: scheduleForm.night_shift_reduction_percent,
        overtime_50_percent_limit: scheduleForm.overtime_50_percent_limit,
        overtime_100_percent_limit: scheduleForm.overtime_100_percent_limit,
        interjornada_hours: scheduleForm.interjornada_hours,
        intrajornada_minutes: scheduleForm.intrajornada_minutes,
        company_id: profile?.company_id,
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('work_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);
        if (error) throw error;
        toast.success('Jornada atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('work_schedules')
          .insert(scheduleData);
        if (error) throw error;
        toast.success('Jornada criada com sucesso!');
      }

      setScheduleDialogOpen(false);
      resetScheduleForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error('Erro ao salvar jornada: ' + error.message);
    }
  };

  const handleDeleteSchedule = async (schedule: WorkSchedule) => {
    if (!confirm('Tem certeza que deseja excluir esta jornada?')) return;

    try {
      const { error } = await supabase
        .from('work_schedules')
        .delete()
        .eq('id', schedule.id);

      if (error) throw error;
      toast.success('Jornada excluída com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast.error('Erro ao excluir jornada: ' + error.message);
    }
  };

  const handleSaveAssignment = async () => {
    if (!assignmentForm.profile_id || !assignmentForm.schedule_id) {
      toast.error('Selecione o funcionário e a jornada');
      return;
    }

    try {
      const data = {
        profile_id: assignmentForm.profile_id,
        schedule_id: assignmentForm.schedule_id,
        start_date: format(assignmentForm.start_date, 'yyyy-MM-dd'),
        company_id: profile?.company_id,
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('employee_schedules')
          .update(data)
          .eq('id', editingAssignment.id);
        if (error) throw error;
        toast.success('Atribuição atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('employee_schedules')
          .insert(data);
        if (error) throw error;
        toast.success('Jornada atribuída ao funcionário!');
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
      const { error } = await supabase.from('employee_schedules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Atribuição removida com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      toast.error('Erro ao remover atribuição: ' + error.message);
    }
  };

  const handleSaveOffDay = async () => {
    if (!offDayForm.profile_id) {
      toast.error('Selecione o funcionário');
      return;
    }

    try {
      const { error } = await supabase.from('employee_off_days').insert({
        profile_id: offDayForm.profile_id,
        off_date: format(offDayForm.off_date, 'yyyy-MM-dd'),
        reason: offDayForm.reason || null,
        company_id: profile?.company_id,
        is_manual_override: true,
      });
      if (error) throw error;
      toast.success('Folga manual adicionada!');
      setOffDayDialogOpen(false);
      resetOffDayForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving off day:', error);
      toast.error('Erro ao adicionar folga: ' + error.message);
    }
  };

  const handleDeleteOffDay = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta folga?')) return;

    try {
      const { error } = await supabase.from('employee_off_days').delete().eq('id', id);
      if (error) throw error;
      toast.success('Folga removida com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting off day:', error);
      toast.error('Erro ao remover folga: ' + error.message);
    }
  };

  const resetScheduleForm = () => {
    setScheduleForm(defaultScheduleForm);
    setEditingSchedule(null);
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      profile_id: '',
      schedule_id: '',
      start_date: new Date(),
      scale_start_day: new Date(),
    });
    setEditingAssignment(null);
  };

  const resetOffDayForm = () => {
    setOffDayForm({
      profile_id: '',
      off_date: new Date(),
      reason: '',
    });
  };

  const openEditSchedule = (schedule: WorkSchedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      name: schedule.name,
      description: schedule.description || '',
      scale_type: schedule.scale_type || 'standard',
      workload_type: schedule.workload_type || 'weekly',
      work_days: schedule.work_days || 5,
      off_days: schedule.off_days || 2,
      work_hours_per_day: schedule.work_hours_per_day || 8,
      weekly_hours: schedule.weekly_hours || 44,
      monthly_hours: schedule.monthly_hours || 220,
      holiday_treatment: schedule.holiday_treatment || 'normal',
      monday_start: schedule.monday_start || '',
      monday_end: schedule.monday_end || '',
      tuesday_start: schedule.tuesday_start || '',
      tuesday_end: schedule.tuesday_end || '',
      wednesday_start: schedule.wednesday_start || '',
      wednesday_end: schedule.wednesday_end || '',
      thursday_start: schedule.thursday_start || '',
      thursday_end: schedule.thursday_end || '',
      friday_start: schedule.friday_start || '',
      friday_end: schedule.friday_end || '',
      saturday_start: schedule.saturday_start || '',
      saturday_end: schedule.saturday_end || '',
      sunday_start: schedule.sunday_start || '',
      sunday_end: schedule.sunday_end || '',
      break_duration_minutes: schedule.break_duration_minutes || 60,
      tolerance_minutes: schedule.tolerance_minutes || 10,
      night_shift_start: schedule.night_shift_start || '22:00',
      night_shift_end: schedule.night_shift_end || '05:00',
      night_shift_reduction_percent: schedule.night_shift_reduction_percent || 14.28,
      overtime_50_percent_limit: schedule.overtime_50_percent_limit || 2,
      overtime_100_percent_limit: schedule.overtime_100_percent_limit || 0,
      interjornada_hours: schedule.interjornada_hours || 11,
      intrajornada_minutes: schedule.intrajornada_minutes || 60,
      is_night_shift: !!schedule.night_shift_start,
    });
    setScheduleDialogOpen(true);
  };

  const openEditAssignment = (assignment: EmployeeScheduleAssignment) => {
    setEditingAssignment(assignment);
    setAssignmentForm({
      profile_id: assignment.profile_id,
      schedule_id: assignment.schedule_id,
      start_date: new Date(assignment.start_date),
      scale_start_day: new Date(assignment.start_date),
    });
    setAssignmentDialogOpen(true);
  };

  const calculateOffDays = (assignment: EmployeeScheduleAssignment) => {
    if (!assignment.schedule) return [];
    
    const schedule = assignment.schedule;
    const startDate = startOfDay(new Date(assignment.start_date));
    const today = startOfDay(new Date());
    const endDate = addDays(today, 30);
    
    const offDaysList: Date[] = [];
    
    if (schedule.scale_type === '12x36') {
      let currentDay = startDate;
      let isWorkDay = true;
      while (currentDay <= endDate) {
        if (!isWorkDay && currentDay >= today) {
          offDaysList.push(new Date(currentDay));
        }
        currentDay = addDays(currentDay, isWorkDay ? 1 : 1);
        isWorkDay = !isWorkDay;
      }
    } else if (schedule.scale_type === '5x1' || schedule.scale_type === '6x1') {
      const cycleLength = schedule.work_days + schedule.off_days;
      let currentDay = startDate;
      
      while (currentDay <= endDate) {
        const dayInCycle = differenceInDays(currentDay, startDate) % cycleLength;
        
        if (dayInCycle >= schedule.work_days && currentDay >= today) {
          offDaysList.push(new Date(currentDay));
        }
        currentDay = addDays(currentDay, 1);
      }
    }
    
    return offDaysList;
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
            <Clock className="h-8 w-8 text-primary" />
            Jornadas e Escalas
          </h1>
          <p className="text-muted-foreground">
            Configure jornadas, escalas (5x1, 6x1, 12x36) e atribua a funcionários conforme Portarias 1510 e 671
          </p>
        </div>
      </div>

      <Tabs defaultValue="schedules" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="schedules" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Jornadas
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Users className="h-4 w-4" />
            Atribuições
          </TabsTrigger>
          <TabsTrigger value="off-days" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Folgas Manuais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetScheduleForm(); setScheduleDialogOpen(true); }} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Nova Jornada
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {schedules.map((schedule) => (
              <Card key={schedule.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{schedule.name}</CardTitle>
                      <CardDescription>
                        {scaleTypeLabels[schedule.scale_type || 'standard']}
                      </CardDescription>
                    </div>
                    <Badge variant={schedule.is_active !== false ? 'default' : 'secondary'}>
                      {schedule.is_active !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carga Horária:</span>
                      <span className="font-medium">{workloadTypeLabels[schedule.workload_type || 'weekly']}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Horas/dia:</span>
                      <span className="font-medium">{schedule.work_hours_per_day || 8}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Horas/semana:</span>
                      <span className="font-medium">{schedule.weekly_hours || 44}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dias trabalho/folga:</span>
                      <span className="font-medium">{schedule.work_days || 5}x{schedule.off_days || 2}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Feriados:</span>
                      <span className="font-medium">{holidayTreatmentLabels[schedule.holiday_treatment || 'normal']}</span>
                    </div>
                    {schedule.night_shift_start && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Moon className="h-3 w-3" /> Noturno:
                        </span>
                        <span className="font-medium">
                          {formatTime(schedule.night_shift_start)} - {formatTime(schedule.night_shift_end)}
                        </span>
                      </div>
                    )}
                  </div>
                  <Separator className="my-4" />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditSchedule(schedule)} className="flex-1">
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteSchedule(schedule)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {schedules.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma jornada cadastrada</p>
                <Button className="mt-4" onClick={() => { resetScheduleForm(); setScheduleDialogOpen(true); }}>
                  Criar primeira jornada
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetAssignmentForm(); setAssignmentDialogOpen(true); }} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Atribuir Jornada
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Jornada</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Próximas Folgas</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.profile?.full_name || '-'}
                      </TableCell>
                      <TableCell>{assignment.profile?.registration_number || '-'}</TableCell>
                      <TableCell>{assignment.schedule?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {scaleTypeLabels[assignment.schedule?.scale_type || 'standard']}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(assignment.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {calculateOffDays(assignment).slice(0, 3).map((date, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {format(date, 'dd/MM', { locale: ptBR })}
                            </Badge>
                          ))}
                        </div>
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
                        Nenhuma atribuição encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="off-days" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetOffDayForm(); setOffDayDialogOpen(true); }} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Folga Manual
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Data da Folga</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offDays.map((offDay) => (
                    <TableRow key={offDay.id}>
                      <TableCell className="font-medium">
                        {offDay.profile?.full_name || '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(offDay.off_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{offDay.reason || '-'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteOffDay(offDay.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {offDays.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhuma folga manual registrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Editar Jornada' : 'Nova Jornada'}
            </DialogTitle>
            <DialogDescription>
              Configure a jornada de trabalho conforme Portarias 1510 e 671 do MTE
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Jornada *</Label>
                <Input
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  placeholder="Ex: Comercial 44h"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </div>
            </div>

            {/* Scale and Workload Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Escala</Label>
                <Select
                  value={scheduleForm.scale_type}
                  onValueChange={(v) => updateFormByScaleType(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Padrão (CLT - 5x2)</SelectItem>
                    <SelectItem value="5x1">5x1 (5 dias trabalho, 1 folga)</SelectItem>
                    <SelectItem value="6x1">6x1 (6 dias trabalho, 1 folga)</SelectItem>
                    <SelectItem value="12x36">12x36 (12h trabalho, 36h folga)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Carga Horária</Label>
                <Select
                  value={scheduleForm.workload_type}
                  onValueChange={(v) => updateFormByWorkloadType(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diária (controle por horas/dia)</SelectItem>
                    <SelectItem value="weekly">Semanal (44h CLT)</SelectItem>
                    <SelectItem value="monthly">Mensal (220h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Work Hours Configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Configuração de Carga Horária
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Dias de Trabalho</Label>
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={scheduleForm.work_days}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, work_days: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dias de Folga</Label>
                    <Input
                      type="number"
                      min={0}
                      max={6}
                      value={scheduleForm.off_days}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, off_days: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horas/Dia</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={scheduleForm.work_hours_per_day}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, work_hours_per_day: parseFloat(e.target.value) || 8 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horas/Semana</Label>
                    <Input
                      type="number"
                      value={scheduleForm.weekly_hours}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, weekly_hours: parseFloat(e.target.value) || 44 })}
                    />
                  </div>
                </div>
                {scheduleForm.workload_type === 'monthly' && (
                  <div className="mt-4">
                    <div className="space-y-2">
                      <Label>Horas/Mês</Label>
                      <Input
                        type="number"
                        value={scheduleForm.monthly_hours}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, monthly_hours: parseFloat(e.target.value) || 220 })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Schedule */}
            {scheduleForm.scale_type !== '12x36' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Horários por Dia da Semana
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {DAYS.map((day) => (
                      <div key={day.key} className="grid grid-cols-5 gap-2 items-center">
                        <span className="text-sm font-medium">{day.label}</span>
                        <div className="col-span-2">
                          <Input
                            type="time"
                            value={scheduleForm[`${day.key}_start` as keyof typeof scheduleForm] as string}
                            onChange={(e) => setScheduleForm({
                              ...scheduleForm,
                              [`${day.key}_start`]: e.target.value
                            })}
                            placeholder="Entrada"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="time"
                            value={scheduleForm[`${day.key}_end` as keyof typeof scheduleForm] as string}
                            onChange={(e) => setScheduleForm({
                              ...scheduleForm,
                              [`${day.key}_end`]: e.target.value
                            })}
                            placeholder="Saída"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Intervals & Tolerance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Intervalos e Tolerâncias (CLT/Portaria 671)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Intervalo Intrajornada (min)</Label>
                    <Input
                      type="number"
                      value={scheduleForm.intrajornada_minutes}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, intrajornada_minutes: parseInt(e.target.value) || 60 })}
                    />
                    <p className="text-xs text-muted-foreground">CLT: mín. 60min para jornada &gt;6h</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo Interjornada (h)</Label>
                    <Input
                      type="number"
                      value={scheduleForm.interjornada_hours}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, interjornada_hours: parseInt(e.target.value) || 11 })}
                    />
                    <p className="text-xs text-muted-foreground">CLT: mín. 11h entre jornadas</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Duração do Intervalo (min)</Label>
                    <Input
                      type="number"
                      value={scheduleForm.break_duration_minutes}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, break_duration_minutes: parseInt(e.target.value) || 60 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tolerância (min)</Label>
                    <Input
                      type="number"
                      value={scheduleForm.tolerance_minutes}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, tolerance_minutes: parseInt(e.target.value) || 10 })}
                    />
                    <p className="text-xs text-muted-foreground">Portaria 1510: até 10min</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overtime Limits */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Limites de Hora Extra
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Limite HE 50% (h/dia)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={scheduleForm.overtime_50_percent_limit}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, overtime_50_percent_limit: parseFloat(e.target.value) || 2 })}
                    />
                    <p className="text-xs text-muted-foreground">CLT: máx. 2h extras/dia</p>
                  </div>
                  <div className="space-y-2">
                    <Label>HE 100% (domingos/feriados)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={scheduleForm.overtime_100_percent_limit}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, overtime_100_percent_limit: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Night Shift */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Adicional Noturno (Art. 73 CLT)
                  </CardTitle>
                  <Switch
                    checked={scheduleForm.is_night_shift}
                    onCheckedChange={(checked) => setScheduleForm({ ...scheduleForm, is_night_shift: checked })}
                  />
                </div>
              </CardHeader>
              {scheduleForm.is_night_shift && (
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Início Noturno</Label>
                      <Input
                        type="time"
                        value={scheduleForm.night_shift_start}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, night_shift_start: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">CLT: 22h</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Fim Noturno</Label>
                      <Input
                        type="time"
                        value={scheduleForm.night_shift_end}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, night_shift_end: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">CLT: 05h</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Redução (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={scheduleForm.night_shift_reduction_percent}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, night_shift_reduction_percent: parseFloat(e.target.value) || 14.28 })}
                      />
                      <p className="text-xs text-muted-foreground">CLT: 14.28% (52m30s)</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Holiday Treatment */}
            <div className="space-y-2">
              <Label>Tratamento de Feriados</Label>
              <Select
                value={scheduleForm.holiday_treatment}
                onValueChange={(v) => setScheduleForm({ ...scheduleForm, holiday_treatment: v as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Dia normal de trabalho</SelectItem>
                  <SelectItem value="overtime">Hora extra (100%)</SelectItem>
                  <SelectItem value="off">Folga obrigatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSchedule} className="gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Editar Atribuição' : 'Atribuir Jornada'}
            </DialogTitle>
            <DialogDescription>
              Atribua uma jornada/escala a um funcionário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário *</Label>
              <Select
                value={assignmentForm.profile_id}
                onValueChange={(v) => {
                  const emp = employees.find(e => e.id === v);
                  setAssignmentForm({ 
                    ...assignmentForm, 
                    profile_id: v,
                    start_date: emp?.hire_date ? new Date(emp.hire_date) : new Date(),
                    scale_start_day: emp?.hire_date ? new Date(emp.hire_date) : new Date(),
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
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
              <Label>Jornada/Escala *</Label>
              <Select
                value={assignmentForm.schedule_id}
                onValueChange={(v) => setAssignmentForm({ ...assignmentForm, schedule_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a jornada" />
                </SelectTrigger>
                <SelectContent>
                  {schedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.name} ({scaleTypeLabels[schedule.scale_type || 'standard']})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Início da Escala</Label>
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
              <p className="text-xs text-muted-foreground">
                Define o dia base para calcular as folgas da escala
              </p>
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

      {/* Off Day Dialog */}
      <Dialog open={offDayDialogOpen} onOpenChange={setOffDayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Folga Manual</DialogTitle>
            <DialogDescription>
              Registre uma folga manual para um funcionário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário *</Label>
              <Select
                value={offDayForm.profile_id}
                onValueChange={(v) => setOffDayForm({ ...offDayForm, profile_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
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
              <Label>Data da Folga</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !offDayForm.off_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {offDayForm.off_date ? format(offDayForm.off_date, 'PPP', { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={offDayForm.off_date}
                    onSelect={(date) => date && setOffDayForm({ ...offDayForm, off_date: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                value={offDayForm.reason}
                onChange={(e) => setOffDayForm({ ...offDayForm, reason: e.target.value })}
                placeholder="Motivo da folga (opcional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOffDayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveOffDay} className="gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <HelpButton pageKey="schedules" />
    </div>
  );
}
