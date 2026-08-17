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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Calendar, CalendarDays, Plus, Edit, Trash2, Search, Users } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';

interface FixedScale {
  id: string;
  code: string | null;
  description: string;
  start_date: string;
  end_date: string | null;
  calculate_dsr: boolean;
  consider_holiday: boolean;
  is_active: boolean;
}

interface WorkSchedule {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  full_name: string;
}

export default function Scales() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('fixed');
  const [fixedScales, setFixedScales] = useState<FixedScale[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<FixedScale | null>(null);
  const [isCycleDialogOpen, setIsCycleDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    start_date: '',
    end_date: '',
    calculate_dsr: false,
    consider_holiday: false,
    is_active: true,
  });

  const [cycleForm, setCycleForm] = useState({
    work_schedule_id: '',
    work_days: '5',
    off_days: '2',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [scalesRes, schedulesRes, employeesRes] = await Promise.all([
        supabase.from('fixed_scales').select('*').order('description'),
        supabase.from('work_schedules').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
      ]);

      if (scalesRes.error) throw scalesRes.error;
      setFixedScales(scalesRes.data || []);
      setSchedules(schedulesRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.description.trim() || formData.description.length < 3) {
      toast.error('Descrição deve ter pelo menos 3 caracteres');
      return;
    }
    if (!formData.start_date) {
      toast.error('Data de início é obrigatória');
      return;
    }

    try {
      const data = {
        code: formData.code.trim() || null,
        description: formData.description.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        calculate_dsr: formData.calculate_dsr,
        consider_holiday: formData.consider_holiday,
        is_active: formData.is_active,
        company_id: profile?.company_id,
      };

      if (editingScale) {
        const { error } = await supabase
          .from('fixed_scales')
          .update(data)
          .eq('id', editingScale.id);
        if (error) throw error;
        toast.success('Escala atualizada!');
      } else {
        const { error } = await supabase.from('fixed_scales').insert(data);
        if (error) throw error;
        toast.success('Escala criada!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      console.error('Error saving scale:', error);
      const code = error instanceof Error && 'code' in error ? (error as { code: string }).code : '';
      if (code === '23505') {
        toast.error('Já existe uma escala com essa descrição');
      } else {
        toast.error('Erro ao salvar escala');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta escala?')) return;

    try {
      const { error } = await supabase.from('fixed_scales').delete().eq('id', id);
      if (error) throw error;
      toast.success('Escala excluída!');
      fetchData();
    } catch (error) {
      console.error('Error deleting scale:', error);
      toast.error('Erro ao excluir. A escala pode estar vinculada a funcionários.');
    }
  };

  const openEditDialog = (scale: FixedScale) => {
    setEditingScale(scale);
    setFormData({
      code: scale.code || '',
      description: scale.description,
      start_date: scale.start_date,
      end_date: scale.end_date || '',
      calculate_dsr: scale.calculate_dsr,
      consider_holiday: scale.consider_holiday,
      is_active: scale.is_active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingScale(null);
    setFormData({
      code: '',
      description: '',
      start_date: '',
      end_date: '',
      calculate_dsr: false,
      consider_holiday: false,
      is_active: true,
    });
  };

  const filteredScales = fixedScales.filter(s =>
    s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Escalas de Trabalho"
          description="Gerencie escalas fixas e agendadas dos funcionários" icon={Calendar}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="fixed" className="gap-2">
            <Calendar className="h-4 w-4" />
            Escalas Fixas
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Escalas Agendadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Escalas Fixas</CardTitle>
                <CardDescription>Configure escalas com dias de trabalho e folga em ciclo</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Escala
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : filteredScales.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>DSR</TableHead>
                      <TableHead>Feriados</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredScales.map((scale) => (
                      <TableRow key={scale.id}>
                        <TableCell>{scale.code || '-'}</TableCell>
                        <TableCell className="font-medium">{scale.description}</TableCell>
                        <TableCell>
                          {format(new Date(scale.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {scale.end_date 
                            ? format(new Date(scale.end_date), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant={scale.calculate_dsr ? 'default' : 'outline'}>
                            {scale.calculate_dsr ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={scale.consider_holiday ? 'default' : 'outline'}>
                            {scale.consider_holiday ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={scale.is_active ? 'default' : 'secondary'}>
                            {scale.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(scale)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(scale.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma escala cadastrada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Escalas Agendadas</CardTitle>
              <CardDescription>Configure escalas individuais para cada funcionário por período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Use o Espelho Ponto para gerenciar escalas agendadas individualmente</p>
                <Button variant="outline" className="mt-4">
                  <Users className="h-4 w-4 mr-2" />
                  Ir para Espelho Ponto
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingScale ? 'Editar' : 'Nova'} Escala Fixa</DialogTitle>
            <DialogDescription>Configure os parâmetros da escala</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Código opcional"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: 12x36"
                  maxLength={30}
                />
              </div>
            </div>

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
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Calcular DSR</Label>
                <Switch
                  checked={formData.calculate_dsr}
                  onCheckedChange={(checked) => setFormData({ ...formData, calculate_dsr: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Considerar Feriados</Label>
                <Switch
                  checked={formData.consider_holiday}
                  onCheckedChange={(checked) => setFormData({ ...formData, consider_holiday: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="scales" />
    </div>
  );
}
