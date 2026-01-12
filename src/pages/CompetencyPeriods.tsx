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
import { CalendarRange, Plus, Edit, Trash2, Search } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CompetencyPeriod {
  id: string;
  description: string;
  reference_month_year: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export default function CompetencyPeriods() {
  const { profile } = useAuth();
  const [periods, setPeriods] = useState<CompetencyPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<CompetencyPeriod | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    reference_month_year: '',
    start_date: '',
    end_date: '',
    is_active: true,
  });

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('competency_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
    } catch (error) {
      console.error('Error fetching periods:', error);
      toast.error('Erro ao carregar competências');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.description.trim() || formData.description.length < 3) {
      toast.error('Descrição deve ter pelo menos 3 caracteres');
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error('As datas de início e fim são obrigatórias');
      return;
    }
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast.error('Data final não pode ser anterior à data inicial');
      return;
    }

    try {
      const data = {
        description: formData.description.trim(),
        reference_month_year: formData.reference_month_year || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        is_active: formData.is_active,
        company_id: profile?.company_id,
      };

      if (editingPeriod) {
        const { error } = await supabase
          .from('competency_periods')
          .update(data)
          .eq('id', editingPeriod.id);
        if (error) throw error;
        toast.success('Competência atualizada!');
      } else {
        const { error } = await supabase.from('competency_periods').insert(data);
        if (error) throw error;
        toast.success('Competência criada!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPeriods();
    } catch (error: unknown) {
      console.error('Error saving period:', error);
      const code = error instanceof Error && 'code' in error ? (error as { code: string }).code : '';
      if (code === '23505') {
        toast.error('Já existe uma competência com essa descrição');
      } else {
        toast.error('Erro ao salvar competência');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta competência?')) return;

    try {
      const { error } = await supabase.from('competency_periods').delete().eq('id', id);
      if (error) throw error;
      toast.success('Competência excluída!');
      fetchPeriods();
    } catch (error) {
      console.error('Error deleting period:', error);
      toast.error('Erro ao excluir competência');
    }
  };

  const openEditDialog = (period: CompetencyPeriod) => {
    setEditingPeriod(period);
    setFormData({
      description: period.description,
      reference_month_year: period.reference_month_year || '',
      start_date: period.start_date,
      end_date: period.end_date,
      is_active: period.is_active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPeriod(null);
    setFormData({
      description: '',
      reference_month_year: '',
      start_date: '',
      end_date: '',
      is_active: true,
    });
  };

  const filteredPeriods = periods.filter(p =>
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Gerar competências do ano atual
  const generateYearCompetencies = async () => {
    const year = new Date().getFullYear();
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    try {
      const competencies = months.map((month, index) => {
        const monthNum = index + 1;
        const startDate = new Date(year, index, 1);
        const endDate = new Date(year, index + 1, 0);
        
        return {
          description: `${month} ${year}`,
          reference_month_year: `${year}-${String(monthNum).padStart(2, '0')}-01`,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          is_active: true,
          company_id: profile?.company_id,
        };
      });

      const { error } = await supabase.from('competency_periods').insert(competencies);
      if (error) throw error;
      
      toast.success('Competências do ano geradas com sucesso!');
      fetchPeriods();
    } catch (error) {
      console.error('Error generating competencies:', error);
      toast.error('Erro ao gerar competências');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarRange className="h-8 w-8 text-primary" />
            Competências
          </h1>
          <p className="text-muted-foreground">Gerencie os períodos de competência para cálculos e relatórios</p>
        </div>
        <div className="flex gap-2">
          {periods.length === 0 && (
            <Button variant="outline" onClick={generateYearCompetencies}>
              <CalendarRange className="h-4 w-4 mr-2" />
              Gerar Ano Atual
            </Button>
          )}
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Nova Competência
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista de Competências</CardTitle>
            <CardDescription>{periods.length} competências cadastradas</CardDescription>
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
            <div className="text-center py-8">Carregando...</div>
          ) : filteredPeriods.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Mês/Ano Ref.</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeriods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{period.description}</TableCell>
                    <TableCell>
                      {period.reference_month_year 
                        ? format(new Date(period.reference_month_year), 'MM/yyyy', { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {format(new Date(period.start_date), 'dd/MM/yyyy', { locale: ptBR })} - {format(new Date(period.end_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {differenceInDays(new Date(period.end_date), new Date(period.start_date)) + 1} dias
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={period.is_active ? 'default' : 'secondary'}>
                        {period.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(period)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(period.id)}>
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
              <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma competência cadastrada</p>
              <Button variant="outline" className="mt-4" onClick={generateYearCompetencies}>
                Gerar Competências do Ano
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPeriod ? 'Editar' : 'Nova'} Competência</DialogTitle>
            <DialogDescription>Configure o período de competência</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Janeiro 2024"
                maxLength={60}
              />
            </div>

            <div className="space-y-2">
              <Label>Mês/Ano Referência</Label>
              <Input
                type="month"
                value={formData.reference_month_year ? formData.reference_month_year.substring(0, 7) : ''}
                onChange={(e) => setFormData({ ...formData, reference_month_year: e.target.value ? `${e.target.value}-01` : '' })}
              />
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
                <Label>Data de Fim *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton 
        title="Competências"
        description="Competências são períodos utilizados como filtro no espelho ponto, meu espelho ponto e relatórios."
      />
    </div>
  );
}
