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
import { PhoneCall, Plus, Edit, Trash2, Search, Calendar, User, Clock } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';

interface OnCallSchedule {
  id: string;
  profile_id: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  notes: string | null;
  is_active: boolean;
  profiles?: {
    full_name: string;
  };
}

interface Employee {
  id: string;
  full_name: string;
}

export default function OnCallSchedules() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<OnCallSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OnCallSchedule | null>(null);
  
  const [formData, setFormData] = useState({
    profile_id: '',
    start_datetime: '',
    end_datetime: '',
    status: 'pending',
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
        .from('on_call_schedules')
        .select(`
          *,
          profiles!on_call_schedules_profile_id_fkey (full_name)
        `)
        .order('start_datetime', { ascending: false });

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
    if (!formData.profile_id || !formData.start_datetime || !formData.end_datetime) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const payload = {
        profile_id: formData.profile_id,
        start_datetime: formData.start_datetime,
        end_datetime: formData.end_datetime,
        status: formData.status,
        notes: formData.notes || null,
        is_active: true,
        company_id: profile?.company_id,
        created_by: profile?.id,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('on_call_schedules')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
        toast.success('Escala atualizada!');
      } else {
        const { error } = await supabase
          .from('on_call_schedules')
          .insert([payload]);
        if (error) throw error;
        toast.success('Escala criada!');
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
    if (!confirm('Tem certeza que deseja excluir esta escala?')) return;

    try {
      const { error } = await supabase.from('on_call_schedules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Escala excluída!');
      fetchRecords();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir');
    }
  };

  const openEditDialog = (record: OnCallSchedule) => {
    setEditingRecord(record);
    setFormData({
      profile_id: record.profile_id,
      start_datetime: record.start_datetime.slice(0, 16),
      end_datetime: record.end_datetime.slice(0, 16),
      status: record.status,
      notes: record.notes || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRecord(null);
    setFormData({
      profile_id: '',
      start_datetime: '',
      end_datetime: '',
      status: 'pending',
      notes: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'pending': { label: 'Pendente', variant: 'secondary' },
      'active': { label: 'Ativo', variant: 'default' },
      'completed': { label: 'Concluído', variant: 'outline' },
      'cancelled': { label: 'Cancelado', variant: 'destructive' },
    };
    const s = statusMap[status] || { label: status, variant: 'secondary' };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const filteredRecords = records.filter(r =>
    r.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Sobre Aviso"
          description="Gerencie escalas de sobreaviso dos funcionários" icon={PhoneCall}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Nova Escala
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Escalas de Sobreaviso</CardTitle>
            <CardDescription>Funcionários em regime de sobreaviso com período e status</CardDescription>
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
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                      {format(parseISO(record.start_datetime), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(record.end_datetime), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="max-w-xs truncate">{record.notes || '-'}</TableCell>
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
              <PhoneCall className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhuma escala cadastrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar' : 'Nova'} Escala de Sobreaviso
            </DialogTitle>
            <DialogDescription>
              Defina o período de sobreaviso do funcionário
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data/Hora Início *</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_datetime}
                  onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data/Hora Fim *</Label>
                <Input
                  type="datetime-local"
                  value={formData.end_datetime}
                  onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre a escala"
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

      <HelpButton pageKey="on-call" />
    </div>
  );
}
