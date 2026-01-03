import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Moon, School } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TeacherConfiguration {
  id: string;
  name: string;
  duration_minutes: number;
  hourly_rate: number | null;
  description: string | null;
  is_active: boolean;
  contract_type: string | null;
  weekly_class_hours: number | null;
  monthly_class_hours: number | null;
  min_interval_between_classes: number | null;
  max_consecutive_classes: number | null;
  night_class_start: string | null;
  night_class_end: string | null;
  night_class_rate_multiplier: number | null;
  activity_hours_percent: number | null;
  preparation_minutes_per_class: number | null;
}

const contractTypeLabels: Record<string, string> = {
  'hourly': 'Horista',
  'part_time': 'Tempo Parcial',
  'full_time': 'Tempo Integral',
};

interface TeacherConfigurationsProps {
  configurations: TeacherConfiguration[];
  onRefresh: () => void;
}

export default function TeacherConfigurations({ configurations, onRefresh }: TeacherConfigurationsProps) {
  const { profile } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TeacherConfiguration | null>(null);

  const [form, setForm] = useState({
    name: '',
    duration_minutes: 50,
    hourly_rate: '',
    description: '',
    contract_type: 'hourly',
    weekly_class_hours: '',
    monthly_class_hours: '',
    min_interval_between_classes: 10,
    max_consecutive_classes: 4,
    night_class_start: '18:00',
    night_class_end: '22:00',
    night_class_rate_multiplier: 1.2,
    activity_hours_percent: 33.33,
    preparation_minutes_per_class: 10,
    has_night_classes: false,
  });

  const resetForm = () => {
    setForm({
      name: '',
      duration_minutes: 50,
      hourly_rate: '',
      description: '',
      contract_type: 'hourly',
      weekly_class_hours: '',
      monthly_class_hours: '',
      min_interval_between_classes: 10,
      max_consecutive_classes: 4,
      night_class_start: '18:00',
      night_class_end: '22:00',
      night_class_rate_multiplier: 1.2,
      activity_hours_percent: 33.33,
      preparation_minutes_per_class: 10,
      has_night_classes: false,
    });
    setEditingConfig(null);
  };

  const openEditConfig = (config: TeacherConfiguration) => {
    setEditingConfig(config);
    setForm({
      name: config.name,
      duration_minutes: config.duration_minutes,
      hourly_rate: config.hourly_rate?.toString() || '',
      description: config.description || '',
      contract_type: config.contract_type || 'hourly',
      weekly_class_hours: config.weekly_class_hours?.toString() || '',
      monthly_class_hours: config.monthly_class_hours?.toString() || '',
      min_interval_between_classes: config.min_interval_between_classes || 10,
      max_consecutive_classes: config.max_consecutive_classes || 4,
      night_class_start: config.night_class_start || '18:00',
      night_class_end: config.night_class_end || '22:00',
      night_class_rate_multiplier: config.night_class_rate_multiplier || 1.2,
      activity_hours_percent: config.activity_hours_percent || 33.33,
      preparation_minutes_per_class: config.preparation_minutes_per_class || 10,
      has_night_classes: !!config.night_class_start,
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
        duration_minutes: form.duration_minutes,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        description: form.description || null,
        contract_type: form.contract_type,
        weekly_class_hours: form.weekly_class_hours ? parseFloat(form.weekly_class_hours) : null,
        monthly_class_hours: form.monthly_class_hours ? parseFloat(form.monthly_class_hours) : null,
        min_interval_between_classes: form.min_interval_between_classes,
        max_consecutive_classes: form.max_consecutive_classes,
        night_class_start: form.has_night_classes ? form.night_class_start : null,
        night_class_end: form.has_night_classes ? form.night_class_end : null,
        night_class_rate_multiplier: form.night_class_rate_multiplier,
        activity_hours_percent: form.activity_hours_percent,
        preparation_minutes_per_class: form.preparation_minutes_per_class,
        company_id: profile?.company_id,
      };

      if (editingConfig) {
        const { error } = await supabase
          .from('class_hour_configurations')
          .update(data)
          .eq('id', editingConfig.id);
        if (error) throw error;
        toast.success('Configuração atualizada!');
      } else {
        const { error } = await supabase
          .from('class_hour_configurations')
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
      const { error } = await supabase.from('class_hour_configurations').delete().eq('id', id);
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
    <div className="space-y-4" data-tour="teacher-config">
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
                  {contractTypeLabels[config.contract_type || 'hourly']}
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
                    <span className="font-medium">R$ {config.hourly_rate.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hora atividade:</span>
                  <span className="font-medium">{config.activity_hours_percent || 33.33}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Máx. consecutivas:</span>
                  <span className="font-medium">{config.max_consecutive_classes || 4} aulas</span>
                </div>
                {config.night_class_start && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Moon className="h-3 w-3" /> Noturno:
                    </span>
                    <span className="font-medium">
                      {formatTime(config.night_class_start)} - {formatTime(config.night_class_end)}
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
            <School className="h-12 w-12 text-muted-foreground mb-4" />
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
              {editingConfig ? 'Editar Configuração' : 'Nova Configuração de Professor'}
            </DialogTitle>
            <DialogDescription>
              Configure parâmetros de hora aula conforme Portarias 1510 e 671 do MTE
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Configuração *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Professor Ensino Fundamental"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Contrato</Label>
                <Select
                  value={form.contract_type}
                  onValueChange={(v) => setForm({ ...form, contract_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Horista</SelectItem>
                    <SelectItem value="part_time">Tempo Parcial</SelectItem>
                    <SelectItem value="full_time">Tempo Integral</SelectItem>
                  </SelectContent>
                </Select>
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
                <CardTitle className="text-sm">Parâmetros de Hora Aula</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Duração (min)</Label>
                    <Input
                      type="number"
                      value={form.duration_minutes}
                      onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 50 })}
                    />
                  </div>
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
                    <Label>% Hora Atividade</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.activity_hours_percent}
                      onChange={(e) => setForm({ ...form, activity_hours_percent: parseFloat(e.target.value) || 33.33 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preparo (min/aula)</Label>
                    <Input
                      type="number"
                      value={form.preparation_minutes_per_class}
                      onChange={(e) => setForm({ ...form, preparation_minutes_per_class: parseInt(e.target.value) || 10 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. Consecutivas</Label>
                    <Input
                      type="number"
                      value={form.max_consecutive_classes}
                      onChange={(e) => setForm({ ...form, max_consecutive_classes: parseInt(e.target.value) || 4 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo Mínimo (min)</Label>
                    <Input
                      type="number"
                      value={form.min_interval_between_classes}
                      onChange={(e) => setForm({ ...form, min_interval_between_classes: parseInt(e.target.value) || 10 })}
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
                    Aulas Noturnas (Art. 73 CLT)
                  </CardTitle>
                  <Switch
                    checked={form.has_night_classes}
                    onCheckedChange={(checked) => setForm({ ...form, has_night_classes: checked })}
                  />
                </div>
              </CardHeader>
              {form.has_night_classes && (
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Início Noturno</Label>
                      <Input
                        type="time"
                        value={form.night_class_start}
                        onChange={(e) => setForm({ ...form, night_class_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim Noturno</Label>
                      <Input
                        type="time"
                        value={form.night_class_end}
                        onChange={(e) => setForm({ ...form, night_class_end: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Multiplicador</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.night_class_rate_multiplier}
                        onChange={(e) => setForm({ ...form, night_class_rate_multiplier: parseFloat(e.target.value) || 1.2 })}
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
