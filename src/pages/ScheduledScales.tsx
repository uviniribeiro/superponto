import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  CalendarDays, Plus, Edit, Trash2, Search, Users, 
  UserPlus, CalendarClock, Check, X, Filter
} from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import useSEO from '@/hooks/useSEO';

interface WorkSchedule {
  id: string;
  name: string;
  scale_type: string | null;
  weekly_hours: number | null;
}

interface Employee {
  id: string;
  full_name: string;
  registration_number: string | null;
  department: string | null;
}

interface ScheduledScale {
  id: string;
  profile_id: string;
  schedule_id: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
  schedule?: {
    name: string;
    scale_type: string | null;
  };
}

export default function ScheduledScales() {
  useSEO({
    title: 'Escalas Agendadas | Ponto Max',
    description: 'Gerencie escalas agendadas individuais por funcionário.',
  });

  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scheduledScales, setScheduledScales] = useState<ScheduledScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'individual' | 'bulk'>('individual');
  const [editingScale, setEditingScale] = useState<ScheduledScale | null>(null);
  
  // Form states
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    schedule_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
  });
  
  // Employee selection search
  const [employeeSearch, setEmployeeSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schedulesRes, employeesRes, scheduledRes] = await Promise.all([
        supabase.from('work_schedules').select('id, name, scale_type, weekly_hours').eq('is_active', true).order('name'),
        supabase.from('profiles').select('id, full_name, registration_number, department').eq('is_active', true).order('full_name'),
        supabase.from('employee_schedules').select(`
          id, profile_id, schedule_id, start_date, end_date, created_at,
          profile:profiles(full_name, registration_number),
          schedule:work_schedules(name, scale_type)
        `).order('start_date', { ascending: false }),
      ]);

      if (schedulesRes.data) setSchedules(schedulesRes.data);
      if (employeesRes.data) setEmployees(employeesRes.data);
      if (scheduledRes.data) setScheduledScales(scheduledRes.data as unknown as ScheduledScale[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const filteredScheduledScales = useMemo(() => {
    if (!searchTerm) return scheduledScales;
    const term = searchTerm.toLowerCase();
    return scheduledScales.filter(s => 
      s.profile?.full_name?.toLowerCase().includes(term) ||
      s.profile?.registration_number?.toLowerCase().includes(term) ||
      s.schedule?.name?.toLowerCase().includes(term)
    );
  }, [scheduledScales, searchTerm]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return employees;
    const term = employeeSearch.toLowerCase();
    return employees.filter(e => 
      e.full_name.toLowerCase().includes(term) ||
      e.registration_number?.toLowerCase().includes(term)
    );
  }, [employees, employeeSearch]);

  const openIndividualDialog = (scale?: ScheduledScale) => {
    if (scale) {
      setEditingScale(scale);
      setSelectedEmployees([scale.profile_id]);
      setFormData({
        schedule_id: scale.schedule_id,
        start_date: scale.start_date,
        end_date: scale.end_date || '',
      });
    } else {
      setEditingScale(null);
      setSelectedEmployees([]);
      setFormData({
        schedule_id: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: '',
      });
    }
    setDialogMode('individual');
    setEmployeeSearch('');
    setIsDialogOpen(true);
  };

  const openBulkDialog = () => {
    setEditingScale(null);
    setSelectedEmployees([]);
    setFormData({
      schedule_id: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
    });
    setDialogMode('bulk');
    setEmployeeSearch('');
    setIsDialogOpen(true);
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const selectAllEmployees = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map(e => e.id));
    }
  };

  const handleSave = async () => {
    if (!formData.schedule_id) {
      toast.error('Selecione uma escala');
      return;
    }
    if (!formData.start_date) {
      toast.error('Data de início é obrigatória');
      return;
    }
    if (selectedEmployees.length === 0) {
      toast.error('Selecione pelo menos um funcionário');
      return;
    }

    try {
      if (editingScale) {
        // Update existing
        const { error } = await supabase
          .from('employee_schedules')
          .update({
            schedule_id: formData.schedule_id,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
          })
          .eq('id', editingScale.id);
        
        if (error) throw error;
        toast.success('Escala atualizada com sucesso!');
      } else {
        // Insert new (individual or bulk)
        const inserts = selectedEmployees.map(profile_id => ({
          profile_id,
          schedule_id: formData.schedule_id,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          company_id: profile?.company_id,
        }));

        const { error } = await supabase.from('employee_schedules').insert(inserts);
        if (error) throw error;
        
        toast.success(
          selectedEmployees.length === 1
            ? 'Escala atribuída com sucesso!'
            : `Escala atribuída a ${selectedEmployees.length} funcionários!`
        );
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta escala?')) return;

    try {
      const { error } = await supabase.from('employee_schedules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Escala removida!');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao remover escala');
    }
  };

  const getScaleTypeBadge = (type: string | null) => {
    switch (type) {
      case '12x36': return <Badge variant="outline" className="bg-purple-100 text-purple-700">12x36</Badge>;
      case '6x1': return <Badge variant="outline" className="bg-blue-100 text-blue-700">6x1</Badge>;
      case '5x1': return <Badge variant="outline" className="bg-cyan-100 text-cyan-700">5x1</Badge>;
      default: return <Badge variant="outline">Padrão</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-0 flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <PageHeader
          title="Escalas Agendadas"
          description="Atribua escalas individuais ou em lote para funcionários"
          icon={CalendarDays}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={openBulkDialog} className="gap-2">
            <Users className="h-4 w-4" />
            Escala em Lote
          </Button>
          <Button onClick={() => openIndividualDialog()} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Nova Escala Individual
          </Button>
        </div>
      </div>


      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Atribuições</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {scheduledScales.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Funcionários</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {employees.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Escalas Disponíveis</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {schedules.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Sem Escala</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {employees.length - new Set(scheduledScales.map(s => s.profile_id)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Escalas Atribuídas</CardTitle>
            <CardDescription>Visualize e gerencie as escalas de cada funcionário</CardDescription>
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
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredScheduledScales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Escala</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Data Fim</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScheduledScales.map((scale) => (
                  <TableRow key={scale.id}>
                    <TableCell className="font-medium">{scale.profile?.full_name}</TableCell>
                    <TableCell>{scale.profile?.registration_number || '-'}</TableCell>
                    <TableCell>{scale.schedule?.name}</TableCell>
                    <TableCell>{getScaleTypeBadge(scale.schedule?.scale_type || null)}</TableCell>
                    <TableCell>
                      {format(new Date(scale.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {scale.end_date
                        ? format(new Date(scale.end_date), 'dd/MM/yyyy', { locale: ptBR })
                        : <Badge variant="outline" className="text-green-600">Vigente</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openIndividualDialog(scale)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(scale.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma escala agendada encontrada</p>
              <p className="text-sm mt-1">Clique em "Nova Escala Individual" ou "Escala em Lote" para começar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Individual/Bulk */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogMode === 'bulk' ? (
                <>
                  <Users className="h-5 w-5" />
                  Atribuir Escala em Lote
                </>
              ) : editingScale ? (
                <>
                  <Edit className="h-5 w-5" />
                  Editar Escala
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  Nova Escala Individual
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'bulk'
                ? 'Selecione múltiplos funcionários para aplicar a mesma escala'
                : 'Configure a escala para o funcionário selecionado'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Employee Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Funcionário(s) *</Label>
                {dialogMode === 'bulk' && (
                  <Button variant="ghost" size="sm" onClick={selectAllEmployees}>
                    {selectedEmployees.length === filteredEmployees.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </Button>
                )}
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar funcionário..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <ScrollArea className="h-48 border rounded-md p-2">
                <div className="space-y-1">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                        selectedEmployees.includes(employee.id)
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => dialogMode === 'bulk' || !editingScale ? toggleEmployee(employee.id) : null}
                    >
                      <Checkbox
                        checked={selectedEmployees.includes(employee.id)}
                        onCheckedChange={() => dialogMode === 'bulk' || !editingScale ? toggleEmployee(employee.id) : null}
                        disabled={editingScale !== null}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{employee.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {employee.registration_number || 'Sem matrícula'}
                          {employee.department && ` • ${employee.department}`}
                        </p>
                      </div>
                      {selectedEmployees.includes(employee.id) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <p className="text-center py-4 text-muted-foreground text-sm">
                      Nenhum funcionário encontrado
                    </p>
                  )}
                </div>
              </ScrollArea>

              {selectedEmployees.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedEmployees.length} funcionário(s) selecionado(s)
                </p>
              )}
            </div>

            <Separator />

            {/* Schedule Selection */}
            <div className="space-y-2">
              <Label>Escala *</Label>
              <Select
                value={formData.schedule_id}
                onValueChange={(value) => setFormData({ ...formData, schedule_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a escala" />
                </SelectTrigger>
                <SelectContent>
                  {schedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      <div className="flex items-center gap-2">
                        <span>{schedule.name}</span>
                        {schedule.scale_type && (
                          <Badge variant="outline" className="text-xs">
                            {schedule.scale_type}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Fim (opcional)</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para escala vigente
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={selectedEmployees.length === 0 || !formData.schedule_id}>
              {editingScale ? 'Atualizar' : dialogMode === 'bulk' ? 'Aplicar para Todos' : 'Atribuir Escala'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="scheduled-scales" />
    </div>
  );
}
