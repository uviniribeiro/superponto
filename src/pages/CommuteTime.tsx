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
import { Car, Plus, Edit, Trash2, Search, Clock, Users } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';

interface CommuteTimeConfig {
  id: string;
  description: string;
  entry_period_start: string;
  entry_period_end: string;
  exit_period_start: string;
  exit_period_end: string;
  is_active: boolean;
  company_id: string | null;
}

export default function CommuteTime() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<CommuteTimeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CommuteTimeConfig | null>(null);
  
  const [formData, setFormData] = useState({
    description: '',
    entry_period_start: '06:00',
    entry_period_end: '07:00',
    exit_period_start: '17:00',
    exit_period_end: '18:00',
    is_active: true,
  });

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('commute_time_configs')
        .select('*')
        .order('description');

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.description.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }

    try {
      const payload = {
        description: formData.description.trim(),
        entry_period_start: formData.entry_period_start,
        entry_period_end: formData.entry_period_end,
        exit_period_start: formData.exit_period_start,
        exit_period_end: formData.exit_period_end,
        is_active: formData.is_active,
        company_id: profile?.company_id,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('commute_time_configs')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
        toast.success('Configuração atualizada!');
      } else {
        const { error } = await supabase
          .from('commute_time_configs')
          .insert([payload]);
        if (error) throw error;
        toast.success('Configuração criada!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchRecords();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração?')) return;

    try {
      const { error } = await supabase.from('commute_time_configs').delete().eq('id', id);
      if (error) throw error;
      toast.success('Configuração excluída!');
      fetchRecords();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir. A configuração pode estar vinculada a funcionários.');
    }
  };

  const openEditDialog = (record: CommuteTimeConfig) => {
    setEditingRecord(record);
    setFormData({
      description: record.description,
      entry_period_start: record.entry_period_start,
      entry_period_end: record.entry_period_end,
      exit_period_start: record.exit_period_start,
      exit_period_end: record.exit_period_end,
      is_active: record.is_active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRecord(null);
    setFormData({
      description: '',
      entry_period_start: '06:00',
      entry_period_end: '07:00',
      exit_period_start: '17:00',
      exit_period_end: '18:00',
      is_active: true,
    });
  };

  const filteredRecords = records.filter(r =>
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Car className="h-8 w-8 text-primary" />
            Hora In Itinere
          </h1>
          <p className="text-muted-foreground">
            Configure o tempo de deslocamento computado na jornada (CLT Art. 58, §2º)
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Nova Configuração
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Configurações de In Itinere</CardTitle>
            <CardDescription>Defina os períodos de deslocamento que serão computados como tempo de trabalho</CardDescription>
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
          ) : filteredRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Entrada (Início-Fim)</TableHead>
                  <TableHead>Saída (Início-Fim)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.description}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {record.entry_period_start} - {record.entry_period_end}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {record.exit_period_start} - {record.exit_period_end}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.is_active ? 'default' : 'secondary'}>
                        {record.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(record)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
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
              <Car className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhuma configuração cadastrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar' : 'Nova'} Configuração In Itinere
            </DialogTitle>
            <DialogDescription>
              Defina os períodos de deslocamento que serão computados como tempo de trabalho
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Transporte Fábrica - Centro"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entrada: Início do Período</Label>
                <Input
                  type="time"
                  value={formData.entry_period_start}
                  onChange={(e) => setFormData({ ...formData, entry_period_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Entrada: Fim do Período</Label>
                <Input
                  type="time"
                  value={formData.entry_period_end}
                  onChange={(e) => setFormData({ ...formData, entry_period_end: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saída: Início do Período</Label>
                <Input
                  type="time"
                  value={formData.exit_period_start}
                  onChange={(e) => setFormData({ ...formData, exit_period_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Saída: Fim do Período</Label>
                <Input
                  type="time"
                  value={formData.exit_period_end}
                  onChange={(e) => setFormData({ ...formData, exit_period_end: e.target.value })}
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

      <HelpButton pageKey="commute-time" />
    </div>
  );
}
