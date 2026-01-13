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
import { Percent, Plus, Edit, Trash2, Search, Moon } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';

interface OvertimePercentage {
  id: string;
  description: string | null;
  percentage_value: number;
  external_code: string | null;
  is_night: boolean;
  is_active: boolean;
}

export default function OvertimePercentages() {
  const { profile } = useAuth();
  const [percentages, setPercentages] = useState<OvertimePercentage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPercentage, setEditingPercentage] = useState<OvertimePercentage | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    percentage_value: '',
    external_code: '',
    is_night: false,
    is_active: true,
  });

  useEffect(() => {
    fetchPercentages();
  }, []);

  const fetchPercentages = async () => {
    try {
      const { data, error } = await supabase
        .from('overtime_percentages')
        .select('*')
        .order('percentage_value');

      if (error) throw error;
      setPercentages(data || []);
    } catch (error) {
      console.error('Error fetching percentages:', error);
      toast.error('Erro ao carregar percentuais');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const percentageValue = parseFloat(formData.percentage_value);
    if (isNaN(percentageValue) || percentageValue <= 0) {
      toast.error('Valor do percentual deve ser maior que zero');
      return;
    }

    try {
      const data = {
        description: formData.description.trim() || null,
        percentage_value: percentageValue,
        external_code: formData.external_code.trim() || null,
        is_night: formData.is_night,
        is_active: formData.is_active,
        company_id: profile?.company_id,
      };

      if (editingPercentage) {
        const { error } = await supabase
          .from('overtime_percentages')
          .update(data)
          .eq('id', editingPercentage.id);
        if (error) throw error;
        toast.success('Percentual atualizado!');
      } else {
        const { error } = await supabase.from('overtime_percentages').insert(data);
        if (error) throw error;
        toast.success('Percentual criado!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPercentages();
    } catch (error: unknown) {
      console.error('Error saving percentage:', error);
      const code = error instanceof Error && 'code' in error ? (error as { code: string }).code : '';
      if (code === '23505') {
        toast.error('Já existe um percentual com esse valor');
      } else {
        toast.error('Erro ao salvar percentual');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este percentual?')) return;

    try {
      const { error } = await supabase.from('overtime_percentages').delete().eq('id', id);
      if (error) throw error;
      toast.success('Percentual excluído!');
      fetchPercentages();
    } catch (error) {
      console.error('Error deleting percentage:', error);
      toast.error('Erro ao excluir. O percentual pode estar em uso.');
    }
  };

  const openEditDialog = (percentage: OvertimePercentage) => {
    setEditingPercentage(percentage);
    setFormData({
      description: percentage.description || '',
      percentage_value: percentage.percentage_value.toString(),
      external_code: percentage.external_code || '',
      is_night: percentage.is_night,
      is_active: percentage.is_active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPercentage(null);
    setFormData({
      description: '',
      percentage_value: '',
      external_code: '',
      is_night: false,
      is_active: true,
    });
  };

  const filteredPercentages = percentages.filter(p =>
    p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.percentage_value.toString().includes(searchTerm)
  );

  // Comum percentuais CLT
  const commonPercentages = [
    { value: 50, label: 'Hora Extra 50%', description: 'Dias úteis' },
    { value: 100, label: 'Hora Extra 100%', description: 'Domingos e feriados' },
    { value: 20, label: 'Adicional Noturno 20%', description: 'Trabalho noturno' },
  ];

  const addCommonPercentage = async (value: number, description: string, isNight: boolean) => {
    try {
      const { error } = await supabase.from('overtime_percentages').insert({
        description,
        percentage_value: value,
        is_night: isNight,
        is_active: true,
        company_id: profile?.company_id,
      });
      if (error) throw error;
      toast.success('Percentual adicionado!');
      fetchPercentages();
    } catch (error) {
      console.error('Error adding percentage:', error);
      toast.error('Erro ao adicionar percentual');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Percent className="h-8 w-8 text-primary" />
            Percentuais de Hora Extra
          </h1>
          <p className="text-muted-foreground">Configure os percentuais de acréscimo para horas extras</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Novo Percentual
        </Button>
      </div>

      {percentages.length === 0 && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Percentuais Padrão CLT</CardTitle>
            <CardDescription>Adicione rapidamente os percentuais mais comuns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {commonPercentages.map((item) => (
                <Card key={item.value} className="cursor-pointer hover:border-primary transition-colors">
                  <CardContent className="p-4 text-center" onClick={() => addCommonPercentage(item.value, item.label, item.value === 20)}>
                    <div className="text-3xl font-bold text-primary">{item.value}%</div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                    <Button variant="outline" size="sm" className="mt-2">
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista de Percentuais</CardTitle>
            <CardDescription>{percentages.length} percentuais cadastrados</CardDescription>
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
          ) : filteredPercentages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Percentual</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Código Externo</TableHead>
                  <TableHead>Noturno</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPercentages.map((percentage) => (
                  <TableRow key={percentage.id}>
                    <TableCell className="font-bold text-lg">
                      {percentage.percentage_value}%
                    </TableCell>
                    <TableCell>{percentage.description || '-'}</TableCell>
                    <TableCell>{percentage.external_code || '-'}</TableCell>
                    <TableCell>
                      {percentage.is_night ? (
                        <Badge className="gap-1">
                          <Moon className="h-3 w-3" />
                          Sim
                        </Badge>
                      ) : (
                        <Badge variant="outline">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={percentage.is_active ? 'default' : 'secondary'}>
                        {percentage.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(percentage)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(percentage.id)}>
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
              Nenhum percentual cadastrado
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPercentage ? 'Editar' : 'Novo'} Percentual</DialogTitle>
            <DialogDescription>Configure o percentual de hora extra</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor do Percentual *</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.percentage_value}
                  onChange={(e) => setFormData({ ...formData, percentage_value: e.target.value })}
                  placeholder="50"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Hora Extra 50%"
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <Label>Código Externo</Label>
              <Input
                value={formData.external_code}
                onChange={(e) => setFormData({ ...formData, external_code: e.target.value })}
                placeholder="Para integração com folha"
                maxLength={20}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Moon className="h-4 w-4" />
                Percentual Noturno
              </Label>
              <Switch
                checked={formData.is_night}
                onCheckedChange={(checked) => setFormData({ ...formData, is_night: checked })}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="overtimepercentages" />
    </div>
  );
}
