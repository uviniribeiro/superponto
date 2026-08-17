import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { CheckCircle, Plus, Edit, Trash2, Search, Calendar, Users } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';

interface BatchAbsolution {
  id: string;
  description: string;
  start_date: string;
  end_date: string;
  absolve_absences: boolean;
  absolve_delays: boolean;
  is_active: boolean;
  justification_id: string | null;
  company_id: string | null;
}

interface Justification {
  id: string;
  description: string;
}

interface Employee {
  id: string;
  full_name: string;
}

export default function BatchAbsolutions() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<BatchAbsolution[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BatchAbsolution | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    description: '',
    start_date: '',
    end_date: '',
    absolve_absences: true,
    absolve_delays: false,
    justification_id: '',
    is_active: true,
  });

  useEffect(() => {
    fetchRecords();
    fetchJustifications();
    fetchEmployees();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('batch_absolutions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchJustifications = async () => {
    const { data } = await supabase
      .from('justifications')
      .select('id, description')
      .eq('is_active', true)
      .order('description');
    setJustifications(data || []);
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
    if (!formData.description.trim() || !formData.start_date || !formData.end_date) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (selectedEmployees.length === 0) {
      toast.error('Selecione pelo menos um funcionário');
      return;
    }

    try {
      const payload = {
        description: formData.description.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date,
        absolve_absences: formData.absolve_absences,
        absolve_delays: formData.absolve_delays,
        justification_id: formData.justification_id || null,
        is_active: formData.is_active,
        company_id: profile?.company_id,
        created_by: profile?.id,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('batch_absolutions')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;

        // Update employees
        await supabase.from('batch_absolution_employees').delete().eq('batch_absolution_id', editingRecord.id);
        const employeeRecords = selectedEmployees.map(pid => ({
          batch_absolution_id: editingRecord.id,
          profile_id: pid,
        }));
        if (employeeRecords.length > 0) {
          await supabase.from('batch_absolution_employees').insert(employeeRecords);
        }

        toast.success('Abono em lote atualizado!');
      } else {
        const { data: newRecord, error } = await supabase
          .from('batch_absolutions')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;

        // Link employees
        const employeeRecords = selectedEmployees.map(pid => ({
          batch_absolution_id: newRecord.id,
          profile_id: pid,
        }));
        if (employeeRecords.length > 0) {
          await supabase.from('batch_absolution_employees').insert(employeeRecords);
        }

        toast.success('Abono em lote criado!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchRecords();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este abono?')) return;

    try {
      await supabase.from('batch_absolution_employees').delete().eq('batch_absolution_id', id);
      const { error } = await supabase.from('batch_absolutions').delete().eq('id', id);
      if (error) throw error;
      toast.success('Abono excluído!');
      fetchRecords();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir');
    }
  };

  const openEditDialog = async (record: BatchAbsolution) => {
    setEditingRecord(record);
    setFormData({
      description: record.description,
      start_date: record.start_date,
      end_date: record.end_date,
      absolve_absences: record.absolve_absences || false,
      absolve_delays: record.absolve_delays || false,
      justification_id: record.justification_id || '',
      is_active: record.is_active,
    });

    // Fetch linked employees
    const { data } = await supabase
      .from('batch_absolution_employees')
      .select('profile_id')
      .eq('batch_absolution_id', record.id);
    setSelectedEmployees((data || []).map(d => d.profile_id));

    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRecord(null);
    setSelectedEmployees([]);
    setFormData({
      description: '',
      start_date: '',
      end_date: '',
      absolve_absences: true,
      absolve_delays: false,
      justification_id: '',
      is_active: true,
    });
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const selectAllEmployees = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(employees.map(e => e.id));
    }
  };

  const filteredRecords = records.filter(r =>
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Abono em Lote"
          description="Abone faltas e atrasos para múltiplos funcionários de uma vez" icon={CheckCircle}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Novo Abono
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Abonos em Lote</CardTitle>
            <CardDescription>Abonos aplicados para grupos de funcionários</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
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
                  <TableHead>Descrição</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Abona</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.description}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(parseISO(record.start_date), 'dd/MM/yy')} - {format(parseISO(record.end_date), 'dd/MM/yy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {record.absolve_absences && <Badge variant="outline">Faltas</Badge>}
                        {record.absolve_delays && <Badge variant="outline">Atrasos</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.is_active ? 'default' : 'secondary'}>
                        {record.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(record)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum abono cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar' : 'Novo'} Abono em Lote
            </DialogTitle>
            <DialogDescription>
              Selecione os funcionários e defina o período do abono
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Abono por evento corporativo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Justificativa</Label>
              <Select
                value={formData.justification_id}
                onValueChange={(v) => setFormData({ ...formData, justification_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma justificativa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {justifications.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.absolve_absences}
                  onCheckedChange={(checked) => setFormData({ ...formData, absolve_absences: checked })}
                />
                <Label>Abonar Faltas</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.absolve_delays}
                  onCheckedChange={(checked) => setFormData({ ...formData, absolve_delays: checked })}
                />
                <Label>Abonar Atrasos</Label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Funcionários *</Label>
                <Button variant="outline" size="sm" onClick={selectAllEmployees}>
                  {selectedEmployees.length === employees.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              </div>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {employees.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedEmployees.includes(emp.id)}
                      onCheckedChange={() => toggleEmployee(emp.id)}
                    />
                    <span className="text-sm">{emp.full_name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedEmployees.length} funcionário(s) selecionado(s)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="batch-absolutions" />
    </div>
  );
}
