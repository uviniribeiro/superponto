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
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, CalendarIcon, Clock, Users, BookOpen, DollarSign } from 'lucide-react';

interface ClassHourConfiguration {
  id: string;
  name: string;
  duration_minutes: number;
  hourly_rate: number | null;
  description: string | null;
  is_active: boolean;
}

interface EmployeeClassHourAssignment {
  id: string;
  profile_id: string;
  class_hour_configuration_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
  class_hour_configuration?: ClassHourConfiguration;
}

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
  class_hour_configuration?: ClassHourConfiguration;
}

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
}

export default function ClassHours() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [configurations, setConfigurations] = useState<ClassHourConfiguration[]>([]);
  const [assignments, setAssignments] = useState<EmployeeClassHourAssignment[]>([]);
  const [records, setRecords] = useState<ClassRecord[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);

  const [editingConfig, setEditingConfig] = useState<ClassHourConfiguration | null>(null);

  const [configForm, setConfigForm] = useState({
    name: '',
    duration_minutes: 50,
    hourly_rate: '',
    description: '',
  });

  const [assignmentForm, setAssignmentForm] = useState({
    profile_id: '',
    class_hour_configuration_id: '',
    start_date: new Date(),
  });

  const [recordForm, setRecordForm] = useState({
    profile_id: '',
    class_hour_configuration_id: '',
    class_date: new Date(),
    number_of_classes: 1,
    notes: '',
  });

  const [filterMonth, setFilterMonth] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [filterMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

      const [configsRes, assignmentsRes, recordsRes, employeesRes] = await Promise.all([
        supabase.from('class_hour_configurations').select('*').order('name'),
        supabase.from('employee_class_hour_assignments').select(`
          *,
          profile:profiles(full_name, registration_number),
          class_hour_configuration:class_hour_configurations(*)
        `).order('created_at', { ascending: false }),
        supabase.from('class_records').select(`
          *,
          profile:profiles(full_name),
          class_hour_configuration:class_hour_configurations(*)
        `).gte('class_date', startDate).lte('class_date', endDate).order('class_date', { ascending: false }),
        supabase.from('profiles').select('id, full_name, registration_number').eq('is_active', true).order('full_name'),
      ]);

      if (configsRes.data) setConfigurations(configsRes.data as ClassHourConfiguration[]);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as EmployeeClassHourAssignment[]);
      if (recordsRes.data) setRecords(recordsRes.data as unknown as ClassRecord[]);
      if (employeesRes.data) setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const data = {
        name: configForm.name,
        duration_minutes: configForm.duration_minutes,
        hourly_rate: configForm.hourly_rate ? parseFloat(configForm.hourly_rate) : null,
        description: configForm.description || null,
        company_id: profile?.company_id,
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('class_hour_configurations')
          .update(data)
          .eq('id', editingConfig.id);
        if (error) throw error;
        toast({ title: 'Configuração atualizada com sucesso' });
      } else {
        const { error } = await supabase
          .from('class_hour_configurations')
          .insert(data);
        if (error) throw error;
        toast({ title: 'Configuração criada com sucesso' });
      }

      setConfigDialogOpen(false);
      resetConfigForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({ title: 'Erro ao salvar configuração', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração?')) return;
    try {
      const { error } = await supabase.from('class_hour_configurations').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Configuração excluída com sucesso' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting config:', error);
      toast({ title: 'Erro ao excluir configuração', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveAssignment = async () => {
    try {
      const { error } = await supabase.from('employee_class_hour_assignments').insert({
        profile_id: assignmentForm.profile_id,
        class_hour_configuration_id: assignmentForm.class_hour_configuration_id,
        start_date: format(assignmentForm.start_date, 'yyyy-MM-dd'),
        company_id: profile?.company_id,
      });
      if (error) throw error;
      toast({ title: 'Configuração atribuída ao funcionário' });
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
      const { error } = await supabase.from('employee_class_hour_assignments').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Atribuição removida com sucesso' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      toast({ title: 'Erro ao remover atribuição', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveRecord = async () => {
    try {
      const config = configurations.find(c => c.id === recordForm.class_hour_configuration_id);
      const totalMinutes = recordForm.number_of_classes * (config?.duration_minutes || 50);

      const { error } = await supabase.from('class_records').insert({
        profile_id: recordForm.profile_id,
        class_hour_configuration_id: recordForm.class_hour_configuration_id,
        class_date: format(recordForm.class_date, 'yyyy-MM-dd'),
        number_of_classes: recordForm.number_of_classes,
        total_minutes: totalMinutes,
        notes: recordForm.notes || null,
        company_id: profile?.company_id,
      });
      if (error) throw error;
      toast({ title: 'Aulas registradas com sucesso' });
      setRecordDialogOpen(false);
      resetRecordForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving record:', error);
      toast({ title: 'Erro ao registrar aulas', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      const { error } = await supabase.from('class_records').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Registro excluído com sucesso' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting record:', error);
      toast({ title: 'Erro ao excluir registro', description: error.message, variant: 'destructive' });
    }
  };

  const resetConfigForm = () => {
    setConfigForm({
      name: '',
      duration_minutes: 50,
      hourly_rate: '',
      description: '',
    });
    setEditingConfig(null);
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      profile_id: '',
      class_hour_configuration_id: '',
      start_date: new Date(),
    });
  };

  const resetRecordForm = () => {
    setRecordForm({
      profile_id: '',
      class_hour_configuration_id: '',
      class_date: new Date(),
      number_of_classes: 1,
      notes: '',
    });
  };

  const openEditConfig = (config: ClassHourConfiguration) => {
    setEditingConfig(config);
    setConfigForm({
      name: config.name,
      duration_minutes: config.duration_minutes,
      hourly_rate: config.hourly_rate?.toString() || '',
      description: config.description || '',
    });
    setConfigDialogOpen(true);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  const calculateMonthSummary = (profileId: string) => {
    const profileRecords = records.filter(r => r.profile_id === profileId);
    const totalClasses = profileRecords.reduce((sum, r) => sum + r.number_of_classes, 0);
    const totalMinutes = profileRecords.reduce((sum, r) => sum + r.total_minutes, 0);
    
    let totalValue = 0;
    profileRecords.forEach(r => {
      if (r.class_hour_configuration?.hourly_rate) {
        const hours = r.total_minutes / 60;
        totalValue += hours * r.class_hour_configuration.hourly_rate;
      }
    });

    return { totalClasses, totalMinutes, totalValue };
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
          <h1 className="text-2xl font-bold">Gestão de Hora Aula</h1>
          <p className="text-muted-foreground">Configure valores por hora aula e registre aulas ministradas</p>
        </div>
      </div>

      <Tabs defaultValue="configurations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configurations" className="gap-2">
            <Clock className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Users className="h-4 w-4" />
            Atribuições
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Aulas Registradas
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Resumo Mensal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetConfigForm(); setConfigDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Configuração
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {configurations.map((config) => (
              <Card key={config.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription>{config.description}</CardDescription>
                    </div>
                    <Badge variant={config.is_active ? 'default' : 'secondary'}>
                      {config.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duração da aula:</span>
                      <span className="font-medium">{config.duration_minutes} min</span>
                    </div>
                    {config.hourly_rate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor hora:</span>
                        <span className="font-medium">
                          R$ {config.hourly_rate.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor por aula:</span>
                      <span className="font-medium">
                        {config.hourly_rate 
                          ? `R$ ${((config.hourly_rate / 60) * config.duration_minutes).toFixed(2)}`
                          : '-'
                        }
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => openEditConfig(config)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteConfig(config.id)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {configurations.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma configuração cadastrada</p>
                <Button className="mt-4" onClick={() => { resetConfigForm(); setConfigDialogOpen(true); }}>
                  Criar primeira configuração
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetAssignmentForm(); setAssignmentDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Atribuir Configuração
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Configuração</TableHead>
                  <TableHead>Duração Aula</TableHead>
                  <TableHead>Valor Hora</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
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
                        {assignment.class_hour_configuration?.name}
                      </Badge>
                    </TableCell>
                    <TableCell>{assignment.class_hour_configuration?.duration_minutes} min</TableCell>
                    <TableCell>
                      {assignment.class_hour_configuration?.hourly_rate 
                        ? `R$ ${assignment.class_hour_configuration.hourly_rate.toFixed(2)}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell>{format(new Date(assignment.start_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAssignment(assignment.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {assignments.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma configuração atribuída</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Mês:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filterMonth, "MMMM yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterMonth}
                    onSelect={(date) => date && setFilterMonth(date)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={() => { resetRecordForm(); setRecordDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar Aulas
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Configuração</TableHead>
                  <TableHead>Qtd Aulas</TableHead>
                  <TableHead>Tempo Total</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const value = record.class_hour_configuration?.hourly_rate 
                    ? (record.total_minutes / 60) * record.class_hour_configuration.hourly_rate
                    : null;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.class_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{record.profile?.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {record.class_hour_configuration?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.number_of_classes}</TableCell>
                      <TableCell>{formatDuration(record.total_minutes)}</TableCell>
                      <TableCell>
                        {value ? `R$ ${value.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{record.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRecord(record.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {records.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma aula registrada neste mês</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>Mês:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(filterMonth, "MMMM yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterMonth}
                  onSelect={(date) => date && setFilterMonth(date)}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumo por Funcionário</CardTitle>
              <CardDescription>
                Consolidado de aulas ministradas em {format(filterMonth, "MMMM yyyy", { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-center">Total de Aulas</TableHead>
                    <TableHead className="text-center">Tempo Total</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...new Set(records.map(r => r.profile_id))].map(profileId => {
                    const summary = calculateMonthSummary(profileId);
                    const profileName = records.find(r => r.profile_id === profileId)?.profile?.full_name || 'Desconhecido';
                    return (
                      <TableRow key={profileId}>
                        <TableCell className="font-medium">{profileName}</TableCell>
                        <TableCell className="text-center">{summary.totalClasses}</TableCell>
                        <TableCell className="text-center">{formatDuration(summary.totalMinutes)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {summary.totalValue > 0 ? `R$ ${summary.totalValue.toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {records.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum dado para exibir neste mês</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Nova/Editar Configuração */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Editar Configuração' : 'Nova Configuração'}</DialogTitle>
            <DialogDescription>Configure a duração e valor da hora aula</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={configForm.name}
                onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                placeholder="Ex: Aula Regular, Aula Prática..."
              />
            </div>
            <div>
              <Label htmlFor="duration">Duração por Aula (minutos)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={configForm.duration_minutes}
                onChange={(e) => setConfigForm({ ...configForm, duration_minutes: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="hourly_rate">Valor por Hora (R$)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                value={configForm.hourly_rate}
                onChange={(e) => setConfigForm({ ...configForm, hourly_rate: e.target.value })}
                placeholder="Ex: 50.00"
              />
              {configForm.hourly_rate && configForm.duration_minutes > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Valor por aula: R$ {((parseFloat(configForm.hourly_rate) / 60) * configForm.duration_minutes).toFixed(2)}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={configForm.description}
                onChange={(e) => setConfigForm({ ...configForm, description: e.target.value })}
                placeholder="Observações sobre esta configuração..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveConfig}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Atribuir Configuração */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Configuração</DialogTitle>
            <DialogDescription>Vincule uma configuração de hora aula a um funcionário</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário</Label>
              <Select
                value={assignmentForm.profile_id}
                onValueChange={(value) => setAssignmentForm({ ...assignmentForm, profile_id: value })}
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
              <Label>Configuração</Label>
              <Select
                value={assignmentForm.class_hour_configuration_id}
                onValueChange={(value) => setAssignmentForm({ ...assignmentForm, class_hour_configuration_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a configuração" />
                </SelectTrigger>
                <SelectContent>
                  {configurations.filter(c => c.is_active).map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name} ({config.duration_minutes}min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Início</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAssignment}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar Aulas */}
      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Aulas</DialogTitle>
            <DialogDescription>Registre as aulas ministradas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Funcionário</Label>
              <Select
                value={recordForm.profile_id}
                onValueChange={(value) => {
                  const assignment = assignments.find(a => a.profile_id === value && a.is_active);
                  setRecordForm({ 
                    ...recordForm, 
                    profile_id: value,
                    class_hour_configuration_id: assignment?.class_hour_configuration_id || '',
                  });
                }}
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
              <Label>Configuração de Hora Aula</Label>
              <Select
                value={recordForm.class_hour_configuration_id}
                onValueChange={(value) => setRecordForm({ ...recordForm, class_hour_configuration_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a configuração" />
                </SelectTrigger>
                <SelectContent>
                  {configurations.filter(c => c.is_active).map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name} ({config.duration_minutes}min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(recordForm.class_date, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={recordForm.class_date}
                    onSelect={(date) => date && setRecordForm({ ...recordForm, class_date: date })}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="num_classes">Quantidade de Aulas</Label>
              <Input
                id="num_classes"
                type="number"
                min="1"
                value={recordForm.number_of_classes}
                onChange={(e) => setRecordForm({ ...recordForm, number_of_classes: parseInt(e.target.value) || 1 })}
              />
              {recordForm.class_hour_configuration_id && (
                <p className="text-sm text-muted-foreground mt-1">
                  Tempo total: {formatDuration(
                    recordForm.number_of_classes * 
                    (configurations.find(c => c.id === recordForm.class_hour_configuration_id)?.duration_minutes || 0)
                  )}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={recordForm.notes}
                onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                placeholder="Detalhes sobre as aulas..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveRecord}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
