import React, { useState, useEffect, useRef } from 'react';
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
import { format, startOfMonth, endOfMonth, parseISO, eachDayOfInterval, isWeekend, differenceInMinutes, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Plus, Pencil, Trash2, CalendarIcon, Clock, Users, BookOpen, 
  DollarSign, GraduationCap, Moon, AlertCircle, FileText, School,
  Download, Printer, ClipboardList, LayoutGrid
} from 'lucide-react';
import TeacherScheduleBoard, { educatorTypes, teachingLevels, subjects } from '@/components/teachers/TeacherScheduleBoard';

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

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  nsr: number;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

interface DailyTimesheet {
  date: string;
  dayOfWeek: string;
  records: TimeRecord[];
  entry: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  exit: string | null;
  workedMinutes: number;
  classRecords: ClassRecord[];
  totalClasses: number;
  totalClassMinutes: number;
  activityMinutes: number;
  isHoliday: boolean;
  holidayName: string | null;
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

// Grouped employee - same person with multiple registrations
interface GroupedEmployee {
  key: string; // CPF or first profile ID if no CPF
  full_name: string;
  cpf: string | null;
  profiles: Profile[];
}

interface CompanySettings {
  company_name: string;
  cnpj: string | null;
  cei: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

const contractTypeLabels: Record<string, string> = {
  'hourly': 'Horista',
  'part_time': 'Tempo Parcial',
  'full_time': 'Tempo Integral',
};

export default function TeacherModule() {
  const { profile } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [configurations, setConfigurations] = useState<TeacherConfiguration[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [records, setRecords] = useState<ClassRecord[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);

  const [editingConfig, setEditingConfig] = useState<TeacherConfiguration | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<TeacherAssignment | null>(null);
  
  // Timesheet state
  const [selectedEmployeeGroup, setSelectedEmployeeGroup] = useState<string>('');
  const [selectedRegistration, setSelectedRegistration] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [timesheetData, setTimesheetData] = useState<DailyTimesheet[]>([]);

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
    educator_type: 'PEB_II',
    teaching_level: 'fundamental_2',
    subject: '',
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

      const [configsRes, assignmentsRes, recordsRes, employeesRes, schedulesRes, holidaysRes, settingsRes] = await Promise.all([
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
        supabase.from('holidays').select('id, date, name'),
        supabase.from('company_settings').select('company_name, cnpj, cei, address, city, state').limit(1).maybeSingle(),
      ]);

      if (configsRes.data) setConfigurations(configsRes.data as unknown as TeacherConfiguration[]);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as TeacherAssignment[]);
      if (recordsRes.data) setRecords(recordsRes.data as unknown as ClassRecord[]);
      if (employeesRes.data) setEmployees(employeesRes.data as unknown as Profile[]);
      if (schedulesRes.data) setSchedules(schedulesRes.data as unknown as WorkSchedule[]);
      if (holidaysRes.data) setHolidays(holidaysRes.data);
      if (settingsRes.data) setCompanySettings(settingsRes.data);
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
        educator_type: assignmentForm.educator_type,
        teaching_level: assignmentForm.teaching_level,
        subject: assignmentForm.subject || null,
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
      educator_type: 'PEB_II',
      teaching_level: 'fundamental_2',
      subject: '',
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
      educator_type: assignment.educator_type || 'PEB_II',
      teaching_level: assignment.teaching_level || 'fundamental_2',
      subject: assignment.subject || '',
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

  // Group employees by CPF for the timesheet view (same person with multiple registrations)
  const groupedEmployees = React.useMemo(() => {
    const groups: Map<string, GroupedEmployee> = new Map();
    
    employees.forEach(emp => {
      const key = emp.cpf || emp.id; // Group by CPF if available, otherwise use ID
      
      if (groups.has(key)) {
        groups.get(key)!.profiles.push(emp);
      } else {
        groups.set(key, {
          key,
          full_name: emp.full_name,
          cpf: emp.cpf,
          profiles: [emp],
        });
      }
    });
    
    return Array.from(groups.values());
  }, [employees]);

  // Get available registrations for the selected employee group
  const availableRegistrations = React.useMemo(() => {
    if (!selectedEmployeeGroup) return [];
    const group = groupedEmployees.find(g => g.key === selectedEmployeeGroup);
    return group?.profiles || [];
  }, [selectedEmployeeGroup, groupedEmployees]);

  // Fetch time records for selected teacher
  const fetchTeacherTimeRecords = async (profileId: string) => {
    if (!profileId) {
      setTimesheetData([]);
      return;
    }

    const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('profile_id', profileId)
        .gte('recorded_at', `${startDate}T00:00:00`)
        .lte('recorded_at', `${endDate}T23:59:59`)
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      
      processTimesheetData(profileId, data || [], startDate, endDate);
    } catch (error) {
      console.error('Error fetching time records:', error);
      toast.error('Erro ao carregar registros de ponto');
    }
  };

  // Process timesheet data
  const processTimesheetData = (profileId: string, timeRecordsData: TimeRecord[], startDate: string, endDate: string) => {
    const days = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    const teacherClassRecords = records.filter(r => r.profile_id === profileId);
    const teacherAssignment = assignments.find(a => a.profile_id === profileId && a.is_active);
    const activityPercent = teacherAssignment?.class_hour_configuration?.activity_hours_percent || 33.33;

    const timesheetRows: DailyTimesheet[] = days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayOfWeek = format(day, 'EEEE', { locale: ptBR });
      
      // Check if holiday
      const holiday = holidays.find(h => h.date === dateStr);
      
      // Get time records for this day
      const dayRecords = timeRecordsData.filter(r => 
        format(parseISO(r.recorded_at), 'yyyy-MM-dd') === dateStr
      );
      
      // Extract record times
      const entry = dayRecords.find(r => r.record_type === 'entry');
      const breakStart = dayRecords.find(r => r.record_type === 'break_start');
      const breakEnd = dayRecords.find(r => r.record_type === 'break_end');
      const exit = dayRecords.find(r => r.record_type === 'exit');

      // Calculate worked minutes
      let workedMinutes = 0;
      if (entry && exit) {
        const entryTime = parseISO(entry.recorded_at);
        const exitTime = parseISO(exit.recorded_at);
        workedMinutes = differenceInMinutes(exitTime, entryTime);
        
        // Subtract break time
        if (breakStart && breakEnd) {
          const breakStartTime = parseISO(breakStart.recorded_at);
          const breakEndTime = parseISO(breakEnd.recorded_at);
          workedMinutes -= differenceInMinutes(breakEndTime, breakStartTime);
        }
      }

      // Get class records for this day
      const dayClassRecords = teacherClassRecords.filter(r => r.class_date === dateStr);
      const totalClasses = dayClassRecords.reduce((sum, r) => sum + r.number_of_classes, 0);
      const totalClassMinutes = dayClassRecords.reduce((sum, r) => sum + r.total_minutes, 0);
      const activityMinutes = Math.round((totalClassMinutes * activityPercent) / 100);

      return {
        date: dateStr,
        dayOfWeek,
        records: dayRecords,
        entry: entry ? format(parseISO(entry.recorded_at), 'HH:mm') : null,
        breakStart: breakStart ? format(parseISO(breakStart.recorded_at), 'HH:mm') : null,
        breakEnd: breakEnd ? format(parseISO(breakEnd.recorded_at), 'HH:mm') : null,
        exit: exit ? format(parseISO(exit.recorded_at), 'HH:mm') : null,
        workedMinutes,
        classRecords: dayClassRecords,
        totalClasses,
        totalClassMinutes,
        activityMinutes,
        isHoliday: !!holiday,
        holidayName: holiday?.name || null,
      };
    });

    setTimesheetData(timesheetRows);
    setTimeRecords(timeRecordsData);
  };

  // Calculate totals for timesheet
  const calculateTimesheetTotals = () => {
    const totalWorkedMinutes = timesheetData.reduce((sum, d) => sum + d.workedMinutes, 0);
    const totalClasses = timesheetData.reduce((sum, d) => sum + d.totalClasses, 0);
    const totalClassMinutes = timesheetData.reduce((sum, d) => sum + d.totalClassMinutes, 0);
    const totalActivityMinutes = timesheetData.reduce((sum, d) => sum + d.activityMinutes, 0);
    const totalDaysWorked = timesheetData.filter(d => d.workedMinutes > 0 || d.totalClasses > 0).length;

    return {
      totalWorkedMinutes,
      totalClasses,
      totalClassMinutes,
      totalActivityMinutes,
      totalDaysWorked,
    };
  };

  // Format minutes to hours and minutes
  const formatMinutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  // Print timesheet
  const handlePrintTimesheet = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'height=600,width=900');
    if (!printWindow) return;

    const selectedEmployee = employees.find(e => e.id === selectedTeacher);
    const totals = calculateTimesheetTotals();

    printWindow.document.write(`
      <html>
        <head>
          <title>Espelho de Ponto - ${selectedEmployee?.full_name || 'Professor'}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
            h1 { font-size: 14px; text-align: center; margin-bottom: 5px; }
            h2 { font-size: 12px; text-align: center; margin-bottom: 10px; }
            .header { border: 1px solid #000; padding: 10px; margin-bottom: 10px; }
            .header-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { border: 1px solid #000; padding: 3px 5px; text-align: center; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .weekend { background-color: #f5f5f5; }
            .holiday { background-color: #ffe0e0; }
            .totals { margin-top: 10px; border: 1px solid #000; padding: 10px; }
            .signature-area { margin-top: 30px; display: flex; justify-content: space-between; }
            .signature-line { width: 200px; border-top: 1px solid #000; text-align: center; padding-top: 5px; }
            .legal-notice { margin-top: 20px; font-size: 8px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <h1>ESPELHO DE PONTO ELETRÔNICO</h1>
          <h2>Portaria 671/2021 MTE - Art. 76 a 79</h2>
          
          <div class="header">
            <div class="header-row">
              <span><strong>Empresa:</strong> ${companySettings?.company_name || 'N/A'}</span>
              <span><strong>CNPJ:</strong> ${companySettings?.cnpj || 'N/A'}</span>
            </div>
            <div class="header-row">
              <span><strong>Endereço:</strong> ${companySettings?.address || 'N/A'}, ${companySettings?.city || ''} - ${companySettings?.state || ''}</span>
            </div>
            <div class="header-row">
              <span><strong>Professor:</strong> ${selectedEmployee?.full_name || 'N/A'}</span>
              <span><strong>PIS:</strong> ${selectedEmployee?.pis || 'N/A'}</span>
            </div>
            <div class="header-row">
              <span><strong>Matrícula:</strong> ${selectedEmployee?.registration_number || 'N/A'}</span>
              <span><strong>CPF:</strong> ${selectedEmployee?.cpf || 'N/A'}</span>
            </div>
            <div class="header-row">
              <span><strong>Cargo:</strong> ${selectedEmployee?.position || 'Professor'}</span>
              <span><strong>Período:</strong> ${format(startOfMonth(filterMonth), 'dd/MM/yyyy')} a ${format(endOfMonth(filterMonth), 'dd/MM/yyyy')}</span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dia</th>
                <th>Entrada</th>
                <th>Saída Int.</th>
                <th>Retorno Int.</th>
                <th>Saída</th>
                <th>Total Horas</th>
                <th>Aulas</th>
                <th>Hora Aula</th>
                <th>Hora Ativ.</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              ${timesheetData.map(row => `
                <tr class="${isWeekend(parseISO(row.date)) ? 'weekend' : ''} ${row.isHoliday ? 'holiday' : ''}">
                  <td>${format(parseISO(row.date), 'dd/MM')}</td>
                  <td>${row.dayOfWeek.slice(0, 3)}</td>
                  <td>${row.entry || '-'}</td>
                  <td>${row.breakStart || '-'}</td>
                  <td>${row.breakEnd || '-'}</td>
                  <td>${row.exit || '-'}</td>
                  <td>${row.workedMinutes > 0 ? formatMinutesToHours(row.workedMinutes) : '-'}</td>
                  <td>${row.totalClasses > 0 ? row.totalClasses : '-'}</td>
                  <td>${row.totalClassMinutes > 0 ? formatMinutesToHours(row.totalClassMinutes) : '-'}</td>
                  <td>${row.activityMinutes > 0 ? formatMinutesToHours(row.activityMinutes) : '-'}</td>
                  <td>${row.isHoliday ? row.holidayName : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="header-row">
              <span><strong>Total Dias Trabalhados:</strong> ${totals.totalDaysWorked}</span>
              <span><strong>Total Horas Relógio:</strong> ${formatMinutesToHours(totals.totalWorkedMinutes)}</span>
            </div>
            <div class="header-row">
              <span><strong>Total Aulas:</strong> ${totals.totalClasses}</span>
              <span><strong>Total Hora Aula:</strong> ${formatMinutesToHours(totals.totalClassMinutes)}</span>
            </div>
            <div class="header-row">
              <span><strong>Total Hora Atividade:</strong> ${formatMinutesToHours(totals.totalActivityMinutes)}</span>
              <span><strong>Total Geral (Aula + Ativ.):</strong> ${formatMinutesToHours(totals.totalClassMinutes + totals.totalActivityMinutes)}</span>
            </div>
          </div>
          
          <div class="signature-area">
            <div class="signature-line">Assinatura do Funcionário</div>
            <div class="signature-line">Assinatura do Responsável</div>
          </div>
          
          <div class="legal-notice">
            Documento gerado conforme Portaria 671/2021 do Ministério do Trabalho e Previdência - Arts. 76 a 79.
            <br>Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Generate AFD for teacher (Portaria 1510/671)
  const generateTeacherAFD = () => {
    if (!selectedTeacher || timeRecords.length === 0) {
      toast.error('Selecione um professor e busque os registros primeiro');
      return;
    }

    const selectedEmployee = employees.find(e => e.id === selectedTeacher);
    const startDate = format(startOfMonth(filterMonth), 'ddMMyyyy');
    const endDate = format(endOfMonth(filterMonth), 'ddMMyyyy');

    const lines: string[] = [];
    
    // Header line (Type 1)
    const header = [
      '1',
      '1',
      (companySettings?.cnpj || '00000000000000').replace(/\D/g, '').padStart(14, '0'),
      '000000000000',
      (companySettings?.company_name || 'EMPRESA').padEnd(150, ' ').slice(0, 150),
      '00000000000000000',
      startDate,
      endDate,
      format(new Date(), 'ddMMyyyyHHmmss'),
    ].join('');
    lines.push(header);

    // Record lines (Type 3)
    timeRecords.forEach((record) => {
      const recordLine = [
        '3',
        String(record.nsr).padStart(9, '0'),
        '1',
        (selectedEmployee?.pis || '00000000000').replace(/\D/g, '').padStart(11, '0'),
        format(parseISO(record.recorded_at), 'ddMMyyyy'),
        format(parseISO(record.recorded_at), 'HHmm'),
      ].join('');
      lines.push(recordLine);
    });

    // Trailer line (Type 9)
    const trailer = [
      '9',
      String(lines.length + 1).padStart(9, '0'),
    ].join('');
    lines.push(trailer);

    downloadFile(lines.join('\r\n'), `AFD_PROFESSOR_${selectedEmployee?.full_name?.replace(/\s/g, '_')}_${format(filterMonth, 'yyyy_MM')}.txt`);
    toast.success('AFD gerado com sucesso!');
  };

  // Download file helper
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Auto-register classes from time records
  const autoRegisterClassesFromPunch = async () => {
    if (!selectedTeacher) {
      toast.error('Selecione um professor primeiro');
      return;
    }

    const teacherAssignment = assignments.find(a => a.profile_id === selectedTeacher && a.is_active);
    if (!teacherAssignment) {
      toast.error('Professor não possui configuração de aulas atribuída');
      return;
    }

    const config = configurations.find(c => c.id === teacherAssignment.class_hour_configuration_id);
    if (!config) {
      toast.error('Configuração de aulas não encontrada');
      return;
    }

    // For each day with time records, calculate classes based on worked hours
    let classesRegistered = 0;
    const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

    for (const day of timesheetData) {
      // Skip if no punch records or already has class records
      if (day.workedMinutes === 0 || day.totalClasses > 0) continue;

      // Calculate number of classes based on worked minutes and class duration
      const possibleClasses = Math.floor(day.workedMinutes / config.duration_minutes);
      if (possibleClasses <= 0) continue;

      // Check max consecutive classes
      const maxClasses = Math.min(possibleClasses, config.max_consecutive_classes || 4);
      const totalMinutes = maxClasses * config.duration_minutes;

      try {
        const { error } = await supabase.from('class_records').insert({
          profile_id: selectedTeacher,
          class_hour_configuration_id: config.id,
          class_date: day.date,
          number_of_classes: maxClasses,
          total_minutes: totalMinutes,
          notes: 'Gerado automaticamente a partir do registro de ponto',
          company_id: profile?.company_id,
        });

        if (!error) classesRegistered++;
      } catch (error) {
        console.error('Error registering class:', error);
      }
    }

    if (classesRegistered > 0) {
      toast.success(`${classesRegistered} dia(s) de aulas registrados automaticamente!`);
      fetchData();
      fetchTeacherTimeRecords(selectedTeacher);
    } else {
      toast.info('Nenhuma aula nova para registrar (dias já possuem registros ou sem ponto)');
    }
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
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="configurations" className="gap-2">
            <School className="h-4 w-4" />
            <span className="hidden md:inline">Configurações</span>
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Professores</span>
          </TabsTrigger>
          <TabsTrigger value="schedule-board" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden md:inline">Quadro Horários</span>
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden md:inline">Aulas</span>
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden md:inline">Resumo</span>
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

        {/* Schedule Board Tab */}
        <TabsContent value="schedule-board" className="space-y-4">
          <TeacherScheduleBoard
            assignments={assignments}
            employees={employees}
            onRefresh={fetchData}
          />
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
                  value={assignmentForm.work_schedule_id || "none"}
                  onValueChange={(v) => setAssignmentForm({ ...assignmentForm, work_schedule_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {schedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {schedule.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Educator Type and Teaching Level - EducaNet Compatible */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Educador (EducaNet)</Label>
                <Select
                  value={assignmentForm.educator_type}
                  onValueChange={(v) => setAssignmentForm({ ...assignmentForm, educator_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(educatorTypes).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nível de Ensino</Label>
                <Select
                  value={assignmentForm.teaching_level}
                  onValueChange={(v) => setAssignmentForm({ ...assignmentForm, teaching_level: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(teachingLevels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Disciplina</Label>
                <Select
                  value={assignmentForm.subject || "none"}
                  onValueChange={(v) => setAssignmentForm({ ...assignmentForm, subject: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {subjects.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Carga Semanal (h)</Label>
                <Input
                  type="number"
                  value={assignmentForm.contract_weekly_hours}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, contract_weekly_hours: e.target.value })}
                  placeholder="Ex: 20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
