import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, AlertTriangle, Calendar, UserX } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

interface Profile {
  id: string;
  full_name: string;
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
}

interface Absence {
  date: string;
  dayOfWeek: string;
  expectedStart: string;
  expectedEnd: string;
  reason: string;
}

interface AbsenceSummary {
  totalAbsences: number;
  totalHoursLost: number;
  weeklyBreakdown: { week: number; absences: number }[];
}

const Absences = () => {
  const { isAdmin: isAdminRole, isManager: isManagerRole, profile } = useAuth();
  const isAdmin = isAdminRole || isManagerRole;
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [summary, setSummary] = useState<AbsenceSummary>({
    totalAbsences: 0,
    totalHoursLost: 0,
    weeklyBreakdown: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
    } else if (profile) {
      setSelectedEmployee(profile.id);
    }
  }, [isAdmin, profile]);

  useEffect(() => {
    if (selectedEmployee) {
      calculateAbsences();
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

  const shouldWorkOnDay = (dayOfWeek: number, schedule: WorkSchedule): { should: boolean; start: string | null; end: string | null } => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const day = days[dayOfWeek];
    const start = schedule[`${day}_start` as keyof WorkSchedule] as string | null;
    const end = schedule[`${day}_end` as keyof WorkSchedule] as string | null;
    return { should: !!(start && end), start, end };
  };

  const calculateAbsences = async () => {
    setLoading(true);
    try {
      // Fetch employee schedule
      const { data: scheduleData } = await supabase
        .from('employee_schedules')
        .select('schedule_id, work_schedules(*)')
        .eq('profile_id', selectedEmployee)
        .maybeSingle();

      const schedule = scheduleData?.work_schedules as WorkSchedule | null;

      if (!schedule) {
        toast({
          title: "Atenção",
          description: "Funcionário não possui jornada de trabalho definida",
          variant: "destructive"
        });
        setAbsences([]);
        setSummary({ totalAbsences: 0, totalHoursLost: 0, weeklyBreakdown: [] });
        setLoading(false);
        return;
      }

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
        .select('recorded_at')
        .eq('profile_id', selectedEmployee)
        .gte('recorded_at', `${startDate}T00:00:00`)
        .lte('recorded_at', `${endDate}T23:59:59`);

      if (error) throw error;

      // Get unique dates with records
      const datesWithRecords = new Set(
        (records || []).map(r => format(parseISO(r.recorded_at), 'yyyy-MM-dd'))
      );

      // Calculate absences
      const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate)
      });

      const today = new Date();
      const foundAbsences: Absence[] = [];
      let totalHoursLost = 0;
      const weeklyAbsences: { [week: number]: number } = {};

      days.forEach(day => {
        // Skip future dates
        if (day > today) return;

        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);
        const weekNumber = Math.ceil(day.getDate() / 7);

        // Check if it's a holiday
        if (holidays.has(dateStr)) return;

        // Check if should work on this day
        const { should, start, end } = shouldWorkOnDay(dayOfWeek, schedule);
        if (!should) return;

        // Check if there are records for this day
        if (!datesWithRecords.has(dateStr)) {
          foundAbsences.push({
            date: dateStr,
            dayOfWeek: format(day, 'EEEE', { locale: ptBR }),
            expectedStart: start!,
            expectedEnd: end!,
            reason: 'Falta injustificada'
          });

          // Calculate hours lost
          const [startHour, startMin] = start!.split(':').map(Number);
          const [endHour, endMin] = end!.split(':').map(Number);
          const hours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
          totalHoursLost += hours;

          weeklyAbsences[weekNumber] = (weeklyAbsences[weekNumber] || 0) + 1;
        }
      });

      setAbsences(foundAbsences);
      setSummary({
        totalAbsences: foundAbsences.length,
        totalHoursLost: Math.round(totalHoursLost * 100) / 100,
        weeklyBreakdown: Object.entries(weeklyAbsences).map(([week, absences]) => ({
          week: Number(week),
          absences
        }))
      });

    } catch (error: any) {
      toast({
        title: "Erro ao calcular faltas",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const employeeName = employees.find(e => e.id === selectedEmployee)?.full_name || 'funcionario';
    const headers = ['Data', 'Dia da Semana', 'Horário Esperado', 'Motivo'];
    const rows = absences.map(a => [
      format(parseISO(a.date), 'dd/MM/yyyy'),
      a.dayOfWeek,
      `${a.expectedStart} - ${a.expectedEnd}`,
      a.reason
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `faltas-${employeeName}-${startDate}-${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          icon={UserX}
          title="Faltas Injustificadas"
          description="Relatório de ausências não justificadas"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={exportToCSV} disabled={absences.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Faltas</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <UserX className="h-5 w-5 text-destructive" />
                {summary.totalAbsences} {summary.totalAbsences === 1 ? 'dia' : 'dias'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Horas Perdidas</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {summary.totalHoursLost}h
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Semanas com Faltas</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                {summary.weeklyBreakdown.length} {summary.weeklyBreakdown.length === 1 ? 'semana' : 'semanas'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Weekly Breakdown */}
      {summary.weeklyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Impacto no DSR</CardTitle>
            <CardDescription>
              Semanas com faltas que afetam o Descanso Semanal Remunerado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.weeklyBreakdown.map(({ week, absences }) => (
                <Badge key={week} variant="destructive" className="text-sm">
                  Semana {week}: {absences} {absences === 1 ? 'falta' : 'faltas'} - DSR perdido
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Absences Table */}
      {selectedEmployee && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento de Faltas</CardTitle>
            <CardDescription>
              Lista de dias com ausência injustificada
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : absences.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma falta injustificada encontrada no período.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Dia da Semana</TableHead>
                    <TableHead>Horário Esperado</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absences.map((absence) => (
                    <TableRow key={absence.date}>
                      <TableCell className="font-medium">
                        {format(parseISO(absence.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="capitalize">{absence.dayOfWeek}</TableCell>
                      <TableCell>{absence.expectedStart} - {absence.expectedEnd}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{absence.reason}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Absences;
