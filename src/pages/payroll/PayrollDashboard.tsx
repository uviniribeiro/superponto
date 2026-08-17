import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Wallet, 
  Users, 
  FileText, 
  Clock,
  RefreshCw
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';

interface Payroll {
  id: string;
  reference_month: number;
  reference_year: number;
  period_start: string;
  period_end: string;
  status: string;
  total_net: number;
  employee_count: number;
}

export default function PayrollDashboard() {
  useSEO({
    title: 'Dashboard Folha de Pagamento | Ponto Max',
    description: 'Dashboard da folha de pagamento com visão geral.',
  });

  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchPayrolls();
  }, [selectedYear]);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payrolls')
        .select('id, reference_month, reference_year, period_start, period_end, status, total_net, employee_count')
        .eq('reference_year', selectedYear)
        .order('reference_month', { ascending: false });

      if (error) throw error;
      setPayrolls((data || []) as Payroll[]);
    } catch (error) {
      console.error('Error fetching payrolls:', error);
      toast.error('Erro ao carregar folhas');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => ({
    totalPayrolls: payrolls.length,
    totalEmployees: payrolls.reduce((sum, p) => sum + p.employee_count, 0),
    totalNet: payrolls.reduce((sum, p) => sum + (p.total_net || 0), 0),
    pendingCount: payrolls.filter(p => p.status === 'draft' || p.status === 'processing').length,
  }), [payrolls]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'draft': { label: 'Rascunho', variant: 'secondary' },
      'processing': { label: 'Processando', variant: 'outline' },
      'calculated': { label: 'Calculada', variant: 'default' },
      'approved': { label: 'Aprovada', variant: 'default' },
      'paid': { label: 'Paga', variant: 'default' },
      'cancelled': { label: 'Cancelada', variant: 'destructive' },
    };
    const s = statusMap[status] || { label: status, variant: 'secondary' };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const getMonthName = (month: number) => {
    return format(new Date(2024, month - 1, 1), 'MMMM', { locale: ptBR });
  };

  if (loading && payrolls.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Dashboard Folha de Pagamento
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral da folha de pagamento
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchPayrolls} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Folhas {selectedYear}</p>
                <p className="text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-400">{stats.totalPayrolls}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <FileText className="h-5 w-5 lg:h-6 lg:w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Funcionários</p>
                <p className="text-2xl lg:text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalEmployees}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Líquido</p>
                <p className="text-xl lg:text-2xl font-bold text-purple-600 dark:text-purple-400">
                  R$ {stats.totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <Wallet className="h-5 w-5 lg:h-6 lg:w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl lg:text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.pendingCount}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/10">
                <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payrolls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Folhas de {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Funcionários</TableHead>
                <TableHead>Total Líquido</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls.slice(0, 6).map((payroll) => (
                <TableRow key={payroll.id}>
                  <TableCell className="font-medium capitalize">{getMonthName(payroll.reference_month)}</TableCell>
                  <TableCell>
                    {format(new Date(payroll.period_start), 'dd/MM')} - {format(new Date(payroll.period_end), 'dd/MM')}
                  </TableCell>
                  <TableCell>{payroll.employee_count}</TableCell>
                  <TableCell>R$ {payroll.total_net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{getStatusBadge(payroll.status)}</TableCell>
                </TableRow>
              ))}
              {payrolls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma folha cadastrada para {selectedYear}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
