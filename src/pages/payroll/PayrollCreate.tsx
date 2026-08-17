import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Plus, 
  FileText,
  ArrowLeft,
  Save
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';

const months = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

export default function PayrollCreate() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  useSEO({
    title: 'Nova Folha de Pagamento | Ponto Max',
    description: 'Criar nova folha de pagamento.',
  });

  const currentDate = new Date();
  const [formData, setFormData] = useState({
    referenceMonth: currentDate.getMonth() + 1,
    referenceYear: currentDate.getFullYear(),
    periodStart: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
    periodEnd: format(endOfMonth(currentDate), 'yyyy-MM-dd'),
    paymentDate: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [employeeCount, setEmployeeCount] = useState(0);

  useEffect(() => {
    fetchEmployeeCount();
  }, []);

  useEffect(() => {
    // Update period dates when month/year changes
    const date = new Date(formData.referenceYear, formData.referenceMonth - 1, 1);
    setFormData(prev => ({
      ...prev,
      periodStart: format(startOfMonth(date), 'yyyy-MM-dd'),
      periodEnd: format(endOfMonth(date), 'yyyy-MM-dd'),
    }));
  }, [formData.referenceMonth, formData.referenceYear]);

  const fetchEmployeeCount = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_system_user', false);
    
    setEmployeeCount(count || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if payroll already exists for this month/year
      const { data: existing } = await supabase
        .from('payrolls')
        .select('id')
        .eq('reference_month', formData.referenceMonth)
        .eq('reference_year', formData.referenceYear)
        .maybeSingle();

      if (existing) {
        toast.error('Já existe uma folha para este mês/ano');
        return;
      }

      const { error } = await supabase.from('payrolls').insert({
        reference_month: formData.referenceMonth,
        reference_year: formData.referenceYear,
        period_start: formData.periodStart,
        period_end: formData.periodEnd,
        payment_date: formData.paymentDate || null,
        description: formData.description || null,
        status: 'draft',
        employee_count: employeeCount,
        total_earnings: 0,
        total_deductions: 0,
        total_net: 0,
        company_id: profile?.company_id,
        created_by: profile?.user_id,
      });

      if (error) throw error;

      toast.success('Folha de pagamento criada com sucesso!');
      navigate('/payroll/list');
    } catch (error) {
      console.error('Error creating payroll:', error);
      toast.error('Erro ao criar folha de pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/payroll/list')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Plus className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Nova Folha de Pagamento
          </h1>
          <p className="text-muted-foreground mt-1">
            Criar uma nova folha de pagamento
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Dados da Folha
          </CardTitle>
          <CardDescription>
            Preencha as informações para criar a folha de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month">Mês de Referência *</Label>
                <Select
                  value={formData.referenceMonth.toString()}
                  onValueChange={(v) => setFormData({ ...formData, referenceMonth: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Ano *</Label>
                <Select
                  value={formData.referenceYear.toString()}
                  onValueChange={(v) => setFormData({ ...formData, referenceYear: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodStart">Início do Período *</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodEnd">Fim do Período *</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentDate">Data de Pagamento</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Funcionários Ativos</Label>
                <Input value={employeeCount} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional da folha"
              />
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => navigate('/payroll/list')}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                <Save className="h-4 w-4" />
                {loading ? 'Criando...' : 'Criar Folha'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
