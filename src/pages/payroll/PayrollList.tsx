import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Eye, Calculator, CheckCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

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

interface PayrollListProps {
  payrolls: Payroll[];
  onRefresh: () => void;
}

export default function PayrollList({ payrolls, onRefresh }: PayrollListProps) {
  const navigate = useNavigate();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const updateStatus = async (id: string, status: string, successMsg: string) => {
    setBusyId(id);
    const { error } = await supabase.from('payrolls').update({ status }).eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error('Não foi possível atualizar a folha: ' + error.message);
      return;
    }
    toast.success(successMsg);
    onRefresh();
  };

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gradient-primary" onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Folha
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competência</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Funcionários</TableHead>
                <TableHead>Proventos</TableHead>
                <TableHead>Descontos</TableHead>
                <TableHead>Líquido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls.map((payroll) => (
                <TableRow key={payroll.id}>
                  <TableCell className="font-medium capitalize">
                    {getMonthName(payroll.reference_month)}/{payroll.reference_year}
                  </TableCell>
                  <TableCell>
                    {format(new Date(payroll.period_start), 'dd/MM')} - {format(new Date(payroll.period_end), 'dd/MM')}
                  </TableCell>
                  <TableCell>{payroll.employee_count}</TableCell>
                  <TableCell className="text-green-600">
                    R$ {payroll.total_earnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-red-600">
                    R$ {payroll.total_deductions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="font-medium">
                    R$ {payroll.total_net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{getStatusBadge(payroll.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Visualizar">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Calcular">
                        <Calculator className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Aprovar">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Enviar Holerites">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {payrolls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma folha cadastrada
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