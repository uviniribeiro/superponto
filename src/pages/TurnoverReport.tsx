import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Users, UserPlus, UserMinus, RefreshCw, FileText, BarChart3 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import useSEO from '@/hooks/useSEO';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface TurnoverMetric {
  id: string;
  period_month: number;
  period_year: number;
  total_employees: number;
  new_hires: number;
  terminations: number;
  turnover_rate: number | null;
  calculated_at: string;
}

interface MonthlyData {
  month: string;
  admissoes: number;
  demissoes: number;
  turnover: number;
  total: number;
}

export default function TurnoverReport() {
  useSEO({
    title: 'Relatório de Turnover | SuperPonto',
    description: 'Análise de rotatividade de funcionários.',
  });

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [metrics, setMetrics] = useState<TurnoverMetric[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    fetchMetrics();
  }, [year]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('turnover_metrics')
        .select('*')
        .eq('period_year', parseInt(year))
        .order('period_month', { ascending: true });

      if (error) throw error;

      setMetrics(data || []);
      
      // Process for charts
      const processed = (data || []).map(m => ({
        month: format(new Date(m.period_year, m.period_month - 1), 'MMM', { locale: ptBR }),
        admissoes: m.new_hires,
        demissoes: m.terminations,
        turnover: m.turnover_rate || 0,
        total: m.total_employees
      }));
      setMonthlyData(processed);
    } catch (error) {
      console.error('Error fetching turnover metrics:', error);
      toast.error('Erro ao carregar métricas de turnover');
    } finally {
      setLoading(false);
    }
  };

  const calculateTurnover = async () => {
    setCalculating(true);
    try {
      // Get current month data
      const currentDate = new Date();
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      
      // Count total active employees
      const { count: totalEmployees } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_system_user', false);

      // Count new hires this month
      const { count: newHires } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('hire_date', format(startDate, 'yyyy-MM-dd'))
        .lte('hire_date', format(endDate, 'yyyy-MM-dd'))
        .eq('is_system_user', false);

      // Calculate turnover rate: ((Admissões + Demissões) / 2) / Total * 100
      const terminations = 0; // Would need a termination_date field
      const avgMovement = ((newHires || 0) + terminations) / 2;
      const turnoverRate = totalEmployees ? (avgMovement / totalEmployees) * 100 : 0;

      // Upsert metric
      const { error } = await supabase
        .from('turnover_metrics')
        .upsert({
          period_month: currentDate.getMonth() + 1,
          period_year: currentDate.getFullYear(),
          total_employees: totalEmployees || 0,
          new_hires: newHires || 0,
          terminations: terminations,
          turnover_rate: turnoverRate,
          calculated_at: new Date().toISOString()
        }, {
          onConflict: 'company_id,period_month,period_year'
        });

      if (error) throw error;

      toast.success('Turnover calculado com sucesso!');
      fetchMetrics();
    } catch (error) {
      console.error('Error calculating turnover:', error);
      toast.error('Erro ao calcular turnover');
    } finally {
      setCalculating(false);
    }
  };

  // Calculate summary
  const totalHires = metrics.reduce((sum, m) => sum + m.new_hires, 0);
  const totalTerminations = metrics.reduce((sum, m) => sum + m.terminations, 0);
  const avgTurnover = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + (m.turnover_rate || 0), 0) / metrics.length 
    : 0;
  const lastMonthEmployees = metrics.length > 0 ? metrics[metrics.length - 1]?.total_employees : 0;

  const years = [];
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 5; y--) {
    years.push(y.toString());
  }

  const COLORS = ['#10b981', '#ef4444', '#6366f1', '#f59e0b'];

  const pieData = [
    { name: 'Admissões', value: totalHires, color: '#10b981' },
    { name: 'Demissões', value: totalTerminations, color: '#ef4444' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando relatório de turnover...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Relatório de Turnover
          </h1>
          <p className="text-muted-foreground">
            Análise de rotatividade de funcionários
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={calculateTurnover} disabled={calculating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
            Calcular
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastMonthEmployees}</div>
            <p className="text-xs text-muted-foreground">Último mês registrado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admissões ({year})</CardTitle>
            <UserPlus className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalHires}</div>
            <p className="text-xs text-muted-foreground">Total no ano</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demissões ({year})</CardTitle>
            <UserMinus className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalTerminations}</div>
            <p className="text-xs text-muted-foreground">Total no ano</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Média Turnover</CardTitle>
            {avgTurnover > 5 ? (
              <TrendingUp className="h-4 w-4 text-amber-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-emerald-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${avgTurnover > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {avgTurnover.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Média mensal do ano</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
            <CardDescription>Admissões e demissões por mês</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="admissoes" name="Admissões" fill="#10b981" />
                <Bar dataKey="demissoes" name="Demissões" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxa de Turnover</CardTitle>
            <CardDescription>Evolução da taxa ao longo do ano</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="turnover" name="Turnover %" stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento Mensal</CardTitle>
          <CardDescription>Dados de rotatividade mês a mês</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum dado de turnover para {year}</p>
              <p className="text-sm mt-2">Clique em "Calcular" para gerar as métricas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Total Funcionários</TableHead>
                  <TableHead className="text-right">Admissões</TableHead>
                  <TableHead className="text-right">Demissões</TableHead>
                  <TableHead className="text-right">Taxa Turnover</TableHead>
                  <TableHead className="text-right">Calculado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((metric) => (
                  <TableRow key={metric.id}>
                    <TableCell className="font-medium">
                      {format(new Date(metric.period_year, metric.period_month - 1), 'MMMM', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">{metric.total_employees}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-emerald-600">
                        +{metric.new_hires}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-red-600">
                        -{metric.terminations}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={metric.turnover_rate && metric.turnover_rate > 5 ? 'destructive' : 'default'}>
                        {metric.turnover_rate?.toFixed(1) || '0.0'}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {format(new Date(metric.calculated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
