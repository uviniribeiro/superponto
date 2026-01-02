import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Landmark, Plus, Search, Key, CheckCircle, XCircle, RefreshCw, ChevronDown, Trash2, GraduationCap, Heart, Palette, Bus, Settings2, Building2, Users, Calendar } from 'lucide-react';
import { format, addMonths } from 'date-fns';
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
  address: string | null;
  city: string | null;
  state: string | null;
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

const contractDurationOptions = [
  { value: 1, label: '1 mês' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '1 ano' },
  { value: 24, label: '2 anos' },
  { value: 36, label: '3 anos' },
  { value: 48, label: '4 anos' },
  { value: 60, label: '5 anos' },
  { value: 1200, label: 'Vitalício' },
];

const employeeLimits = [
  { value: 50, label: '50 funcionários' },
  { value: 100, label: '100 funcionários' },
  { value: 200, label: '200 funcionários' },
  { value: 300, label: '300 funcionários' },
  { value: 500, label: '500 funcionários' },
  { value: 1000, label: '1.000 funcionários' },
  { value: -1, label: 'Ilimitado' },
];

const cityHallSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  cnpj: z.string().min(14, 'CNPJ inválido').max(18),
});

const generateLicenseKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(segment);
  }
  return parts.join('-');
};

export default function SuperAdminCityHalls() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    cnpj: '',
    address: '',
    city: '',
    state: '',
    contractDuration: 12,
    maxEmployees: 100
  });
  
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
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

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

      // Create the city hall
      const { data: newCityHall, error } = await supabase
        .from('companies')
        .insert({
          name: validData.name,
          cnpj: formData.cnpj,
          company_code: normalizedCnpj,
          organization_type: 'city_hall',
          license_status: 'active',
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null
        })
        .select()
        .single();

      if (error) throw error;

      // Create the license based on contract duration
      const licenseKey = generateLicenseKey();
      const validFrom = new Date();
      const validUntil = addMonths(validFrom, formData.contractDuration);
      const maxEmployees = formData.maxEmployees === -1 ? null : formData.maxEmployees;
      
      let licenseType = 'annual';
      if (formData.contractDuration === 1) licenseType = 'monthly';
      else if (formData.contractDuration >= 1200) licenseType = 'lifetime';

      const { error: licenseError } = await supabase.from('licenses').insert({
        company_id: newCityHall.id,
        license_key: licenseKey,
        valid_from: validFrom.toISOString().split('T')[0],
        valid_until: validUntil.toISOString().split('T')[0],
        max_employees: maxEmployees,
        is_active: true,
        created_by: user.id,
        license_type: licenseType,
        notes: `Contrato de ${contractDurationOptions.find(c => c.value === formData.contractDuration)?.label || formData.contractDuration + ' meses'}`
      });

      if (licenseError) {
        console.error('Error creating license:', licenseError);
        toast.warning('Prefeitura criada, mas houve erro ao criar licença');
      }

      // Create company_settings
      await supabase.from('company_settings').insert({
        company_id: newCityHall.id,
        company_name: validData.name,
        cnpj: formData.cnpj,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null
      });

      // Create support and admin users for the new city hall
      try {
        const { data: usersData, error: usersError } = await supabase.functions.invoke('create-company-users', {
          body: {
            action: 'create-for-company',
            companyId: newCityHall.id
          }
        });

        if (usersError) {
          console.error('Error creating city hall users:', usersError);
          toast.warning('Prefeitura criada, mas houve erro ao criar usuários');
        } else if (usersData?.success) {
          const creds = usersData.credentials;
          const validUntilFormatted = format(validUntil, 'dd/MM/yyyy', { locale: ptBR });
          if (creds?.support?.temporaryPassword || creds?.admin?.temporaryPassword) {
            const supportInfo = creds?.support ? `Suporte: suporte/${creds.support.temporaryPassword}` : '';
            const adminInfo = creds?.admin ? `Admin: admin/${creds.admin.temporaryPassword}` : '';
            toast.success(`Prefeitura cadastrada! Licença válida até ${validUntilFormatted}. ${supportInfo} ${adminInfo}. Usuários devem trocar senha no primeiro login.`, { duration: 15000 });
          } else {
            toast.success(`Prefeitura cadastrada! Licença válida até ${validUntilFormatted}.`);
          }
        }
      } catch (err) {
        console.error('Error calling create-company-users:', err);
        toast.warning('Prefeitura criada, mas houve erro ao criar usuários');
      }

      setIsDialogOpen(false);
      setFormData({ name: '', cnpj: '', address: '', city: '', state: '', contractDuration: 12, maxEmployees: 100 });
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

    // Validate sector name
    if (!sectorFormData.name.trim()) {
      toast.error('O nome do setor é obrigatório');
      return;
    }

    try {
      // Generate unique sector code with timestamp to avoid collisions
      const timestamp = Date.now().toString(36).toUpperCase();
      const sectorCode = `${selectedCityHall.company_code}-${sectorFormData.sector.toUpperCase().slice(0, 3)}-${timestamp}`;
      
      const insertData = {
        name: sectorFormData.name.trim(),
        cnpj: selectedCityHall.cnpj,
        company_code: sectorCode,
        organization_type: 'city_hall' as const,
        sector: sectorFormData.sector as "education" | "health" | "culture" | "transport" | "administration" | "finance" | "environment" | "social_assistance" | "urban_planning" | "other",
        parent_organization_id: selectedCityHall.id,
        license_status: selectedCityHall.license_status
      };

      const { data: newSector, error } = await supabase
        .from('companies')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Create support and admin users for the new sector
      try {
        const { data: usersData, error: usersError } = await supabase.functions.invoke('create-company-users', {
          body: {
            action: 'create-for-company',
            companyId: newSector.id
          }
        });

        if (usersError) {
          console.error('Error creating sector users:', usersError);
          toast.warning('Setor criado, mas houve erro ao criar usuários');
        } else if (usersData?.success) {
          const creds = usersData.credentials;
          if (creds?.support?.temporaryPassword || creds?.admin?.temporaryPassword) {
            const supportInfo = creds?.support ? `Suporte: suporte/${creds.support.temporaryPassword}` : '';
            const adminInfo = creds?.admin ? `Admin: admin/${creds.admin.temporaryPassword}` : '';
            toast.success(`Setor criado! ${supportInfo} ${adminInfo}. Usuários devem trocar senha no primeiro login.`, { duration: 15000 });
          } else {
            toast.success('Setor criado! Usuários criados (já existiam ou foram criados anteriormente).');
          }
        }
      } catch (err) {
        console.error('Error calling create-company-users:', err);
        toast.success('Setor criado com sucesso!');
      }

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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Prefeitura</DialogTitle>
            <DialogDescription>Cadastre uma nova prefeitura com contrato e licença</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Prefeitura *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Prefeitura Municipal de..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ *</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Dados do Contrato e Licença
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractDuration" className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Tempo de Contrato
                  </Label>
                  <Select 
                    value={formData.contractDuration.toString()} 
                    onValueChange={(value) => setFormData({ ...formData, contractDuration: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractDurationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxEmployees" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Limite de Funcionários
                  </Label>
                  <Select 
                    value={formData.maxEmployees.toString()} 
                    onValueChange={(value) => setFormData({ ...formData, maxEmployees: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o limite" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeLimits.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A licença será gerada automaticamente com a validade de acordo com o tempo de contrato selecionado.
              </p>
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
              Adicione um setor para {selectedCityHall?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sector-name">Nome do Setor</Label>
              <Input
                id="sector-name"
                value={sectorFormData.name}
                onChange={(e) => setSectorFormData({ ...sectorFormData, name: e.target.value })}
                placeholder="Ex: Secretaria Municipal de Educação"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector-type">Tipo do Setor</Label>
              <Select value={sectorFormData.sector} onValueChange={(value) => setSectorFormData({ ...sectorFormData, sector: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {sectorOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
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
