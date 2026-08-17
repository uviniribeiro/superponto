import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Clock, Plus, Edit, Trash2, Users, Calendar } from 'lucide-react';

interface WorkSchedule {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  weekly_hours?: number | null;
  work_hours_per_day?: number | null;
  tolerance_minutes?: number | null;
  scale_type?: string | null;
  is_active: boolean | null;
}

interface DaySchedule {
  enabled: boolean;
  entry1: string;
  exit1: string;
  entry2: string;
  exit2: string;
}

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function NewScales() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [activeTab, setActiveTab] = useState('basico');
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    schedule_type: 'normal',
    status: 'active',
    weekly_hours: '44',
    daily_hours: '8',
    tolerance_minutes: '10',
    // Overtime
    weekday_percentage: '50',
    saturday_percentage: '50',
    sunday_percentage: '100',
    holiday_percentage: '100',
    night_start: '22:00',
    night_end: '05:00',
  });

  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>(
    DAYS.map((_, i) => ({
      enabled: i >= 1 && i <= 5, // Mon-Fri enabled by default
      entry1: '08:00',
      exit1: '12:00',
      entry2: '13:00',
      exit2: '17:00',
    }))
  );

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .order('name');

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Erro ao carregar escalas');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (schedule?: WorkSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        name: schedule.name,
        code: schedule.code || '',
        schedule_type: schedule.scale_type || 'normal',
        status: schedule.is_active ? 'active' : 'inactive',
        weekly_hours: String(schedule.weekly_hours || 44),
        daily_hours: String(schedule.work_hours_per_day || 8),
        tolerance_minutes: String(schedule.tolerance_minutes || 10),
        weekday_percentage: '50',
        saturday_percentage: '50',
        sunday_percentage: '100',
        holiday_percentage: '100',
        night_start: '22:00',
        night_end: '05:00',
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        name: '',
        code: '',
        schedule_type: 'normal',
        status: 'active',
        weekly_hours: '44',
        daily_hours: '8',
        tolerance_minutes: '10',
        weekday_percentage: '50',
        saturday_percentage: '50',
        sunday_percentage: '100',
        holiday_percentage: '100',
        night_start: '22:00',
        night_end: '05:00',
      });
      setDaySchedules(
        DAYS.map((_, i) => ({
          enabled: i >= 1 && i <= 5,
          entry1: '08:00',
          exit1: '12:00',
          entry2: '13:00',
          exit2: '17:00',
        }))
      );
    }
    setActiveTab('basico');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const data = {
        name: formData.name.trim(),
        description: formData.code.trim() || null,
        weekly_hours: parseInt(formData.weekly_hours) || 44,
        tolerance_minutes: parseInt(formData.tolerance_minutes) || 10,
        is_active: formData.status === 'active',
        company_id: profile?.company_id,
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('work_schedules')
          .update(data)
          .eq('id', editingSchedule.id);
        if (error) throw error;
        toast.success('Escala atualizada!');
      } else {
        const { error } = await supabase.from('work_schedules').insert(data);
        if (error) throw error;
        toast.success('Escala criada!');
      }

      setIsDialogOpen(false);
      fetchSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Erro ao salvar escala');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta escala?')) return;

    try {
      const { error } = await supabase.from('work_schedules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Escala excluída!');
      fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Erro ao excluir. A escala pode estar vinculada a funcionários.');
    }
  };

  const updateDaySchedule = (index: number, field: keyof DaySchedule, value: any) => {
    setDaySchedules(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const getScheduleTypeLabel = (type?: string | null) => {
    switch (type) {
      case '12x36': return '12x36';
      case 'flexible': return 'Flexível';
      default: return 'Normal';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-0 flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <PageHeader
          title="Escalas de Trabalho"
          description={`${schedules.length} escalas cadastradas`}
          icon={CalendarDays}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Escala
        </Button>
      </div>


      {/* Schedule Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.map((schedule) => (
          <Card key={schedule.id} className="relative">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{schedule.name}</h3>
                    {schedule.code && (
                      <p className="text-xs text-muted-foreground">{schedule.code}</p>
                    )}
                  </div>
                </div>
                <Badge 
                  variant={schedule.is_active ? 'default' : 'secondary'}
                  className={schedule.is_active 
                    ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                    : ''
                  }
                >
                  {schedule.is_active ? 'ativo' : 'inativo'}
                </Badge>
              </div>

              <div className="flex gap-2 mt-3">
                <Badge variant="outline" className="text-xs">
                  {getScheduleTypeLabel(schedule.scale_type)}
                </Badge>
                {schedule.description && (
                  <span className="text-xs text-muted-foreground truncate">
                    {schedule.description}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{schedule.weekly_hours || 44}h/semana</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{schedule.work_hours_per_day || 8}h/dia</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>0 funcionário(s)</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openDialog(schedule)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(schedule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {schedules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma escala cadastrada</p>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Editar Escala' : 'Nova Escala'}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="horarios">Horários</TabsTrigger>
              <TabsTrigger value="hora-extra">Hora Extra</TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basico" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome da escala"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Código único"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Escala</Label>
                  <Select
                    value={formData.schedule_type}
                    onValueChange={(v) => setFormData({ ...formData, schedule_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="12x36">12x36</SelectItem>
                      <SelectItem value="flexible">Flexível</SelectItem>
                    </SelectContent>
                  </Select>
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
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Carga Semanal (h)</Label>
                  <Input
                    type="number"
                    value={formData.weekly_hours}
                    onChange={(e) => setFormData({ ...formData, weekly_hours: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Carga Diária (h)</Label>
                  <Input
                    type="number"
                    value={formData.daily_hours}
                    onChange={(e) => setFormData({ ...formData, daily_hours: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tolerância (min)</Label>
                  <Input
                    type="number"
                    value={formData.tolerance_minutes}
                    onChange={(e) => setFormData({ ...formData, tolerance_minutes: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Schedules Tab */}
            <TabsContent value="horarios" className="space-y-4 mt-4">
              {DAYS.map((day, index) => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-20 flex items-center gap-2">
                    <Switch
                      checked={daySchedules[index].enabled}
                      onCheckedChange={(checked) => updateDaySchedule(index, 'enabled', checked)}
                    />
                    <span className={`text-sm ${daySchedules[index].enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {day}
                    </span>
                  </div>
                  {daySchedules[index].enabled && (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={daySchedules[index].entry1}
                        onChange={(e) => updateDaySchedule(index, 'entry1', e.target.value)}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={daySchedules[index].exit1}
                        onChange={(e) => updateDaySchedule(index, 'exit1', e.target.value)}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={daySchedules[index].entry2}
                        onChange={(e) => updateDaySchedule(index, 'entry2', e.target.value)}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={daySchedules[index].exit2}
                        onChange={(e) => updateDaySchedule(index, 'exit2', e.target.value)}
                        className="w-24"
                      />
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            {/* Overtime Tab */}
            <TabsContent value="hora-extra" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dia Útil (%)</Label>
                  <Input
                    type="number"
                    value={formData.weekday_percentage}
                    onChange={(e) => setFormData({ ...formData, weekday_percentage: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sábado (%)</Label>
                  <Input
                    type="number"
                    value={formData.saturday_percentage}
                    onChange={(e) => setFormData({ ...formData, saturday_percentage: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Domingo (%)</Label>
                  <Input
                    type="number"
                    value={formData.sunday_percentage}
                    onChange={(e) => setFormData({ ...formData, sunday_percentage: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Feriado (%)</Label>
                  <Input
                    type="number"
                    value={formData.holiday_percentage}
                    onChange={(e) => setFormData({ ...formData, holiday_percentage: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início Adicional Noturno</Label>
                  <Input
                    type="time"
                    value={formData.night_start}
                    onChange={(e) => setFormData({ ...formData, night_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim Adicional Noturno</Label>
                  <Input
                    type="time"
                    value={formData.night_end}
                    onChange={(e) => setFormData({ ...formData, night_end: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
