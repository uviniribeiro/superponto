import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, CalendarIcon, Users, Settings2, CalendarDays } from 'lucide-react';

interface ScaleConfiguration {
  id: string;
  name: string;
  scale_type: 'standard' | '5x1' | '6x1' | '12x36';
  work_days: number;
  off_days: number;
  work_hours_per_day: number;
  holiday_treatment: 'normal' | 'overtime' | 'off';
  description: string | null;
  is_active: boolean;
}

interface EmployeeScaleAssignment {
  id: string;
  profile_id: string;
  scale_configuration_id: string;
  start_date: string;
  scale_start_day: string;
  end_date: string | null;
  is_active: boolean;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
  scale_configuration?: ScaleConfiguration;
}

interface EmployeeOffDay {
  id: string;
  profile_id: string;
  off_date: string;
  reason: string | null;
  is_manual_override: boolean;
  profile?: {
    full_name: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
  hire_date: string | null;
}

const scaleTypeLabels: Record<string, string> = {
  'standard': 'Padrão',
  '5x1': '5x1 (5 dias trabalho, 1 folga)',
  '6x1': '6x1 (6 dias trabalho, 1 folga)',
  '12x36': '12x36 (12h trabalho, 36h folga)',
};

const holidayTreatmentLabels: Record<string, string> = {
  'normal': 'Dia normal',
  'overtime': 'Hora extra',
  'off': 'Folga',
};

export default function ScaleManagement() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [scales, setScales] = useState<ScaleConfiguration[]>([]);
  const [assignments, setAssignments] = useState<EmployeeScaleAssignment[]>([]);
  const [offDays, setOffDays] = useState<EmployeeOffDay[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [offDayDialogOpen, setOffDayDialogOpen] = useState(false);

  const [editingScale, setEditingScale] = useState<ScaleConfiguration | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<EmployeeScaleAssignment | null>(null);

  const [scaleForm, setScaleForm] = useState({
    name: '',
    scale_type: 'standard' as 'standard' | '5x1' | '6x1' | '12x36',
    work_days: 5,
    off_days: 1,
    work_hours_per_day: 8,
    holiday_treatment: 'normal' as 'normal' | 'overtime' | 'off',
    description: '',
  });

  const [assignmentForm, setAssignmentForm] = useState({
    profile_id: '',
    scale_configuration_id: '',
    start_date: new Date(),
    scale_start_day: new Date(),
  });

  const [offDayForm, setOffDayForm] = useState({
    profile_id: '',
    off_date: new Date(),
    reason: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scalesRes, assignmentsRes, offDaysRes, employeesRes] = await Promise.all([
        supabase.from('scale_configurations').select('*').order('name'),
        supabase.from('employee_scale_assignments').select(`
          *,
          profile:profiles(full_name, registration_number),
          scale_configuration:scale_configurations(*)
        `).order('created_at', { ascending: false }),
        supabase.from('employee_off_days').select(`
          *,
          profile:profiles(full_name)
        `).order('off_date', { ascending: false }),
        supabase.from('profiles').select('id, full_name, registration_number, hire_date').eq('is_active', true).order('full_name'),
      ]);

      if (scalesRes.data) setScales(scalesRes.data as ScaleConfiguration[]);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as EmployeeScaleAssignment[]);
      if (offDaysRes.data) setOffDays(offDaysRes.data as unknown as EmployeeOffDay[]);
      if (employeesRes.data) setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScale = async () => {
    try {
      const data = {
        ...scaleForm,
        company_id: profile?.company_id,
      };

      if (editingScale) {
        const { error } = await supabase
          .from('scale_configurations')
          .update(data)
          .eq('id', editingScale.id);
        if (error) throw error;
        toast({ title: 'Escala atualizada com sucesso' });
      } else {
        const { error } = await supabase
          .from('scale_configurations')
          .insert(data);
        if (error) throw error;
        toast({ title: 'Escala criada com sucesso' });
      }

      setScaleDialogOpen(false);
      resetScaleForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving scale:', error);
      toast({ title: 'Erro ao salvar escala', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteScale = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta escala?')) return;
    try {
      const { error } = await supabase.from('scale_configurations').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Escala excluída com sucesso' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting scale:', error);
      toast({ title: 'Erro ao excluir escala', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveAssignment = async () => {
    try {
      const data = {
        profile_id: assignmentForm.profile_id,
        scale_configuration_id: assignmentForm.scale_configuration_id,
        start_date: format(assignmentForm.start_date, 'yyyy-MM-dd'),
        scale_start_day: format(assignmentForm.scale_start_day, 'yyyy-MM-dd'),
        company_id: profile?.company_id,
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('employee_scale_assignments')
          .update(data)
          .eq('id', editingAssignment.id);
        if (error) throw error;
        toast({ title: 'Atribuição atualizada com sucesso' });
      } else {
        const { error } = await supabase
          .from('employee_scale_assignments')
          .insert(data);
        if (error) throw error;
        toast({ title: 'Escala atribuída ao funcionário' });
      }

      setAssignmentDialogOpen(false);
      resetAssignmentForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving assignment:', error);
      toast({ title: 'Erro ao salvar atribuição', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta atribuição?')) return;
    try {
      const { error } = await supabase.from('employee_scale_assignments').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Atribuição removida com sucesso' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      toast({ title: 'Erro ao remover atribuição', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveOffDay = async () => {
    try {
      const { error } = await supabase.from('employee_off_days').insert({
        profile_id: offDayForm.profile_id,
        off_date: format(offDayForm.off_date, 'yyyy-MM-dd'),
        reason: offDayForm.reason || null,
        company_id: profile?.company_id,
        is_manual_override: true,
      });
      if (error) throw error;
      toast({ title: 'Folga manual adicionada' });
      setOffDayDialogOpen(false);
      resetOffDayForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving off day:', error);
      toast({ title: 'Erro ao adicionar folga', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteOffDay = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta folga?')) return;
    try {
      const { error } = await supabase.from('employee_off_days').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Folga removida com sucesso' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting off day:', error);
      toast({ title: 'Erro ao remover folga', description: error.message, variant: 'destructive' });
    }
  };

  const resetScaleForm = () => {
    setScaleForm({
      name: '',
      scale_type: 'standard',
      work_days: 5,
      off_days: 1,
      work_hours_per_day: 8,
      holiday_treatment: 'normal',
      description: '',
    });
    setEditingScale(null);
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      profile_id: '',
      scale_configuration_id: '',
      start_date: new Date(),
      scale_start_day: new Date(),
    });
    setEditingAssignment(null);
  };

  const resetOffDayForm = () => {
    setOffDayForm({
      profile_id: '',
      off_date: new Date(),
      reason: '',
    });
  };

  const openEditScale = (scale: ScaleConfiguration) => {
    setEditingScale(scale);
    setScaleForm({
      name: scale.name,
      scale_type: scale.scale_type,
      work_days: scale.work_days,
      off_days: scale.off_days,
      work_hours_per_day: scale.work_hours_per_day,
      holiday_treatment: scale.holiday_treatment,
      description: scale.description || '',
    });
    setScaleDialogOpen(true);
  };

  const openEditAssignment = (assignment: EmployeeScaleAssignment) => {
    setEditingAssignment(assignment);
    setAssignmentForm({
      profile_id: assignment.profile_id,
      scale_configuration_id: assignment.scale_configuration_id,
      start_date: new Date(assignment.start_date),
      scale_start_day: new Date(assignment.scale_start_day),
    });
    setAssignmentDialogOpen(true);
  };

  const calculateOffDays = (assignment: EmployeeScaleAssignment) => {
    if (!assignment.scale_configuration) return [];
    
    const scale = assignment.scale_configuration;
    const scaleStartDay = startOfDay(new Date(assignment.scale_start_day));
    const today = startOfDay(new Date());
    const endDate = addDays(today, 30);
    
    const offDays: Date[] = [];
    
    if (scale.scale_type === '12x36') {
      let currentDay = scaleStartDay;
      while (currentDay <= endDate) {
        const workDay = addDays(currentDay, 1);
        offDays.push(workDay);
        currentDay = addDays(currentDay, 2);
      }
    } else {
      const cycleLength = scale.work_days + scale.off_days;
      let currentDay = scaleStartDay;
      
      while (currentDay <= endDate) {
        const dayInCycle = differenceInDays(currentDay, scaleStartDay) % cycleLength;
        
        if (dayInCycle >= scale.work_days) {
          offDays.push(new Date(currentDay));
        }
        currentDay = addDays(currentDay, 1);
      }
    }
    
    return offDays.filter(d => d >= today && d <= endDate);
  };

  const updateScaleFormByType = (type: 'standard' | '5x1' | '6x1' | '12x36') => {
    switch (type) {
      case '5x1':
        setScaleForm(prev => ({ ...prev, scale_type: type, work_days: 5, off_days: 1 }));
        break;
      case '6x1':
        setScaleForm(prev => ({ ...prev, scale_type: type, work_days: 6, off_days: 1 }));
        break;
      case '12x36':
        setScaleForm(prev => ({ ...prev, scale_type: type, work_days: 1, off_days: 1, work_hours_per_day: 12 }));
        break;
      default:
        setScaleForm(prev => ({ ...prev, scale_type: type, work_days: 5, off_days: 2 }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Escalas</h1>
          <p className="text-muted-foreground">Configure escalas 5x1, 6x1, 12x36 e atribua a funcionários</p>
        </div>
      </div>

      <Tabs defaultValue="scales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scales" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Tipos de Escala
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Users className="h-4 w-4" />
            Atribuições
          </TabsTrigger>
          <TabsTrigger value="off-days" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Folgas Manuais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scales" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetScaleForm(); setScaleDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Escala
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scales.map((scale) => (
              <Card key={scale.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{scale.name}</CardTitle>
                      <CardDescription>{scaleTypeLabels[scale.scale_type]}</CardDescription>
                    </div>
                    <Badge variant={scale.is_active ? 'default' : 'secondary'}>
                      {scale.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dias de trabalho:</span>
                      <span className="font-medium">{scale.work_days}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dias de folga:</span>
                      <span className="font-medium">{scale.off_days}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Horas/dia:</span>
                      <span className="font-medium">{scale.work_hours_per_day}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Feriados:</span>
                      <span className="font-medium">{holidayTreatmentLabels[scale.holiday_treatment]}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => openEditScale(scale)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteScale(scale.id)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {scales.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma escala cadastrada</p>
                <Button className="mt-4" onClick={() => { resetScaleForm(); setScaleDialogOpen(true); }}>
                  Criar primeira escala
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetAssignmentForm(); setAssignmentDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Atribuir Escala
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Escala</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Dia Base da Escala</TableHead>
                  <TableHead>Próximas Folgas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => {
                  const nextOffDays = calculateOffDays(assignment);
                  return (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.profile?.full_name}
                        {assignment.profile?.registration_number && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            #{assignment.profile.registration_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {assignment.scale_configuration?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(assignment.start_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{format(new Date(assignment.scale_start_day), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {nextOffDays.slice(0, 3).map((date, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {format(date, 'dd/MM')}
                            </Badge>
                          ))}
                          {nextOffDays.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{nextOffDays.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEditAssignment(assignment)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteAssignment(assignment.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {assignments.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma escala atribuída</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="off-days" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetOffDayForm(); setOffDayDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Folga Manual
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offDays.map((offDay) => (
                  <TableRow key={offDay.id}>
                    <TableCell className="font-medium">{offDay.profile?.full_name}</TableCell>
                    <TableCell>{format(new Date(offDay.off_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{offDay.reason || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteOffDay(offDay.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {offDays.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma folga manual cadastrada</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Nova/Editar Escala */}
      <Dialog open={scaleDialogOpen} onOpenChange={setScaleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingScale ? 'Editar Escala' : 'Nova Escala'}</DialogTitle>
            <DialogDescription>Configure os parâmetros da escala de trabalho</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Escala</Label>
              <Input
                id="name"
                value={scaleForm.name}
                onChange={(e) => setScaleForm({ ...scaleForm, name: e.target.value })}
                placeholder="Ex: Escala 6x1 Produção"
              />
            </div>
            <div>
              <Label htmlFor="scale_type">Tipo de Escala</Label>
              <Select
                value={scaleForm.scale_type}
                onValueChange={(value: any) => updateScaleFormByType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Padrão (personalizável)</SelectItem>
                  <SelectItem value="5x1">5x1 (5 dias trabalho, 1 folga)</SelectItem>
                  <SelectItem value="6x1">6x1 (6 dias trabalho, 1 folga)</SelectItem>
                  <SelectItem value="12x36">12x36 (12h trabalho, 36h folga)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="work_days">Dias de Trabalho</Label>
                <Input
                  id="work_days"
                  type="number"
                  min="1"
                  value={scaleForm.work_days}
                  onChange={(e) => setScaleForm({ ...scaleForm, work_days: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="off_days">Dias de Folga</Label>
                <Input
                  id="off_days"
                  type="number"
                  min="1"
                  value={scaleForm.off_days}
                  onChange={(e) => setScaleForm({ ...scaleForm, off_days: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="work_hours">Horas por Dia</Label>
              <Input
                id="work_hours"
                type="number"
                min="1"
                max="24"
                step="0.5"
                value={scaleForm.work_hours_per_day}
                onChange={(e) => setScaleForm({ ...scaleForm, work_hours_per_day: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="holiday_treatment">Tratamento de Feriados</Label>
              <Select
                value={scaleForm.holiday_treatment}
                onValueChange={(value: any) => setScaleForm({ ...scaleForm, holiday_treatment: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Dia normal de trabalho</SelectItem>
                  <SelectItem value="overtime">Contar como hora extra</SelectItem>
                  <SelectItem value="off">Folga obrigatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={scaleForm.description}
                onChange={(e) => setScaleForm({ ...scaleForm, description: e.target.value })}
                placeholder="Observações sobre esta escala..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScaleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveScale}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Atribuir Escala */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAssignment ? 'Editar Atribuição' : 'Atribuir Escala'}</DialogTitle>
            <DialogDescription>Vincule uma escala a um funcionário</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário</Label>
              <Select
                value={assignmentForm.profile_id}
                onValueChange={(value) => {
                  const emp = employees.find(e => e.id === value);
                  setAssignmentForm({ 
                    ...assignmentForm, 
                    profile_id: value,
                    start_date: emp?.hire_date ? new Date(emp.hire_date) : new Date(),
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.registration_number && `#${emp.registration_number}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Escala</Label>
              <Select
                value={assignmentForm.scale_configuration_id}
                onValueChange={(value) => setAssignmentForm({ ...assignmentForm, scale_configuration_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a escala" />
                </SelectTrigger>
                <SelectContent>
                  {scales.filter(s => s.is_active).map((scale) => (
                    <SelectItem key={scale.id} value={scale.id}>
                      {scale.name} ({scaleTypeLabels[scale.scale_type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Início (Admissão)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(assignmentForm.start_date, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={assignmentForm.start_date}
                    onSelect={(date) => date && setAssignmentForm({ ...assignmentForm, start_date: date })}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Dia Base da Escala</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Data de referência para calcular o ciclo de folgas
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(assignmentForm.scale_start_day, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={assignmentForm.scale_start_day}
                    onSelect={(date) => date && setAssignmentForm({ ...assignmentForm, scale_start_day: date })}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAssignment}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Folga Manual */}
      <Dialog open={offDayDialogOpen} onOpenChange={setOffDayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Folga Manual</DialogTitle>
            <DialogDescription>Adicione uma folga extra fora do ciclo normal da escala</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário</Label>
              <Select
                value={offDayForm.profile_id}
                onValueChange={(value) => setOffDayForm({ ...offDayForm, profile_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data da Folga</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(offDayForm.off_date, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={offDayForm.off_date}
                    onSelect={(date) => date && setOffDayForm({ ...offDayForm, off_date: date })}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input
                value={offDayForm.reason}
                onChange={(e) => setOffDayForm({ ...offDayForm, reason: e.target.value })}
                placeholder="Ex: Compensação, troca de turno..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOffDayDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveOffDay}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
