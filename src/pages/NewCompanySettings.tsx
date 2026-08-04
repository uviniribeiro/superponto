import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Building2, Settings, Link2, Scale, Upload, Save } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CnpjInput } from '@/components/shared/CnpjInput';
import { validateCNPJ } from '@/lib/validators';

interface CompanySettings {
  id: string;
  company_name: string;
  trade_name: string | null;
  cnpj: string | null;
  cei: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  logo_url: string | null;
  rep_number: string | null;
  rep_manufacturer: string | null;
  rep_model: string | null;
}

export default function NewCompanySettings() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('empresa');

  const [formData, setFormData] = useState({
    company_name: '',
    trade_name: '',
    cnpj: '',
    cei: '',
    state_registration: '',
    municipal_registration: '',
    address: '',
    cep: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    responsible_name: '',
    responsible_cpf: '',
    logo_url: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setFormData({
          company_name: data.company_name || '',
          trade_name: data.trade_name || '',
          cnpj: data.cnpj || '',
          cei: data.cei || '',
          state_registration: '',
          municipal_registration: '',
          address: data.address || '',
          cep: '',
          city: data.city || '',
          state: data.state || '',
          phone: data.phone || '',
          email: '',
          responsible_name: '',
          responsible_cpf: '',
          logo_url: data.logo_url || '',
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.company_name.trim()) {
      toast.error('Razão Social é obrigatória');
      return;
    }

    if (formData.cnpj.trim()) {
      const cnpjCheck = validateCNPJ(formData.cnpj);
      if (!cnpjCheck.valid) {
        toast.error(cnpjCheck.message);
        return;
      }
    }

    setSaving(true);
    try {
      const updateData = {
        company_name: formData.company_name.trim(),
        trade_name: formData.trade_name.trim() || null,
        cnpj: formData.cnpj.trim() || null,
        cei: formData.cei.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        phone: formData.phone.trim() || null,
        company_id: profile?.company_id,
      };

      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update(updateData)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert(updateData);
        if (error) throw error;
      }

      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="empresa" className="gap-2">
            <Building2 className="h-4 w-4" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="regras" className="gap-2">
            <Settings className="h-4 w-4" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="integracao" className="gap-2">
            <Link2 className="h-4 w-4" />
            Integração
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-2">
            <Scale className="h-4 w-4" />
            Legal
          </TabsTrigger>
        </TabsList>

        {/* Company Data Tab */}
        <TabsContent value="empresa" className="mt-6 space-y-6">
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Dados da Empresa</h2>
                <p className="text-sm text-muted-foreground">Informações cadastrais da empresa</p>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                {formData.logo_url ? (
                  <Avatar className="h-16 w-16 rounded-lg">
                    <AvatarImage src={formData.logo_url} />
                    <AvatarFallback className="rounded-lg">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Alterar Logo
              </Button>
              <span className="text-xs text-muted-foreground">PNG ou JPG até 2MB</span>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Razão Social *</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Empresa Demonstração LTDA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={formData.trade_name}
                    onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                    placeholder="Demo Ponto"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ *</Label>
                  <CnpjInput
                    id="company-cnpj"
                    value={formData.cnpj}
                    onChange={(value) => setFormData({ ...formData, cnpj: value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEI/CAEPF</Label>
                  <Input
                    value={formData.cei}
                    onChange={(e) => setFormData({ ...formData, cei: e.target.value })}
                    placeholder=""
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Inscrição Estadual</Label>
                  <Input
                    value={formData.state_registration}
                    onChange={(e) => setFormData({ ...formData, state_registration: e.target.value })}
                    placeholder=""
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inscrição Municipal</Label>
                  <Input
                    value={formData.municipal_registration}
                    onChange={(e) => setFormData({ ...formData, municipal_registration: e.target.value })}
                    placeholder=""
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Av. Paulista, 1000 - Bela Vista"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    placeholder="01310-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="São Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="SP"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 3000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@demoponto.com.br"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Responsável</Label>
                  <Input
                    value={formData.responsible_name}
                    onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                    placeholder="João da Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF do Responsável</Label>
                  <Input
                    value={formData.responsible_cpf}
                    onChange={(e) => setFormData({ ...formData, responsible_cpf: e.target.value })}
                    placeholder="123.456.789-00"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="regras" className="mt-6">
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Regras de Negócio</h2>
            <p className="text-sm text-muted-foreground">
              Configure as regras de cálculo de ponto da empresa.
            </p>
            {/* Add rules configuration here */}
          </div>
        </TabsContent>

        {/* Integration Tab */}
        <TabsContent value="integracao" className="mt-6">
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Integrações</h2>
            <p className="text-sm text-muted-foreground">
              Configure integrações com outros sistemas.
            </p>
            {/* Add integrations configuration here */}
          </div>
        </TabsContent>

        {/* Legal Tab */}
        <TabsContent value="legal" className="mt-6">
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Informações Legais</h2>
            <p className="text-sm text-muted-foreground">
              Configurações legais e de conformidade.
            </p>
            {/* Add legal configuration here */}
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
