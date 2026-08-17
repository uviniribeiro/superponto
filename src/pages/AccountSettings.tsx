import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { User, Palette, FileSpreadsheet, Save, Building2, UserCog, Lock, Eye, EyeOff, Shield, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TwoFactorSettings } from '@/components/auth/TwoFactorSettings';
import { EmailNotificationSettings } from '@/components/settings/EmailNotificationSettings';
import { PageHeader } from '@/components/shared/PageHeader';

interface ImportLayout {
  id?: string;
  name: string;
  separator: string;
  dateFormat: string;
  timeFormat: string;
  employeeIdColumn: number;
  dateColumn: number;
  timeColumn: number;
  recordTypeColumn: number | null;
  skipHeaderRows: number;
  encoding: string;
}

// ProfileEditor Component - allows admin to edit their name
function ProfileEditor() {
  const { profile, isAdmin } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const userLogin = profile?.email?.split('@')[0] || '';

  useEffect(() => {
    setFullName(profile?.full_name || '');
  }, [profile?.full_name]);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast.error('Nome não pode estar vazio');
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', profile?.id);

      if (error) throw error;
      toast.success('Nome atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar nome');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Informações do Perfil</CardTitle>
        <CardDescription>Seus dados pessoais no sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Login</Label>
            <Input value={userLogin} disabled className="bg-muted font-mono" />
          </div>
          <div className="space-y-2">
            <Label>Nome Completo {isAdmin && '*'}</Label>
            {isAdmin ? (
              <Input 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
              />
            ) : (
              <Input value={profile?.full_name || ''} disabled className="bg-muted" />
            )}
          </div>
          <div className="space-y-2">
            <Label>Matrícula</Label>
            <Input value={profile?.registration_number || '-'} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Input value={profile?.department || '-'} disabled className="bg-muted" />
          </div>
        </div>
        {isAdmin ? (
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            <Save className="h-4 w-4 mr-2" />
            {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Para alterar seus dados, entre em contato com o administrador do sistema.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountSettings() {
  const { profile, isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Personalization settings
  const [compactMode, setCompactMode] = useState(false);
  const [showSeconds, setShowSeconds] = useState(true);
  const [dateFormat, setDateFormat] = useState('dd/MM/yyyy');
  const [timeFormat, setTimeFormat] = useState('HH:mm:ss');
  const [startPage, setStartPage] = useState('/home');
  
  // Import layout for Primme
  const [importLayouts, setImportLayouts] = useState<ImportLayout[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<ImportLayout | null>(null);
  const [newLayout, setNewLayout] = useState<ImportLayout>({
    name: 'Primme Acesso',
    separator: ';',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm:ss',
    employeeIdColumn: 1,
    dateColumn: 2,
    timeColumn: 3,
    recordTypeColumn: null,
    skipHeaderRows: 1,
    encoding: 'UTF-8',
  });

  const [saving, setSaving] = useState(false);
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Extract login from email
  const userLogin = profile?.email?.split('@')[0] || '';

  useEffect(() => {
    loadSettings();
    loadImportLayouts();
  }, []);

  const loadSettings = async () => {
    // Load personalization settings from localStorage for now
    const saved = localStorage.getItem('personalization-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      setCompactMode(settings.compactMode ?? false);
      setShowSeconds(settings.showSeconds ?? true);
      setDateFormat(settings.dateFormat ?? 'dd/MM/yyyy');
      setTimeFormat(settings.timeFormat ?? 'HH:mm:ss');
      setStartPage(settings.startPage ?? '/home');
    }
  };

  const loadImportLayouts = () => {
    // Load import layouts from localStorage
    const saved = localStorage.getItem('import-layouts');
    if (saved) {
      setImportLayouts(JSON.parse(saved));
    } else {
      // Add default Primme layout
      const defaultLayouts: ImportLayout[] = [
        {
          id: 'primme-default',
          name: 'Primme Acesso (Padrão)',
          separator: ';',
          dateFormat: 'dd/MM/yyyy',
          timeFormat: 'HH:mm',
          employeeIdColumn: 0,
          dateColumn: 1,
          timeColumn: 2,
          recordTypeColumn: null,
          skipHeaderRows: 0,
          encoding: 'ISO-8859-1',
        }
      ];
      setImportLayouts(defaultLayouts);
      localStorage.setItem('import-layouts', JSON.stringify(defaultLayouts));
    }
  };

  const savePersonalizationSettings = () => {
    const settings = {
      compactMode,
      showSeconds,
      dateFormat,
      timeFormat,
      startPage,
    };
    localStorage.setItem('personalization-settings', JSON.stringify(settings));
    toast.success('Configurações de personalização salvas');
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Erro ao alterar senha. Verifique sua senha atual.');
    } finally {
      setChangingPassword(false);
    }
  };

  const saveImportLayout = () => {
    setSaving(true);
    try {
      const layoutToSave = {
        ...newLayout,
        id: newLayout.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      };
      
      const updatedLayouts = [...importLayouts, layoutToSave];
      setImportLayouts(updatedLayouts);
      localStorage.setItem('import-layouts', JSON.stringify(updatedLayouts));
      
      setNewLayout({
        name: '',
        separator: ';',
        dateFormat: 'dd/MM/yyyy',
        timeFormat: 'HH:mm:ss',
        employeeIdColumn: 1,
        dateColumn: 2,
        timeColumn: 3,
        recordTypeColumn: null,
        skipHeaderRows: 1,
        encoding: 'UTF-8',
      });
      
      toast.success('Layout de importação salvo com sucesso');
    } catch (error) {
      toast.error('Erro ao salvar layout');
    } finally {
      setSaving(false);
    }
  };

  const deleteLayout = (id: string) => {
    const updatedLayouts = importLayouts.filter(l => l.id !== id);
    setImportLayouts(updatedLayouts);
    localStorage.setItem('import-layouts', JSON.stringify(updatedLayouts));
    toast.success('Layout removido');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
          title="Minha Conta"
          description="Gerencie suas preferências e configurações" icon={UserCog}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Segurança</span>
          </TabsTrigger>
          <TabsTrigger value="2fa" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">2FA</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="personalization" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Preferências</span>
          </TabsTrigger>
          <TabsTrigger value="import-layouts" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Layouts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 mt-6">
          <ProfileEditor />

          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Configurações da Empresa
                </CardTitle>
                <CardDescription>Acesso rápido às configurações administrativas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/company">
                  <Button variant="outline" className="w-full justify-start">
                    <Building2 className="h-4 w-4 mr-2" />
                    Dados da Empresa
                  </Button>
                </Link>
                <Link to="/users">
                  <Button variant="outline" className="w-full justify-start">
                    <UserCog className="h-4 w-4 mr-2" />
                    Gerenciar Usuários
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Alterar Senha
              </CardTitle>
              <CardDescription>Atualize sua senha de acesso ao sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Digite novamente a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <Button 
                onClick={handleChangePassword} 
                disabled={changingPassword || !newPassword || !confirmPassword}
                className="w-full"
              >
                {changingPassword ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="2fa" className="space-y-4 mt-6">
          <TwoFactorSettings />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-6">
          <EmailNotificationSettings />
        </TabsContent>

        <TabsContent value="personalization" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferências de Interface</CardTitle>
              <CardDescription>Personalize como o sistema é exibido para você</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo Compacto</Label>
                  <p className="text-xs text-muted-foreground">Reduz o espaçamento dos elementos</p>
                </div>
                <Switch checked={compactMode} onCheckedChange={setCompactMode} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Mostrar Segundos no Relógio</Label>
                  <p className="text-xs text-muted-foreground">Exibe segundos nos horários</p>
                </div>
                <Switch checked={showSeconds} onCheckedChange={setShowSeconds} />
              </div>

              <div className="space-y-2">
                <Label>Formato de Data</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd/MM/yyyy">DD/MM/AAAA (31/12/2024)</SelectItem>
                    <SelectItem value="MM/dd/yyyy">MM/DD/AAAA (12/31/2024)</SelectItem>
                    <SelectItem value="yyyy-MM-dd">AAAA-MM-DD (2024-12-31)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Formato de Hora</Label>
                <Select value={timeFormat} onValueChange={setTimeFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HH:mm:ss">24 horas com segundos (14:30:00)</SelectItem>
                    <SelectItem value="HH:mm">24 horas (14:30)</SelectItem>
                    <SelectItem value="hh:mm:ss a">12 horas com segundos (02:30:00 PM)</SelectItem>
                    <SelectItem value="hh:mm a">12 horas (02:30 PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Página Inicial</Label>
                <Select value={startPage} onValueChange={setStartPage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/home">Início</SelectItem>
                    <SelectItem value="/dashboard">Dashboard</SelectItem>
                    <SelectItem value="/time-clock">Registrar Ponto</SelectItem>
                    <SelectItem value="/my-records">Meus Registros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={savePersonalizationSettings} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Salvar Preferências
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import-layouts" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Layouts de Importação Salvos</CardTitle>
              <CardDescription>Layouts configurados para importação de arquivos de ponto</CardDescription>
            </CardHeader>
            <CardContent>
              {importLayouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum layout configurado
                </p>
              ) : (
                <div className="space-y-2">
                  {importLayouts.map((layout) => (
                    <div
                      key={layout.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div>
                        <p className="font-medium text-sm">{layout.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Separador: "{layout.separator}" | Colunas: ID={layout.employeeIdColumn}, Data={layout.dateColumn}, Hora={layout.timeColumn}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteLayout(layout.id!)}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Novo Layout de Importação</CardTitle>
              <CardDescription>
                Configure o formato do arquivo para importação do Relógio Primme Acesso ou outro equipamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nome do Layout</Label>
                  <Input
                    value={newLayout.name}
                    onChange={(e) => setNewLayout({ ...newLayout, name: e.target.value })}
                    placeholder="Ex: Primme Acesso Matriz"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Separador de Colunas</Label>
                  <Select
                    value={newLayout.separator}
                    onValueChange={(v) => setNewLayout({ ...newLayout, separator: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=";">Ponto e vírgula (;)</SelectItem>
                      <SelectItem value=",">Vírgula (,)</SelectItem>
                      <SelectItem value="\t">Tabulação (Tab)</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Codificação do Arquivo</Label>
                  <Select
                    value={newLayout.encoding}
                    onValueChange={(v) => setNewLayout({ ...newLayout, encoding: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTF-8">UTF-8</SelectItem>
                      <SelectItem value="ISO-8859-1">ISO-8859-1 (Latin1)</SelectItem>
                      <SelectItem value="Windows-1252">Windows-1252</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Formato de Data no Arquivo</Label>
                  <Select
                    value={newLayout.dateFormat}
                    onValueChange={(v) => setNewLayout({ ...newLayout, dateFormat: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dd/MM/yyyy">DD/MM/AAAA</SelectItem>
                      <SelectItem value="ddMMyyyy">DDMMAAAA (sem separador)</SelectItem>
                      <SelectItem value="yyyy-MM-dd">AAAA-MM-DD</SelectItem>
                      <SelectItem value="dd-MM-yyyy">DD-MM-AAAA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Formato de Hora no Arquivo</Label>
                  <Select
                    value={newLayout.timeFormat}
                    onValueChange={(v) => setNewLayout({ ...newLayout, timeFormat: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HH:mm">HH:MM (14:30)</SelectItem>
                      <SelectItem value="HH:mm:ss">HH:MM:SS (14:30:00)</SelectItem>
                      <SelectItem value="HHmm">HHMM (1430)</SelectItem>
                      <SelectItem value="HHmmss">HHMMSS (143000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-3 block">Posição das Colunas (começando em 0)</Label>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Coluna ID Funcionário</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newLayout.employeeIdColumn}
                      onChange={(e) => setNewLayout({ ...newLayout, employeeIdColumn: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Coluna Data</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newLayout.dateColumn}
                      onChange={(e) => setNewLayout({ ...newLayout, dateColumn: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Coluna Hora</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newLayout.timeColumn}
                      onChange={(e) => setNewLayout({ ...newLayout, timeColumn: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Linhas de Cabeçalho</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newLayout.skipHeaderRows}
                      onChange={(e) => setNewLayout({ ...newLayout, skipHeaderRows: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={saveImportLayout} 
                disabled={!newLayout.name || saving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Layout de Importação'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
