import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Eye, EyeOff, Pencil, Plus, Shield, Trash2, UserCheck, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  SUPER_ADMIN_MIN_PASSWORD,
  deactivationBlockReason,
  normalizeEmail,
  removalBlockReason,
  validateEmail,
  validateFullName,
  validatePassword,
} from '../../../supabase/functions/_shared/superAdminRules';

interface SuperAdminUser {
  user_id: string;
  profile_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

type Action =
  | { action: 'list' }
  | { action: 'create'; email: string; password: string; fullName: string }
  | { action: 'promote'; email: string }
  | { action: 'update'; userId: string; fullName?: string; isActive?: boolean }
  | { action: 'remove'; userId: string };

async function callManageSuperAdmin<T = { success: boolean; message?: string }>(body: Action): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-super-admin', { body });
  if (error) {
    // FunctionsHttpError carrega a resposta JSON com a mensagem do servidor
    const context = (error as { context?: Response }).context;
    const payload = context ? await context.json().catch(() => null) : null;
    throw new Error(payload?.error || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

const firstError = (...errors: (string | null)[]) => errors.find(Boolean) ?? null;

export default function SuperAdminUsers() {
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  const [superAdmins, setSuperAdmins] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '' });

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState('');

  const [editing, setEditing] = useState<SuperAdminUser | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', isActive: true });

  const [removing, setRemoving] = useState<SuperAdminUser | null>(null);

  const fetchSuperAdmins = async () => {
    try {
      const result = await callManageSuperAdmin<{ data: SuperAdminUser[] }>({ action: 'list' });
      setSuperAdmins(result.data || []);
    } catch (error) {
      console.error('Error fetching super admins:', error);
      toast.error('Erro ao carregar super administradores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuperAdmins();
  }, []);

  const run = async (body: Action, success: string, onDone: () => void) => {
    setBusy(true);
    try {
      const result = await callManageSuperAdmin(body);
      toast.success(result.message || success);
      onDone();
      await fetchSuperAdmins();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operação não concluída');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () => {
    const email = normalizeEmail(createForm.email);
    const problem = firstError(
      validateFullName(createForm.fullName),
      validateEmail(email),
      validatePassword(createForm.password)
    );
    if (problem) return toast.error(problem);
    run(
      { action: 'create', email, password: createForm.password, fullName: createForm.fullName.trim() },
      'Super administrador criado',
      () => {
        setCreateOpen(false);
        setCreateForm({ email: '', password: '', fullName: '' });
      }
    );
  };

  const handlePromote = () => {
    const email = normalizeEmail(promoteEmail);
    const problem = validateEmail(email);
    if (problem) return toast.error(problem);
    run({ action: 'promote', email }, 'Conta promovida a super admin', () => {
      setPromoteOpen(false);
      setPromoteEmail('');
    });
  };

  const openEdit = (admin: SuperAdminUser) => {
    setEditing(admin);
    setEditForm({ fullName: admin.full_name, isActive: admin.is_active });
  };

  const handleEdit = () => {
    if (!editing) return;
    const changes: { fullName?: string; isActive?: boolean } = {};
    if (editForm.fullName.trim() !== editing.full_name) {
      const problem = validateFullName(editForm.fullName);
      if (problem) return toast.error(problem);
      changes.fullName = editForm.fullName.trim();
    }
    if (editForm.isActive !== editing.is_active) {
      if (!editForm.isActive) {
        const problem = deactivationBlockReason(superAdmins, currentUserId, editing.user_id);
        if (problem) return toast.error(problem);
      }
      changes.isActive = editForm.isActive;
    }
    if (Object.keys(changes).length === 0) {
      setEditing(null);
      return;
    }
    run({ action: 'update', userId: editing.user_id, ...changes }, 'Super admin atualizado', () => setEditing(null));
  };

  const handleRemove = () => {
    if (!removing) return;
    run({ action: 'remove', userId: removing.user_id }, 'Permissão removida', () => setRemoving(null));
  };

  const editDeactivationBlock = editing
    ? deactivationBlockReason(superAdmins, currentUserId, editing.user_id)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Super Administradores"
          description="Gerencie os usuários com acesso total ao sistema"
          icon={Shield}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setPromoteOpen(true)}>
            <UserCheck className="h-4 w-4 mr-2" />
            Promover usuário existente
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Novo Super Admin
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Super Administradores ({superAdmins.length})
          </CardTitle>
          <CardDescription>
            E-mails de contas existentes são protegidos e não podem ser alterados aqui.
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
            <div className="overflow-x-auto">
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
                  {superAdmins.map((admin) => {
                    const removeBlock = removalBlockReason(superAdmins, currentUserId, admin.user_id);
                    return (
                      <TableRow key={admin.user_id}>
                        <TableCell className="font-medium">
                          {admin.full_name}
                          {admin.user_id === currentUserId && (
                            <Badge variant="outline" className="ml-2">Você</Badge>
                          )}
                        </TableCell>
                        <TableCell>{admin.email}</TableCell>
                        <TableCell>
                          <Badge variant={admin.is_active ? 'default' : 'secondary'}>
                            {admin.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {admin.created_at
                            ? format(new Date(admin.created_at), 'dd/MM/yyyy', { locale: ptBR })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(admin)}
                            title="Editar"
                            aria-label={`Editar ${admin.full_name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoving(admin)}
                            className="text-destructive hover:text-destructive"
                            disabled={!!removeBlock}
                            title={removeBlock ?? 'Remover permissão'}
                            aria-label={`Remover permissão de ${admin.full_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Criar */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Super Administrador</DialogTitle>
            <DialogDescription>
              Cria uma conta nova com acesso total. Para dar acesso a uma conta que já existe, use
              “Promover usuário existente”.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sa-fullName">Nome Completo *</Label>
              <Input
                id="sa-fullName"
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                placeholder="Nome do administrador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sa-email">Email *</Label>
              <Input
                id="sa-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="admin@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sa-password">Senha *</Label>
              <div className="relative">
                <Input
                  id="sa-password"
                  type={showPassword ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder={`Mínimo ${SUPER_ADMIN_MIN_PASSWORD} caracteres`}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Combine ao menos 3 tipos: minúsculas, maiúsculas, números e símbolos.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={busy}>
              {busy ? 'Criando...' : 'Criar Super Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promover */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promover usuário existente</DialogTitle>
            <DialogDescription>
              Concede acesso de super admin a uma conta já cadastrada. E-mail, senha e empresa da conta
              não são alterados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="sa-promote-email">Email da conta *</Label>
            <Input
              id="sa-promote-email"
              type="email"
              value={promoteEmail}
              onChange={(e) => setPromoteEmail(e.target.value)}
              placeholder="usuario@empresa.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteOpen(false)}>Cancelar</Button>
            <Button onClick={handlePromote} disabled={busy}>
              {busy ? 'Promovendo...' : 'Promover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Super Admin</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sa-edit-name">Nome Completo</Label>
              <Input
                id="sa-edit-name"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="sa-edit-active">Conta ativa</Label>
                {editDeactivationBlock && editForm.isActive && (
                  <p className="text-xs text-muted-foreground">{editDeactivationBlock}</p>
                )}
              </div>
              <Switch
                id="sa-edit-active"
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                disabled={editForm.isActive && !!editDeactivationBlock}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={busy}>
              {busy ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remover */}
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover permissão de super admin?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.full_name} perde o acesso de super admin. A conta e a senha são mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
