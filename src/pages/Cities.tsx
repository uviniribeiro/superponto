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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { MapPin, Plus, Edit, Trash2, Search } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { PageHeader } from '@/components/shared/PageHeader';

interface City {
  id: string;
  abbreviation: string | null;
  description: string;
  state: string;
  is_active: boolean;
  company_id: string | null;
}

const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];

export default function Cities() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<City | null>(null);
  
  const [formData, setFormData] = useState({
    abbreviation: '',
    description: '',
    state: '',
    is_active: true,
  });

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cities')
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
    if (!formData.description.trim() || !formData.state) {
      toast.error('Descrição e Estado são obrigatórios');
      return;
    }

    try {
      const payload = {
        abbreviation: formData.abbreviation.trim() || null,
        description: formData.description.trim(),
        state: formData.state,
        is_active: formData.is_active,
        company_id: profile?.company_id,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('cities')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
        toast.success('Cidade atualizada!');
      } else {
        const { error } = await supabase
          .from('cities')
          .insert([payload]);
        if (error) throw error;
        toast.success('Cidade criada!');
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
    if (!confirm('Tem certeza que deseja excluir esta cidade?')) return;

    try {
      const { error } = await supabase.from('cities').delete().eq('id', id);
      if (error) throw error;
      toast.success('Cidade excluída!');
      fetchRecords();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir. A cidade pode estar vinculada a funcionários.');
    }
  };

  const openEditDialog = (record: City) => {
    setEditingRecord(record);
    setFormData({
      abbreviation: record.abbreviation || '',
      description: record.description,
      state: record.state,
      is_active: record.is_active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRecord(null);
    setFormData({
      abbreviation: '',
      description: '',
      state: '',
      is_active: true,
    });
  };

  const filteredRecords = records.filter(r =>
    r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Cidades"
          description="Gerencie o cadastro de cidades do sistema" icon={MapPin}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Nova Cidade
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cidades</CardTitle>
            <CardDescription>Cadastro de cidades para endereços</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cidade ou UF..."
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
                  <TableHead>Sigla</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.abbreviation || '-'}</TableCell>
                    <TableCell className="font-medium">{record.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.state}</Badge>
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
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhuma cidade cadastrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar' : 'Nova'} Cidade
            </DialogTitle>
            <DialogDescription>Preencha os dados da cidade</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sigla</Label>
              <Input
                value={formData.abbreviation}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value.toUpperCase() })}
                placeholder="Ex: SP, RJ"
                maxLength={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome da Cidade *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: São Paulo"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Estado (UF) *</Label>
              <Select
                value={formData.state}
                onValueChange={(v) => setFormData({ ...formData, state: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <HelpButton pageKey="cities" />
    </div>
  );
}
