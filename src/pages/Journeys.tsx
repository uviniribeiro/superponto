import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Clock, Plus, Edit, Trash2, Search, Users, 
  Calendar, Moon, Settings2
} from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import useSEO from '@/hooks/useSEO';

interface WorkSchedule {
  id: string;
  name: string;
  description: string | null;
  scale_type: string | null;
  workload_type: string | null;
  work_days: number | null;
  off_days: number | null;
  work_hours_per_day: number | null;
  weekly_hours: number | null;
  monthly_hours: number | null;
  holiday_treatment: string | null;
  is_active: boolean | null;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
  break_duration_minutes: number | null;
  tolerance_minutes: number | null;
  night_shift_start: string | null;
  night_shift_end: string | null;
  night_shift_reduction_percent: number | null;
  overtime_50_percent_limit: number | null;
  overtime_100_percent_limit: number | null;
  interjornada_hours: number | null;
  intrajornada_minutes: number | null;
}

const DAYS = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const scaleTypeLabels: Record<string, string> = {
  'standard': 'Padrão (CLT)',
  '5x1': '5x1',
  '6x1': '6x1',
  '12x36': '12x36',
};

const holidayTreatmentLabels: Record<string, string> = {
  'normal': 'Dia normal',
  'overtime': 'Hora extra 100%',
  'off': 'Folga',
};

export default function Journeys() {
  useSEO({
    title: 'Jornadas de Trabalho | SuperPonto',
    description: 'Gerencie jornadas e horários de trabalho dos funcionários.',
  });

  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [activeTab, setActiveTab] = useState('basic');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scale_type: 'standard',
    work_days: 5,
    off_days: 2,
    work_hours_per_day: 8,
    weekly_hours: 44,
    monthly_hours: 220,
    holiday_treatment: 'normal',
    break_duration_minutes: 60,
    tolerance_minutes: 10,
    is_night_shift: false,
    night_shift_start: '22:00',
    night_shift_end: '05:00',
    night_shift_reduction_percent: 14.28,
    overtime_50_percent_limit: 2,
    overtime_100_percent_limit: 0,
    interjornada_hours: 11,
    intrajornada_minutes: 60,
  });

  const [daySchedules, setDaySchedules] = useState<Record<string, { enabled: boolean; start: string; end: string }>>({
    monday: { enabled: true, start: '08:00', end: '17:00' },
    tuesday: { enabled: true, start: '08:00', end: '17:00' },
    wednesday: { enabled: true, start: '08:00', end: '17:00' },
    thursday: { enabled: true, start: '08:00', end: '17:00' },
    friday: { enabled: true, start: '08:00', end: '17:00' },
    saturday: { enabled: false, start: '', end: '' },
    sunday: { enabled: false, start: '', end: '' },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .order('name');

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (schedule?: WorkSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        name: schedule.name,
        description: schedule.description || '',
        scale_type: schedule.scale_type || 'standard',
        work_days: schedule.work_days || 5,
        off_days: schedule.off_days || 2,
        work_hours_per_day: schedule.work_hours_per_day || 8,
        weekly_hours: schedule.weekly_hours || 44,
        monthly_hours: schedule.monthly_hours || 220,
        holiday_treatment: schedule.holiday_treatment || 'normal',
        break_duration_minutes: schedule.break_duration_minutes || 60,
        tolerance_minutes: schedule.tolerance_minutes || 10,
        is_night_shift: !!schedule.night_shift_start,
        night_shift_start: schedule.night_shift_start?.slice(0, 5) || '22:00',
        night_shift_end: schedule.night_shift_end?.slice(0, 5) || '05:00',
        night_shift_reduction_percent: schedule.night_shift_reduction_percent || 14.28,
        overtime_50_percent_limit: schedule.overtime_50_percent_limit || 2,
        overtime_100_percent_limit: schedule.overtime_100_percent_limit || 0,
        interjornada_hours: schedule.interjornada_hours || 11,
        intrajornada_minutes: schedule.intrajornada_minutes || 60,
      });
      setDaySchedules({
        monday: { enabled: !!schedule.monday_start, start: schedule.monday_start?.slice(0, 5) || '08:00', end: schedule.monday_end?.slice(0, 5) || '17:00' },
        tuesday: { enabled: !!schedule.tuesday_start, start: schedule.tuesday_start?.slice(0, 5) || '08:00', end: schedule.tuesday_end?.slice(0, 5) || '17:00' },
        wednesday: { enabled: !!schedule.wednesday_start, start: schedule.wednesday_start?.slice(0, 5) || '08:00', end: schedule.wednesday_end?.slice(0, 5) || '17:00' },
        thursday: { enabled: !!schedule.thursday_start, start: schedule.thursday_start?.slice(0, 5) || '08:00', end: schedule.thursday_end?.slice(0, 5) || '17:00' },
        friday: { enabled: !!schedule.friday_start, start: schedule.friday_start?.slice(0, 5) || '08:00', end: schedule.friday_end?.slice(0, 5) || '17:00' },
        saturday: { enabled: !!schedule.saturday_start, start: schedule.saturday_start?.slice(0, 5) || '', end: schedule.saturday_end?.slice(0, 5) || '' },
        sunday: { enabled: !!schedule.sunday_start, start: schedule.sunday_start?.slice(0, 5) || '', end: schedule.sunday_end?.slice(0, 5) || '' },
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        name: '',
        description: '',
        scale_type: 'standard',
        work_days: 5,
        off_days: 2,
        work_hours_per_day: 8,
        weekly_hours: 44,
        monthly_hours: 220,
        holiday_treatment: 'normal',
        break_duration_minutes: 60,
        tolerance_minutes: 10,
        is_night_shift: false,
        night_shift_start: '22:00',
        night_shift_end: '05:00',
        night_shift_reduction_percent: 14.28,
        overtime_50_percent_limit: 2,
        overtime_100_percent_limit: 0,
        interjornada_hours: 11,
        intrajornada_minutes: 60,
      });
      setDaySchedules({
        monday: { enabled: true, start: '08:00', end: '17:00' },
        tuesday: { enabled: true, start: '08:00', end: '17:00' },
        wednesday: { enabled: true, start: '08:00', end: '17:00' },
        thursday: { enabled: true, start: '08:00', end: '17:00' },
        friday: { enabled: true, start: '08:00', end: '17:00' },
        saturday: { enabled: false, start: '', end: '' },
        sunday: { enabled: false, start: '', end: '' },
      });
    }
    setActiveTab('basic');
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
        description: formData.description.trim() || null,
        scale_type: formData.scale_type as 'standard' | '5x1' | '6x1' | '12x36',
        work_days: formData.work_days,
        off_days: formData.off_days,
        work_hours_per_day: formData.work_hours_per_day,
        weekly_hours: formData.weekly_hours,
        monthly_hours: formData.monthly_hours,
        holiday_treatment: formData.holiday_treatment as 'normal' | 'overtime' | 'off',
        break_duration_minutes: formData.break_duration_minutes,
        tolerance_minutes: formData.tolerance_minutes,
        night_shift_start: formData.is_night_shift ? formData.night_shift_start : null,
        night_shift_end: formData.is_night_shift ? formData.night_shift_end : null,
        night_shift_reduction_percent: formData.night_shift_reduction_percent,
        overtime_50_percent_limit: formData.overtime_50_percent_limit,
        overtime_100_percent_limit: formData.overtime_100_percent_limit,
        interjornada_hours: formData.interjornada_hours,
        intrajornada_minutes: formData.intrajornada_minutes,
        monday_start: daySchedules.monday.enabled ? daySchedules.monday.start : null,
        monday_end: daySchedules.monday.enabled ? daySchedules.monday.end : null,
        tuesday_start: daySchedules.tuesday.enabled ? daySchedules.tuesday.start : null,
        tuesday_end: daySchedules.tuesday.enabled ? daySchedules.tuesday.end : null,
        wednesday_start: daySchedules.wednesday.enabled ? daySchedules.wednesday.start : null,
        wednesday_end: daySchedules.wednesday.enabled ? daySchedules.wednesday.end : null,
        thursday_start: daySchedules.thursday.enabled ? daySchedules.thursday.start : null,
        thursday_end: daySchedules.thursday.enabled ? daySchedules.thursday.end : null,
        friday_start: daySchedules.friday.enabled ? daySchedules.friday.start : null,
        friday_end: daySchedules.friday.enabled ? daySchedules.friday.end : null,
        saturday_start: daySchedules.saturday.enabled ? daySchedules.saturday.start : null,
        saturday_end: daySchedules.saturday.enabled ? daySchedules.saturday.end : null,
        sunday_start: daySchedules.sunday.enabled ? daySchedules.sunday.start : null,
        sunday_end: daySchedules.sunday.enabled ? daySchedules.sunday.end : null,
        company_id: profile?.company_id,
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('work_schedules')
          .update(data)
          .eq('id', editingSchedule.id);
        if (error) throw error;
        toast.success('Jornada atualizada!');
      } else {
        const { error } = await supabase.from('work_schedules').insert(data);
        if (error) throw error;
        toast.success('Jornada criada!');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta jornada?')) return;

    try {
      const { error } = await supabase.from('work_schedules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Jornada excluída!');
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir. A jornada pode estar vinculada a funcionários.');
    }
  };

  const filteredSchedules = schedules.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Jornadas de Trabalho
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure horários e regras de trabalho
          </p>
        </div>

        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Jornada
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {schedules.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ativas</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {schedules.filter(s => s.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">12x36</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {schedules.filter(s => s.scale_type === '12x36').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Noturnas</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {schedules.filter(s => s.night_shift_start).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Cards */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar jornada..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredSchedules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSchedules.map((schedule) => (
            <Card key={schedule.id} className="relative hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{schedule.name}</h3>
                      {schedule.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{schedule.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant={schedule.is_active ? 'default' : 'secondary'}
                    className={schedule.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                  >
                    {schedule.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {getScaleTypeBadge(schedule.scale_type)}
                  {schedule.night_shift_start && (
                    <Badge variant="outline" className="bg-indigo-100 text-indigo-700 gap-1">
                      <Moon className="h-3 w-3" />
                      Noturno
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{schedule.weekly_hours || 44}h/sem</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{schedule.work_hours_per_day || 8}h/dia</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t">
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma jornada cadastrada</p>
          <p className="text-sm mt-1">Clique em "Nova Jornada" para começar</p>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Editar' : 'Nova'} Jornada</DialogTitle>
            <DialogDescription>Configure os parâmetros da jornada de trabalho</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="schedule">Horários</TabsTrigger>
              <TabsTrigger value="overtime">Extras</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Administrativo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Escala</Label>
                  <Select
                    value={formData.scale_type}
                    onValueChange={(v) => setFormData({ ...formData, scale_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Padrão (CLT)</SelectItem>
                      <SelectItem value="5x1">5x1</SelectItem>
                      <SelectItem value="6x1">6x1</SelectItem>
                      <SelectItem value="12x36">12x36</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Carga Semanal (h)</Label>
                  <Input
                    type="number"
                    value={formData.weekly_hours}
                    onChange={(e) => setFormData({ ...formData, weekly_hours: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Carga Diária (h)</Label>
                  <Input
                    type="number"
                    value={formData.work_hours_per_day}
                    onChange={(e) => setFormData({ ...formData, work_hours_per_day: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tolerância (min)</Label>
                  <Input
                    type="number"
                    value={formData.tolerance_minutes}
                    onChange={(e) => setFormData({ ...formData, tolerance_minutes: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Intervalo Intrajornada (min)</Label>
                  <Input
                    type="number"
                    value={formData.intrajornada_minutes}
                    onChange={(e) => setFormData({ ...formData, intrajornada_minutes: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tratamento de Feriado</Label>
                  <Select
                    value={formData.holiday_treatment}
                    onValueChange={(v) => setFormData({ ...formData, holiday_treatment: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Dia normal</SelectItem>
                      <SelectItem value="overtime">Hora extra 100%</SelectItem>
                      <SelectItem value="off">Folga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 mt-4">
              {DAYS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-4">
                  <div className="w-28 flex items-center gap-2">
                    <Switch
                      checked={daySchedules[key].enabled}
                      onCheckedChange={(checked) => setDaySchedules(prev => ({
                        ...prev,
                        [key]: { ...prev[key], enabled: checked }
                      }))}
                    />
                    <span className={`text-sm ${daySchedules[key].enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {label}
                    </span>
                  </div>
                  {daySchedules[key].enabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={daySchedules[key].start}
                        onChange={(e) => setDaySchedules(prev => ({
                          ...prev,
                          [key]: { ...prev[key], start: e.target.value }
                        }))}
                        className="w-28"
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={daySchedules[key].end}
                        onChange={(e) => setDaySchedules(prev => ({
                          ...prev,
                          [key]: { ...prev[key], end: e.target.value }
                        }))}
                        className="w-28"
                      />
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="overtime" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Jornada Noturna</Label>
                  <p className="text-xs text-muted-foreground">Habilitar redução de hora noturna</p>
                </div>
                <Switch
                  checked={formData.is_night_shift}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_night_shift: checked })}
                />
              </div>

              {formData.is_night_shift && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label>Início Noturno</Label>
                    <Input
                      type="time"
                      value={formData.night_shift_start}
                      onChange={(e) => setFormData({ ...formData, night_shift_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim Noturno</Label>
                    <Input
                      type="time"
                      value={formData.night_shift_end}
                      onChange={(e) => setFormData({ ...formData, night_shift_end: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Redução (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.night_shift_reduction_percent}
                      onChange={(e) => setFormData({ ...formData, night_shift_reduction_percent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Limite H.E. 50% (h/dia)</Label>
                  <Input
                    type="number"
                    value={formData.overtime_50_percent_limit}
                    onChange={(e) => setFormData({ ...formData, overtime_50_percent_limit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Limite H.E. 100% (h/dia)</Label>
                  <Input
                    type="number"
                    value={formData.overtime_100_percent_limit}
                    onChange={(e) => setFormData({ ...formData, overtime_100_percent_limit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Interjornada (horas)</Label>
                <Input
                  type="number"
                  value={formData.interjornada_hours}
                  onChange={(e) => setFormData({ ...formData, interjornada_hours: parseInt(e.target.value) || 11 })}
                />
                <p className="text-xs text-muted-foreground">Mínimo de descanso entre jornadas (CLT: 11h)</p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="journeys" />
    </div>
  );
}
