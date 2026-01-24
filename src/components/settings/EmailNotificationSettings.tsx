import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bell, Mail, Shield, Smartphone, Save } from 'lucide-react';

interface NotificationSettings {
  notify_new_device: boolean;
  notify_suspicious_login: boolean;
  notify_password_change: boolean;
  notify_backup_codes: boolean;
}

export function EmailNotificationSettings() {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    notify_new_device: true,
    notify_suspicious_login: true,
    notify_password_change: true,
    notify_backup_codes: true,
  });

  useEffect(() => {
    if (profile?.id) {
      loadSettings();
    }
  }, [profile?.id]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notify_new_device, notify_suspicious_login, notify_password_change, notify_backup_codes')
        .eq('id', profile?.id)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          notify_new_device: data.notify_new_device ?? true,
          notify_suspicious_login: data.notify_suspicious_login ?? true,
          notify_password_change: data.notify_password_change ?? true,
          notify_backup_codes: data.notify_backup_codes ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          notify_new_device: settings.notify_new_device,
          notify_suspicious_login: settings.notify_suspicious_login,
          notify_password_change: settings.notify_password_change,
          notify_backup_codes: settings.notify_backup_codes,
        })
        .eq('id', profile?.id);

      if (error) throw error;
      toast.success('Configurações de notificação salvas');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notificações por Email
        </CardTitle>
        <CardDescription>
          Configure quais alertas de segurança você deseja receber por email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <Label htmlFor="notify-new-device" className="font-medium">
                Novo dispositivo
              </Label>
              <p className="text-xs text-muted-foreground">
                Receber alerta quando um novo dispositivo acessar sua conta
              </p>
            </div>
          </div>
          <Switch
            id="notify-new-device"
            checked={settings.notify_new_device}
            onCheckedChange={(checked) => updateSetting('notify_new_device', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Shield className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <Label htmlFor="notify-suspicious" className="font-medium">
                Login suspeito
              </Label>
              <p className="text-xs text-muted-foreground">
                Alertas sobre tentativas de login suspeitas ou bloqueadas
              </p>
            </div>
          </div>
          <Switch
            id="notify-suspicious"
            checked={settings.notify_suspicious_login}
            onCheckedChange={(checked) => updateSetting('notify_suspicious_login', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Mail className="h-4 w-4 text-warning" />
            </div>
            <div>
              <Label htmlFor="notify-password" className="font-medium">
                Alteração de senha
              </Label>
              <p className="text-xs text-muted-foreground">
                Confirmação quando sua senha for alterada
              </p>
            </div>
          </div>
          <Switch
            id="notify-password"
            checked={settings.notify_password_change}
            onCheckedChange={(checked) => updateSetting('notify_password_change', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <Label htmlFor="notify-backup" className="font-medium">
                Códigos de backup 2FA
              </Label>
              <p className="text-xs text-muted-foreground">
                Receber cópia dos códigos de recuperação por email
              </p>
            </div>
          </div>
          <Switch
            id="notify-backup"
            checked={settings.notify_backup_codes}
            onCheckedChange={(checked) => updateSetting('notify_backup_codes', checked)}
          />
        </div>

        <Button onClick={saveSettings} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </CardContent>
    </Card>
  );
}
