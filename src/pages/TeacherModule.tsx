import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, parseISO, eachDayOfInterval, isWeekend, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Plus, Trash2, CalendarIcon, Clock, BookOpen, 
  DollarSign, GraduationCap, FileText, School,
  Download, Printer, ClipboardList, LayoutGrid, Search
} from 'lucide-react';
import TeacherScheduleBoard, { educatorTypes, teachingLevels, subjects } from '@/components/teachers/TeacherScheduleBoard';
import TeacherConfigurations from './teacher/TeacherConfigurations';
import TeacherAssignments from './teacher/TeacherAssignments';
import useSEO from '@/hooks/useSEO';

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
}

interface DailyTimesheet {
  date: string;
  dayOfWeek: string;
  entry: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  exit: string | null;
  workedMinutes: number;
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

interface CompanySettings {
  company_name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

export default function TeacherModule() {
  const { profile } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  useSEO({
    title: 'Módulo Professor | PontoMax',
    description: 'Gestão completa de professores: hora aula, hora atividade, quadro de horários e espelho de ponto.',
  });

  const [configurations, setConfigurations] = useState<TeacherConfiguration[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [records, setRecords] = useState<ClassRecord[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [timesheetData, setTimesheetData] = useState<DailyTimesheet[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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
        supabase.from('company_settings').select('company_name, cnpj, address, city, state').limit(1).maybeSingle(),
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
      toast.success('Aulas registradas!');
      setRecordDialogOpen(false);
      resetRecordForm();
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao registrar: ' + error.message);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Excluir este registro?')) return;
    try {
      const { error } = await supabase.from('class_records').delete().eq('id', id);
      if (error) throw error;
      toast.success('Registro excluído!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
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
        const activityPercent = r.class_hour_configuration.activity_hours_percent || 33.33;
        activityHours += (r.total_minutes * activityPercent) / 100;
      }
    });

    return { totalClasses, totalMinutes, totalValue, activityHours };
  };

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
      toast.error('Erro ao carregar registros');
    }
  };

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
      const holiday = holidays.find(h => h.date === dateStr);
      
      const dayRecords = timeRecordsData.filter(r => 
        format(parseISO(r.recorded_at), 'yyyy-MM-dd') === dateStr
      );
      
      const entry = dayRecords.find(r => r.record_type === 'entry');
      const breakStart = dayRecords.find(r => r.record_type === 'break_start');
      const breakEnd = dayRecords.find(r => r.record_type === 'break_end');
      const exit = dayRecords.find(r => r.record_type === 'exit');

      let workedMinutes = 0;
      if (entry && exit) {
        const entryTime = parseISO(entry.recorded_at);
        const exitTime = parseISO(exit.recorded_at);
        workedMinutes = differenceInMinutes(exitTime, entryTime);
        
        if (breakStart && breakEnd) {
          workedMinutes -= differenceInMinutes(parseISO(breakEnd.recorded_at), parseISO(breakStart.recorded_at));
        }
      }

      const dayClassRecords = teacherClassRecords.filter(r => r.class_date === dateStr);
      const totalClasses = dayClassRecords.reduce((sum, r) => sum + r.number_of_classes, 0);
      const totalClassMinutes = dayClassRecords.reduce((sum, r) => sum + r.total_minutes, 0);
      const activityMinutes = Math.round((totalClassMinutes * activityPercent) / 100);

      return {
        date: dateStr,
        dayOfWeek,
        entry: entry ? format(parseISO(entry.recorded_at), 'HH:mm') : null,
        breakStart: breakStart ? format(parseISO(breakStart.recorded_at), 'HH:mm') : null,
        breakEnd: breakEnd ? format(parseISO(breakEnd.recorded_at), 'HH:mm') : null,
        exit: exit ? format(parseISO(exit.recorded_at), 'HH:mm') : null,
        workedMinutes,
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

  const calculateTimesheetTotals = () => {
    return {
      totalWorkedMinutes: timesheetData.reduce((sum, d) => sum + d.workedMinutes, 0),
      totalClasses: timesheetData.reduce((sum, d) => sum + d.totalClasses, 0),
      totalClassMinutes: timesheetData.reduce((sum, d) => sum + d.totalClassMinutes, 0),
      totalActivityMinutes: timesheetData.reduce((sum, d) => sum + d.activityMinutes, 0),
      totalDaysWorked: timesheetData.filter(d => d.workedMinutes > 0 || d.totalClasses > 0).length,
    };
  };

  const formatMinutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const handlePrintTimesheet = () => {
    const selectedEmployee = employees.find(e => e.id === selectedTeacher);
    if (!selectedEmployee) return;
    const totals = calculateTimesheetTotals();

    const printWindow = window.open('', '', 'height=600,width=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Espelho de Ponto - ${selectedEmployee.full_name}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
            h1 { font-size: 14px; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { border: 1px solid #000; padding: 3px; text-align: center; }
            th { background: #f0f0f0; }
            .weekend { background: #f5f5f5; }
            .holiday { background: #ffe0e0; }
          </style>
        </head>
        <body>
          <h1>ESPELHO DE PONTO - ${selectedEmployee.full_name}</h1>
          <p>Período: ${format(startOfMonth(filterMonth), 'dd/MM/yyyy')} a ${format(endOfMonth(filterMonth), 'dd/MM/yyyy')}</p>
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Dia</th><th>Entrada</th><th>Intervalo</th><th>Retorno</th><th>Saída</th><th>Horas</th><th>Aulas</th>
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
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p><strong>Total:</strong> ${totals.totalDaysWorked} dias | ${formatMinutesToHours(totals.totalWorkedMinutes)} trabalhadas | ${totals.totalClasses} aulas</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    const search = searchTerm.toLowerCase();
    return records.filter(r => 
      r.profile?.full_name?.toLowerCase().includes(search) ||
      r.class_hour_configuration?.name?.toLowerCase().includes(search)
    );
  }, [records, searchTerm]);

  const filteredEmployeesWithRecords = useMemo(() => {
    return employees.filter(emp => records.some(r => r.profile_id === emp.id));
  }, [employees, records]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin-slow h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Módulo Professor</h1>
          <p className="text-muted-foreground">
            Gestão de hora aula, atribuições e espelho de ponto
          </p>
        </div>
      </div>

      <Tabs defaultValue="configurations" className="space-y-4" data-tour="teacher-tabs">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto gap-1">
          <TabsTrigger value="configurations" className="flex items-center gap-2 py-2">
            <School className="h-4 w-4" />
            <span className="hidden md:inline">Configurações</span>
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-2 py-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden md:inline">Atribuições</span>
          </TabsTrigger>
          <TabsTrigger value="schedule-board" className="flex items-center gap-2 py-2" data-tour="teacher-schedule">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden md:inline">Quadro</span>
          </TabsTrigger>
          <TabsTrigger value="records" className="flex items-center gap-2 py-2" data-tour="teacher-records">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden md:inline">Aulas</span>
          </TabsTrigger>
          <TabsTrigger value="timesheet" className="flex items-center gap-2 py-2" data-tour="teacher-timesheet">
            <FileText className="h-4 w-4" />
            <span className="hidden md:inline">Espelho</span>
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2 py-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden md:inline">Resumo</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-4">
          <TeacherConfigurations configurations={configurations} onRefresh={fetchData} />
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <TeacherAssignments 
            assignments={assignments as any} 
            configurations={configurations as any} 
            employees={employees} 
            schedules={schedules as any}
            onRefresh={fetchData} 
          />
        </TabsContent>

        <TabsContent value="schedule-board" className="space-y-4">
          <TeacherScheduleBoard
            assignments={assignments as any}
            employees={employees as any}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <Label>Mês:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
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
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por professor ou configuração..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={() => { resetRecordForm(); setRecordDialogOpen(true); }} className="gradient-primary btn-press">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Aulas
            </Button>
          </div>

          <Card className="animate-fade-in">
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
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/50 transition-colors">
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
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRecord(record.id)} className="btn-press">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhuma aula registrada neste mês'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timesheet" className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="space-y-2 flex-1">
              <Label>Selecionar Professor</Label>
              <Select value={selectedTeacher} onValueChange={(v) => { setSelectedTeacher(v); fetchTeacherTimeRecords(v); }}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Selecione o professor" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => assignments.some(a => a.profile_id === e.id)).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.registration_number ? `(${emp.registration_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filterMonth, 'MMM yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filterMonth}
                    onSelect={(date) => { date && setFilterMonth(date); if (selectedTeacher) fetchTeacherTimeRecords(selectedTeacher); }}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" onClick={handlePrintTimesheet} disabled={!selectedTeacher} className="btn-press">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>

          {selectedTeacher && timesheetData.length > 0 && (
            <Card ref={printRef} className="animate-fade-in">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Dia</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Intervalo</TableHead>
                      <TableHead>Retorno</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Aulas</TableHead>
                      <TableHead>Hora Aula</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheetData.map(row => (
                      <TableRow 
                        key={row.date} 
                        className={cn(
                          isWeekend(parseISO(row.date)) && 'bg-muted/30',
                          row.isHoliday && 'bg-destructive/10'
                        )}
                      >
                        <TableCell>{format(parseISO(row.date), 'dd/MM')}</TableCell>
                        <TableCell>{row.dayOfWeek.slice(0, 3)}</TableCell>
                        <TableCell>{row.entry || '-'}</TableCell>
                        <TableCell>{row.breakStart || '-'}</TableCell>
                        <TableCell>{row.breakEnd || '-'}</TableCell>
                        <TableCell>{row.exit || '-'}</TableCell>
                        <TableCell>{row.workedMinutes > 0 ? formatMinutesToHours(row.workedMinutes) : '-'}</TableCell>
                        <TableCell>{row.totalClasses || '-'}</TableCell>
                        <TableCell>{row.totalClassMinutes > 0 ? formatMinutesToHours(row.totalClassMinutes) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {!selectedTeacher && (
            <Card className="animate-fade-in">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Selecione um professor para visualizar o espelho de ponto</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

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
            {filteredEmployeesWithRecords.map((emp, index) => {
              const summary = calculateMonthSummary(emp.id);
              return (
                <Card key={emp.id} className={`card-hover animate-fade-in stagger-${Math.min(index + 1, 5)}`}>
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
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-bold">
                          {Math.floor((summary.totalMinutes + summary.activityHours) / 60)}h
                        </span>
                      </div>
                      {summary.totalValue > 0 && (
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-muted-foreground">Valor:</span>
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

          {filteredEmployeesWithRecords.length === 0 && (
            <Card className="animate-fade-in">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum registro de aula neste mês</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
