import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Building2, Save, Upload, X } from 'lucide-react';

interface CompanySettings {
  id?: string;
  company_name: string;
  cnpj: string;
  cei: string;
  address: string;
  city: string;
  state: string;
  rep_number: string;
  rep_manufacturer: string;
  rep_model: string;
  daily_overtime_limit_hours: number;
  weekly_overtime_limit_hours: number;
  monthly_overtime_limit_hours: number;
  overtime_alert_email: string;
  whatsapp_alert_phone: string;
  logo_url: string;
}

export default function Company() {
  const { company } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<CompanySettings>({
    company_name: '',
    cnpj: '',
    cei: '',
    address: '',
    city: '',
    state: '',
    rep_number: '',
    rep_manufacturer: '',
    rep_model: '',
    daily_overtime_limit_hours: 2,
    weekly_overtime_limit_hours: 10,
    monthly_overtime_limit_hours: 44,
    overtime_alert_email: '',
    whatsapp_alert_phone: '',
    logo_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        setSettings({
          id: data.id,
          company_name: data.company_name || '',
          cnpj: data.cnpj || '',
          cei: data.cei || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          rep_number: data.rep_number || '',
          rep_manufacturer: data.rep_manufacturer || '',
          rep_model: data.rep_model || '',
          daily_overtime_limit_hours: data.daily_overtime_limit_hours ?? 2,
          weekly_overtime_limit_hours: data.weekly_overtime_limit_hours ?? 10,
          monthly_overtime_limit_hours: data.monthly_overtime_limit_hours ?? 44,
          overtime_alert_email: data.overtime_alert_email || '',
          whatsapp_alert_phone: (data as any).whatsapp_alert_phone || '',
          logo_url: (data as any).logo_url || ''
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${company?.id || 'company'}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      setSettings(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success('Logo carregada com sucesso');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Erro ao carregar logo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setSettings(prev => ({ ...prev, logo_url: '' }));
  };

  const handleSave = async () => {
    if (!settings.company_name.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }
    
    if (!settings.cnpj.trim()) {
      toast.error('CNPJ é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const normalizedCnpj = settings.cnpj.replace(/[^\d]/g, '');
      
      const settingsData = {
        company_name: settings.company_name,
        cnpj: settings.cnpj || null,
        cei: settings.cei || null,
        address: settings.address || null,
        city: settings.city || null,
        state: settings.state || null,
        rep_number: settings.rep_number || null,
        rep_manufacturer: settings.rep_manufacturer || null,
        rep_model: settings.rep_model || null,
        daily_overtime_limit_hours: settings.daily_overtime_limit_hours,
        weekly_overtime_limit_hours: settings.weekly_overtime_limit_hours,
        monthly_overtime_limit_hours: settings.monthly_overtime_limit_hours,
        overtime_alert_email: settings.overtime_alert_email || null,
        whatsapp_alert_phone: settings.whatsapp_alert_phone || null,
        logo_url: settings.logo_url || null
      };

      if (settings.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert(settingsData)
          .select()
          .single();
        if (error) throw error;
        setSettings({ ...settings, id: data.id });
      }

      // Update company table with new CNPJ as company_code
      if (company?.id) {
        const { error: companyError } = await supabase
          .from('companies')
          .update({ 
            cnpj: settings.cnpj,
            company_code: normalizedCnpj,
            name: settings.company_name,
            logo_url: settings.logo_url || null
          })
          .eq('id', company.id);
        
        if (companyError) {
          console.error('Error updating company:', companyError);
          toast.error('Erro ao atualizar código da empresa');
          return;
        }
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse-soft text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Configurações da Empresa
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure os dados da empresa para os relatórios AFD/AFDT</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Identidade Visual</CardTitle>
          <CardDescription>
            Logo e nome da empresa exibidos no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 rounded-xl">
                <AvatarImage src={settings.logo_url} alt="Logo" className="object-cover" />
                <AvatarFallback className="rounded-xl bg-muted text-muted-foreground text-xl font-semibold">
                  {settings.company_name ? getInitials(settings.company_name) : 'CO'}
                </AvatarFallback>
              </Avatar>
              {settings.logo_url && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={handleRemoveLogo}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Logo da Empresa</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Recomendado: imagem quadrada, máximo 2MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Enviando...' : 'Carregar Logo'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Dados da Empresa</CardTitle>
          <CardDescription>
            Informações utilizadas na geração dos arquivos legais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm">Razão Social *</Label>
              <Input
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="Nome da empresa"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">CNPJ *</Label>
              <Input
                value={settings.cnpj}
                onChange={(e) => setSettings({ ...settings, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                required
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">O CNPJ é usado como código de acesso da empresa no login</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">CEI</Label>
              <Input
                value={settings.cei}
                onChange={(e) => setSettings({ ...settings, cei: e.target.value })}
                placeholder="00.000.00000/00"
                className="h-9"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm">Endereço</Label>
              <Input
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Endereço completo"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Cidade</Label>
              <Input
                value={settings.city}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                placeholder="Cidade"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Estado</Label>
              <Input
                value={settings.state}
                onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                placeholder="UF"
                maxLength={2}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Dados do REP</CardTitle>
          <CardDescription>
            Informações do Registrador Eletrônico de Ponto (para relatórios)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm">Número do REP</Label>
              <Input
                value={settings.rep_number}
                onChange={(e) => setSettings({ ...settings, rep_number: e.target.value })}
                placeholder="Número de registro"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Fabricante</Label>
              <Input
                value={settings.rep_manufacturer}
                onChange={(e) => setSettings({ ...settings, rep_manufacturer: e.target.value })}
                placeholder="Fabricante do REP"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Modelo</Label>
              <Input
                value={settings.rep_model}
                onChange={(e) => setSettings({ ...settings, rep_model: e.target.value })}
                placeholder="Modelo do REP"
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Limites de Horas Extras</CardTitle>
          <CardDescription>
            Configure os limites para alertas automáticos de horas extras
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm">Limite Diário (horas)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={settings.daily_overtime_limit_hours}
                onChange={(e) => setSettings({ ...settings, daily_overtime_limit_hours: parseFloat(e.target.value) || 0 })}
                placeholder="2"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Limite Semanal (horas)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={settings.weekly_overtime_limit_hours}
                onChange={(e) => setSettings({ ...settings, weekly_overtime_limit_hours: parseFloat(e.target.value) || 0 })}
                placeholder="10"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Limite Mensal (horas)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={settings.monthly_overtime_limit_hours}
                onChange={(e) => setSettings({ ...settings, monthly_overtime_limit_hours: parseFloat(e.target.value) || 0 })}
                placeholder="44"
                className="h-9"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Email para Alertas</Label>
              <Input
                type="email"
                value={settings.overtime_alert_email}
                onChange={(e) => setSettings({ ...settings, overtime_alert_email: e.target.value })}
                placeholder="rh@empresa.com.br"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Os alertas serão enviados para este email
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">WhatsApp para Alertas</Label>
              <Input
                type="tel"
                value={settings.whatsapp_alert_phone}
                onChange={(e) => setSettings({ ...settings, whatsapp_alert_phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Alertas também serão enviados via WhatsApp
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}