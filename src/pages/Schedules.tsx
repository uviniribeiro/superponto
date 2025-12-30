import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Calendar, Plus, Edit, Trash2, Clock } from 'lucide-react';

interface WorkSchedule {
  id: string;
  name: string;
  description: string | null;
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

export default function Schedules() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    monday_start: '08:00',
    monday_end: '17:00',
    tuesday_start: '08:00',
    tuesday_end: '17:00',
    wednesday_start: '08:00',
    wednesday_end: '17:00',
    thursday_start: '08:00',
    thursday_end: '17:00',
    friday_start: '08:00',
    friday_end: '17:00',
    saturday_start: '',
    saturday_end: '',
    sunday_start: '',
    sunday_end: '',
    break_duration_minutes: 60,
    tolerance_minutes: 10,
  });

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
      toast.error('Erro ao carregar jornadas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const scheduleData = {
        name: formData.name,
        description: formData.description || null,
        monday_start: formData.monday_start || null,
        monday_end: formData.monday_end || null,
        tuesday_start: formData.tuesday_start || null,
        tuesday_end: formData.tuesday_end || null,
        wednesday_start: formData.wednesday_start || null,
        wednesday_end: formData.wednesday_end || null,
        thursday_start: formData.thursday_start || null,
        thursday_end: formData.thursday_end || null,
        friday_start: formData.friday_start || null,
        friday_end: formData.friday_end || null,
        saturday_start: formData.saturday_start || null,
        saturday_end: formData.saturday_end || null,
        sunday_start: formData.sunday_start || null,
        sunday_end: formData.sunday_end || null,
        break_duration_minutes: formData.break_duration_minutes,
        tolerance_minutes: formData.tolerance_minutes,
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('work_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);

        if (error) throw error;
        toast.success('Jornada atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('work_schedules')
          .insert(scheduleData);

        if (error) throw error;
        toast.success('Jornada criada com sucesso!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Erro ao salvar jornada');
    }
  };

  const handleDelete = async (schedule: WorkSchedule) => {
    if (!confirm('Tem certeza que deseja excluir esta jornada?')) return;

    try {
      const { error } = await supabase
        .from('work_schedules')
        .delete()
        .eq('id', schedule.id);

      if (error) throw error;
      toast.success('Jornada excluída com sucesso!');
      fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Erro ao excluir jornada');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      monday_start: '08:00',
      monday_end: '17:00',
      tuesday_start: '08:00',
      tuesday_end: '17:00',
      wednesday_start: '08:00',
      wednesday_end: '17:00',
      thursday_start: '08:00',
      thursday_end: '17:00',
      friday_start: '08:00',
      friday_end: '17:00',
      saturday_start: '',
      saturday_end: '',
      sunday_start: '',
      sunday_end: '',
      break_duration_minutes: 60,
      tolerance_minutes: 10,
    });
    setEditingSchedule(null);
  };

  const openEditDialog = (schedule: WorkSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      description: schedule.description || '',
      monday_start: schedule.monday_start || '',
      monday_end: schedule.monday_end || '',
      tuesday_start: schedule.tuesday_start || '',
      tuesday_end: schedule.tuesday_end || '',
      wednesday_start: schedule.wednesday_start || '',
      wednesday_end: schedule.wednesday_end || '',
      thursday_start: schedule.thursday_start || '',
      thursday_end: schedule.thursday_end || '',
      friday_start: schedule.friday_start || '',
      friday_end: schedule.friday_end || '',
      saturday_start: schedule.saturday_start || '',
      saturday_end: schedule.saturday_end || '',
      sunday_start: schedule.sunday_start || '',
      sunday_end: schedule.sunday_end || '',
      break_duration_minutes: schedule.break_duration_minutes || 60,
      tolerance_minutes: schedule.tolerance_minutes || 10,
    });
    setIsDialogOpen(true);
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.slice(0, 5);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8 text-primary" />
            Jornadas de Trabalho
          </h1>
          <p className="text-muted-foreground">Gerencie as jornadas e horários</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="mr-2 h-4 w-4" />
          Nova Jornada
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <div className="animate-pulse-soft">Carregando...</div>
          </div>
        ) : schedules.length > 0 ? (
          schedules.map((schedule) => (
            <Card key={schedule.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{schedule.name}</CardTitle>
                    {schedule.description && (
                      <CardDescription>{schedule.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(schedule)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(schedule)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {DAYS.slice(0, 5).map((day) => {
                    const start = schedule[`${day.key}_start` as keyof WorkSchedule];
                    const end = schedule[`${day.key}_end` as keyof WorkSchedule];
                    return (
                      <div key={day.key} className="flex justify-between">
                        <span className="text-muted-foreground">{day.label}</span>
                        <span className="font-mono">
                          {start && end ? `${formatTime(start as string)} - ${formatTime(end as string)}` : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                  <span className="text-muted-foreground">Intervalo</span>
                  <span>{schedule.break_duration_minutes}min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tolerância</span>
                  <span>{schedule.tolerance_minutes}min</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma jornada cadastrada</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Editar Jornada' : 'Nova Jornada'}
            </DialogTitle>
            <DialogDescription>
              Configure os horários de trabalho
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Jornada *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Comercial 8h"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horários por Dia
              </h4>
              <div className="grid gap-3">
                {DAYS.map((day) => (
                  <div key={day.key} className="grid grid-cols-5 gap-2 items-center">
                    <span className="text-sm font-medium">{day.label}</span>
                    <div className="col-span-2">
                      <Input
                        type="time"
                        value={formData[`${day.key}_start` as keyof typeof formData] as string}
                        onChange={(e) => setFormData({
                          ...formData,
                          [`${day.key}_start`]: e.target.value
                        })}
                        placeholder="Entrada"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="time"
                        value={formData[`${day.key}_end` as keyof typeof formData] as string}
                        onChange={(e) => setFormData({
                          ...formData,
                          [`${day.key}_end`]: e.target.value
                        })}
                        placeholder="Saída"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração do Intervalo (min)</Label>
                <Input
                  type="number"
                  value={formData.break_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, break_duration_minutes: parseInt(e.target.value) || 0 })}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}