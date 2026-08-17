import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, Eye, EyeOff, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';

interface SuperAdminUser {
  user_id: string;
  profile_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export default function SuperAdminUsers() {
  const [superAdmins, setSuperAdmins] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  useEffect(() => {
    fetchSuperAdmins();
  }, []);

  const fetchSuperAdmins = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-super-admin', {
        body: { action: 'list' }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setSuperAdmins(data.data || []);
    } catch (error) {
      console.error('Error fetching super admins:', error);
      toast.error('Erro ao carregar super administradores');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuperAdmin = async () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-super-admin', {
        body: {
          action: 'create',
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Super administrador criado com sucesso!');
      setIsDialogOpen(false);
      setFormData({ email: '', password: '', fullName: '' });
      fetchSuperAdmins();
    } catch (error: any) {
      console.error('Error creating super admin:', error);
      toast.error(error.message || 'Erro ao criar super administrador');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveSuperAdmin = async (userId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover ${name} como super administrador?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-super-admin', {
        body: {
          action: 'remove',
          userId
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success('Permissão de super admin removida');
      fetchSuperAdmins();
    } catch (error: any) {
      console.error('Error removing super admin:', error);
      toast.error(error.message || 'Erro ao remover super administrador');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Super Administradores"
          description="Gerencie os usuários com acesso total ao sistema" icon={Shield}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={() => setIsDialogOpen(true)} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Super Admin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Super Administradores ({superAdmins.length})
          </CardTitle>
          <CardDescription>
            Usuários com permissões máximas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : superAdmins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum super administrador cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {superAdmins.map((admin) => (
                  <TableRow key={admin.user_id}>
                    <TableCell className="font-medium">{admin.full_name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <Badge variant={admin.is_active ? 'default' : 'secondary'}>
                        {admin.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(admin.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSuperAdmin(admin.user_id, admin.full_name)}
                        className="text-destructive hover:text-destructive"
                        disabled={superAdmins.length <= 1}
                        title={superAdmins.length <= 1 ? 'Deve haver pelo menos um super admin' : 'Remover permissão'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Super Administrador</DialogTitle>
            <DialogDescription>
              Crie um novo usuário com acesso total ao sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Nome do administrador"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@empresa.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSuperAdmin} disabled={isCreating}>
              {isCreating ? 'Criando...' : 'Criar Super Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
