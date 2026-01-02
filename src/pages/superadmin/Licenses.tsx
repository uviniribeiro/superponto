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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Key, Plus, Search, CheckCircle, XCircle, Calendar, Users, Infinity, Building2, Landmark } from 'lucide-react';
import { format, addMonths, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  company_code: string;
  is_active: boolean;
  license_status: string | null;
  organization_type: 'company' | 'city_hall';
  parent_organization_id: string | null;
}

interface License {
  id: string;
  company_id: string;
  license_key: string;
  valid_from: string;
  valid_until: string;
  max_employees: number | null;
  is_active: boolean;
  created_at: string;
  notes: string | null;
  license_type: string;
}

const employeeLimits = [
  { value: 50, label: '50 funcionários' },
  { value: 100, label: '100 funcionários' },
  { value: 200, label: '200 funcionários' },
  { value: 300, label: '300 funcionários' },
  { value: 500, label: '500 funcionários' },
  { value: 1000, label: '1.000 funcionários' },
  { value: -1, label: 'Ilimitado' },
];

const licenseTypes = [
  { value: 'monthly', label: 'Mensal', months: 1 },
  { value: 'annual', label: 'Anual', months: 12 },
  { value: 'lifetime', label: 'Vitalícia', months: 1200 }, // 100 years
];

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

export default function SuperAdminLicenses() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedCompanyId = searchParams.get('company');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    license_type: 'annual',
    max_employees: 50,
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (preselectedCompanyId && companies.length > 0) {
      const company = companies.find(c => c.id === preselectedCompanyId);
      if (company) {
        setSelectedCompany(company);
        setIsDialogOpen(true);
      }
    }
  }, [preselectedCompanyId, companies]);

  const fetchData = async () => {
    try {
      const [companiesRes, licensesRes] = await Promise.all([
        supabase.from('companies').select('*').is('parent_organization_id', null).order('name'),
        supabase.from('licenses').select('*').order('created_at', { ascending: false })
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (licensesRes.error) throw licensesRes.error;

      setCompanies((companiesRes.data || []) as Company[]);
      setLicenses((licensesRes.data || []) as License[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLicense = async () => {
    if (!selectedCompany || !user) return;

    try {
      const licenseKey = generateLicenseKey();
      const validFrom = new Date();
      const licenseTypeInfo = licenseTypes.find(t => t.value === formData.license_type);
      const validUntil = addMonths(validFrom, licenseTypeInfo?.months || 12);

      const maxEmployees = formData.max_employees === -1 ? null : formData.max_employees;

      const { error: licenseError } = await supabase
        .from('licenses')
        .insert({
          company_id: selectedCompany.id,
          license_key: licenseKey,
          valid_from: validFrom.toISOString().split('T')[0],
          valid_until: validUntil.toISOString().split('T')[0],
          max_employees: maxEmployees,
          is_active: true,
          created_by: user.id,
          notes: formData.notes || null,
          license_type: formData.license_type
        });

      if (licenseError) throw licenseError;

      await supabase
        .from('companies')
        .update({ license_status: 'active' })
        .eq('id', selectedCompany.id);

      // If it's a city hall, update all sectors too
      if (selectedCompany.organization_type === 'city_hall') {
        await supabase
          .from('companies')
          .update({ license_status: 'active' })
          .eq('parent_organization_id', selectedCompany.id);
      }

      toast.success(`Licença criada! Chave: ${licenseKey}`);
      setIsDialogOpen(false);
      setSelectedCompany(null);
      setFormData({ license_type: 'annual', max_employees: 50, notes: '' });
      fetchData();
    } catch (error) {
      console.error('Error creating license:', error);
      toast.error('Erro ao criar licença');
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
      fetchData();
    } catch (error) {
      console.error('Error toggling license:', error);
      toast.error('Erro ao alterar licença');
    }
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Não encontrado';
  };

  const getCompanyType = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.organization_type;
  };

  const getLicenseStatusBadge = (license: License) => {
    const today = new Date();
    const validUntil = new Date(license.valid_until);
    
    if (!license.is_active) return <Badge variant="secondary">Inativa</Badge>;
    if (validUntil < today) return <Badge variant="destructive">Expirada</Badge>;
    return <Badge variant="default">Ativa</Badge>;
  };

  const getLicenseTypeLabel = (type: string) => {
    const typeInfo = licenseTypes.find(t => t.value === type);
    return typeInfo?.label || type;
  };

  const getEmployeeLimitLabel = (limit: number | null) => {
    if (limit === null) return 'Ilimitado';
    const limitInfo = employeeLimits.find(l => l.value === limit);
    return limitInfo?.label || `${limit} funcionários`;
  };

  const filteredLicenses = licenses.filter(license => {
    const companyName = getCompanyName(license.company_id).toLowerCase();
    return companyName.includes(searchTerm.toLowerCase()) || 
           license.license_key.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8 text-primary" />
            Licenças
          </h1>
          <p className="text-muted-foreground">Gerencie as licenças de uso do sistema</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Key className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{licenses.length}</p>
                <p className="text-sm text-muted-foreground">Total de Licenças</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{licenses.filter(l => l.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Licenças Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{companies.filter(c => c.organization_type === 'company').length}</p>
                <p className="text-sm text-muted-foreground">Empresas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Landmark className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{companies.filter(c => c.organization_type === 'city_hall').length}</p>
                <p className="text-sm text-muted-foreground">Prefeituras</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Licenças Emitidas</CardTitle>
              <CardDescription>{licenses.length} licenças no sistema</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar licença..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select onValueChange={(companyId) => {
                const company = companies.find(c => c.id === companyId);
                if (company) {
                  setSelectedCompany(company);
                  setFormData({ license_type: 'annual', max_employees: 50, notes: '' });
                  setIsDialogOpen(true);
                }
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Nova licença para..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      <div className="flex items-center gap-2">
                        {company.organization_type === 'city_hall' ? (
                          <Landmark className="h-4 w-4" />
                        ) : (
                          <Building2 className="h-4 w-4" />
                        )}
                        {company.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse-soft">Carregando...</div>
            </div>
          ) : filteredLicenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Funcionários</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLicenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCompanyType(license.company_id) === 'city_hall' ? (
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{getCompanyName(license.company_id)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{license.license_key}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getLicenseTypeLabel(license.license_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {license.max_employees === null ? (
                          <Infinity className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Users className="h-4 w-4 text-muted-foreground" />
                        )}
                        {getEmployeeLimitLabel(license.max_employees)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(license.valid_from), 'dd/MM/yy', { locale: ptBR })} - {format(new Date(license.valid_until), 'dd/MM/yy', { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>{getLicenseStatusBadge(license)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLicenseStatus(license)}
                      >
                        {license.is_active ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma licença encontrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create License Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Licença</DialogTitle>
            <DialogDescription>
              Criar licença para: {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Licença</Label>
              <Select 
                value={formData.license_type} 
                onValueChange={(value) => setFormData({ ...formData, license_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {licenseTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Limite de Funcionários</Label>
              <Select 
                value={formData.max_employees.toString()} 
                onValueChange={(value) => setFormData({ ...formData, max_employees: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employeeLimits.map((limit) => (
                    <SelectItem key={limit.value} value={limit.value.toString()}>
                      <div className="flex items-center gap-2">
                        {limit.value === -1 ? (
                          <Infinity className="h-4 w-4" />
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                        {limit.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre a licença..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateLicense} className="gradient-primary">Criar Licença</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
