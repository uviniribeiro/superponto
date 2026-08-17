import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users as UsersIcon, Shield, Search, UserCog, History, Link, Eye, Settings, FileText, Clock, Calendar, Building2, BarChart3, Check } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { SignedAvatarImage } from "@/components/shared/SignedImage";
import { PageHeader } from '@/components/shared/PageHeader';
interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
  created_at: string;
  photo_url: string | null;
  role: 'admin' | 'manager' | 'employee' | 'super_admin';
}

interface RoleChangeHistory {
  id: string;
  user_id: string;
  changed_by_user_id: string;
  previous_role: 'admin' | 'manager' | 'employee' | 'super_admin';
  new_role: 'admin' | 'manager' | 'employee' | 'super_admin';
  changed_at: string;
  notes: string | null;
  user_name?: string;
  changed_by_name?: string;
}

interface EmployeeProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  photo_url: string | null;
}

const roleLabels = {
  admin: 'Administrador',
  manager: 'Gerente',
  employee: 'Funcionário'
};

const roleBadgeVariants = {
  admin: 'destructive' as const,
  manager: 'default' as const,
  employee: 'secondary' as const
};

const rolePermissions = {
  admin: {
    label: 'Administrador',
    description: 'Acesso total ao sistema',
    color: 'bg-red-500',
    permissions: [
      { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { key: 'employees', label: 'Funcionários', icon: UsersIcon },
      { key: 'users', label: 'Gerenciamento de Usuários', icon: UserCog },
      { key: 'timeclock', label: 'Registro de Ponto', icon: Clock },
      { key: 'schedules', label: 'Jornadas de Trabalho', icon: Calendar },
      { key: 'reports', label: 'Relatórios', icon: FileText },
      { key: 'company', label: 'Configurações da Empresa', icon: Building2 },
      { key: 'adjustments', label: 'Solicitações de Ajuste', icon: Settings },
      { key: 'holidays', label: 'Feriados', icon: Calendar },
      { key: 'positions', label: 'Cargos e Departamentos', icon: Building2 },
    ]
  },
  manager: {
    label: 'Gerente',
    description: 'Visualiza equipe e aprova solicitações',
    color: 'bg-blue-500',
    permissions: [
      { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { key: 'employees', label: 'Funcionários (visualização)', icon: UsersIcon },
      { key: 'timeclock', label: 'Registro de Ponto', icon: Clock },
      { key: 'reports', label: 'Relatórios da Equipe', icon: FileText },
      { key: 'adjustments', label: 'Aprovar Solicitações', icon: Settings },
    ]
  },
  employee: {
    label: 'Funcionário',
    description: 'Acesso básico ao próprio registro',
    color: 'bg-gray-500',
    permissions: [
      { key: 'timeclock', label: 'Registro de Ponto', icon: Clock },
      { key: 'myrecords', label: 'Meus Registros', icon: FileText },
      { key: 'adjustments', label: 'Solicitar Ajustes', icon: Settings },
    ]
  }
};

export default function Users() {
  const { isAdmin, user, profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeProfile[]>([]);
  const [history, setHistory] = useState<RoleChangeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Form states for linking existing employee
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [isLinking, setIsLinking] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchHistory();
    fetchAllEmployees();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // Filter out support users (hide from normal user lists)
      const usersWithRoles: UserWithRole[] = (profiles || [])
        .filter(profile => !profile.email.toLowerCase().startsWith('suporte@'))
        .map(profile => ({
          ...profile,
          role: (rolesMap.get(profile.user_id) as 'admin' | 'manager' | 'employee') || 'employee'
        }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllEmployees = async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, department, position, photo_url')
        .order('full_name');
      
      // Filter out support users
      const filteredProfiles = (profiles || []).filter(
        profile => !profile.email.toLowerCase().startsWith('suporte@')
      );
      
      setAllEmployees(filteredProfiles);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data: historyData, error: historyError } = await supabase
        .from('role_change_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100);

      if (historyError) throw historyError;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const historyWithNames: RoleChangeHistory[] = (historyData || []).map(h => ({
        ...h,
        user_name: profilesMap.get(h.user_id) || 'Usuário desconhecido',
        changed_by_name: profilesMap.get(h.changed_by_user_id) || 'Sistema'
      }));

      setHistory(historyWithNames);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'manager' | 'employee') => {
    const currentUser = users.find(u => u.user_id === userId);
    if (!currentUser || currentUser.role === newRole) return;

    setUpdating(userId);
    try {
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Log the change
      const { error: historyError } = await supabase
        .from('role_change_history')
        .insert({
          user_id: userId,
          changed_by_user_id: user?.id,
          previous_role: currentUser.role,
          new_role: newRole,
          company_id: currentProfile?.company_id
        });

      if (historyError) console.error('Error logging role change:', historyError);

      // Send email notification
      try {
        await supabase.functions.invoke('send-role-notification', {
          body: {
            userEmail: currentUser.email,
            userName: currentUser.full_name,
            previousRole: currentUser.role,
            newRole: newRole,
            changedByName: currentProfile?.full_name || 'Administrador'
          }
        });
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }

      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, role: newRole } : u
      ));

      fetchHistory();
      toast.success('Função atualizada com sucesso');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erro ao atualizar função');
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleActive = async (userId: string, profileId: string, currentStatus: boolean) => {
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', profileId);

      if (error) throw error;

      setUsers(prev => prev.map(u => 
        u.id === profileId ? { ...u, is_active: !currentStatus } : u
      ));

      toast.success(currentStatus ? 'Usuário desativado' : 'Usuário ativado');
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Erro ao alterar status do usuário');
    } finally {
      setUpdating(null);
    }
  };

  const handleLinkEmployee = async () => {
    if (!selectedEmployee) {
      toast.error('Selecione um funcionário');
      return;
    }

    const employee = allEmployees.find(e => e.id === selectedEmployee);
    if (!employee) {
      toast.error('Funcionário não encontrado');
      return;
    }

    setIsLinking(true);
    try {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id, role')
        .eq('user_id', employee.user_id)
        .maybeSingle();

      if (existingRole) {
        // Update existing role
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: selectedRole })
          .eq('user_id', employee.user_id);

        if (updateError) throw updateError;

        // Log the change
        await supabase.from('role_change_history').insert({
          user_id: employee.user_id,
          changed_by_user_id: user?.id,
          previous_role: existingRole.role,
          new_role: selectedRole,
          company_id: currentProfile?.company_id
        });

        toast.success(`Nível de acesso de ${employee.full_name} atualizado para ${roleLabels[selectedRole]}`);
      } else {
        // Create new role
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: employee.user_id,
            role: selectedRole
          });

        if (insertError) throw insertError;

        toast.success(`${employee.full_name} agora tem acesso como ${roleLabels[selectedRole]}`);
      }

      // Reset form
      setSelectedEmployee('');
      setSelectedRole('employee');
      
      // Refresh data
      fetchUsers();
      fetchHistory();
    } catch (error) {
      console.error('Error linking employee:', error);
      toast.error('Erro ao vincular acesso');
    } finally {
      setIsLinking(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.department?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const filteredEmployees = allEmployees.filter(emp =>
    emp.full_name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const selectedEmployeeData = allEmployees.find(e => e.id === selectedEmployee);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas administradores podem acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <UserCog className="h-6 w-6 text-primary" />
        </div>
        <PageHeader
          title="Gerenciamento de Usuários"
          description="Gerencie funções e permissões dos usuários do sistema"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <UsersIcon className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <Link className="h-4 w-4" />
            Vincular Acesso
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UsersIcon className="h-5 w-5" />
                    Usuários ({filteredUsers.length})
                  </CardTitle>
                  <CardDescription>
                    Lista de todos os usuários cadastrados no sistema
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuários..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Login</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Nível de Acesso</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((userItem) => (
                        <TableRow key={userItem.id} className={!userItem.is_active ? 'opacity-50' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <SignedAvatarImage src={userItem.photo_url || ''} alt={userItem.full_name} />
                                <AvatarFallback>{userItem.full_name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{userItem.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{userItem.email.split('@')[0]}</TableCell>
                          <TableCell>{userItem.department || '-'}</TableCell>
                          <TableCell>{userItem.position || '-'}</TableCell>
                          <TableCell>
                            <Select
                              value={userItem.role}
                              onValueChange={(value: 'admin' | 'manager' | 'employee') => 
                                handleRoleChange(userItem.user_id, value)
                              }
                              disabled={updating === userItem.user_id}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="destructive" className="text-xs">Admin</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="manager">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="text-xs">Gerente</Badge>
                                  </div>
                                </SelectItem>
                                <SelectItem value="employee">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">Funcionário</Badge>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={userItem.is_active ? 'default' : 'secondary'}>
                              {userItem.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={userItem.is_active ? 'outline' : 'default'}
                              size="sm"
                              onClick={() => handleToggleActive(userItem.user_id, userItem.id, userItem.is_active)}
                              disabled={updating === userItem.user_id}
                            >
                              {userItem.is_active ? 'Desativar' : 'Ativar'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhum usuário encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  Vincular Acesso ao Sistema
                </CardTitle>
                <CardDescription>
                  Selecione um funcionário existente e defina seu nível de acesso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Buscar Funcionário</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Digite o nome ou email..."
                      value={employeeSearchTerm}
                      onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Selecionar Funcionário *</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <SignedAvatarImage src={emp.photo_url || ''} />
                              <AvatarFallback className="text-xs">{emp.full_name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium">{emp.full_name}</span>
                              <span className="text-muted-foreground ml-2 text-sm">{emp.email}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEmployeeData && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <SignedAvatarImage src={selectedEmployeeData.photo_url || ''} />
                        <AvatarFallback>{selectedEmployeeData.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{selectedEmployeeData.full_name}</p>
                        <p className="text-sm text-muted-foreground">{selectedEmployeeData.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedEmployeeData.position || 'Sem cargo'} • {selectedEmployeeData.department || 'Sem departamento'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Nível de Acesso *</Label>
                  <Select value={selectedRole} onValueChange={(v: 'admin' | 'manager' | 'employee') => setSelectedRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span>Administrador</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Gerente</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="employee">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-500" />
                          <span>Funcionário</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleLinkEmployee} 
                  disabled={isLinking || !selectedEmployee}
                  className="w-full gradient-primary"
                >
                  <Link className="mr-2 h-4 w-4" />
                  {isLinking ? 'Vinculando...' : 'Vincular Acesso'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Permissões por Nível
                </CardTitle>
                <CardDescription>
                  Veja o que cada nível de acesso pode visualizar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(rolePermissions).map(([role, info]) => (
                  <div 
                    key={role} 
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedRole === role ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${info.color}`} />
                      <h4 className="font-semibold">{info.label}</h4>
                      {selectedRole === role && (
                        <Badge variant="outline" className="ml-auto">Selecionado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{info.description}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {info.permissions.map((perm) => (
                        <div key={perm.key} className="flex items-center gap-2 text-sm">
                          <Check className="h-3 w-3 text-green-500" />
                          <perm.icon className="h-3 w-3 text-muted-foreground" />
                          <span>{perm.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alterações de Funções
              </CardTitle>
              <CardDescription>
                Registro de todas as alterações de funções realizadas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Usuário Alterado</TableHead>
                        <TableHead>Função Anterior</TableHead>
                        <TableHead>Nova Função</TableHead>
                        <TableHead>Alterado Por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {format(new Date(item.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-medium">{item.user_name}</TableCell>
                          <TableCell>
                            <Badge variant={roleBadgeVariants[item.previous_role]}>
                              {roleLabels[item.previous_role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={roleBadgeVariants[item.new_role]}>
                              {roleLabels[item.new_role]}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.changed_by_name}</TableCell>
                        </TableRow>
                      ))}
                      {history.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhuma alteração registrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <HelpButton pageKey="users" />
    </div>
  );
}
