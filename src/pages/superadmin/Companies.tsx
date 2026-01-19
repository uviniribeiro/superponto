import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Building2, Plus, Search, Key, CheckCircle, XCircle, RefreshCw, GraduationCap, Calendar, Users, Trash2, Loader2, Phone, Pencil, Stethoscope, Wallet, Database } from 'lucide-react';
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
  teacher_module_enabled: boolean;
  doctor_module_enabled: boolean;
  payroll_module_enabled: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  trade_name: string | null;
}

const licenseTypeOptions = [
  { value: 'monthly', label: 'Mensal', months: 1 },
  { value: 'annual', label: 'Anual', months: 12 },
  { value: 'lifetime', label: 'Vitalícia', months: 1200 },
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

export default function SuperAdminCompanies() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [updatingTenant, setUpdatingTenant] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    tradeName: '',
    cnpj: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    teacherModuleEnabled: false,
    doctorModuleEnabled: false,
    payrollModuleEnabled: false,
    licenseType: 'annual',
    maxEmployees: 100
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('organization_type', 'company')
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

  const handleCnpjLookup = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    if (cleanCnpj.length !== 14) return;

    setLookingUpCnpj(true);
    try {
      const { data, error } = await supabase.functions.invoke('cnpj-lookup', {
        body: { cnpj: cleanCnpj }
      });

      if (error) throw error;

      if (data) {
        setFormData(prev => ({
          ...prev,
          name: data.razao_social || prev.name,
          tradeName: data.nome_fantasia || '',
          address: data.address || prev.address,
          city: data.city || prev.city,
          state: data.state || prev.state,
          phone: data.phone || prev.phone,
        }));
        toast.success('Dados do CNPJ carregados com sucesso!');
      }
    } catch (error: any) {
      console.error('Error looking up CNPJ:', error);
      toast.error(error.message || 'Erro ao consultar CNPJ');
    } finally {
      setLookingUpCnpj(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      const validData = companySchema.parse(formData);
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

      const { data: newCompany, error } = await supabase
        .from('companies')
        .insert({
          name: validData.name,
          trade_name: formData.tradeName || null,
          cnpj: formData.cnpj,
          company_code: normalizedCnpj,
          organization_type: 'company',
          license_status: 'active',
          teacher_module_enabled: formData.teacherModuleEnabled,
          doctor_module_enabled: formData.doctorModuleEnabled,
          payroll_module_enabled: formData.payrollModuleEnabled,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Create the license
      const licenseKey = generateLicenseKey();
      const validFrom = new Date();
      const licenseTypeInfo = licenseTypeOptions.find(t => t.value === formData.licenseType);
      const validUntil = addMonths(validFrom, licenseTypeInfo?.months || 12);
      const maxEmployees = formData.maxEmployees === -1 ? null : formData.maxEmployees;

      const { error: licenseError } = await supabase.from('licenses').insert({
        company_id: newCompany.id,
        license_key: licenseKey,
        valid_from: validFrom.toISOString().split('T')[0],
        valid_until: validUntil.toISOString().split('T')[0],
        max_employees: maxEmployees,
        is_active: true,
        created_by: user.id,
        license_type: formData.licenseType,
        notes: `Licença ${licenseTypeInfo?.label || formData.licenseType}`
      });

      if (licenseError) {
        console.error('Error creating license:', licenseError);
        toast.warning('Empresa criada, mas houve erro ao criar licença');
      }

      // Create company_settings
      await supabase.from('company_settings').insert({
        company_id: newCompany.id,
        company_name: validData.name,
        trade_name: formData.tradeName || null,
        cnpj: formData.cnpj,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        phone: formData.phone || null
      });

      // Create support and admin users for the new company
      try {
        const { data: usersData, error: usersError } = await supabase.functions.invoke('create-company-users', {
          body: {
            action: 'create-for-company',
            companyId: newCompany.id
          }
        });

        if (usersError) {
          console.error('Error creating company users:', usersError);
          toast.warning('Empresa criada, mas houve erro ao criar usuários');
        } else if (usersData?.success) {
          const creds = usersData.credentials;
          const validUntilFormatted = format(validUntil, 'dd/MM/yyyy', { locale: ptBR });
          if (creds?.support?.password || creds?.admin?.password) {
            toast.success(`Empresa cadastrada! Licença válida até ${validUntilFormatted}. Suporte: suporte/Super@26 | Admin: admin/Admin@26`, { duration: 15000 });
          } else {
            toast.success(`Empresa cadastrada! Licença válida até ${validUntilFormatted}. Usuários: suporte/Super@26 e admin/Admin@26`);
          }
        } else {
          const validUntilFormatted = format(validUntil, 'dd/MM/yyyy', { locale: ptBR });
          toast.success(`Empresa cadastrada! Licença válida até ${validUntilFormatted}. Usuários: suporte/Super@26 e admin/Admin@26`);
        }
      } catch (err) {
        console.error('Error calling create-company-users:', err);
        const validUntilFormatted = format(validUntil, 'dd/MM/yyyy', { locale: ptBR });
        toast.success(`Empresa cadastrada! Licença válida até ${validUntilFormatted}. Configure os usuários manualmente.`);
      }

      setIsDialogOpen(false);
      setFormData({ name: '', tradeName: '', cnpj: '', address: '', city: '', state: '', phone: '', teacherModuleEnabled: false, doctorModuleEnabled: false, payrollModuleEnabled: false, licenseType: 'annual', maxEmployees: 100 });
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

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      tradeName: company.trade_name || '',
      cnpj: company.cnpj || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      phone: company.phone || '',
      teacherModuleEnabled: company.teacher_module_enabled || false,
      doctorModuleEnabled: company.doctor_module_enabled || false,
      payrollModuleEnabled: company.payroll_module_enabled || false,
      licenseType: 'annual',
      maxEmployees: 100
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateCompany = async () => {
    if (!editingCompany) return;

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: formData.name,
          trade_name: formData.tradeName || null,
          cnpj: formData.cnpj,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          phone: formData.phone || null,
          teacher_module_enabled: formData.teacherModuleEnabled,
          doctor_module_enabled: formData.doctorModuleEnabled,
          payroll_module_enabled: formData.payrollModuleEnabled
        })
        .eq('id', editingCompany.id);

      if (error) throw error;

      // Update company_settings
      await supabase
        .from('company_settings')
        .update({
          company_name: formData.name,
          trade_name: formData.tradeName || null,
          cnpj: formData.cnpj,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          phone: formData.phone || null
        })
        .eq('company_id', editingCompany.id);

      toast.success('Empresa atualizada com sucesso');
      setIsEditDialogOpen(false);
      setEditingCompany(null);
      setFormData({ name: '', tradeName: '', cnpj: '', address: '', city: '', state: '', phone: '', teacherModuleEnabled: false, doctorModuleEnabled: false, payrollModuleEnabled: false, licenseType: 'annual', maxEmployees: 100 });
      fetchCompanies();
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Erro ao atualizar empresa');
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
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    try {
      // Delete ALL related records in order of dependencies
      await supabase.from('time_records').delete().eq('company_id', company.id);
      await supabase.from('adjustment_requests').delete().eq('company_id', company.id);
      await supabase.from('timesheet_locks').delete().eq('company_id', company.id);
      await supabase.from('audit_logs').delete().eq('company_id', company.id);
      await supabase.from('employee_schedules').delete().eq('company_id', company.id);
      await supabase.from('employee_scale_assignments').delete().eq('company_id', company.id);
      await supabase.from('employee_class_hour_assignments').delete().eq('company_id', company.id);
      await supabase.from('employee_off_days').delete().eq('company_id', company.id);
      await supabase.from('class_records').delete().eq('company_id', company.id);
      await supabase.from('teacher_schedule_slots').delete().eq('company_id', company.id);
      await supabase.from('overtime_alerts').delete().eq('company_id', company.id);
      await supabase.from('equipment_pending_records').delete().eq('company_id', company.id);
      await supabase.from('equipment_communication_logs').delete().eq('company_id', company.id);
      await supabase.from('time_clock_equipment').delete().eq('company_id', company.id);
      await supabase.from('positions').delete().eq('company_id', company.id);
      await supabase.from('departments').delete().eq('company_id', company.id);
      await supabase.from('work_schedules').delete().eq('company_id', company.id);
      await supabase.from('scale_configurations').delete().eq('company_id', company.id);
      await supabase.from('class_hour_configurations').delete().eq('company_id', company.id);
      await supabase.from('holidays').delete().eq('company_id', company.id);
      await supabase.from('role_change_history').delete().eq('company_id', company.id);
      
      // Get profiles and their user_ids before deleting
      const { data: profiles } = await supabase.from('profiles').select('user_id').eq('company_id', company.id);
      const userIds = (profiles || []).map(p => p.user_id);
      
      // Delete user roles for these users
      if (userIds.length > 0) {
        await supabase.from('user_roles').delete().in('user_id', userIds);
      }
      
      await supabase.from('profiles').delete().eq('company_id', company.id);
      
      // Delete license renewals (via license_id)
      const { data: licenses } = await supabase.from('licenses').select('id').eq('company_id', company.id);
      if (licenses) {
        for (const license of licenses) {
          await supabase.from('license_renewals').delete().eq('license_id', license.id);
        }
      }
      
      await supabase.from('licenses').delete().eq('company_id', company.id);
      await supabase.from('company_settings').delete().eq('company_id', company.id);
      await supabase.from('pending_company_users').delete().eq('company_id', company.id);
      
      // Finally delete the company
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);

      if (error) throw error;
      toast.success('Empresa e todos os dados vinculados excluídos com sucesso');
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('Erro ao excluir empresa');
    }
  };

  const handleUpdateTenant = async (company: Company) => {
    setUpdatingTenant(company.id);
    try {
      const { data, error } = await supabase.functions.invoke('update-tenant', {
        body: {
          companyId: company.id,
          resources: {
            teacherModule: company.teacher_module_enabled,
            doctorModule: company.doctor_module_enabled,
            payrollModule: company.payroll_module_enabled
          }
        }
      });

      if (error) throw error;

      const updatesCount = data?.results?.updates?.length || 0;
      if (updatesCount > 0) {
        toast.success(`Tenant atualizado! ${updatesCount} recurso(s) sincronizado(s).`);
      } else {
        toast.info('Tenant já está atualizado. Nenhuma alteração necessária.');
      }
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast.error('Erro ao atualizar tenant');
    } finally {
      setUpdatingTenant(null);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj?.includes(searchTerm)
  );

  const renderFormFields = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">Nome da Empresa *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Nome da empresa"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cnpj">CNPJ *</Label>
        <div className="flex gap-2">
          <Input
            id="cnpj"
            value={formData.cnpj}
            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
            onBlur={() => handleCnpjLookup(formData.cnpj)}
            placeholder="00.000.000/0000-00"
            className="flex-1"
          />
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => handleCnpjLookup(formData.cnpj)}
            disabled={lookingUpCnpj}
          >
            {lookingUpCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Digite o CNPJ e os dados serão preenchidos automaticamente</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tradeName">Nome Fantasia</Label>
        <Input
          id="tradeName"
          value={formData.tradeName}
          onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
          placeholder="Nome fantasia"
          disabled={lookingUpCnpj}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Endereço completo"
          disabled={lookingUpCnpj}
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
            disabled={lookingUpCnpj}
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
            disabled={lookingUpCnpj}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone" className="flex items-center gap-1">
          <Phone className="h-3 w-3" />
          Telefone
        </Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="(00) 00000-0000"
          disabled={lookingUpCnpj}
        />
      </div>
      
      <div className="p-3 bg-muted/50 rounded-lg space-y-3">
        <Label className="text-sm font-medium">Módulos Adicionais</Label>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="teacher-module"
            checked={formData.teacherModuleEnabled}
            onCheckedChange={(checked) => setFormData({ ...formData, teacherModuleEnabled: checked as boolean })}
          />
          <Label htmlFor="teacher-module" className="text-sm cursor-pointer flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Módulo Professor
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="doctor-module"
            checked={formData.doctorModuleEnabled}
            onCheckedChange={(checked) => setFormData({ ...formData, doctorModuleEnabled: checked as boolean })}
          />
          <Label htmlFor="doctor-module" className="text-sm cursor-pointer flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Módulo Médico
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="payroll-module"
            checked={formData.payrollModuleEnabled}
            onCheckedChange={(checked) => setFormData({ ...formData, payrollModuleEnabled: checked as boolean })}
          />
          <Label htmlFor="payroll-module" className="text-sm cursor-pointer flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Módulo Folha de Pagamento
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Selecione os módulos adicionais que deseja habilitar para esta empresa
        </p>
      </div>
    </>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Empresas
          </h1>
          <p className="text-muted-foreground">Gerencie as empresas cadastradas no sistema</p>
        </div>
      </div>

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
              <Button onClick={() => setIsDialogOpen(true)} className="gradient-primary">
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
                  <TableHead>Módulos</TableHead>
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
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {company.teacher_module_enabled && (
                          <Badge variant="outline" className="gap-1">
                            <GraduationCap className="h-3 w-3" />
                            Professor
                          </Badge>
                        )}
                        {company.doctor_module_enabled && (
                          <Badge variant="outline" className="gap-1">
                            <Stethoscope className="h-3 w-3" />
                            Médico
                          </Badge>
                        )}
                        {company.payroll_module_enabled && (
                          <Badge variant="outline" className="gap-1">
                            <Wallet className="h-3 w-3" />
                            Folha
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(company.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCompany(company)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateTenant(company)}
                          disabled={updatingTenant === company.id}
                          title="Atualizar tenant com os recursos habilitados"
                        >
                          {updatingTenant === company.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Database className="h-4 w-4 mr-1" />
                          )}
                          Tenant
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/super-admin/licenses?company=${company.id}`)}
                        >
                          <Key className="h-4 w-4 mr-1" />
                          Licença
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCompanyStatus(company)}
                        >
                          {company.is_active ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Empresa</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir a empresa "{company.name}"? 
                                <br /><br />
                                <strong className="text-destructive">ATENÇÃO: Esta ação irá excluir TODOS os dados vinculados:</strong>
                                <ul className="list-disc list-inside mt-2 text-sm">
                                  <li>Funcionários e seus registros de ponto</li>
                                  <li>Equipamentos e logs de comunicação</li>
                                  <li>Escalas e horários de trabalho</li>
                                  <li>Licenças e configurações</li>
                                </ul>
                                <br />
                                Esta ação <strong>NÃO PODE SER DESFEITA</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCompany(company)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir Tudo
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button variant="ghost" size="sm" onClick={fetchCompanies}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma empresa encontrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Company Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>Cadastre uma nova empresa com licença</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {renderFormFields()}

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Dados da Licença
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseType" className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Tipo de Licença
                  </Label>
                  <Select 
                    value={formData.licenseType} 
                    onValueChange={(value) => setFormData({ ...formData, licenseType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {licenseTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
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
                A licença será gerada automaticamente com a validade de acordo com o tipo selecionado.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCompany} className="gradient-primary">Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>Atualize os dados da empresa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {renderFormFields()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingCompany(null);
              setFormData({ name: '', tradeName: '', cnpj: '', address: '', city: '', state: '', phone: '', teacherModuleEnabled: false, doctorModuleEnabled: false, payrollModuleEnabled: false, licenseType: 'annual', maxEmployees: 100 });
            }}>Cancelar</Button>
            <Button onClick={handleUpdateCompany} className="gradient-primary">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
