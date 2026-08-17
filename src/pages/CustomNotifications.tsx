import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Edit, Trash2, Bell, Mail, Smartphone, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

interface CustomNotification {
  id: string;
  name: string;
  description: string | null;
  notification_type: string;
  email_enabled: boolean;
  app_enabled: boolean;
  schedule: string | null;
  is_active: boolean;
  created_at: string;
}

const NOTIFICATION_TYPES = [
  { value: 'pending_approval', label: 'Aprovações Pendentes', description: 'Ajustes e solicitações aguardando aprovação' },
  { value: 'missing_records', label: 'Registros Faltantes', description: 'Servidores sem registro de ponto' },
  { value: 'overtime_alert', label: 'Alerta de Horas Extras', description: 'Limite de horas extras atingido' },
  { value: 'absence_alert', label: 'Alerta de Ausência', description: 'Servidor ausente sem justificativa' },
  { value: 'custom', label: 'Personalizada', description: 'Notificação customizada' }
];

const SCHEDULE_OPTIONS = [
  { value: 'realtime', label: 'Tempo Real' },
  { value: 'daily_8h', label: 'Diário às 8h' },
  { value: 'daily_17h', label: 'Diário às 17h' },
  { value: 'weekly_monday', label: 'Semanal (Segunda)' },
  { value: 'monthly_1', label: 'Mensal (Dia 1)' }
];

export default function CustomNotifications() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<CustomNotification | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    notification_type: 'pending_approval',
    email_enabled: true,
    app_enabled: false,
    schedule: 'realtime'
  });

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['custom-notifications', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_notifications')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CustomNotification[];
    },
    enabled: !!profile?.company_id
  });

  // Fetch notification logs
  const { data: logs = [] } = useQuery({
    queryKey: ['notification-logs', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_logs')
        .select(`
          *,
          profiles:recipient_id(full_name)
        `)
        .eq('company_id', profile?.company_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: profile?.company_id,
        created_by: profile?.id,
        name: formData.name,
        description: formData.description || null,
        notification_type: formData.notification_type,
        email_enabled: formData.email_enabled,
        app_enabled: formData.app_enabled,
        schedule: formData.schedule
      };

      if (editingNotification) {
        const { error } = await supabase
          .from('custom_notifications')
          .update(payload)
          .eq('id', editingNotification.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_notifications')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: editingNotification ? 'Notificação atualizada' : 'Notificação criada' });
      queryClient.invalidateQueries({ queryKey: ['custom-notifications'] });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao salvar notificação', variant: 'destructive' });
    }
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('custom_notifications')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-notifications'] });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: 'Notificação removida' });
      queryClient.invalidateQueries({ queryKey: ['custom-notifications'] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao remover', variant: 'destructive' });
    }
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingNotification(null);
    setFormData({
      name: '',
      description: '',
      notification_type: 'pending_approval',
      email_enabled: true,
      app_enabled: false,
      schedule: 'realtime'
    });
  };

  const handleEdit = (notification: CustomNotification) => {
    setEditingNotification(notification);
    setFormData({
      name: notification.name,
      description: notification.description || '',
      notification_type: notification.notification_type,
      email_enabled: notification.email_enabled,
      app_enabled: notification.app_enabled,
      schedule: notification.schedule || 'realtime'
    });
    setIsDialogOpen(true);
  };

  const getTypeLabel = (type: string) => {
    return NOTIFICATION_TYPES.find(t => t.value === type)?.label || type;
  };

  const getScheduleLabel = (schedule: string | null) => {
    return SCHEDULE_OPTIONS.find(s => s.value === schedule)?.label || schedule || 'Tempo Real';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Enviado</Badge>;
      case 'pending': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'failed': return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'read': return <Badge variant="outline">Lido</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Notificações Customizáveis"
          description="Configure alertas personalizados por e-mail ou aplicativo"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Notificação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingNotification ? 'Editar' : 'Nova'} Notificação</DialogTitle>
              <DialogDescription>
                Configure alertas automáticos para sua equipe
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Notificação *</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Alerta de Aprovações Pendentes"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Notificação</Label>
                <Select 
                  value={formData.notification_type} 
                  onValueChange={(v) => setFormData({ ...formData, notification_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select 
                  value={formData.schedule} 
                  onValueChange={(v) => setFormData({ ...formData, schedule: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <Label>Enviar por E-mail</Label>
                  </div>
                  <Switch 
                    checked={formData.email_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, email_enabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <Label>Enviar para Aplicativo</Label>
                  </div>
                  <Switch 
                    checked={formData.app_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, app_enabled: checked })}
                  />
                </div>
              </div>

              <Button 
                onClick={() => saveMutation.mutate()} 
                disabled={saveMutation.isPending || !formData.name}
                className="mt-4"
              >
                {editingNotification ? 'Atualizar' : 'Criar'} Notificação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Total de Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {notifications.filter(n => n.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Enviados Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {logs.filter(l => l.status === 'sent').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas Configurados</CardTitle>
          <CardDescription>Gerencie suas notificações customizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma notificação configurada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Canais</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell>
                      <Switch 
                        checked={notification.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: notification.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <div>{notification.name}</div>
                        {notification.description && (
                          <div className="text-xs text-muted-foreground">{notification.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(notification.notification_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {notification.email_enabled && (
                          <Badge variant="secondary"><Mail className="h-3 w-3" /></Badge>
                        )}
                        {notification.app_enabled && (
                          <Badge variant="secondary"><Smartphone className="h-3 w-3" /></Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getScheduleLabel(notification.schedule)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(notification)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (confirm('Confirma a remoção?')) {
                              deleteMutation.mutate(notification.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Envios</CardTitle>
            <CardDescription>Últimas 50 notificações enviadas</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 10).map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{log.profiles?.full_name || 'N/A'}</TableCell>
                    <TableCell>{getTypeLabel(log.notification_type)}</TableCell>
                    <TableCell>
                      {log.channel === 'email' ? <Mail className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
