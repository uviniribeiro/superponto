import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Shield, TrendingUp, Users, Clock, AlertTriangle, Building2, FileDown, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface MonthlyComparison {
  month: string;
  currentYear: number;
  previousYear: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const PDF_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function OvertimeDashboard() {
  const { isAdmin, isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [allEmployeeData, setAllEmployeeData] = useState<OvertimeData[]>([]);
  const [employeeData, setEmployeeData] = useState<OvertimeData[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyComparison[]>([]);
  const [totalOvertime, setTotalOvertime] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [departments, setDepartments] = useState<string[]>([]);

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
      fetchMonthlyComparison();
      fetchAlertCount();
    }
  }, [selectedMonth, isAdmin, isManager]);

  useEffect(() => {
    // Filter data by department
    if (selectedDepartment === 'all') {
      setEmployeeData(allEmployeeData.slice(0, 10));
      setTotalOvertime(Math.round(allEmployeeData.reduce((sum, d) => sum + d.overtimeHours, 0) * 10) / 10);
    } else {
      const filtered = allEmployeeData.filter(e => e.department === selectedDepartment);
      setEmployeeData(filtered.slice(0, 10));
      setTotalOvertime(Math.round(filtered.reduce((sum, d) => sum + d.overtimeHours, 0) * 10) / 10);
    }
  }, [selectedDepartment, allEmployeeData]);

  const fetchOvertimeData = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, department')
        .eq('is_active', true);

      if (!profiles) return;

      const { data: timeRecords } = await supabase
        .from('time_records')
        .select('*')
        .gte('recorded_at', startDate.toISOString())
        .lte('recorded_at', endDate.toISOString())
        .order('recorded_at');

      const { data: employeeSchedules } = await supabase
        .from('employee_schedules')
        .select('profile_id, schedule_id');

      const { data: workSchedules } = await supabase
        .from('work_schedules')
        .select('*');

      const overtimeByEmployee: Record<string, { overtime: number; regular: number; department: string; name: string }> = {};
      const uniqueDepartments = new Set<string>();

      profiles.forEach(profile => {
        const dept = profile.department || 'Sem departamento';
        uniqueDepartments.add(dept);
        
        const schedule = employeeSchedules?.find(es => es.profile_id === profile.id);
        const workSchedule = schedule ? workSchedules?.find(ws => ws.id === schedule.schedule_id) : null;
        
        const employeeRecords = timeRecords?.filter(tr => tr.profile_id === profile.id) || [];
        
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
          department: dept,
          name: profile.full_name
        };
      });

      setDepartments(Array.from(uniqueDepartments).sort());

      const employeeDataArray: OvertimeData[] = Object.values(overtimeByEmployee)
        .map(data => ({
          employee: data.name,
          department: data.department,
          overtimeHours: Math.round(data.overtime * 10) / 10,
          regularHours: Math.round(data.regular * 10) / 10
        }))
        .filter(d => d.overtimeHours > 0)
        .sort((a, b) => b.overtimeHours - a.overtimeHours);

      setAllEmployeeData(employeeDataArray);
      setEmployeeData(employeeDataArray.slice(0, 10));

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

  const fetchMonthlyComparison = async () => {
    try {
      const comparison: MonthlyComparison[] = [];
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;
      
      for (let m = 0; m < 12; m++) {
        const monthName = format(new Date(currentYear, m), 'MMM', { locale: ptBR });
        
        // Current year data
        const currentStart = startOfMonth(new Date(currentYear, m));
        const currentEnd = endOfMonth(new Date(currentYear, m));
        
        const { data: currentAlerts } = await supabase
          .from('overtime_alerts')
          .select('hours_worked')
          .gte('created_at', currentStart.toISOString())
          .lte('created_at', currentEnd.toISOString());

        const currentTotal = currentAlerts?.reduce((sum, a) => sum + Number(a.hours_worked), 0) || 0;

        // Previous year data
        const prevStart = startOfMonth(new Date(previousYear, m));
        const prevEnd = endOfMonth(new Date(previousYear, m));
        
        const { data: prevAlerts } = await supabase
          .from('overtime_alerts')
          .select('hours_worked')
          .gte('created_at', prevStart.toISOString())
          .lte('created_at', prevEnd.toISOString());

        const prevTotal = prevAlerts?.reduce((sum, a) => sum + Number(a.hours_worked), 0) || 0;
        
        comparison.push({
          month: monthName,
          currentYear: Math.round(currentTotal * 10) / 10,
          previousYear: Math.round(prevTotal * 10) / 10
        });
      }

      setMonthlyComparison(comparison);
    } catch (error) {
      console.error('Error fetching monthly comparison:', error);
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

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: ptBR });

      // Header
      doc.setFontSize(20);
      doc.setTextColor(59, 130, 246);
      doc.text('Relatório de Horas Extras', 14, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Período: ${monthLabel}`, 14, 30);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 37);
      
      if (selectedDepartment !== 'all') {
        doc.text(`Departamento: ${selectedDepartment}`, 14, 44);
      }

      // Summary
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Resumo', 14, 55);
      
      doc.setFontSize(10);
      doc.setTextColor(60);
      const summaryY = 62;
      doc.text(`Total de Horas Extras: ${totalOvertime}h`, 14, summaryY);
      doc.text(`Funcionários com HE: ${employeeData.length}`, 14, summaryY + 7);
      doc.text(`Departamentos: ${departmentData.length}`, 100, summaryY);
      doc.text(`Alertas Gerados: ${alertCount}`, 100, summaryY + 7);

      // Employee Table
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Top Funcionários - Horas Extras', 14, summaryY + 22);

      const dataToExport = selectedDepartment === 'all' ? allEmployeeData : allEmployeeData.filter(e => e.department === selectedDepartment);
      
      autoTable(doc, {
        startY: summaryY + 28,
        head: [['Funcionário', 'Departamento', 'Horas Extras', 'Horas Regulares']],
        body: dataToExport.slice(0, 20).map(emp => [
          emp.employee,
          emp.department,
          `${emp.overtimeHours}h`,
          `${emp.regularHours}h`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
      });

      // Department Table
      const finalY = (doc as any).lastAutoTable.finalY || summaryY + 80;
      
      if (finalY < 200) {
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('Resumo por Departamento', 14, finalY + 15);

        autoTable(doc, {
          startY: finalY + 21,
          head: [['Departamento', 'Funcionários', 'Total HE', 'Média/Func.', 'Status']],
          body: departmentData.map(dept => [
            dept.name,
            dept.employeeCount.toString(),
            `${dept.totalOvertime}h`,
            `${(dept.totalOvertime / dept.employeeCount).toFixed(1)}h`,
            dept.totalOvertime > 20 ? 'Alto' : dept.totalOvertime > 10 ? 'Médio' : 'Normal'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 9 },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `PontoMax - Sistema de Controle de Ponto | Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      doc.save(`relatorio-horas-extras-${selectedMonth}.pdf`);
      toast.success('Relatório PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setExporting(false);
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
        <div className="flex flex-wrap gap-2">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os departamentos</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Button onClick={exportToPDF} disabled={exporting || loading} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />
            {exporting ? 'Gerando...' : 'Exportar PDF'}
          </Button>
        </div>
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
            <p className="text-xs text-muted-foreground">
              {selectedDepartment === 'all' ? 'No mês selecionado' : `Dept: ${selectedDepartment}`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários com HE</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedDepartment === 'all' 
                ? allEmployeeData.length 
                : allEmployeeData.filter(e => e.department === selectedDepartment).length}
            </div>
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
              <CardTitle>
                Top 10 Funcionários - Horas Extras
                {selectedDepartment !== 'all' && (
                  <Badge variant="secondary" className="ml-2 font-normal">
                    {selectedDepartment}
                  </Badge>
                )}
              </CardTitle>
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

          {/* Monthly Year Comparison */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Comparativo Anual de Horas Extras</CardTitle>
              <CardDescription>
                Comparação mês a mês entre {new Date().getFullYear()} e {new Date().getFullYear() - 1}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis unit="h" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value}h`, 
                      name === 'currentYear' ? new Date().getFullYear().toString() : (new Date().getFullYear() - 1).toString()
                    ]}
                  />
                  <Legend 
                    formatter={(value) => value === 'currentYear' ? new Date().getFullYear().toString() : (new Date().getFullYear() - 1).toString()}
                  />
                  <Bar dataKey="currentYear" name="currentYear" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previousYear" name="previousYear" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
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
                      <tr 
                        key={index} 
                        className={`border-b last:border-0 cursor-pointer hover:bg-muted/50 ${selectedDepartment === dept.name ? 'bg-primary/5' : ''}`}
                        onClick={() => setSelectedDepartment(selectedDepartment === dept.name ? 'all' : dept.name)}
                      >
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
