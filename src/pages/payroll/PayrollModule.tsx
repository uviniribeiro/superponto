import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Wallet, 
  Users, 
  FileText, 
  Settings,
  LayoutGrid,
  Search,
  Plus,
  Send,
  Download,
  CheckCircle,
  Clock,
  Calculator,
  RefreshCw,
  Eye
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';
import PayrollItems from './PayrollItems';
import PayrollList from './PayrollList';
import PayslipViewer from './PayslipViewer';

interface Payroll {
  id: string;
  reference_month: number;
  reference_year: number;
  period_start: string;
  period_end: string;
  payment_date: string | null;
  status: string;
  total_earnings: number;
  total_deductions: number;
  total_net: number;
  employee_count: number;
}

interface PayrollStats {
  totalPayrolls: number;
  totalEmployees: number;
  totalNet: number;
  pendingCount: number;
}

interface PayrollModuleProps {
  defaultTab?: string;
}

export default function PayrollModule({ defaultTab = 'overview' }: PayrollModuleProps) {
  const { profile } = useAuth();
  
  useSEO({
    title: 'Folha de Pagamento | SuperPonto',
    description: 'Gestão completa de folha de pagamento, holerites e contra-cheques.',
  });

  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchPayrolls();
  }, [selectedYear]);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payrolls')
        .select('*')
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

  const stats = useMemo<PayrollStats>(() => {
    const totalPayrolls = payrolls.length;
    const totalEmployees = payrolls.reduce((sum, p) => sum + p.employee_count, 0);
    const totalNet = payrolls.reduce((sum, p) => sum + (p.total_net || 0), 0);
    const pendingCount = payrolls.filter(p => p.status === 'draft' || p.status === 'processing').length;
    return { totalPayrolls, totalEmployees, totalNet, pendingCount };
  }, [payrolls]);

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
          <p className="text-muted-foreground">Carregando folha de pagamento...</p>
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
            Folha de Pagamento
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de folha, holerites e contra-cheques
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
                <p className="text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.totalPayrolls}
                </p>
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
                <p className="text-2xl lg:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalEmployees}
                </p>
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
                <p className="text-2xl lg:text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.pendingCount}
                </p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/10">
                <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <TabsList className="bg-muted/50 p-1 h-auto flex-wrap justify-start">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="payrolls" className="gap-2 data-[state=active]:bg-background">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Folhas</span>
            </TabsTrigger>
            <TabsTrigger value="payslips" className="gap-2 data-[state=active]:bg-background">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Holerites</span>
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2 data-[state=active]:bg-background">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Rubricas</span>
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6 mt-0">
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
                      <TableCell className="font-medium capitalize">
                        {getMonthName(payroll.reference_month)}
                      </TableCell>
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
        </TabsContent>

        <TabsContent value="payrolls" className="mt-0">
          <PayrollList payrolls={payrolls} onRefresh={fetchPayrolls} />
        </TabsContent>

        <TabsContent value="payslips" className="mt-0">
          <PayslipViewer payrolls={payrolls} />
        </TabsContent>

        <TabsContent value="items" className="mt-0">
          <PayrollItems />
        </TabsContent>
      </Tabs>
    </div>
  );
}