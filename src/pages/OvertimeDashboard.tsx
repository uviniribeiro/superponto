import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Shield, TrendingUp, Users, Clock, AlertTriangle, Building2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OvertimeData {
  employee: string;
  department: string;
  overtimeHours: number;
  regularHours: number;
}

interface DepartmentData {
  name: string;
  totalOvertime: number;
  employeeCount: number;
}

interface MonthlyTrend {
  month: string;
  overtime: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function OvertimeDashboard() {
  const { isAdmin, isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [employeeData, setEmployeeData] = useState<OvertimeData[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [totalOvertime, setTotalOvertime] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  });

  useEffect(() => {
    if (isAdmin || isManager) {
      fetchOvertimeData();
      fetchMonthlyTrend();
      fetchAlertCount();
    }
  }, [selectedMonth, isAdmin, isManager]);

  const fetchOvertimeData = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, department')
        .eq('is_active', true);

      if (!profiles) return;

      // Fetch time records for the month
      const { data: timeRecords } = await supabase
        .from('time_records')
        .select('*')
        .gte('recorded_at', startDate.toISOString())
        .lte('recorded_at', endDate.toISOString())
        .order('recorded_at');

      // Fetch schedules
      const { data: employeeSchedules } = await supabase
        .from('employee_schedules')
        .select('profile_id, schedule_id');

      const { data: workSchedules } = await supabase
        .from('work_schedules')
        .select('*');

      // Calculate overtime per employee
      const overtimeByEmployee: Record<string, { overtime: number; regular: number; department: string; name: string }> = {};

      profiles.forEach(profile => {
        const schedule = employeeSchedules?.find(es => es.profile_id === profile.id);
        const workSchedule = schedule ? workSchedules?.find(ws => ws.id === schedule.schedule_id) : null;
        
        // Get employee's time records
        const employeeRecords = timeRecords?.filter(tr => tr.profile_id === profile.id) || [];
        
        // Group by date
        const recordsByDate: Record<string, typeof employeeRecords> = {};
        employeeRecords.forEach(record => {
          const date = format(parseISO(record.recorded_at), 'yyyy-MM-dd');
          if (!recordsByDate[date]) recordsByDate[date] = [];
          recordsByDate[date].push(record);
        });

        let totalWorked = 0;
        let expectedHours = 0;

        Object.entries(recordsByDate).forEach(([date, records]) => {
          const dayOfWeek = format(parseISO(date), 'EEEE', { locale: ptBR }).toLowerCase();
          const dayMap: Record<string, string> = {
            'segunda-feira': 'monday',
            'terça-feira': 'tuesday',
            'quarta-feira': 'wednesday',
            'quinta-feira': 'thursday',
            'sexta-feira': 'friday',
            'sábado': 'saturday',
            'domingo': 'sunday'
          };
          
          const englishDay = dayMap[dayOfWeek] || 'monday';
          const startKey = `${englishDay}_start` as keyof typeof workSchedule;
          const endKey = `${englishDay}_end` as keyof typeof workSchedule;

          if (workSchedule && workSchedule[startKey] && workSchedule[endKey]) {
            const [startH, startM] = (workSchedule[startKey] as string).split(':').map(Number);
            const [endH, endM] = (workSchedule[endKey] as string).split(':').map(Number);
            const expectedMinutes = (endH * 60 + endM) - (startH * 60 + startM) - (workSchedule.break_duration_minutes || 60);
            expectedHours += expectedMinutes / 60;
          }

          // Calculate worked hours from records
          const sortedRecords = records.sort((a, b) => 
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );

          for (let i = 0; i < sortedRecords.length - 1; i += 2) {
            if (sortedRecords[i + 1]) {
              const minutes = differenceInMinutes(
                parseISO(sortedRecords[i + 1].recorded_at),
                parseISO(sortedRecords[i].recorded_at)
              );
              totalWorked += minutes / 60;
            }
          }
        });

        const overtime = Math.max(0, totalWorked - expectedHours);
        
        overtimeByEmployee[profile.id] = {
          overtime,
          regular: Math.min(totalWorked, expectedHours),
          department: profile.department || 'Sem departamento',
          name: profile.full_name
        };
      });

      // Format employee data
      const employeeDataArray: OvertimeData[] = Object.values(overtimeByEmployee)
        .map(data => ({
          employee: data.name,
          department: data.department,
          overtimeHours: Math.round(data.overtime * 10) / 10,
          regularHours: Math.round(data.regular * 10) / 10
        }))
        .filter(d => d.overtimeHours > 0)
        .sort((a, b) => b.overtimeHours - a.overtimeHours)
        .slice(0, 10);

      setEmployeeData(employeeDataArray);

      // Aggregate by department
      const deptMap: Record<string, { total: number; count: number }> = {};
      Object.values(overtimeByEmployee).forEach(data => {
        if (!deptMap[data.department]) {
          deptMap[data.department] = { total: 0, count: 0 };
        }
        deptMap[data.department].total += data.overtime;
        deptMap[data.department].count++;
      });

      const deptData: DepartmentData[] = Object.entries(deptMap)
        .map(([name, data]) => ({
          name,
          totalOvertime: Math.round(data.total * 10) / 10,
          employeeCount: data.count
        }))
        .sort((a, b) => b.totalOvertime - a.totalOvertime);

      setDepartmentData(deptData);
      setTotalOvertime(Math.round(Object.values(overtimeByEmployee).reduce((sum, d) => sum + d.overtime, 0) * 10) / 10);

    } catch (error) {
      console.error('Error fetching overtime data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyTrend = async () => {
    try {
      const trends: MonthlyTrend[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const { data: alerts } = await supabase
          .from('overtime_alerts')
          .select('hours_worked')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        const totalOvertime = alerts?.reduce((sum, a) => sum + Number(a.hours_worked), 0) || 0;
        
        trends.push({
          month: format(date, 'MMM', { locale: ptBR }),
          overtime: Math.round(totalOvertime * 10) / 10
        });
      }

      setMonthlyTrend(trends);
    } catch (error) {
      console.error('Error fetching monthly trend:', error);
    }
  };

  const fetchAlertCount = async () => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      const { count } = await supabase
        .from('overtime_alerts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      setAlertCount(count || 0);
    } catch (error) {
      console.error('Error fetching alert count:', error);
    }
  };

  if (!isAdmin && !isManager) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas administradores e gerentes podem acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dashboard de Horas Extras</h1>
            <p className="text-muted-foreground">
              Análise de horas extras por departamento e funcionário
            </p>
          </div>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value} className="capitalize">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Horas Extras</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOvertime}h</div>
            <p className="text-xs text-muted-foreground">No mês selecionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários com HE</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeeData.length}</div>
            <p className="text-xs text-muted-foreground">Com horas extras registradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departamentos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departmentData.length}</div>
            <p className="text-xs text-muted-foreground">Com registros de HE</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Gerados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertCount}</div>
            <p className="text-xs text-muted-foreground">Limites ultrapassados</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Employees Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Funcionários - Horas Extras</CardTitle>
              <CardDescription>Funcionários com mais horas extras no período</CardDescription>
            </CardHeader>
            <CardContent>
              {employeeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employeeData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" unit="h" />
                    <YAxis dataKey="employee" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value}h`, 'Horas Extras']}
                      labelFormatter={(label) => `Funcionário: ${label}`}
                    />
                    <Bar dataKey="overtimeHours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum registro de horas extras encontrado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Department Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Horas Extras por Departamento</CardTitle>
              <CardDescription>Distribuição de horas extras entre departamentos</CardDescription>
            </CardHeader>
            <CardContent>
              {departmentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentData}
                      dataKey="totalOvertime"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {departmentData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value}h`, 'Horas Extras']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum departamento com horas extras
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Tendência de Horas Extras</CardTitle>
              <CardDescription>Evolução das horas extras nos últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis unit="h" />
                  <Tooltip formatter={(value: number) => [`${value}h`, 'Horas Extras']} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="overtime" 
                    name="Horas Extras"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Department Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Resumo por Departamento</CardTitle>
              <CardDescription>Detalhamento de horas extras por departamento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Departamento</th>
                      <th className="text-right py-3 px-4 font-medium">Funcionários</th>
                      <th className="text-right py-3 px-4 font-medium">Total HE</th>
                      <th className="text-right py-3 px-4 font-medium">Média/Func.</th>
                      <th className="text-right py-3 px-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentData.map((dept, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-3 px-4 font-medium">{dept.name}</td>
                        <td className="py-3 px-4 text-right">{dept.employeeCount}</td>
                        <td className="py-3 px-4 text-right">{dept.totalOvertime}h</td>
                        <td className="py-3 px-4 text-right">
                          {(dept.totalOvertime / dept.employeeCount).toFixed(1)}h
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Badge variant={dept.totalOvertime > 20 ? 'destructive' : dept.totalOvertime > 10 ? 'default' : 'secondary'}>
                            {dept.totalOvertime > 20 ? 'Alto' : dept.totalOvertime > 10 ? 'Médio' : 'Normal'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {departmentData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Nenhum dado disponível para o período selecionado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
