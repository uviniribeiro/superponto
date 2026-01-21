import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Hospital, 
  Plus, 
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';
import { useAuth } from '@/contexts/AuthContext';

interface HealthUnit {
  id: string;
  name: string;
  code: string | null;
  cnes_code: string | null;
  unit_type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

const unitTypes = [
  'UBS - Unidade Básica de Saúde',
  'UPA - Unidade de Pronto Atendimento',
  'Hospital Municipal',
  'Hospital Regional',
  'CAPS - Centro de Atenção Psicossocial',
  'CEO - Centro de Especialidades Odontológicas',
  'SAMU',
  'Ambulatório Municipal',
  'ESF - Estratégia Saúde da Família',
  'Outro',
];

export default function DoctorHealthUnits() {
  useSEO({
    title: 'Unidades de Saúde | Módulo Médico',
    description: 'Gestão de unidades de saúde do município.',
  });

  const { profile } = useAuth();
  const [units, setUnits] = useState<HealthUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<HealthUnit | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    cnes_code: '',
    unit_type: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    is_active: true
  });

  useEffect(() => {
    fetchUnits();
  }, [profile?.company_id]);

  const fetchUnits = async () => {
    if (!profile?.company_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('health_units')
        .select('*')
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching health units:', error);
      toast.error('Erro ao carregar unidades de saúde');
    } finally {
      setLoading(false);
    }
  };

  const syncUnits = async () => {
    if (!profile?.company_id) return;
    
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-municipal-data', {
        body: { 
          company_id: profile.company_id, 
          type: 'health_units' 
        }
      });

      if (error) throw error;
      
      toast.success(`${data.count || 0} unidades sincronizadas`);
      fetchUnits();
    } catch (error: any) {
      console.error('Error syncing health units:', error);
      toast.error('Erro ao sincronizar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.unit_type) {
      toast.error('Nome e tipo são obrigatórios');
      return;
    }

    try {
      const data = {
        company_id: profile?.company_id,
        name: formData.name,
        code: formData.code || null,
        cnes_code: formData.cnes_code || null,
        unit_type: formData.unit_type,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        phone: formData.phone || null,
        email: formData.email || null,
        is_active: formData.is_active
      };

      if (editingUnit) {
        const { error } = await supabase
          .from('health_units')
          .update(data)
          .eq('id', editingUnit.id);
        if (error) throw error;
        toast.success('Unidade atualizada');
      } else {
        const { error } = await supabase
          .from('health_units')
          .insert(data);
        if (error) throw error;
        toast.success('Unidade cadastrada');
      }

      setIsDialogOpen(false);
      setEditingUnit(null);
      resetForm();
      fetchUnits();
    } catch (error: any) {
      console.error('Error saving health unit:', error);
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleEdit = (unit: HealthUnit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      code: unit.code || '',
      cnes_code: unit.cnes_code || '',
      unit_type: unit.unit_type,
      address: unit.address || '',
      city: unit.city || '',
      state: unit.state || '',
      phone: unit.phone || '',
      email: unit.email || '',
      is_active: unit.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta unidade?')) return;

    try {
      const { error } = await supabase.from('health_units').delete().eq('id', id);
      if (error) throw error;
      toast.success('Unidade excluída');
      fetchUnits();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      cnes_code: '',
      unit_type: '',
      address: '',
      city: '',
      state: '',
      phone: '',
      email: '',
      is_active: true
    });
  };

  const filteredUnits = units.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.unit_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUnitCount = (type: string) => units.filter(u => u.unit_type?.includes(type)).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Hospital className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Unidades de Saúde
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as unidades de saúde do município
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={syncUnits} disabled={syncing} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            Sincronizar do Município
          </Button>
          
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Unidade
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{units.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">UBS</p>
            <p className="text-2xl font-bold text-blue-600">{getUnitCount('UBS')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">UPA</p>
            <p className="text-2xl font-bold text-orange-600">{getUnitCount('UPA')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Hospitais</p>
            <p className="text-2xl font-bold text-red-600">{getUnitCount('Hospital')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">ESF</p>
            <p className="text-2xl font-bold text-green-600">{getUnitCount('ESF')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle>Lista de Unidades</CardTitle>
              <CardDescription>Unidades de saúde cadastradas</CardDescription>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredUnits.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CNES</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{unit.unit_type}</Badge>
                    </TableCell>
                    <TableCell>{unit.cnes_code || '-'}</TableCell>
                    <TableCell>{unit.city || '-'}</TableCell>
                    <TableCell>
                      <Badge className={unit.is_active ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}>
                        {unit.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(unit)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(unit.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Hospital className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma unidade de saúde cadastrada</p>
              <div className="flex justify-center gap-3 mt-4">
                <Button variant="outline" onClick={syncUnits}>
                  Sincronizar do Município
                </Button>
                <Button onClick={() => setIsDialogOpen(true)}>
                  Cadastrar Unidade
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Editar Unidade' : 'Nova Unidade de Saúde'}</DialogTitle>
            <DialogDescription>
              {editingUnit ? 'Atualize os dados da unidade' : 'Cadastre uma nova unidade de saúde'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da unidade"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={formData.unit_type} onValueChange={(v) => setFormData({ ...formData, unit_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código CNES</Label>
                <Input
                  value={formData.cnes_code}
                  onChange={(e) => setFormData({ ...formData, cnes_code: e.target.value })}
                  placeholder="Código CNES"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Código interno"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@unidade.com"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>Unidade ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingUnit ? 'Salvar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
