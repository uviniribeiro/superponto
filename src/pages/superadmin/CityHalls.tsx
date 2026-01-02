import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Landmark, Plus, Search, Key, CheckCircle, XCircle, RefreshCw, ChevronDown, Trash2, GraduationCap, Heart, Palette, Bus, Settings2, Building2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  company_code: string;
  is_active: boolean;
  license_status: string | null;
  created_at: string;
  organization_type: 'company' | 'city_hall';
  sector: string | null;
  parent_organization_id: string | null;
}

const sectorOptions = [
  { value: 'education', label: 'Educação', icon: GraduationCap },
  { value: 'health', label: 'Saúde', icon: Heart },
  { value: 'culture', label: 'Cultura', icon: Palette },
  { value: 'transport', label: 'Transportes', icon: Bus },
  { value: 'administration', label: 'Administração', icon: Settings2 },
  { value: 'finance', label: 'Finanças', icon: Building2 },
  { value: 'environment', label: 'Meio Ambiente', icon: Landmark },
  { value: 'social_assistance', label: 'Assistência Social', icon: Users },
  { value: 'urban_planning', label: 'Planejamento Urbano', icon: Building2 },
  { value: 'other', label: 'Outros', icon: Settings2 },
];

const cityHallSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  cnpj: z.string().min(14, 'CNPJ inválido').max(18),
});

export default function SuperAdminCityHalls() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', cnpj: '' });
  
  const [isSectorDialogOpen, setIsSectorDialogOpen] = useState(false);
  const [selectedCityHall, setSelectedCityHall] = useState<Company | null>(null);
  const [sectorFormData, setSectorFormData] = useState({ name: '', sector: 'education' });
  const [expandedCityHalls, setExpandedCityHalls] = useState<string[]>([]);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies((data || []) as Company[]);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Erro ao carregar prefeituras');
    } finally {
      setLoading(false);
    }
  };

  const cityHalls = companies.filter(c => c.organization_type === 'city_hall' && !c.parent_organization_id);
  const getSectors = (cityHallId: string) => companies.filter(c => c.parent_organization_id === cityHallId);

  const handleCreateCityHall = async () => {
    try {
      const validData = cityHallSchema.parse(formData);
      const normalizedCnpj = formData.cnpj.replace(/[^\d]/g, '');
      
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('company_code', normalizedCnpj)
        .maybeSingle();
      
      if (existingCompany) {
        toast.error('CNPJ já cadastrado no sistema');
        return;
      }

      const { error } = await supabase
        .from('companies')
        .insert({
          name: validData.name,
          cnpj: formData.cnpj,
          company_code: normalizedCnpj,
          organization_type: 'city_hall',
          license_status: 'pending'
        });

      if (error) throw error;

      toast.success('Prefeitura cadastrada com sucesso!');
      setIsDialogOpen(false);
      setFormData({ name: '', cnpj: '' });
      fetchCompanies();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error creating city hall:', error);
        toast.error('Erro ao cadastrar prefeitura');
      }
    }
  };

  const handleCreateSector = async () => {
    if (!selectedCityHall) return;

    try {
      const sectorCode = `${selectedCityHall.company_code}-${sectorFormData.sector.toUpperCase().slice(0, 3)}`;
      
      const { data: existingSector } = await supabase
        .from('companies')
        .select('id')
        .eq('company_code', sectorCode)
        .maybeSingle();
      
      if (existingSector) {
        toast.error('Este setor já existe para esta prefeitura');
        return;
      }

      const { error } = await supabase
        .from('companies')
        .insert({
          name: sectorFormData.name,
          cnpj: selectedCityHall.cnpj,
          company_code: sectorCode,
          organization_type: 'city_hall',
          sector: sectorFormData.sector,
          parent_organization_id: selectedCityHall.id,
          license_status: selectedCityHall.license_status
        } as any);

      if (error) throw error;

      toast.success('Setor criado com sucesso!');
      setIsSectorDialogOpen(false);
      setSectorFormData({ name: '', sector: 'education' });
      setSelectedCityHall(null);
      fetchCompanies();
    } catch (error) {
      console.error('Error creating sector:', error);
      toast.error('Erro ao criar setor');
    }
  };

  const handleDeleteSector = async (sectorId: string) => {
    if (!confirm('Tem certeza que deseja excluir este setor?')) return;

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', sectorId);

      if (error) throw error;
      toast.success('Setor excluído com sucesso');
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting sector:', error);
      toast.error('Erro ao excluir setor');
    }
  };

  const toggleCityHallStatus = async (cityHall: Company) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: !cityHall.is_active })
        .eq('id', cityHall.id);

      if (error) throw error;
      
      // Toggle all sectors too
      await supabase
        .from('companies')
        .update({ is_active: !cityHall.is_active })
        .eq('parent_organization_id', cityHall.id);

      toast.success(cityHall.is_active ? 'Prefeitura desativada' : 'Prefeitura ativada');
      fetchCompanies();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedCityHalls(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getSectorLabel = (sector: string) => {
    const sectorInfo = sectorOptions.find(s => s.value === sector);
    return sectorInfo?.label || sector;
  };

  const filteredCityHalls = cityHalls.filter(ch =>
    ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.cnpj?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Landmark className="h-8 w-8 text-primary" />
            Prefeituras
          </h1>
          <p className="text-muted-foreground">Gerencie as prefeituras e seus setores</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Prefeituras Cadastradas</CardTitle>
              <CardDescription>{cityHalls.length} prefeituras no sistema</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar prefeitura..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setIsDialogOpen(true)} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Nova Prefeitura
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse-soft">Carregando...</div>
            </div>
          ) : filteredCityHalls.length > 0 ? (
            <div className="space-y-2">
              {filteredCityHalls.map((cityHall) => {
                const sectors = getSectors(cityHall.id);
                const isExpanded = expandedCityHalls.includes(cityHall.id);
                
                return (
                  <Collapsible key={cityHall.id} open={isExpanded} onOpenChange={() => toggleExpanded(cityHall.id)}>
                    <div className="border rounded-lg">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </Button>
                          </CollapsibleTrigger>
                          <div>
                            <p className="font-medium">{cityHall.name}</p>
                            <p className="text-sm text-muted-foreground">{cityHall.cnpj} • {sectors.length} setores</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={cityHall.is_active ? 'default' : 'secondary'}>
                            {cityHall.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                          <Badge variant={cityHall.license_status === 'active' ? 'default' : cityHall.license_status === 'expired' ? 'destructive' : 'secondary'}>
                            {cityHall.license_status === 'active' ? 'Licenciada' : cityHall.license_status === 'expired' ? 'Expirada' : 'Pendente'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCityHall(cityHall);
                              setSectorFormData({ name: '', sector: 'education' });
                              setIsSectorDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Setor
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/super-admin/licenses?company=${cityHall.id}`)}
                          >
                            <Key className="h-4 w-4 mr-1" />
                            Licença
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCityHallStatus(cityHall)}
                          >
                            {cityHall.is_active ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                          </Button>
                        </div>
                      </div>
                      <CollapsibleContent>
                        {sectors.length > 0 ? (
                          <div className="border-t px-4 py-2 bg-muted/50">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Setor</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Código</TableHead>
                                  <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sectors.map((sector) => (
                                  <TableRow key={sector.id}>
                                    <TableCell className="font-medium">{sector.name}</TableCell>
                                    <TableCell>{getSectorLabel(sector.sector || '')}</TableCell>
                                    <TableCell className="font-mono text-sm">{sector.company_code}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteSector(sector.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="border-t px-4 py-4 text-center text-muted-foreground bg-muted/50">
                            Nenhum setor cadastrado
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma prefeitura encontrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create City Hall Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Prefeitura</DialogTitle>
            <DialogDescription>Cadastre uma nova prefeitura no sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Prefeitura</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Prefeitura Municipal de..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCityHall} className="gradient-primary">Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Sector Dialog */}
      <Dialog open={isSectorDialogOpen} onOpenChange={setIsSectorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Setor</DialogTitle>
            <DialogDescription>
              Adicionar setor para: {selectedCityHall?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sector-type">Tipo de Setor</Label>
              <Select 
                value={sectorFormData.sector} 
                onValueChange={(value) => setSectorFormData({ ...sectorFormData, sector: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sectorOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector-name">Nome do Setor</Label>
              <Input
                id="sector-name"
                value={sectorFormData.name}
                onChange={(e) => setSectorFormData({ ...sectorFormData, name: e.target.value })}
                placeholder="Secretaria de..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSectorDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSector} className="gradient-primary">Criar Setor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
