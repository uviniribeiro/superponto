import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Scale, Plus, Search, Calendar, TrendingUp, TrendingDown, User } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CompensationEntry {
  id: string;
  profile_id: string;
  reference_date: string;
  credit_hours: unknown;
  debit_hours: unknown;
  balance: unknown;
  notes: string | null;
  profiles?: {
    full_name: string;
  };
}

interface Employee {
  id: string;
  full_name: string;
}

export default function CompensationBank() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<CompensationEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    profile_id: '',
    reference_date: format(new Date(), 'yyyy-MM-dd'),
    credit_hours: '00:00',
    debit_hours: '00:00',
    notes: '',
  });

  useEffect(() => {
    fetchRecords();
    fetchEmployees();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('compensation_banks')
        .select(`
          *,
          profiles!compensation_banks_profile_id_fkey (full_name)
        `)
        .order('reference_date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');
    setEmployees(data || []);
  };

  const handleSave = async () => {
    if (!formData.profile_id || !formData.reference_date) {
      toast.error('Selecione o funcionário e a data');
      return;
    }

    try {
      const payload = {
        profile_id: formData.profile_id,
        reference_date: formData.reference_date,
        credit_hours: formData.credit_hours,
        debit_hours: formData.debit_hours,
        notes: formData.notes || null,
        company_id: profile?.company_id,
        created_by: profile?.id,
      };

      const { error } = await supabase
        .from('compensation_banks')
        .insert([payload]);
      if (error) throw error;
      toast.success('Lançamento registrado!');

      setIsDialogOpen(false);
      resetForm();
      fetchRecords();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar');
    }
  };

  const resetForm = () => {
    setFormData({
      profile_id: '',
      reference_date: format(new Date(), 'yyyy-MM-dd'),
      credit_hours: '00:00',
      debit_hours: '00:00',
      notes: '',
    });
  };

  const formatTime = (time: unknown): string => {
    if (typeof time !== 'string' || !time) return '00:00';
    return time;
  };

  const filteredRecords = records.filter(r =>
    r.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate totals by employee
  const employeeTotals = records.reduce((acc, rec) => {
    const empId = rec.profile_id;
    if (!acc[empId]) {
      acc[empId] = { name: rec.profiles?.full_name || '', credits: 0, debits: 0 };
    }
    // Simple parsing - assumes HH:MM format
    const parseHours = (t: unknown): number => {
      if (typeof t !== 'string') return 0;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) + (m || 0) / 60;
    };
    acc[empId].credits += parseHours(rec.credit_hours);
    acc[empId].debits += parseHours(rec.debit_hours);
    return acc;
  }, {} as Record<string, { name: string; credits: number; debits: number }>);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="h-8 w-8 text-primary" />
            Banco de Compensação
          </h1>
          <p className="text-muted-foreground">
            Gerencie créditos e débitos de horas para compensação
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Novo Lançamento
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Créditos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-green-600">
                {Object.values(employeeTotals).reduce((sum, e) => sum + e.credits, 0).toFixed(1)}h
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Débitos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-red-600">
                {Object.values(employeeTotals).reduce((sum, e) => sum + e.debits, 0).toFixed(1)}h
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {(Object.values(employeeTotals).reduce((sum, e) => sum + e.credits - e.debits, 0)).toFixed(1)}h
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lançamentos</CardTitle>
            <CardDescription>Histórico de créditos e débitos de horas</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar funcionário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data Referência</TableHead>
                  <TableHead>Crédito</TableHead>
                  <TableHead>Débito</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {record.profiles?.full_name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(parseISO(record.reference_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-600">
                        +{formatTime(record.credit_hours)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-red-600">
                        -{formatTime(record.debit_hours)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {formatTime(record.balance)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{record.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Scale className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum lançamento encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lançamento</DialogTitle>
            <DialogDescription>
              Registre crédito ou débito de horas para compensação
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário *</Label>
              <Select
                value={formData.profile_id}
                onValueChange={(v) => setFormData({ ...formData, profile_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Referência *</Label>
              <Input
                type="date"
                value={formData.reference_date}
                onChange={(e) => setFormData({ ...formData, reference_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-green-600">Crédito (hh:mm)</Label>
                <Input
                  type="time"
                  value={formData.credit_hours}
                  onChange={(e) => setFormData({ ...formData, credit_hours: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-red-600">Débito (hh:mm)</Label>
                <Input
                  type="time"
                  value={formData.debit_hours}
                  onChange={(e) => setFormData({ ...formData, debit_hours: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Motivo do lançamento"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="compensation-bank" />
    </div>
  );
}
