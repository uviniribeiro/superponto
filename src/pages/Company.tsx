import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Save } from 'lucide-react';

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
}

export default function Company() {
  const [settings, setSettings] = useState<CompanySettings>({
    company_name: '',
    cnpj: '',
    cei: '',
    address: '',
    city: '',
    state: '',
    rep_number: '',
    rep_manufacturer: '',
    rep_model: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          rep_model: data.rep_model || ''
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.company_name.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const settingsData = {
        company_name: settings.company_name,
        cnpj: settings.cnpj || null,
        cei: settings.cei || null,
        address: settings.address || null,
        city: settings.city || null,
        state: settings.state || null,
        rep_number: settings.rep_number || null,
        rep_manufacturer: settings.rep_manufacturer || null,
        rep_model: settings.rep_model || null
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

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse-soft">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-8 w-8 text-primary" />
          Configurações da Empresa
        </h1>
        <p className="text-muted-foreground">Configure os dados da empresa para os relatórios AFD/AFDT</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Empresa</CardTitle>
          <CardDescription>
            Informações utilizadas na geração dos arquivos legais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Razão Social *</Label>
              <Input
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={settings.cnpj}
                onChange={(e) => setSettings({ ...settings, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>CEI</Label>
              <Input
                value={settings.cei}
                onChange={(e) => setSettings({ ...settings, cei: e.target.value })}
                placeholder="00.000.00000/00"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço</Label>
              <Input
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                value={settings.city}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                placeholder="Cidade"
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input
                value={settings.state}
                onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                placeholder="UF"
                maxLength={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados do REP</CardTitle>
          <CardDescription>
            Informações do Registrador Eletrônico de Ponto (para relatórios)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Número do REP</Label>
              <Input
                value={settings.rep_number}
                onChange={(e) => setSettings({ ...settings, rep_number: e.target.value })}
                placeholder="Número de registro"
              />
            </div>
            <div className="space-y-2">
              <Label>Fabricante</Label>
              <Input
                value={settings.rep_manufacturer}
                onChange={(e) => setSettings({ ...settings, rep_manufacturer: e.target.value })}
                placeholder="Fabricante do REP"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                value={settings.rep_model}
                onChange={(e) => setSettings({ ...settings, rep_model: e.target.value })}
                placeholder="Modelo do REP"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gradient-primary">
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}