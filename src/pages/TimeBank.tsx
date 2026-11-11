import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, getDay, startOfWeek, endOfWeek, eachWeekOfInterval, isSameWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarCheck, Clock, Download, Edit, Minus, Plus, Timer, TrendingDown, TrendingUp } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { TimeBankAdjustmentDialog } from '@/components/timebank/TimeBankAdjustmentDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { expectedHoursForSchedule, workedHoursFromPunches } from '@/lib/timeBank';

interface Profile {
  id: string;
  full_name: string;
}

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
}

interface WorkSchedule {
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
}

interface Holiday {
  date: string;
}

interface DailyBalance {
  date: string;
  expected: number;
  worked: number;
  balance: number;
  isHoliday: boolean;
  isWeekend: boolean;
  weekNumber: number;
}

interface WeeklyDSR {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  hasAbsence: boolean;
  dsrValue: number;
  dsrLost: boolean;
}

const TimeBank = () => {
  const { profile, isAdmin: isAdminRole, isManager: isManagerRole } = useAuth();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const isAdmin = isAdminRole || isManagerRole;
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dailyBalances, setDailyBalances] = useState<DailyBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [summary, setSummary] = useState({
    totalExpected: 0,
    totalWorked: 0,
    totalBalance: 0,
    overtimeHours: 0,
    deficitHours: 0
  });

  const selectedEmployeeName = employees.find(e => e.id === selectedEmployee)?.full_name || '';
  
  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
    } else if (profile) {
      setSelectedEmployee(profile.id);
    }
  }, [isAdmin, profile]);

  useEffect(() => {
    if (selectedEmployee) {
      calculateTimeBank();
    }
  }, [selectedEmployee, startDate, endDate]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');

    if (!error && data) {
      setEmployees(data);
    }
  };

  const getExpectedHoursForDay = (dayOfWeek: number, schedule: WorkSchedule): number => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const day = days[dayOfWeek];
    const start = schedule[`${day}_start` as keyof WorkSchedule] as string | null;
    const end = schedule[`${day}_end` as keyof WorkSchedule] as string | null;

    return expectedHoursForSchedule({ start, end, breakMinutes: schedule.break_duration_minutes });
  };

  const calculateTimeBank = async () => {
    setLoading(true);
    try {
      // Fetch employee schedule
      const { data: scheduleData } = await supabase
        .from('employee_schedules')
        .select('schedule_id, work_schedules(*)')
        .eq('profile_id', selectedEmployee)
        .maybeSingle();

      const schedule = scheduleData?.work_schedules as WorkSchedule | null;

      // Fetch holidays
      const { data: holidaysData } = await supabase
        .from('holidays')
        .select('date')
        .gte('date', startDate)
        .lte('date', endDate);

      const holidays = new Set((holidaysData || []).map(h => h.date));

      // Fetch time records
      const { data: records, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('profile_id', selectedEmployee)
        .gte('recorded_at', `${startDate}T00:00:00`)
        .lte('recorded_at', `${endDate}T23:59:59`)
        .order('recorded_at');

      if (error) throw error;

      // Group records by date
      const recordsByDate: { [key: string]: TimeRecord[] } = {};
      (records || []).forEach(record => {
        const date = format(parseISO(record.recorded_at), 'yyyy-MM-dd');
        if (!recordsByDate[date]) recordsByDate[date] = [];
        recordsByDate[date].push(record);
      });

      // Calculate daily balances
      const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      });

      const balances: DailyBalance[] = [];
      let totalExpected = 0;
      let totalWorked = 0;
      let overtimeHours = 0;
      let deficitHours = 0;

      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);
        const isHolidayDay = holidays.has(dateStr);
        const isWeekendDay = isWeekend(day);

        // Calculate expected hours
        let expected = 0;
        if (!isHolidayDay && schedule) {
          expected = getExpectedHoursForDay(dayOfWeek, schedule);
        }

        // Calculate worked hours
        const dayRecords = recordsByDate[dateStr] || [];
        const worked = workedHoursFromPunches(dayRecords);

        const balance = worked - expected;
        
        totalExpected += expected;
        totalWorked += worked;
        
        if (balance > 0) {
          overtimeHours += balance;
        } else if (balance < 0) {
          deficitHours += Math.abs(balance);
        }

        balances.push({
          date: dateStr,
          expected: Math.round(expected * 100) / 100,
          worked: Math.round(worked * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          isHoliday: isHolidayDay,
          isWeekend: isWeekendDay,
          weekNumber: Math.ceil(day.getDate() / 7)
        });
      });

      setDailyBalances(balances);
      setSummary({
        totalExpected: Math.round(totalExpected * 100) / 100,
        totalWorked: Math.round(totalWorked * 100) / 100,
        totalBalance: Math.round((totalWorked - totalExpected) * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        deficitHours: Math.round(deficitHours * 100) / 100
      });

    } catch (error: any) {
      toast({
        title: "Erro ao calcular banco de horas",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (hours: number): string => {
    const h = Math.floor(Math.abs(hours));
    const m = Math.round((Math.abs(hours) - h) * 60);
    const sign = hours < 0 ? '-' : '';
    return `${sign}${h}h${m.toString().padStart(2, '0')}min`;
  };

  const exportToCSV = () => {
    const employeeName = employees.find(e => e.id === selectedEmployee)?.full_name || 'funcionario';
    const headers = ['Data', 'Esperado (h)', 'Trabalhado (h)', 'Saldo (h)', 'Feriado', 'Fim de Semana'];
    const rows = dailyBalances.map(b => [
      format(parseISO(b.date), 'dd/MM/yyyy'),
      b.expected.toFixed(2),
      b.worked.toFixed(2),
      b.balance.toFixed(2),
      b.isHoliday ? 'Sim' : 'Não',
      b.isWeekend ? 'Sim' : 'Não'
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `banco-horas-${employeeName}-${startDate}-${endDate}.csv`;
    link.click();
  };

  const chartData = dailyBalances
    .filter(b => b.expected > 0 || b.worked > 0)
    .map(b => ({
      date: format(parseISO(b.date), 'dd/MM'),
      balance: b.balance
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-0 flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <PageHeader
          icon={Timer}
          title="Banco de Horas"
          description="Relatório de horas extras e débitos"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <div className="flex gap-2">
          {isAdmin && selectedEmployee && (
            <Button onClick={() => setAdjustmentDialogOpen(true)} variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Ajuste Manual
            </Button>
          )}
          <Button onClick={exportToCSV} disabled={dailyBalances.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isAdmin && (
              <div className="space-y-2">
                <Label>Funcionário</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funcionário" />
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
            )}
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {selectedEmployee && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Horas Esperadas</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                {formatHours(summary.totalExpected)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Horas Trabalhadas</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                {formatHours(summary.totalWorked)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Saldo Total</CardDescription>
              <CardTitle className={`text-2xl flex items-center gap-2 ${
                summary.totalBalance > 0 ? 'text-green-600' : 
                summary.totalBalance < 0 ? 'text-red-600' : ''
              }`}>
                {summary.totalBalance > 0 ? <TrendingUp className="h-5 w-5" /> :
                 summary.totalBalance < 0 ? <TrendingDown className="h-5 w-5" /> :
                 <Minus className="h-5 w-5" />}
                {formatHours(summary.totalBalance)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Horas Extras</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                +{formatHours(summary.overtimeHours)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Horas em Débito</CardDescription>
              <CardTitle className="text-2xl text-red-600">
                -{formatHours(summary.deficitHours)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saldo Diário</CardTitle>
            <CardDescription>
              Visualização do saldo de horas por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis tickFormatter={(v) => `${v}h`} />
                <Tooltip 
                  formatter={(value: number) => [formatHours(value), 'Saldo']}
                />
                <ReferenceLine y={0} stroke="#666" />
                <Bar dataKey="balance">
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.balance >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Details Table */}
      {selectedEmployee && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento Diário</CardTitle>
            <CardDescription>
              Registro detalhado de horas por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Trabalhado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyBalances.map((day) => (
                    <TableRow 
                      key={day.date}
                      className={day.isHoliday || day.isWeekend ? 'bg-muted/50' : ''}
                    >
                      <TableCell>{format(parseISO(day.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        {format(parseISO(day.date), 'EEEE', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">{formatHours(day.expected)}</TableCell>
                      <TableCell className="text-right">{formatHours(day.worked)}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        day.balance > 0 ? 'text-green-600' : 
                        day.balance < 0 ? 'text-red-600' : ''
                      }`}>
                        {day.balance > 0 ? '+' : ''}{formatHours(day.balance)}
                      </TableCell>
                      <TableCell>
                        {day.isHoliday ? 'Feriado' : day.isWeekend ? 'Fim de semana' : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Adjustment Dialog */}
      {isAdmin && (
        <TimeBankAdjustmentDialog
          open={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
          employeeId={selectedEmployee}
          employeeName={selectedEmployeeName}
          companyId={profile?.company_id || ''}
          onSave={calculateTimeBank}
        />
      )}
      
      <HelpButton pageKey="timebank" />
    </div>
  );
};

export default TimeBank;
