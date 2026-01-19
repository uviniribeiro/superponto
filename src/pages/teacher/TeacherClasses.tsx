import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  BookOpen, 
  Plus, 
  Search,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';

interface ClassRecord {
  id: string;
  profile_id: string;
  class_hour_configuration_id: string;
  class_date: string;
  number_of_classes: number;
  total_minutes: number;
  notes: string | null;
  profile?: {
    full_name: string;
  };
  class_hour_configuration?: {
    id: string;
    name: string;
    duration_minutes: number;
  };
}

interface TeacherAssignment {
  id: string;
  profile_id: string;
  class_hour_configuration_id: string;
  profile?: {
    full_name: string;
  };
  class_hour_configuration?: {
    id: string;
    name: string;
    duration_minutes: number;
  };
}

export default function TeacherClasses() {
  useSEO({
    title: 'Aulas | Módulo Professor',
    description: 'Registro e gestão de aulas ministradas pelos professores.',
  });

  const [records, setRecords] = useState<ClassRecord[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ClassRecord | null>(null);
  const [formData, setFormData] = useState({
    profile_id: '',
    class_hour_configuration_id: '',
    class_date: new Date(),
    number_of_classes: 1,
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [filterMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

      const [recordsRes, assignmentsRes] = await Promise.all([
        supabase.from('class_records').select(`
          *,
          profile:profiles(full_name),
          class_hour_configuration:class_hour_configurations(id, name, duration_minutes)
        `).gte('class_date', startDate).lte('class_date', endDate).order('class_date', { ascending: false }),
        supabase.from('employee_class_hour_assignments').select(`
          id, profile_id, class_hour_configuration_id,
          profile:profiles(full_name),
          class_hour_configuration:class_hour_configurations(id, name, duration_minutes)
        `).eq('is_active', true)
      ]);

      if (recordsRes.data) setRecords(recordsRes.data as unknown as ClassRecord[]);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as TeacherAssignment[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(filterMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setFilterMonth(newDate);
  };

  const handleSubmit = async () => {
    if (!formData.profile_id || !formData.class_hour_configuration_id) {
      toast.error('Selecione o professor e a configuração');
      return;
    }

    try {
      const assignment = assignments.find(a => a.profile_id === formData.profile_id);
      const config = assignment?.class_hour_configuration;
      const totalMinutes = formData.number_of_classes * (config?.duration_minutes || 50);

      const data = {
        profile_id: formData.profile_id,
        class_hour_configuration_id: formData.class_hour_configuration_id,
        class_date: format(formData.class_date, 'yyyy-MM-dd'),
        number_of_classes: formData.number_of_classes,
        total_minutes: totalMinutes,
        notes: formData.notes || null
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('class_records')
          .update(data)
          .eq('id', editingRecord.id);
        if (error) throw error;
        toast.success('Aula atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('class_records')
          .insert(data);
        if (error) throw error;
        toast.success('Aula registrada com sucesso');
      }

      setIsDialogOpen(false);
      setEditingRecord(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving record:', error);
      toast.error('Erro ao salvar registro');
    }
  };

  const handleEdit = (record: ClassRecord) => {
    setEditingRecord(record);
    setFormData({
      profile_id: record.profile_id,
      class_hour_configuration_id: record.class_hour_configuration_id,
      class_date: new Date(record.class_date),
      number_of_classes: record.number_of_classes,
      notes: record.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;

    try {
      const { error } = await supabase.from('class_records').delete().eq('id', id);
      if (error) throw error;
      toast.success('Registro excluído');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir');
    }
  };

  const resetForm = () => {
    setFormData({
      profile_id: '',
      class_hour_configuration_id: '',
      class_date: new Date(),
      number_of_classes: 1,
      notes: ''
    });
  };

  const handleProfileChange = (profileId: string) => {
    const assignment = assignments.find(a => a.profile_id === profileId);
    setFormData({
      ...formData,
      profile_id: profileId,
      class_hour_configuration_id: assignment?.class_hour_configuration_id || ''
    });
  };

  const filteredRecords = records.filter(r =>
    r.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalClasses = filteredRecords.reduce((sum, r) => sum + r.number_of_classes, 0);
  const totalMinutes = filteredRecords.reduce((sum, r) => sum + r.total_minutes, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Registro de Aulas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os registros de aulas ministradas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-8 px-3 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={filterMonth}
                  onSelect={(date) => date && setFilterMonth(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Registrar Aulas
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Registros</p>
            <p className="text-2xl font-bold">{filteredRecords.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Aulas</p>
            <p className="text-2xl font-bold">{totalClasses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Horas</p>
            <p className="text-2xl font-bold">{(totalMinutes / 60).toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Professores</p>
            <p className="text-2xl font-bold">{new Set(filteredRecords.map(r => r.profile_id)).size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle>Aulas Registradas</CardTitle>
              <CardDescription>Registros de {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}</CardDescription>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por professor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Configuração</TableHead>
                  <TableHead>Aulas</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.class_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="font-medium">{record.profile?.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.class_hour_configuration?.name}</Badge>
                    </TableCell>
                    <TableCell>{record.number_of_classes}</TableCell>
                    <TableCell>{(record.total_minutes / 60).toFixed(1)}h</TableCell>
                    <TableCell className="max-w-[200px] truncate">{record.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}>
                          <Pencil className="h-4 w-4" />
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
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma aula registrada neste mês</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                Criar primeira aula
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Editar Aula' : 'Registrar Aula'}</DialogTitle>
            <DialogDescription>
              {editingRecord ? 'Atualize os dados do registro' : 'Registre uma nova aula'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Professor</Label>
              <Select value={formData.profile_id} onValueChange={handleProfileChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o professor" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((a) => (
                    <SelectItem key={a.id} value={a.profile_id}>
                      {a.profile?.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data da Aula</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.class_date, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.class_date}
                    onSelect={(date) => date && setFormData({ ...formData, class_date: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Número de Aulas</Label>
              <Input
                type="number"
                min={1}
                value={formData.number_of_classes}
                onChange={(e) => setFormData({ ...formData, number_of_classes: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações opcionais..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingRecord ? 'Salvar' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
