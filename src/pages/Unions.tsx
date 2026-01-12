import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Users2, Plus, Edit, Trash2, Search, Building2 } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { validateCNPJ } from '@/lib/validators';

interface Union {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  description: string | null;
  cnpj: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  entity_type: string;
  union_type: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  is_active: boolean;
}

export default function Unions() {
  const { profile } = useAuth();
  const [unions, setUnions] = useState<Union[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnion, setEditingUnion] = useState<Union | null>(null);
  const [activeTab, setActiveTab] = useState('dados');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    abbreviation: '',
    description: '',
    cnpj: '',
    email: '',
    phone: '',
    website: '',
    entity_type: 'sindicato',
    union_type: 'empregados',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    is_active: true,
  });

  useEffect(() => {
    fetchUnions();
  }, []);

  const fetchUnions = async () => {
    try {
      const { data, error } = await supabase
        .from('unions')
        .select('*')
        .order('name');

      if (error) throw error;
      setUnions(data || []);
    } catch (error) {
      console.error('Error fetching unions:', error);
      toast.error('Erro ao carregar sindicatos');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.code.trim() || formData.code.length < 3) {
      toast.error('Código deve ter pelo menos 3 caracteres');
      return;
    }
    if (!formData.name.trim() || formData.name.length < 3) {
      toast.error('Nome deve ter pelo menos 3 caracteres');
      return;
    }
    if (!formData.abbreviation.trim() || formData.abbreviation.length < 3) {
      toast.error('Sigla deve ter pelo menos 3 caracteres');
      return;
    }
    if (!validateCNPJ(formData.cnpj)) {
      toast.error('CNPJ inválido');
      return;
    }

    try {
      const data = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        abbreviation: formData.abbreviation.trim(),
        description: formData.description.trim() || null,
        cnpj: formData.cnpj.replace(/\D/g, ''),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        entity_type: formData.entity_type,
        union_type: formData.union_type,
        street: formData.street.trim() || null,
        number: formData.number.trim() || null,
        complement: formData.complement.trim() || null,
        neighborhood: formData.neighborhood.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state || null,
        zip_code: formData.zip_code.trim() || null,
        is_active: formData.is_active,
        company_id: profile?.company_id,
      };

      if (editingUnion) {
        const { error } = await supabase
          .from('unions')
          .update(data)
          .eq('id', editingUnion.id);
        if (error) throw error;
        toast.success('Sindicato atualizado!');
      } else {
        const { error } = await supabase.from('unions').insert(data);
        if (error) throw error;
        toast.success('Sindicato criado!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchUnions();
    } catch (error: unknown) {
      console.error('Error saving union:', error);
      const code = error instanceof Error && 'code' in error ? (error as { code: string }).code : '';
      if (code === '23505') {
        toast.error('Já existe um sindicato com esses dados');
      } else {
        toast.error('Erro ao salvar sindicato');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este sindicato?')) return;

    try {
      const { error } = await supabase.from('unions').delete().eq('id', id);
      if (error) throw error;
      toast.success('Sindicato excluído!');
      fetchUnions();
    } catch (error) {
      console.error('Error deleting union:', error);
      toast.error('Erro ao excluir sindicato');
    }
  };

  const openEditDialog = (union: Union) => {
    setEditingUnion(union);
    setFormData({
      code: union.code,
      name: union.name,
      abbreviation: union.abbreviation,
      description: union.description || '',
      cnpj: union.cnpj,
      email: union.email || '',
      phone: union.phone || '',
      website: union.website || '',
      entity_type: union.entity_type,
      union_type: union.union_type,
      street: union.street || '',
      number: union.number || '',
      complement: union.complement || '',
      neighborhood: union.neighborhood || '',
      city: union.city || '',
      state: union.state || '',
      zip_code: union.zip_code || '',
      is_active: union.is_active,
    });
    setActiveTab('dados');
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingUnion(null);
    setFormData({
      code: '',
      name: '',
      abbreviation: '',
      description: '',
      cnpj: '',
      email: '',
      phone: '',
      website: '',
      entity_type: 'sindicato',
      union_type: 'empregados',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zip_code: '',
      is_active: true,
    });
    setActiveTab('dados');
  };

  const filteredUnions = unions.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.abbreviation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const states = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 
    'SP', 'SE', 'TO'
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users2 className="h-8 w-8 text-primary" />
            Sindicatos
          </h1>
          <p className="text-muted-foreground">Gerencie os sindicatos vinculados à empresa</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Novo Sindicato
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista de Sindicatos</CardTitle>
            <CardDescription>{unions.length} sindicatos cadastrados</CardDescription>
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
          ) : filteredUnions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Sigla</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnions.map((union) => (
                  <TableRow key={union.id}>
                    <TableCell>{union.code}</TableCell>
                    <TableCell className="font-medium">{union.name}</TableCell>
                    <TableCell>{union.abbreviation}</TableCell>
                    <TableCell>{union.cnpj}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{union.entity_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={union.is_active ? 'default' : 'secondary'}>
                        {union.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(union)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(union.id)}>
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
              Nenhum sindicato cadastrado
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUnion ? 'Editar' : 'Novo'} Sindicato</DialogTitle>
            <DialogDescription>Preencha os dados do sindicato</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">Dados do Sindicato</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Código único"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sigla *</Label>
                  <Input
                    value={formData.abbreviation}
                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                    placeholder="Sigla do sindicato"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo do sindicato"
                  maxLength={150}
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ *</Label>
                  <Input
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 0000-0000"
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@sindicato.com"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="www.sindicato.com.br"
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Entidade</Label>
                  <Select
                    value={formData.entity_type}
                    onValueChange={(v) => setFormData({ ...formData, entity_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sindicato">Sindicato</SelectItem>
                      <SelectItem value="federacao">Federação</SelectItem>
                      <SelectItem value="confederacao">Confederação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Sindicato</Label>
                  <Select
                    value={formData.union_type}
                    onValueChange={(v) => setFormData({ ...formData, union_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empregados">Sindicato para Empregados</SelectItem>
                      <SelectItem value="patronal">Sindicato Patronal</SelectItem>
                      <SelectItem value="profissionais_liberais">Profissionais Liberais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </TabsContent>

            <TabsContent value="endereco" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Rua</Label>
                  <Input
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    placeholder="Nome da rua"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="123"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input
                    value={formData.complement}
                    onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                    placeholder="Apto, Sala, etc."
                    maxLength={30}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    placeholder="Nome do bairro"
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Nome da cidade"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(v) => setFormData({ ...formData, state: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  placeholder="00000-000"
                  maxLength={10}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton 
        title="Sindicatos"
        description="Cadastre e gerencie os sindicatos vinculados aos funcionários da empresa."
      />
    </div>
  );
}
