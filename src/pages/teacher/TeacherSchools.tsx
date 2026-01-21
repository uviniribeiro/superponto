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
  School, 
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

interface SchoolData {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  inep_code: string | null;
  school_type: string | null;
  is_active: boolean;
}

const schoolTypes = [
  'EMEI - Escola Municipal de Educação Infantil',
  'EMEF - Escola Municipal de Ensino Fundamental',
  'CMEI - Centro Municipal de Educação Infantil',
  'CEMEI - Centro Municipal de Educação Infantil',
  'EM - Escola Municipal',
  'EE - Escola Estadual',
  'Creche Municipal',
  'Outra',
];

export default function TeacherSchools() {
  useSEO({
    title: 'Escolas | Módulo Professor',
    description: 'Gestão de escolas do município.',
  });

  const { profile } = useAuth();
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolData | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    inep_code: '',
    school_type: '',
    is_active: true
  });

  useEffect(() => {
    fetchSchools();
  }, [profile?.company_id]);

  const fetchSchools = async () => {
    if (!profile?.company_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name');

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error('Error fetching schools:', error);
      toast.error('Erro ao carregar escolas');
    } finally {
      setLoading(false);
    }
  };

  const syncSchools = async () => {
    if (!profile?.company_id) return;
    
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-municipal-data', {
        body: { 
          company_id: profile.company_id, 
          type: 'schools' 
        }
      });

      if (error) throw error;
      
      toast.success(`${data.count || 0} escolas sincronizadas`);
      fetchSchools();
    } catch (error: any) {
      console.error('Error syncing schools:', error);
      toast.error('Erro ao sincronizar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const data = {
        company_id: profile?.company_id,
        name: formData.name,
        code: formData.code || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        phone: formData.phone || null,
        email: formData.email || null,
        inep_code: formData.inep_code || null,
        school_type: formData.school_type || null,
        is_active: formData.is_active
      };

      if (editingSchool) {
        const { error } = await supabase
          .from('schools')
          .update(data)
          .eq('id', editingSchool.id);
        if (error) throw error;
        toast.success('Escola atualizada');
      } else {
        const { error } = await supabase
          .from('schools')
          .insert(data);
        if (error) throw error;
        toast.success('Escola cadastrada');
      }

      setIsDialogOpen(false);
      setEditingSchool(null);
      resetForm();
      fetchSchools();
    } catch (error: any) {
      console.error('Error saving school:', error);
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleEdit = (school: SchoolData) => {
    setEditingSchool(school);
    setFormData({
      name: school.name,
      code: school.code || '',
      address: school.address || '',
      city: school.city || '',
      state: school.state || '',
      phone: school.phone || '',
      email: school.email || '',
      inep_code: school.inep_code || '',
      school_type: school.school_type || '',
      is_active: school.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta escola?')) return;

    try {
      const { error } = await supabase.from('schools').delete().eq('id', id);
      if (error) throw error;
      toast.success('Escola excluída');
      fetchSchools();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      phone: '',
      email: '',
      inep_code: '',
      school_type: '',
      is_active: true
    });
  };

  const filteredSchools = schools.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.school_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <School className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Escolas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as escolas do município
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={syncSchools} disabled={syncing} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            Sincronizar do Município
          </Button>
          
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Escola
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Escolas</p>
            <p className="text-2xl font-bold">{schools.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ativas</p>
            <p className="text-2xl font-bold text-green-600">
              {schools.filter(s => s.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">EMEIs</p>
            <p className="text-2xl font-bold">
              {schools.filter(s => s.school_type?.includes('EMEI')).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">EMEFs</p>
            <p className="text-2xl font-bold">
              {schools.filter(s => s.school_type?.includes('EMEF')).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle>Lista de Escolas</CardTitle>
              <CardDescription>Escolas cadastradas no sistema</CardDescription>
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
          ) : filteredSchools.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Código INEP</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{school.school_type || '-'}</Badge>
                    </TableCell>
                    <TableCell>{school.inep_code || '-'}</TableCell>
                    <TableCell>{school.city || '-'}</TableCell>
                    <TableCell>
                      <Badge className={school.is_active ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}>
                        {school.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(school)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(school.id)}>
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
              <School className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma escola cadastrada</p>
              <div className="flex justify-center gap-3 mt-4">
                <Button variant="outline" onClick={syncSchools}>
                  Sincronizar do Município
                </Button>
                <Button onClick={() => setIsDialogOpen(true)}>
                  Cadastrar Escola
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
            <DialogTitle>{editingSchool ? 'Editar Escola' : 'Nova Escola'}</DialogTitle>
            <DialogDescription>
              {editingSchool ? 'Atualize os dados da escola' : 'Cadastre uma nova escola'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da escola"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Escola</Label>
                <Select value={formData.school_type} onValueChange={(v) => setFormData({ ...formData, school_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código INEP</Label>
                <Input
                  value={formData.inep_code}
                  onChange={(e) => setFormData({ ...formData, inep_code: e.target.value })}
                  placeholder="Código do INEP"
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
                  placeholder="email@escola.com"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>Escola ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingSchool ? 'Salvar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
