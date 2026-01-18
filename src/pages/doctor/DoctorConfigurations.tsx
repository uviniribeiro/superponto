import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Moon, Stethoscope, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ShiftConfiguration {
  id: string;
  name: string;
  duration_hours: number;
  hourly_rate: number | null;
  description: string | null;
  is_active: boolean;
  night_shift_start: string | null;
  night_shift_end: string | null;
  night_shift_rate_multiplier: number | null;
  weekend_rate_multiplier: number | null;
  holiday_rate_multiplier: number | null;
  max_consecutive_hours: number | null;
  min_rest_hours: number | null;
}

interface DoctorConfigurationsProps {
  configurations: ShiftConfiguration[];
  onRefresh: () => void;
}

export default function DoctorConfigurations({ configurations, onRefresh }: DoctorConfigurationsProps) {
  const { profile } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ShiftConfiguration | null>(null);

  const [form, setForm] = useState({
    name: '',
    duration_hours: 12,
    hourly_rate: '',
    description: '',
    night_shift_start: '19:00',
    night_shift_end: '07:00',
    night_shift_rate_multiplier: 1.5,
    weekend_rate_multiplier: 1.5,
    holiday_rate_multiplier: 2.0,
    max_consecutive_hours: 24,
    min_rest_hours: 11,
    has_night_shift: false,
  });

  const resetForm = () => {
    setForm({
      name: '',
      duration_hours: 12,
      hourly_rate: '',
      description: '',
      night_shift_start: '19:00',
      night_shift_end: '07:00',
      night_shift_rate_multiplier: 1.5,
      weekend_rate_multiplier: 1.5,
      holiday_rate_multiplier: 2.0,
      max_consecutive_hours: 24,
      min_rest_hours: 11,
      has_night_shift: false,
    });
    setEditingConfig(null);
  };

  const openEditConfig = (config: ShiftConfiguration) => {
    setEditingConfig(config);
    setForm({
      name: config.name,
      duration_hours: config.duration_hours,
      hourly_rate: config.hourly_rate?.toString() || '',
      description: config.description || '',
      night_shift_start: config.night_shift_start || '19:00',
      night_shift_end: config.night_shift_end || '07:00',
      night_shift_rate_multiplier: config.night_shift_rate_multiplier || 1.5,
      weekend_rate_multiplier: config.weekend_rate_multiplier || 1.5,
      holiday_rate_multiplier: config.holiday_rate_multiplier || 2.0,
      max_consecutive_hours: config.max_consecutive_hours || 24,
      min_rest_hours: config.min_rest_hours || 11,
      has_night_shift: !!config.night_shift_start,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const data = {
        name: form.name,
        duration_hours: form.duration_hours,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        description: form.description || null,
        night_shift_start: form.has_night_shift ? form.night_shift_start : null,
        night_shift_end: form.has_night_shift ? form.night_shift_end : null,
        night_shift_rate_multiplier: form.night_shift_rate_multiplier,
        weekend_rate_multiplier: form.weekend_rate_multiplier,
        holiday_rate_multiplier: form.holiday_rate_multiplier,
        max_consecutive_hours: form.max_consecutive_hours,
        min_rest_hours: form.min_rest_hours,
        company_id: profile?.company_id,
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('medical_shift_configurations')
          .update(data)
          .eq('id', editingConfig.id);
        if (error) throw error;
        toast.success('Configuração atualizada!');
      } else {
        const { error } = await supabase
          .from('medical_shift_configurations')
          .insert(data);
        if (error) throw error;
        toast.success('Configuração criada!');
      }

      setDialogOpen(false);
      resetForm();
      onRefresh();
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta configuração?')) return;
    try {
      const { error } = await supabase.from('medical_shift_configurations').delete().eq('id', id);
      if (error) throw error;
      toast.success('Configuração excluída!');
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.slice(0, 5);
  };

  return (
    <div className="space-y-4" data-tour="doctor-config">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gradient-primary btn-press">
          <Plus className="h-4 w-4 mr-2" />
          Nova Configuração
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configurations.map((config, index) => (
          <Card key={config.id} className={`card-hover animate-fade-in stagger-${Math.min(index + 1, 5)}`}>
            <CardHeader className="pb-3">
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
                  <span className="text-muted-foreground">Duração do plantão:</span>
                  <span className="font-medium">{config.duration_hours}h</span>
                </div>
                {config.hourly_rate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor hora:</span>
                    <span className="font-medium">R$ {config.hourly_rate.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Add. Fim de Semana:</span>
                  <span className="font-medium">{((config.weekend_rate_multiplier || 1) * 100 - 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Add. Feriado:</span>
                  <span className="font-medium">{((config.holiday_rate_multiplier || 1) * 100 - 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descanso mínimo:</span>
                  <span className="font-medium">{config.min_rest_hours || 11}h</span>
                </div>
                {config.night_shift_start && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Moon className="h-3 w-3" /> Noturno:
                    </span>
                    <span className="font-medium">
                      {formatTime(config.night_shift_start)} - {formatTime(config.night_shift_end)}
                    </span>
                  </div>
                )}
              </div>
              <Separator className="my-4" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditConfig(config)} className="flex-1 btn-press">
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(config.id)} className="btn-press">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {configurations.length === 0 && (
        <Card className="animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Stethoscope className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma configuração cadastrada</p>
            <Button className="mt-4" onClick={() => { resetForm(); setDialogOpen(true); }}>
              Criar primeira configuração
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Editar Configuração' : 'Nova Configuração de Plantão'}
            </DialogTitle>
            <DialogDescription>
              Configure parâmetros de plantão médico conforme normas do CFM e CLT
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Configuração *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Plantão 12h UBS"
                />
              </div>
              <div className="space-y-2">
                <Label>Duração (horas)</Label>
                <Input
                  type="number"
                  value={form.duration_hours}
                  onChange={(e) => setForm({ ...form, duration_hours: parseInt(e.target.value) || 12 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Parâmetros de Plantão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Valor Hora (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.hourly_rate}
                      onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mult. Fim de Semana</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.weekend_rate_multiplier}
                      onChange={(e) => setForm({ ...form, weekend_rate_multiplier: parseFloat(e.target.value) || 1.5 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mult. Feriado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.holiday_rate_multiplier}
                      onChange={(e) => setForm({ ...form, holiday_rate_multiplier: parseFloat(e.target.value) || 2.0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. Consecutivas (h)</Label>
                    <Input
                      type="number"
                      value={form.max_consecutive_hours}
                      onChange={(e) => setForm({ ...form, max_consecutive_hours: parseInt(e.target.value) || 24 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descanso Mínimo (h)</Label>
                    <Input
                      type="number"
                      value={form.min_rest_hours}
                      onChange={(e) => setForm({ ...form, min_rest_hours: parseInt(e.target.value) || 11 })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Adicional Noturno (Art. 73 CLT)
                  </CardTitle>
                  <Switch
                    checked={form.has_night_shift}
                    onCheckedChange={(checked) => setForm({ ...form, has_night_shift: checked })}
                  />
                </div>
              </CardHeader>
              {form.has_night_shift && (
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Início Noturno</Label>
                      <Input
                        type="time"
                        value={form.night_shift_start}
                        onChange={(e) => setForm({ ...form, night_shift_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim Noturno</Label>
                      <Input
                        type="time"
                        value={form.night_shift_end}
                        onChange={(e) => setForm({ ...form, night_shift_end: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Multiplicador</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.night_shift_rate_multiplier}
                        onChange={(e) => setForm({ ...form, night_shift_rate_multiplier: parseFloat(e.target.value) || 1.5 })}
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
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