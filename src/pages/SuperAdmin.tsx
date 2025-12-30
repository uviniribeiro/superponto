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
import { toast } from 'sonner';
import { Building2, Key, Shield, Plus, Search, Calendar, Users, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { format, addMonths, addYears } from 'date-fns';
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
  company_name?: string;
}

const companySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  cnpj: z.string().min(14, 'CNPJ inválido').max(18),
});

const generateLicenseKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = 4;
  const segmentLength = 4;
  const parts: string[] = [];
  
  for (let i = 0; i < segments; i++) {
    let segment = '';
    for (let j = 0; j < segmentLength; j++) {
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
  
  // Company dialog state
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    cnpj: ''
  });
  
  // License dialog state
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const [selectedCompanyForLicense, setSelectedCompanyForLicense] = useState<Company | null>(null);
  const [licenseFormData, setLicenseFormData] = useState({
    valid_months: 12,
    max_employees: 50,
    notes: ''
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
      setCompanies(data || []);
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
      
      // Check if CNPJ already exists
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
          license_status: 'pending'
        });

      if (error) throw error;

      toast.success('Empresa cadastrada com sucesso!');
      setIsCompanyDialogOpen(false);
      setCompanyFormData({ name: '', cnpj: '' });
      fetchCompanies();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error creating company:', error);
        toast.error('Erro ao cadastrar empresa');
      }
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

      // Update company license status
      await supabase
        .from('companies')
        .update({ license_status: 'active' })
        .eq('id', selectedCompanyForLicense.id);

      toast.success(`Licença criada com sucesso! Chave: ${licenseKey}`);
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
      toast.success(company.is_active ? 'Empresa desativada' : 'Empresa ativada');
      fetchCompanies();
    } catch (error) {
      console.error('Error toggling company status:', error);
      toast.error('Erro ao alterar status da empresa');
    }
  };

  const toggleLicenseStatus = async (license: License) => {
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ is_active: !license.is_active })
        .eq('id', license.id);

      if (error) throw error;
      
      // Update company license status
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
      console.error('Error toggling license status:', error);
      toast.error('Erro ao alterar status da licença');
    }
  };

  const openLicenseDialog = (company: Company) => {
    setSelectedCompanyForLicense(company);
    setLicenseFormData({ valid_months: 12, max_employees: 50, notes: '' });
    setIsLicenseDialogOpen(true);
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj?.includes(searchTerm)
  );

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Empresa não encontrada';
  };

  const getLicenseStatusBadge = (license: License) => {
    const today = new Date();
    const validUntil = new Date(license.valid_until);
    
    if (!license.is_active) {
      return <Badge variant="secondary">Inativa</Badge>;
    }
    if (validUntil < today) {
      return <Badge variant="destructive">Expirada</Badge>;
    }
    return <Badge variant="default">Ativa</Badge>;
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Esta área é exclusiva para Super Administradores.
            </p>
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
          <p className="text-muted-foreground">Gerencie empresas e licenças do sistema</p>
        </div>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="licenses" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Licenças
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Empresas Cadastradas</CardTitle>
                  <CardDescription>{companies.length} empresas no sistema</CardDescription>
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
                  <Button onClick={() => setIsCompanyDialogOpen(true)} className="gradient-primary">
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
                <div className="overflow-x-auto">
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
                            <Badge 
                              variant={
                                company.license_status === 'active' ? 'default' :
                                company.license_status === 'expired' ? 'destructive' : 'secondary'
                              }
                            >
                              {company.license_status === 'active' ? 'Ativa' :
                               company.license_status === 'expired' ? 'Expirada' : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(company.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openLicenseDialog(company)}
                                title="Gerar Licença"
                              >
                                <Key className="h-4 w-4 mr-1" />
                                Licença
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleCompanyStatus(company)}
                                title={company.is_active ? 'Desativar' : 'Ativar'}
                              >
                                {company.is_active ? (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-success" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="licenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Licenças Emitidas</CardTitle>
              <CardDescription>{licenses.length} licenças no sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {licenses.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
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
                              <div className="text-muted-foreground">
                                até {format(new Date(license.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleLicenseStatus(license)}
                              title={license.is_active ? 'Desativar' : 'Ativar'}
                            >
                              {license.is_active ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <RefreshCw className="h-4 w-4 text-success" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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

      {/* Create Company Dialog */}
      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>
              Cadastre uma nova empresa no sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Empresa *</Label>
              <Input
                value={companyFormData.name}
                onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <Input
                value={companyFormData.cnpj}
                onChange={(e) => setCompanyFormData({ ...companyFormData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
              <p className="text-xs text-muted-foreground">
                O CNPJ será usado como código de acesso da empresa
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompanyDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCompany} className="gradient-primary">
              Cadastrar Empresa
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
            <Button variant="outline" onClick={() => setIsLicenseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLicense} className="gradient-primary">
              <Key className="h-4 w-4 mr-2" />
              Gerar Licença
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
