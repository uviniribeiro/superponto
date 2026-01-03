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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Landmark, Plus, Search, Key, CheckCircle, XCircle, RefreshCw, ChevronDown, Trash2, GraduationCap, Heart, Palette, Bus, Settings2, Building2, Users, Calendar, Loader2, Phone, Pencil } from 'lucide-react';
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
  phone: string | null;
  trade_name: string | null;
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

// Default sectors to create for every city hall
const defaultSectors = [
  { value: 'administration', label: 'Administração' },
  { value: 'health', label: 'Saúde' },
  { value: 'education', label: 'Educação' },
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

interface License {
  id: string;
  company_id: string;
  license_key: string;
  valid_from: string;
  valid_until: string;
  max_employees: number | null;
  is_active: boolean;
  license_type: string;
}

export default function SuperAdminCityHalls() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCityHall, setEditingCityHall] = useState<Company | null>(null);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    tradeName: '',
    cnpj: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    contractDuration: 12,
    contractEndDate: '',
    maxEmployees: 100
  });
  
  const [isSectorDialogOpen, setIsSectorDialogOpen] = useState(false);
  const [selectedCityHall, setSelectedCityHall] = useState<Company | null>(null);
  const [sectorFormData, setSectorFormData] = useState({ 
    name: '', 
    sector: 'education',
    contractDuration: 12,
    contractEndDate: '',
    maxEmployees: 100,
    createSeparateLicense: true
  });
  const [expandedCityHalls, setExpandedCityHalls] = useState<string[]>([]);
  
  // Sector license dialog
  const [isSectorLicenseDialogOpen, setIsSectorLicenseDialogOpen] = useState(false);
  const [selectedSectorForLicense, setSelectedSectorForLicense] = useState<Company | null>(null);
  const [sectorLicenseFormData, setSectorLicenseFormData] = useState({
    contractDuration: 12,
    contractEndDate: '',
    maxEmployees: 100
  });

  useEffect(() => {
    fetchCompanies();
    fetchLicenses();
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

  const fetchLicenses = async () => {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('id, company_id, license_key, valid_from, valid_until, max_employees, is_active, license_type')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (error) {
      console.error('Error fetching licenses:', error);
    }
  };

  const getLicenseForCompany = (companyId: string) => {
    return licenses.find(l => l.company_id === companyId && l.is_active);
  };

  const cityHalls = companies.filter(c => c.organization_type === 'city_hall' && !c.parent_organization_id);
  const getSectors = (cityHallId: string) => companies.filter(c => c.parent_organization_id === cityHallId);

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
          state: formData.state || null,
          phone: formData.phone || null,
          trade_name: formData.tradeName || null
        })
        .select()
        .single();

      if (error) throw error;

      // Create the license based on contract duration or end date
      const licenseKey = generateLicenseKey();
      const validFrom = new Date();
      let validUntil: Date;
      
      if (formData.contractEndDate) {
        validUntil = new Date(formData.contractEndDate);
      } else {
        validUntil = addMonths(validFrom, formData.contractDuration);
      }
      
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
        state: formData.state || null,
        phone: formData.phone || null,
        trade_name: formData.tradeName || null
      });

      // Create default sectors (Administração, Saúde, Educação)
      for (const sector of defaultSectors) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const sectorCode = `${normalizedCnpj}-${sector.value.toUpperCase().slice(0, 3)}-${timestamp}`;
        
        const { data: newSector, error: sectorError } = await supabase
          .from('companies')
          .insert({
            name: `Secretaria de ${sector.label}`,
            cnpj: newCityHall.cnpj,
            company_code: sectorCode,
            organization_type: 'city_hall' as const,
            sector: sector.value as any,
            parent_organization_id: newCityHall.id,
            license_status: 'active',
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            phone: formData.phone || null,
          })
          .select()
          .single();

        if (sectorError) {
          console.error(`Error creating ${sector.label} sector:`, sectorError);
        } else if (newSector) {
          // Create users for this sector
          try {
            await supabase.functions.invoke('create-company-users', {
              body: { action: 'create-for-company', companyId: newSector.id }
            });
          } catch (err) {
            console.error(`Error creating users for sector ${sector.label}:`, err);
          }
        }
        
        // Small delay to avoid timestamp collision
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Create support and admin users for the main city hall
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
          if (creds?.support?.password || creds?.admin?.password) {
            toast.success(`Prefeitura cadastrada com 3 setores! Licença válida até ${validUntilFormatted}. Suporte: suporte/Super@26 | Admin: admin/Admin@26`, { duration: 15000 });
          } else {
            toast.success(`Prefeitura cadastrada com 3 setores! Licença válida até ${validUntilFormatted}. Usuários: suporte/Super@26 e admin/Admin@26`);
          }
        } else {
          const validUntilFormatted = format(validUntil, 'dd/MM/yyyy', { locale: ptBR });
          toast.success(`Prefeitura cadastrada com 3 setores! Licença válida até ${validUntilFormatted}. Usuários: suporte/Super@26 e admin/Admin@26`);
        }
      } catch (err) {
        console.error('Error calling create-company-users:', err);
        const validUntilFormatted = format(validUntil, 'dd/MM/yyyy', { locale: ptBR });
        toast.success(`Prefeitura cadastrada com 3 setores! Licença válida até ${validUntilFormatted}. Configure os usuários manualmente.`);
      }

      setIsDialogOpen(false);
      setFormData({ name: '', tradeName: '', cnpj: '', address: '', city: '', state: '', phone: '', contractDuration: 12, contractEndDate: '', maxEmployees: 100 });
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

  const handleEditCityHall = (cityHall: Company) => {
    setEditingCityHall(cityHall);
    setFormData({
      name: cityHall.name,
      tradeName: cityHall.trade_name || '',
      cnpj: cityHall.cnpj || '',
      address: cityHall.address || '',
      city: cityHall.city || '',
      state: cityHall.state || '',
      phone: cityHall.phone || '',
      contractDuration: 12,
      contractEndDate: '',
      maxEmployees: 100
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateCityHall = async () => {
    if (!editingCityHall) return;

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
          phone: formData.phone || null
        })
        .eq('id', editingCityHall.id);

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
        .eq('company_id', editingCityHall.id);

      // Update all sectors with same address info
      const sectors = getSectors(editingCityHall.id);
      for (const sector of sectors) {
        await supabase
          .from('companies')
          .update({
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            phone: formData.phone || null
          })
          .eq('id', sector.id);
      }

      toast.success('Prefeitura atualizada com sucesso');
      setIsEditDialogOpen(false);
      setEditingCityHall(null);
      setFormData({ name: '', tradeName: '', cnpj: '', address: '', city: '', state: '', phone: '', contractDuration: 12, contractEndDate: '', maxEmployees: 100 });
      fetchCompanies();
    } catch (error) {
      console.error('Error updating city hall:', error);
      toast.error('Erro ao atualizar prefeitura');
    }
  };

  const handleCreateSector = async () => {
    if (!selectedCityHall || !user) return;

    // Validate sector name
    if (!sectorFormData.name.trim()) {
      toast.error('O nome do setor é obrigatório');
      return;
    }

    try {
      // Generate unique sector code with timestamp to avoid collisions
      const timestamp = Date.now().toString(36).toUpperCase();
      const sectorCode = `${selectedCityHall.company_code}-${sectorFormData.sector.toUpperCase().slice(0, 3)}-${timestamp}`;
      
      // Determine license status based on whether we're creating a separate license
      const licenseStatus = sectorFormData.createSeparateLicense ? 'active' : selectedCityHall.license_status;
      
      const insertData = {
        name: sectorFormData.name.trim(),
        cnpj: selectedCityHall.cnpj,
        company_code: sectorCode,
        organization_type: 'city_hall' as const,
        sector: sectorFormData.sector as "education" | "health" | "culture" | "transport" | "administration" | "finance" | "environment" | "social_assistance" | "urban_planning" | "other",
        parent_organization_id: selectedCityHall.id,
        license_status: licenseStatus,
        address: selectedCityHall.address,
        city: selectedCityHall.city,
        state: selectedCityHall.state,
        phone: selectedCityHall.phone,
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

      // Create company_settings for the sector
      await supabase.from('company_settings').insert({
        company_id: newSector.id,
        company_name: sectorFormData.name.trim(),
        cnpj: selectedCityHall.cnpj,
        address: selectedCityHall.address || null,
        city: selectedCityHall.city || null,
        state: selectedCityHall.state || null,
        phone: selectedCityHall.phone || null,
      });

      // Create separate license for this sector if requested
      if (sectorFormData.createSeparateLicense) {
        const licenseKey = generateLicenseKey();
        const validFrom = new Date();
        let validUntil: Date;
        
        if (sectorFormData.contractEndDate) {
          validUntil = new Date(sectorFormData.contractEndDate);
        } else {
          validUntil = addMonths(validFrom, sectorFormData.contractDuration);
        }
        
        const maxEmployees = sectorFormData.maxEmployees === -1 ? null : sectorFormData.maxEmployees;
        
        let licenseType = 'annual';
        if (sectorFormData.contractDuration === 1) licenseType = 'monthly';
        else if (sectorFormData.contractDuration >= 1200) licenseType = 'lifetime';

        const { error: licenseError } = await supabase.from('licenses').insert({
          company_id: newSector.id,
          license_key: licenseKey,
          valid_from: validFrom.toISOString().split('T')[0],
          valid_until: validUntil.toISOString().split('T')[0],
          max_employees: maxEmployees,
          is_active: true,
          created_by: user.id,
          license_type: licenseType,
          notes: `Licença do setor ${sectorFormData.name.trim()} - ${contractDurationOptions.find(c => c.value === sectorFormData.contractDuration)?.label || sectorFormData.contractDuration + ' meses'}`
        });

        if (licenseError) {
          console.error('Error creating sector license:', licenseError);
          toast.warning('Setor criado, mas houve erro ao criar licença separada');
        }
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
          toast.warning('Setor criado, mas houve erro ao criar usuários. Tente novamente em Gerenciar Usuários.');
        } else if (usersData?.success) {
          const validUntilFormatted = sectorFormData.createSeparateLicense 
            ? format(sectorFormData.contractEndDate ? new Date(sectorFormData.contractEndDate) : addMonths(new Date(), sectorFormData.contractDuration), 'dd/MM/yyyy', { locale: ptBR })
            : '';
          
          const licenseInfo = sectorFormData.createSeparateLicense 
            ? ` Licença válida até ${validUntilFormatted}.` 
            : '';
          
          toast.success(`Setor criado com banco isolado!${licenseInfo} Suporte: suporte/Super@26 | Admin: admin/Admin@26`, { duration: 15000 });
        } else {
          toast.success('Setor criado! Usuários: suporte/Super@26 e admin/Admin@26');
        }
      } catch (err) {
        console.error('Error calling create-company-users:', err);
        toast.success('Setor criado! Configure os usuários manualmente se necessário.');
      }

      setIsSectorDialogOpen(false);
      setSectorFormData({ 
        name: '', 
        sector: 'education',
        contractDuration: 12,
        contractEndDate: '',
        maxEmployees: 100,
        createSeparateLicense: true
      });
      setSelectedCityHall(null);
      fetchCompanies();
      fetchLicenses();
    } catch (error) {
      console.error('Error creating sector:', error);
      toast.error('Erro ao criar setor');
    }
  };

  const deleteCompanyWithAllData = async (companyId: string) => {
    // Delete ALL related records in order of dependencies
    await supabase.from('time_records').delete().eq('company_id', companyId);
    await supabase.from('adjustment_requests').delete().eq('company_id', companyId);
    await supabase.from('timesheet_locks').delete().eq('company_id', companyId);
    await supabase.from('audit_logs').delete().eq('company_id', companyId);
    await supabase.from('employee_schedules').delete().eq('company_id', companyId);
    await supabase.from('employee_scale_assignments').delete().eq('company_id', companyId);
    await supabase.from('employee_class_hour_assignments').delete().eq('company_id', companyId);
    await supabase.from('employee_off_days').delete().eq('company_id', companyId);
    await supabase.from('class_records').delete().eq('company_id', companyId);
    await supabase.from('teacher_schedule_slots').delete().eq('company_id', companyId);
    await supabase.from('overtime_alerts').delete().eq('company_id', companyId);
    await supabase.from('equipment_pending_records').delete().eq('company_id', companyId);
    await supabase.from('equipment_communication_logs').delete().eq('company_id', companyId);
    await supabase.from('time_clock_equipment').delete().eq('company_id', companyId);
    await supabase.from('positions').delete().eq('company_id', companyId);
    await supabase.from('departments').delete().eq('company_id', companyId);
    await supabase.from('work_schedules').delete().eq('company_id', companyId);
    await supabase.from('scale_configurations').delete().eq('company_id', companyId);
    await supabase.from('class_hour_configurations').delete().eq('company_id', companyId);
    await supabase.from('holidays').delete().eq('company_id', companyId);
    await supabase.from('role_change_history').delete().eq('company_id', companyId);
    
    // Get profiles and their user_ids before deleting
    const { data: profiles } = await supabase.from('profiles').select('user_id').eq('company_id', companyId);
    const userIds = (profiles || []).map(p => p.user_id);
    
    // Delete user roles for these users
    if (userIds.length > 0) {
      await supabase.from('user_roles').delete().in('user_id', userIds);
    }
    
    // Delete profiles
    await supabase.from('profiles').delete().eq('company_id', companyId);
    
    // Delete license renewals via license_id
    const { data: licenses } = await supabase.from('licenses').select('id').eq('company_id', companyId);
    if (licenses) {
      for (const license of licenses) {
        await supabase.from('license_renewals').delete().eq('license_id', license.id);
      }
    }
    
    await supabase.from('licenses').delete().eq('company_id', companyId);
    await supabase.from('company_settings').delete().eq('company_id', companyId);
    await supabase.from('pending_company_users').delete().eq('company_id', companyId);
  };

  const handleDeleteSector = async (sectorId: string) => {
    try {
      await deleteCompanyWithAllData(sectorId);
      
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', sectorId);

      if (error) throw error;
      toast.success('Setor e todos os dados vinculados excluídos com sucesso');
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

  const handleDeleteCityHall = async (cityHall: Company) => {
    try {
      const sectors = getSectors(cityHall.id);
      
      // Delete sectors with all data first
      for (const sector of sectors) {
        await deleteCompanyWithAllData(sector.id);
        await supabase.from('companies').delete().eq('id', sector.id);
      }
      
      // Delete city hall data
      await deleteCompanyWithAllData(cityHall.id);
      
      // Finally delete the city hall
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', cityHall.id);

      if (error) throw error;
      toast.success('Prefeitura, setores e todos os dados vinculados excluídos com sucesso');
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting city hall:', error);
      toast.error('Erro ao excluir prefeitura');
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

  const renderFormFields = () => (
    <>
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
        <Label htmlFor="name">Razão Social *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Prefeitura Municipal de..."
          disabled={lookingUpCnpj}
        />
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
    </>
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
                            onClick={() => handleEditCityHall(cityHall)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCityHall(cityHall);
                              setSectorFormData({ 
                                name: '', 
                                sector: 'education',
                                contractDuration: 12,
                                contractEndDate: '',
                                maxEmployees: 100,
                                createSeparateLicense: true
                              });
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Prefeitura</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir a prefeitura "{cityHall.name}"?
                                  <br /><br />
                                  <strong className="text-destructive">ATENÇÃO: Esta ação irá excluir TODOS os dados vinculados:</strong>
                                  <ul className="list-disc list-inside mt-2 text-sm">
                                    <li>Todos os {sectors.length} setores e seus dados</li>
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
                                <AlertDialogAction onClick={() => handleDeleteCityHall(cityHall)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Excluir Tudo
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
                                  <TableHead>Licença</TableHead>
                                  <TableHead>Validade</TableHead>
                                  <TableHead>Funcionários</TableHead>
                                  <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sectors.map((sector) => {
                                  const sectorLicense = getLicenseForCompany(sector.id);
                                  return (
                                    <TableRow key={sector.id}>
                                      <TableCell className="font-medium">{sector.name}</TableCell>
                                      <TableCell>{getSectorLabel(sector.sector || '')}</TableCell>
                                      <TableCell>
                                        {sectorLicense ? (
                                          <Badge variant="default" className="text-xs">
                                            {sectorLicense.license_key.slice(0, 8)}...
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs">
                                            Sem licença
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {sectorLicense ? (
                                          <span className="text-sm">
                                            {format(new Date(sectorLicense.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
                                          </span>
                                        ) : '-'}
                                      </TableCell>
                                      <TableCell>
                                        {sectorLicense?.max_employees ? (
                                          <span className="text-sm">{sectorLicense.max_employees}</span>
                                        ) : sectorLicense ? (
                                          <span className="text-sm text-muted-foreground">Ilimitado</span>
                                        ) : '-'}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setSelectedSectorForLicense(sector);
                                              setSectorLicenseFormData({
                                                contractDuration: 12,
                                                contractEndDate: '',
                                                maxEmployees: 100
                                              });
                                              setIsSectorLicenseDialogOpen(true);
                                            }}
                                          >
                                            <Key className="h-4 w-4" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button variant="ghost" size="sm">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Excluir Setor</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Tem certeza que deseja excluir o setor "{sector.name}"?
                                                  <br /><br />
                                                  <strong className="text-destructive">Todos os dados do setor serão excluídos permanentemente, incluindo funcionários, registros de ponto e licenças.</strong>
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteSector(sector.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                  Excluir
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
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
            {renderFormFields()}

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
                  <Label htmlFor="contractEndDate" className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Data Fim de Contrato
                  </Label>
                  <Input
                    id="contractEndDate"
                    type="date"
                    value={formData.contractEndDate}
                    onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se preenchido, ignora o tempo de contrato acima
                  </p>
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
                A licença será gerada automaticamente. Os setores de Administração, Saúde e Educação serão criados automaticamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCityHall} className="gradient-primary">Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit City Hall Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Prefeitura</DialogTitle>
            <DialogDescription>Atualize os dados da prefeitura</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {renderFormFields()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingCityHall(null);
              setFormData({ name: '', tradeName: '', cnpj: '', address: '', city: '', state: '', phone: '', contractDuration: 12, contractEndDate: '', maxEmployees: 100 });
            }}>Cancelar</Button>
            <Button onClick={handleUpdateCityHall} className="gradient-primary">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Sector Dialog */}
      <Dialog open={isSectorDialogOpen} onOpenChange={setIsSectorDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Setor</DialogTitle>
            <DialogDescription>
              Adicione um setor para {selectedCityHall?.name}. Cada setor terá banco de dados isolado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="sector-name">Nome do Setor *</Label>
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

            <div className="border-t pt-4 mt-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="createSeparateLicense"
                  checked={sectorFormData.createSeparateLicense}
                  onChange={(e) => setSectorFormData({ ...sectorFormData, createSeparateLicense: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="createSeparateLicense" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Criar licença separada para este setor
                </Label>
              </div>
              
              {sectorFormData.createSeparateLicense && (
                <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-muted rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="sectorContractDuration" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Tempo de Contrato
                    </Label>
                    <Select 
                      value={sectorFormData.contractDuration.toString()} 
                      onValueChange={(value) => setSectorFormData({ ...sectorFormData, contractDuration: parseInt(value) })}
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
                    <Label htmlFor="sectorContractEndDate" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Data Fim de Contrato
                    </Label>
                    <Input
                      id="sectorContractEndDate"
                      type="date"
                      value={sectorFormData.contractEndDate}
                      onChange={(e) => setSectorFormData({ ...sectorFormData, contractEndDate: e.target.value })}
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sectorMaxEmployees" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Limite de Funcionários
                    </Label>
                    <Select 
                      value={sectorFormData.maxEmployees.toString()} 
                      onValueChange={(value) => setSectorFormData({ ...sectorFormData, maxEmployees: parseInt(value) })}
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
              )}
              
              <p className="text-xs text-muted-foreground mt-2">
                {sectorFormData.createSeparateLicense 
                  ? 'O setor terá uma licença independente da prefeitura.' 
                  : 'O setor compartilhará a licença da prefeitura.'
                }
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSectorDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSector} className="gradient-primary">Criar Setor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sector License Dialog */}
      <Dialog open={isSectorLicenseDialogOpen} onOpenChange={setIsSectorLicenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Licença do Setor</DialogTitle>
            <DialogDescription>
              Adicionar ou renovar licença para {selectedSectorForLicense?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Tempo de Contrato
                </Label>
                <Select 
                  value={sectorLicenseFormData.contractDuration.toString()} 
                  onValueChange={(value) => setSectorLicenseFormData({ ...sectorLicenseFormData, contractDuration: parseInt(value) })}
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
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Data Fim de Contrato
                </Label>
                <Input
                  type="date"
                  value={sectorLicenseFormData.contractEndDate}
                  onChange={(e) => setSectorLicenseFormData({ ...sectorLicenseFormData, contractEndDate: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
                <p className="text-xs text-muted-foreground">
                  Se preenchido, ignora o tempo de contrato
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Limite de Funcionários
                </Label>
                <Select 
                  value={sectorLicenseFormData.maxEmployees.toString()} 
                  onValueChange={(value) => setSectorLicenseFormData({ ...sectorLicenseFormData, maxEmployees: parseInt(value) })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSectorLicenseDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={async () => {
                if (!selectedSectorForLicense || !user) return;
                
                try {
                  const licenseKey = generateLicenseKey();
                  const validFrom = new Date();
                  let validUntil: Date;
                  
                  if (sectorLicenseFormData.contractEndDate) {
                    validUntil = new Date(sectorLicenseFormData.contractEndDate);
                  } else {
                    validUntil = addMonths(validFrom, sectorLicenseFormData.contractDuration);
                  }
                  
                  const maxEmployees = sectorLicenseFormData.maxEmployees === -1 ? null : sectorLicenseFormData.maxEmployees;
                  
                  let licenseType = 'annual';
                  if (sectorLicenseFormData.contractDuration === 1) licenseType = 'monthly';
                  else if (sectorLicenseFormData.contractDuration >= 1200) licenseType = 'lifetime';

                  const { error } = await supabase.from('licenses').insert({
                    company_id: selectedSectorForLicense.id,
                    license_key: licenseKey,
                    valid_from: validFrom.toISOString().split('T')[0],
                    valid_until: validUntil.toISOString().split('T')[0],
                    max_employees: maxEmployees,
                    is_active: true,
                    created_by: user.id,
                    license_type: licenseType,
                    notes: `Licença do setor ${selectedSectorForLicense.name}`
                  });

                  if (error) throw error;

                  // Update license status
                  await supabase.from('companies').update({ license_status: 'active' }).eq('id', selectedSectorForLicense.id);

                  toast.success(`Licença criada! Chave: ${licenseKey}. Válida até ${format(validUntil, 'dd/MM/yyyy', { locale: ptBR })}`);
                  setIsSectorLicenseDialogOpen(false);
                  setSelectedSectorForLicense(null);
                  fetchLicenses();
                  fetchCompanies();
                } catch (error) {
                  console.error('Error creating sector license:', error);
                  toast.error('Erro ao criar licença');
                }
              }} 
              className="gradient-primary"
            >
              <Key className="h-4 w-4 mr-2" />
              Criar Licença
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
