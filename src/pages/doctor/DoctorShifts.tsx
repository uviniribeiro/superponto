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
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  Activity, 
  Plus, 
  Search,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';

interface ShiftRecord {
  id: string;
  profile_id: string;
  shift_configuration_id: string;
  shift_date: string;
  total_hours: number;
  shift_type: string | null;
  is_night_shift: boolean;
  is_weekend: boolean;
  is_holiday: boolean;
  notes: string | null;
  profile?: {
    full_name: string;
  };
  shift_configuration?: {
    id: string;
    name: string;
    duration_hours: number;
  };
}

interface DoctorAssignment {
  id: string;
  profile_id: string;
  shift_configuration_id: string;
  profile?: {
    full_name: string;
  };
  shift_configuration?: {
    id: string;
    name: string;
    duration_hours: number;
  };
}

export default function DoctorShifts() {
  useSEO({
    title: 'Plantões | Módulo Médico',
    description: 'Registro e gestão de plantões médicos.',
  });

  const [records, setRecords] = useState<ShiftRecord[]>([]);
  const [assignments, setAssignments] = useState<DoctorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ShiftRecord | null>(null);
  const [formData, setFormData] = useState({
    profile_id: '',
    shift_configuration_id: '',
    shift_date: new Date(),
    total_hours: 12,
    shift_type: 'regular',
    is_night_shift: false,
    is_weekend: false,
    is_holiday: false,
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
        supabase.from('medical_shift_records').select(`
          *,
          profile:profiles(full_name),
          shift_configuration:medical_shift_configurations(id, name, duration_hours)
        `).gte('shift_date', startDate).lte('shift_date', endDate).order('shift_date', { ascending: false }),
        supabase.from('doctor_assignments').select(`
          id, profile_id, shift_configuration_id,
          profile:profiles(full_name),
          shift_configuration:medical_shift_configurations(id, name, duration_hours)
        `).eq('is_active', true)
      ]);

      if (recordsRes.data) setRecords(recordsRes.data as unknown as ShiftRecord[]);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as DoctorAssignment[]);
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
    if (!formData.profile_id || !formData.shift_configuration_id) {
      toast.error('Selecione o médico e a configuração');
      return;
    }

    try {
      const data = {
        profile_id: formData.profile_id,
        shift_configuration_id: formData.shift_configuration_id,
        shift_date: format(formData.shift_date, 'yyyy-MM-dd'),
        total_hours: formData.total_hours,
        shift_type: formData.shift_type,
        is_night_shift: formData.is_night_shift,
        is_weekend: formData.is_weekend,
        is_holiday: formData.is_holiday,
        notes: formData.notes || null
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('medical_shift_records')
          .update(data)
          .eq('id', editingRecord.id);
        if (error) throw error;
        toast.success('Plantão atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('medical_shift_records')
          .insert(data);
        if (error) throw error;
        toast.success('Plantão registrado com sucesso');
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

  const handleEdit = (record: ShiftRecord) => {
    setEditingRecord(record);
    setFormData({
      profile_id: record.profile_id,
      shift_configuration_id: record.shift_configuration_id,
      shift_date: new Date(record.shift_date),
      total_hours: record.total_hours,
      shift_type: record.shift_type || 'regular',
      is_night_shift: record.is_night_shift,
      is_weekend: record.is_weekend,
      is_holiday: record.is_holiday,
      notes: record.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;

    try {
      const { error } = await supabase.from('medical_shift_records').delete().eq('id', id);
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
      shift_configuration_id: '',
      shift_date: new Date(),
      total_hours: 12,
      shift_type: 'regular',
      is_night_shift: false,
      is_weekend: false,
      is_holiday: false,
      notes: ''
    });
  };

  const handleDoctorChange = (profileId: string) => {
    const assignment = assignments.find(a => a.profile_id === profileId);
    setFormData({
      ...formData,
      profile_id: profileId,
      shift_configuration_id: assignment?.shift_configuration_id || '',
      total_hours: assignment?.shift_configuration?.duration_hours || 12
    });
  };

  const filteredRecords = records.filter(r =>
    r.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalShifts = filteredRecords.length;
  const totalHours = filteredRecords.reduce((sum, r) => sum + r.total_hours, 0);
  const nightShifts = filteredRecords.filter(r => r.is_night_shift).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Registro de Plantões
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os registros de plantões médicos
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
            Registrar Plantão
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Plantões</p>
            <p className="text-2xl font-bold">{totalShifts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Horas</p>
            <p className="text-2xl font-bold">{totalHours}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Plantões Noturnos</p>
            <p className="text-2xl font-bold">{nightShifts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Médicos</p>
            <p className="text-2xl font-bold">{new Set(filteredRecords.map(r => r.profile_id)).size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle>Plantões Registrados</CardTitle>
              <CardDescription>Registros de {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}</CardDescription>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por médico..."
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
                  <TableHead>Médico</TableHead>
                  <TableHead>Configuração</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.shift_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="font-medium">{record.profile?.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.shift_configuration?.name}</Badge>
                    </TableCell>
                    <TableCell>{record.total_hours}h</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {record.is_night_shift && <Badge variant="secondary" className="text-xs">Noturno</Badge>}
                        {record.is_weekend && <Badge variant="secondary" className="text-xs">FDS</Badge>}
                        {record.is_holiday && <Badge variant="secondary" className="text-xs">Feriado</Badge>}
                        {!record.is_night_shift && !record.is_weekend && !record.is_holiday && <span className="text-muted-foreground">Regular</span>}
                      </div>
                    </TableCell>
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
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum plantão registrado neste mês</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                Criar primeiro plantão
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Editar Plantão' : 'Registrar Plantão'}</DialogTitle>
            <DialogDescription>
              {editingRecord ? 'Atualize os dados do registro' : 'Registre um novo plantão'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Médico</Label>
              <Select value={formData.profile_id} onValueChange={handleDoctorChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o médico" />
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
              <Label>Data do Plantão</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.shift_date, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.shift_date}
                    onSelect={(date) => date && setFormData({ ...formData, shift_date: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Duração (horas)</Label>
              <Input
                type="number"
                min={1}
                value={formData.total_hours}
                onChange={(e) => setFormData({ ...formData, total_hours: parseInt(e.target.value) || 12 })}
              />
            </div>
            <div className="space-y-3">
              <Label>Características do Plantão</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_night_shift"
                    checked={formData.is_night_shift}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_night_shift: !!checked })}
                  />
                  <Label htmlFor="is_night_shift" className="text-sm cursor-pointer">Noturno</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_weekend"
                    checked={formData.is_weekend}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_weekend: !!checked })}
                  />
                  <Label htmlFor="is_weekend" className="text-sm cursor-pointer">Fim de Semana</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_holiday"
                    checked={formData.is_holiday}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_holiday: !!checked })}
                  />
                  <Label htmlFor="is_holiday" className="text-sm cursor-pointer">Feriado</Label>
                </div>
              </div>
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
