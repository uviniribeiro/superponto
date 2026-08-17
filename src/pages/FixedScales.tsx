import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Calendar, Plus, Edit, Trash2, Search, RotateCcw } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import useSEO from '@/hooks/useSEO';

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

export default function FixedScales() {
  useSEO({
    title: 'Escalas Fixas | Ponto Max',
    description: 'Gerencie escalas fixas com ciclos de trabalho e folga.',
  });

  const { profile } = useAuth();
  const [fixedScales, setFixedScales] = useState<FixedScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<FixedScale | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    start_date: '',
    end_date: '',
    calculate_dsr: false,
    consider_holiday: false,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('fixed_scales')
        .select('*')
        .order('description');

      if (error) throw error;
      setFixedScales(data || []);
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
      <div className="mb-0 flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <PageHeader
          title="Escalas Fixas"
          description="Configure escalas cíclicas de trabalho e folga (12x36, 5x1, 6x1, etc.)"
          icon={RotateCcw}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Escala Fixa
        </Button>
      </div>


      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {fixedScales.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ativas</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {fixedScales.filter(s => s.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Com DSR</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {fixedScales.filter(s => s.calculate_dsr).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Com Feriados</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {fixedScales.filter(s => s.consider_holiday).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Escalas Cadastradas</CardTitle>
            <CardDescription>Escalas com ciclos fixos de trabalho e folga</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredScales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-center">DSR</TableHead>
                  <TableHead className="text-center">Feriados</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScales.map((scale) => (
                  <TableRow key={scale.id}>
                    <TableCell className="font-mono">{scale.code || '-'}</TableCell>
                    <TableCell className="font-medium">{scale.description}</TableCell>
                    <TableCell>
                      {format(new Date(scale.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {scale.end_date 
                        ? format(new Date(scale.end_date), 'dd/MM/yyyy', { locale: ptBR })
                        : <Badge variant="outline" className="text-green-600">Vigente</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={scale.calculate_dsr ? 'default' : 'secondary'}>
                        {scale.calculate_dsr ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={scale.consider_holiday ? 'default' : 'secondary'}>
                        {scale.consider_holiday ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={scale.is_active ? 'default' : 'secondary'}
                        className={scale.is_active ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                      >
                        {scale.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(scale)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(scale.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma escala fixa cadastrada</p>
              <p className="text-sm mt-1">Clique em "Nova Escala Fixa" para começar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingScale ? 'Editar' : 'Nova'} Escala Fixa</DialogTitle>
            <DialogDescription>Configure os parâmetros da escala cíclica</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ex: 12X36"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Escala 12x36"
                  maxLength={50}
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

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Calcular DSR</Label>
                  <p className="text-xs text-muted-foreground">Descanso Semanal Remunerado</p>
                </div>
                <Switch
                  checked={formData.calculate_dsr}
                  onCheckedChange={(checked) => setFormData({ ...formData, calculate_dsr: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Considerar Feriados</Label>
                  <p className="text-xs text-muted-foreground">Aplicar regras de feriado</p>
                </div>
                <Switch
                  checked={formData.consider_holiday}
                  onCheckedChange={(checked) => setFormData({ ...formData, consider_holiday: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Ativo</Label>
                  <p className="text-xs text-muted-foreground">Escala disponível para uso</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="fixed-scales" />
    </div>
  );
}
