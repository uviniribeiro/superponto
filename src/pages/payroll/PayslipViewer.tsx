import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Eye, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Payroll {
  id: string;
  reference_month: number;
  reference_year: number;
}

interface Payslip {
  id: string;
  payroll_id: string;
  profile_id: string;
  base_salary: number;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  status: string;
  sent_at: string | null;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
}

interface PayslipViewerProps {
  payrolls: Payroll[];
}

export default function PayslipViewer({ payrolls }: PayslipViewerProps) {
  const [selectedPayroll, setSelectedPayroll] = useState<string>('');
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedPayroll) {
      fetchPayslips();
    }
  }, [selectedPayroll]);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payslips')
        .select('*, profile:profiles(full_name, registration_number)')
        .eq('payroll_id', selectedPayroll)
        .order('created_at');
      if (error) throw error;
      setPayslips((data || []) as unknown as Payslip[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number, year: number) => {
    return `${format(new Date(year, month - 1, 1), 'MMMM', { locale: ptBR })}/${year}`;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      'pending': { label: 'Pendente', variant: 'secondary' },
      'calculated': { label: 'Calculado', variant: 'outline' },
      'approved': { label: 'Aprovado', variant: 'default' },
      'sent': { label: 'Enviado', variant: 'default' },
      'viewed': { label: 'Visualizado', variant: 'default' },
    };
    const s = map[status] || { label: status, variant: 'secondary' };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const handleSendPayslip = (payslipId: string, employeeName: string) => {
    toast.success(`Holerite de ${employeeName} enviado com sucesso!`);
  };

  const handleSendAll = () => {
    toast.success(`${payslips.length} holerites enviados com sucesso!`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="w-full md:w-80">
          <Select value={selectedPayroll} onValueChange={setSelectedPayroll}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a folha" />
            </SelectTrigger>
            <SelectContent>
              {payrolls.map((p) => (
                <SelectItem key={p.id} value={p.id} className="capitalize">
                  {getMonthName(p.reference_month, p.reference_year)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedPayroll && payslips.length > 0 && (
          <Button onClick={handleSendAll} className="gradient-primary">
            <Send className="h-4 w-4 mr-2" />
            Enviar Todos os Holerites
          </Button>
        )}
      </div>

      {selectedPayroll ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Holerites
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Salário Base</TableHead>
                  <TableHead>Proventos</TableHead>
                  <TableHead>Descontos</TableHead>
                  <TableHead>Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((payslip) => (
                  <TableRow key={payslip.id}>
                    <TableCell className="font-medium">{payslip.profile?.full_name}</TableCell>
                    <TableCell>{payslip.profile?.registration_number || '-'}</TableCell>
                    <TableCell>R$ {payslip.base_salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-green-600">R$ {payslip.total_earnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-red-600">R$ {payslip.total_deductions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="font-medium">R$ {payslip.net_salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{getStatusBadge(payslip.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="Visualizar PDF">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Download PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Enviar" onClick={() => handleSendPayslip(payslip.id, payslip.profile?.full_name || '')}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {payslips.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum holerite para esta folha
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Selecione uma folha para visualizar os holerites</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}