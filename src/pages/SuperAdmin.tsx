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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Key, Shield, Plus, Search, Calendar, Users, CheckCircle, XCircle, RefreshCw, Landmark, GraduationCap, Heart, Palette, Bus, Settings2, Trash2, Loader2, Wrench } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';

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

interface License {
  id: string;
  company_id: string;
  license_key: string;
  valid_from: string;
  valid_until: string;
  max_employees: number;
  is_active: boolean;
  created_at: string;
  notes: string | null;
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

const companySchema = z.object({
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

export default function SuperAdmin() {
  const { isSuperAdmin, user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    cnpj: '',
    organization_type: 'company' as 'company' | 'city_hall'
  });
  
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const [selectedCompanyForLicense, setSelectedCompanyForLicense] = useState<Company | null>(null);
  const [licenseFormData, setLicenseFormData] = useState({
    valid_months: 12,
    max_employees: 50,
    notes: ''
  });

  const [isSectorDialogOpen, setIsSectorDialogOpen] = useState(false);
  const [selectedCityHall, setSelectedCityHall] = useState<Company | null>(null);
  const [sectorFormData, setSectorFormData] = useState({
    name: '',
    sector: 'education'
  });

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
      fetchLicenses();
    }
  }, [isSuperAdmin]);

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
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  const fetchLicenses = async () => {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (error) {
      console.error('Error fetching licenses:', error);
    }
  };

  const handleCreateCompany = async () => {
    try {
      const validData = companySchema.parse(companyFormData);
      const normalizedCnpj = companyFormData.cnpj.replace(/[^\d]/g, '');
      
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
          cnpj: companyFormData.cnpj,
          company_code: normalizedCnpj,
          organization_type: companyFormData.organization_type,
          license_status: 'pending'
        });

      if (error) throw error;

      toast.success(companyFormData.organization_type === 'city_hall' 
        ? 'Prefeitura cadastrada com sucesso!' 
        : 'Empresa cadastrada com sucesso!');
      setIsCompanyDialogOpen(false);
      setCompanyFormData({ name: '', cnpj: '', organization_type: 'company' });
      fetchCompanies();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error creating company:', error);
        toast.error('Erro ao cadastrar');
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

  const handleCreateLicense = async () => {
    if (!selectedCompanyForLicense || !user) return;

    try {
      const licenseKey = generateLicenseKey();
      const validFrom = new Date();
      const validUntil = addMonths(validFrom, licenseFormData.valid_months);

      const { error: licenseError } = await supabase
        .from('licenses')
        .insert({
          company_id: selectedCompanyForLicense.id,
          license_key: licenseKey,
          valid_from: validFrom.toISOString().split('T')[0],
          valid_until: validUntil.toISOString().split('T')[0],
          max_employees: licenseFormData.max_employees,
          is_active: true,
          created_by: user.id,
          notes: licenseFormData.notes || null
        });

      if (licenseError) throw licenseError;

      await supabase
        .from('companies')
        .update({ license_status: 'active' })
        .eq('id', selectedCompanyForLicense.id);

      // If it's a city hall, update all sectors too
      if (selectedCompanyForLicense.organization_type === 'city_hall' && !selectedCompanyForLicense.parent_organization_id) {
        await supabase
          .from('companies')
          .update({ license_status: 'active' })
          .eq('parent_organization_id', selectedCompanyForLicense.id);
      }

      toast.success(`Licença criada! Chave: ${licenseKey}`);
      setIsLicenseDialogOpen(false);
      setSelectedCompanyForLicense(null);
      setLicenseFormData({ valid_months: 12, max_employees: 50, notes: '' });
      fetchCompanies();
      fetchLicenses();
    } catch (error) {
      console.error('Error creating license:', error);
      toast.error('Erro ao criar licença');
    }
  };

  const toggleCompanyStatus = async (company: Company) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: !company.is_active })
        .eq('id', company.id);

      if (error) throw error;
      
      // If it's a city hall, toggle all sectors too
      if (company.organization_type === 'city_hall' && !company.parent_organization_id) {
        await supabase
          .from('companies')
          .update({ is_active: !company.is_active })
          .eq('parent_organization_id', company.id);
      }

      toast.success(company.is_active ? 'Desativado' : 'Ativado');
      fetchCompanies();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const toggleLicenseStatus = async (license: License) => {
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ is_active: !license.is_active })
        .eq('id', license.id);

      if (error) throw error;
      
      const companyLicenses = licenses.filter(l => l.company_id === license.company_id && l.id !== license.id);
      const hasActiveLicense = companyLicenses.some(l => l.is_active) || !license.is_active;
      
      await supabase
        .from('companies')
        .update({ license_status: hasActiveLicense ? 'active' : 'expired' })
        .eq('id', license.company_id);

      toast.success(license.is_active ? 'Licença desativada' : 'Licença ativada');
      fetchLicenses();
      fetchCompanies();
    } catch (error) {
      console.error('Error toggling license:', error);
      toast.error('Erro ao alterar licença');
    }
  };

  const openLicenseDialog = (company: Company) => {
    setSelectedCompanyForLicense(company);
    setLicenseFormData({ valid_months: 12, max_employees: 50, notes: '' });
    setIsLicenseDialogOpen(true);
  };

  const openSectorDialog = (cityHall: Company) => {
    setSelectedCityHall(cityHall);
    setSectorFormData({ name: '', sector: 'education' });
    setIsSectorDialogOpen(true);
  };

  // Filter companies and city halls
  const regularCompanies = companies.filter(c => c.organization_type === 'company');
  const cityHalls = companies.filter(c => c.organization_type === 'city_hall' && !c.parent_organization_id);
  const getSectors = (cityHallId: string) => companies.filter(c => c.parent_organization_id === cityHallId);

  const filteredCompanies = regularCompanies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj?.includes(searchTerm)
  );

  const filteredCityHalls = cityHalls.filter(ch =>
    ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ch.cnpj?.includes(searchTerm)
  );

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Não encontrado';
  };

  const getLicenseStatusBadge = (license: License) => {
    const today = new Date();
    const validUntil = new Date(license.valid_until);
    
    if (!license.is_active) return <Badge variant="secondary">Inativa</Badge>;
    if (validUntil < today) return <Badge variant="destructive">Expirada</Badge>;
    return <Badge variant="default">Ativa</Badge>;
  };

  const getSectorLabel = (sector: string) => {
    const sectorInfo = sectorOptions.find(s => s.value === sector);
    return sectorInfo?.label || sector;
  };

  // Run full setup: add default sectors + recreate users
  const handleFullSetup = async () => {
    if (!confirm('Isso irá:\n1. Adicionar setores de Administração, Educação e Saúde em TODAS as prefeituras\n2. Recriar/resetar usuários admin e suporte em TODAS as empresas e setores\n\nSenhas padrão:\n- suporte: Super@26\n- admin: Admin@26\n\nDeseja continuar?')) {
      return;
    }

    setSetupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-default-data', {
        body: { action: 'full-setup' }
      });

      if (error) throw error;

      console.log('Full setup result:', data);
      
      const sectorCount = data.sectorResults?.reduce((acc: number, ch: any) => 
        acc + (ch.sectors?.filter((s: any) => s.action === 'created').length || 0), 0) || 0;
      
      const userCount = data.userResults?.length || 0;

      toast.success(
        `Setup concluído!\n${sectorCount} novos setores criados\n${userCount} organizações processadas\n\nSenhas padrão:\nSuportes: Super@26\nAdmins: Admin@26`,
        { duration: 10000 }
      );

      fetchCompanies();
    } catch (error) {
      console.error('Error in full setup:', error);
      toast.error('Erro ao executar setup completo');
    } finally {
      setSetupLoading(false);
    }
  };

  // Add default sectors to all city halls
  const handleAddDefaultSectors = async () => {
    if (!confirm('Adicionar setores de Administração, Educação e Saúde em TODAS as prefeituras cadastradas?')) {
      return;
    }

    setSetupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-default-data', {
        body: { action: 'add-default-sectors' }
      });

      if (error) throw error;

      console.log('Add sectors result:', data);
      
      const newSectors = data.results?.reduce((acc: number, ch: any) => 
        acc + (ch.sectors?.filter((s: any) => s.action === 'created').length || 0), 0) || 0;

      toast.success(`${newSectors} novos setores criados!`);
      fetchCompanies();
    } catch (error) {
      console.error('Error adding default sectors:', error);
      toast.error('Erro ao adicionar setores');
    } finally {
      setSetupLoading(false);
    }
  };

  // Recreate all users
  const handleRecreateAllUsers = async () => {
    if (!confirm('Recriar/resetar usuários admin e suporte em TODAS as empresas e setores?\n\nSenhas serão resetadas para:\n- suporte: Super@26\n- admin: Admin@26')) {
      return;
    }

    setSetupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-default-data', {
        body: { action: 'recreate-all-users' }
      });

      if (error) throw error;

      console.log('Recreate users result:', data);
      
      const created = data.results?.filter((r: any) => r.suporte?.action === 'created' || r.admin?.action === 'created').length || 0;
      const reset = data.results?.filter((r: any) => r.suporte?.action === 'reset' || r.admin?.action === 'reset').length || 0;

      toast.success(
        `Usuários processados!\n${created} novos criados\n${reset} senhas resetadas\n\nSenhas padrão:\nSuportes: Super@26\nAdmins: Admin@26`,
        { duration: 8000 }
      );
    } catch (error) {
      console.error('Error recreating users:', error);
      toast.error('Erro ao recriar usuários');
    } finally {
      setSetupLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Área exclusiva para Super Administradores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Super Administrador
          </h1>
          <p className="text-muted-foreground">Gerencie empresas, prefeituras e licenças</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleAddDefaultSectors}
            disabled={setupLoading}
          >
            {setupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Adicionar Setores Padrão
          </Button>
          <Button
            variant="outline"
            onClick={handleRecreateAllUsers}
            disabled={setupLoading}
          >
            {setupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Recriar Usuários
          </Button>
          <Button
            onClick={handleFullSetup}
            disabled={setupLoading}
            className="gradient-primary"
          >
            {setupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
            Setup Completo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="city-halls" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Prefeituras
          </TabsTrigger>
          <TabsTrigger value="licenses" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Licenças
          </TabsTrigger>
        </TabsList>

        {/* EMPRESAS TAB */}
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Empresas Cadastradas</CardTitle>
                  <CardDescription>{regularCompanies.length} empresas no sistema</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empresa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={() => { setCompanyFormData({ name: '', cnpj: '', organization_type: 'company' }); setIsCompanyDialogOpen(true); }} className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Empresa
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-pulse-soft">Carregando...</div>
                </div>
              ) : filteredCompanies.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Licença</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.cnpj || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={company.is_active ? 'default' : 'secondary'}>
                            {company.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={company.license_status === 'active' ? 'default' : company.license_status === 'expired' ? 'destructive' : 'secondary'}>
                            {company.license_status === 'active' ? 'Ativa' : company.license_status === 'expired' ? 'Expirada' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(company.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openLicenseDialog(company)}>
                              <Key className="h-4 w-4 mr-1" />
                              Licença
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => toggleCompanyStatus(company)}>
                              {company.is_active ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREFEITURAS TAB */}
        <TabsContent value="city-halls" className="space-y-4">
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
                  <Button onClick={() => { setCompanyFormData({ name: '', cnpj: '', organization_type: 'city_hall' }); setIsCompanyDialogOpen(true); }} className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Prefeitura
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-pulse-soft">Carregando...</div>
                </div>
              ) : filteredCityHalls.length > 0 ? (
                filteredCityHalls.map((cityHall) => {
                  const sectors = getSectors(cityHall.id);
                  return (
                    <Card key={cityHall.id} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Landmark className="h-6 w-6 text-primary" />
                            <div>
                              <CardTitle className="text-lg">{cityHall.name}</CardTitle>
                              <CardDescription>CNPJ: {cityHall.cnpj || '-'}</CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={cityHall.is_active ? 'default' : 'secondary'}>
                              {cityHall.is_active ? 'Ativa' : 'Inativa'}
                            </Badge>
                            <Badge variant={cityHall.license_status === 'active' ? 'default' : cityHall.license_status === 'expired' ? 'destructive' : 'secondary'}>
                              {cityHall.license_status === 'active' ? 'Licenciada' : cityHall.license_status === 'expired' ? 'Expirada' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Button variant="outline" size="sm" onClick={() => openLicenseDialog(cityHall)}>
                            <Key className="h-4 w-4 mr-1" />
                            Licença
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openSectorDialog(cityHall)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Adicionar Setor
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleCompanyStatus(cityHall)}>
                            {cityHall.is_active ? <XCircle className="h-4 w-4 text-destructive mr-1" /> : <CheckCircle className="h-4 w-4 text-green-500 mr-1" />}
                            {cityHall.is_active ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>

                        {sectors.length > 0 ? (
                          <div>
                            <p className="text-sm font-medium mb-2 text-muted-foreground">Setores ({sectors.length})</p>
                            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                              {sectors.map((sector) => {
                                const sectorInfo = sectorOptions.find(s => s.value === sector.sector);
                                const Icon = sectorInfo?.icon || Settings2;
                                return (
                                  <div key={sector.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="text-sm font-medium">{sector.name}</p>
                                        <p className="text-xs text-muted-foreground">{getSectorLabel(sector.sector || '')}</p>
                                      </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSector(sector.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum setor cadastrado. Clique em "Adicionar Setor" para criar.</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <Landmark className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhuma prefeitura encontrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LICENÇAS TAB */}
        <TabsContent value="licenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Licenças Emitidas</CardTitle>
              <CardDescription>{licenses.length} licenças no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {licenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organização</TableHead>
                      <TableHead>Chave</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Funcionários</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licenses.map((license) => (
                      <TableRow key={license.id}>
                        <TableCell className="font-medium">{getCompanyName(license.company_id)}</TableCell>
                        <TableCell className="font-mono text-xs">{license.license_key}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{format(new Date(license.valid_from), 'dd/MM/yyyy', { locale: ptBR })}</div>
                            <div className="text-muted-foreground">até {format(new Date(license.valid_until), 'dd/MM/yyyy', { locale: ptBR })}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {license.max_employees}
                          </div>
                        </TableCell>
                        <TableCell>{getLicenseStatusBadge(license)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => toggleLicenseStatus(license)}>
                            {license.is_active ? <XCircle className="h-4 w-4 text-destructive" /> : <RefreshCw className="h-4 w-4 text-green-500" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhuma licença emitida</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Company/City Hall Dialog */}
      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {companyFormData.organization_type === 'city_hall' ? 'Nova Prefeitura' : 'Nova Empresa'}
            </DialogTitle>
            <DialogDescription>
              {companyFormData.organization_type === 'city_hall' 
                ? 'Cadastre uma nova prefeitura no sistema' 
                : 'Cadastre uma nova empresa no sistema'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Organização</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={companyFormData.organization_type === 'company' ? 'default' : 'outline'}
                  onClick={() => setCompanyFormData({ ...companyFormData, organization_type: 'company' })}
                  className="flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  Empresa
                </Button>
                <Button
                  type="button"
                  variant={companyFormData.organization_type === 'city_hall' ? 'default' : 'outline'}
                  onClick={() => setCompanyFormData({ ...companyFormData, organization_type: 'city_hall' })}
                  className="flex items-center gap-2"
                >
                  <Landmark className="h-4 w-4" />
                  Prefeitura
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{companyFormData.organization_type === 'city_hall' ? 'Nome da Prefeitura *' : 'Nome da Empresa *'}</Label>
              <Input
                value={companyFormData.name}
                onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                placeholder={companyFormData.organization_type === 'city_hall' ? 'Prefeitura Municipal de...' : 'Nome da empresa'}
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <Input
                value={companyFormData.cnpj}
                onChange={(e) => setCompanyFormData({ ...companyFormData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
              <p className="text-xs text-muted-foreground">O CNPJ será usado como código de acesso</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompanyDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCompany} className="gradient-primary">
              {companyFormData.organization_type === 'city_hall' ? 'Cadastrar Prefeitura' : 'Cadastrar Empresa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Sector Dialog */}
      <Dialog open={isSectorDialogOpen} onOpenChange={setIsSectorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Setor</DialogTitle>
            <DialogDescription>
              Criar novo setor para {selectedCityHall?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Setor</Label>
              <Select
                value={sectorFormData.sector}
                onValueChange={(value) => {
                  const sectorInfo = sectorOptions.find(s => s.value === value);
                  setSectorFormData({ 
                    ...sectorFormData, 
                    sector: value,
                    name: sectorFormData.name || `Secretaria de ${sectorInfo?.label || ''}`
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
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
            <div className="space-y-2">
              <Label>Nome do Setor *</Label>
              <Input
                value={sectorFormData.name}
                onChange={(e) => setSectorFormData({ ...sectorFormData, name: e.target.value })}
                placeholder="Ex: Secretaria Municipal de Educação"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSectorDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSector} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Criar Setor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create License Dialog */}
      <Dialog open={isLicenseDialogOpen} onOpenChange={setIsLicenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Licença</DialogTitle>
            <DialogDescription>
              Gerar nova licença para {selectedCompanyForLicense?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Validade (meses)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={licenseFormData.valid_months}
                onChange={(e) => setLicenseFormData({ ...licenseFormData, valid_months: parseInt(e.target.value) || 12 })}
              />
              <p className="text-xs text-muted-foreground">
                Validade até: {format(addMonths(new Date(), licenseFormData.valid_months), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Limite de Funcionários</Label>
              <Input
                type="number"
                min={1}
                max={10000}
                value={licenseFormData.max_employees}
                onChange={(e) => setLicenseFormData({ ...licenseFormData, max_employees: parseInt(e.target.value) || 50 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                value={licenseFormData.notes}
                onChange={(e) => setLicenseFormData({ ...licenseFormData, notes: e.target.value })}
                placeholder="Observações opcionais"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLicenseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateLicense} className="gradient-primary">
              <Key className="h-4 w-4 mr-2" />
              Gerar Licença
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <HelpButton pageKey="superadmin" />
    </div>
  );
}
