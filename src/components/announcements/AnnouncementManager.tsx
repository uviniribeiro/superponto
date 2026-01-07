import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, Edit, Megaphone, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  announcement_type: string;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
}

export function AnnouncementManager() {
  const { user, company } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    announcement_type: 'info',
    starts_at: new Date().toISOString().slice(0, 16),
    expires_at: '',
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Erro ao carregar avisos',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setAnnouncements(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o título e a mensagem',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      title: formData.title,
      message: formData.message,
      announcement_type: formData.announcement_type,
      starts_at: formData.starts_at,
      expires_at: formData.expires_at || null,
      company_id: company?.id,
      created_by: user?.id,
    };

    let error;
    
    if (editingId) {
      const { error: updateError } = await supabase
        .from('system_announcements')
        .update(payload)
        .eq('id', editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('system_announcements')
        .insert(payload);
      error = insertError;
    }

    if (error) {
      toast({
        title: 'Erro ao salvar aviso',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: editingId ? 'Aviso atualizado' : 'Aviso criado',
        description: 'O aviso foi salvo com sucesso',
      });
      setDialogOpen(false);
      resetForm();
      fetchAnnouncements();
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      announcement_type: announcement.announcement_type,
      starts_at: announcement.starts_at.slice(0, 16),
      expires_at: announcement.expires_at?.slice(0, 16) || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('system_announcements')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Aviso excluído',
        description: 'O aviso foi removido com sucesso',
      });
      fetchAnnouncements();
    }
  };

  const toggleActive = async (id: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('system_announcements')
      .update({ is_active: !currentValue })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      fetchAnnouncements();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: '',
      message: '',
      announcement_type: 'info',
      starts_at: new Date().toISOString().slice(0, 16),
      expires_at: '',
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'urgent':
        return 'Urgente';
      case 'warning':
        return 'Atenção';
      default:
        return 'Informativo';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Gerenciar Avisos
            </CardTitle>
            <CardDescription>
              Crie avisos que serão exibidos para todos os usuários do sistema
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Aviso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Editar Aviso' : 'Novo Aviso'}
                </DialogTitle>
                <DialogDescription>
                  Este aviso será exibido para todos os usuários ativos
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Aviso de Feriado"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem *</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Ex: Dia 25/12 não haverá expediente devido ao feriado de Natal"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Aviso</Label>
                  <Select
                    value={formData.announcement_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, announcement_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-primary" />
                          Informativo
                        </div>
                      </SelectItem>
                      <SelectItem value="warning">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          Atenção
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          Urgente
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="starts_at">Início</Label>
                    <Input
                      id="starts_at"
                      type="datetime-local"
                      value={formData.starts_at}
                      onChange={(e) => setFormData(prev => ({ ...prev, starts_at: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires_at">Expiração (opcional)</Label>
                    <Input
                      id="expires_at"
                      type="datetime-local"
                      value={formData.expires_at}
                      onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  {editingId ? 'Salvar Alterações' : 'Criar Aviso'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum aviso cadastrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Expiração</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((announcement) => (
                <TableRow key={announcement.id}>
                  <TableCell>
                    <Badge variant={getBadgeVariant(announcement.announcement_type) as any}>
                      <span className="flex items-center gap-1">
                        {getIcon(announcement.announcement_type)}
                        {getTypeLabel(announcement.announcement_type)}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{announcement.title}</TableCell>
                  <TableCell>
                    {format(new Date(announcement.starts_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {announcement.expires_at
                      ? format(new Date(announcement.expires_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={announcement.is_active}
                      onCheckedChange={() => toggleActive(announcement.id, announcement.is_active)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(announcement)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(announcement.id)}
                      >
                        <Trash2 className="h-4 w-4" />
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
  );
}
