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
import { Users as UsersIcon, Shield, Search, UserCog, History, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { SelfieCapture } from '@/components/employees/SelfieCapture';

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
  created_at: string;
  role: 'admin' | 'manager' | 'employee';
}

interface RoleChangeHistory {
  id: string;
  user_id: string;
  changed_by_user_id: string;
  previous_role: 'admin' | 'manager' | 'employee';
  new_role: 'admin' | 'manager' | 'employee';
  changed_at: string;
  notes: string | null;
  user_name?: string;
  changed_by_name?: string;
}

interface Schedule {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  department_id: string | null;
}

const employeeSchema = z.object({
  fullName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
  cpf: z.string().optional(),
  pis: z.string().optional(),
  registration_number: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  department_id: z.string().optional(),
  position_id: z.string().optional(),
  hire_date: z.string().optional(),
  phone: z.string().optional(),
  schedule_id: z.string().optional(),
});

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

export default function Users() {
  const { isAdmin, user, profile: currentProfile, createEmployee } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [history, setHistory] = useState<RoleChangeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Form states for new user registration
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    cpf: '',
    pis: '',
    registration_number: '',
    department: '',
    position: '',
    department_id: '',
    position_id: '',
    hire_date: '',
    phone: '',
    schedule_id: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchHistory();
    fetchFormData();
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

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
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

  const fetchFormData = async () => {
    const [schedulesRes, deptsRes, posRes] = await Promise.all([
      supabase.from('work_schedules').select('id, name'),
      supabase.from('departments').select('id, name').eq('is_active', true).order('name'),
      supabase.from('positions').select('id, name, department_id').eq('is_active', true).order('name')
    ]);
    setSchedules(schedulesRes.data || []);
    setDepartments(deptsRes.data || []);
    setPositions(posRes.data || []);
  };

  const handleDepartmentChange = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    setFormData({
      ...formData,
      department_id: deptId === 'none' ? '' : deptId,
      department: dept?.name || '',
      position_id: '',
      position: ''
    });
  };

  const handlePositionChange = (posId: string) => {
    const pos = positions.find(p => p.id === posId);
    setFormData({
      ...formData,
      position_id: posId === 'none' ? '' : posId,
      position: pos?.name || ''
    });
  };

  const filteredPositions = formData.department_id
    ? positions.filter(p => p.department_id === formData.department_id || !p.department_id)
    : positions;

  const handlePhotoCapture = (blob: Blob) => {
    setPhotoBlob(blob);
    setCapturedImage(URL.createObjectURL(blob));
  };

  const handlePhotoClear = () => {
    setPhotoBlob(null);
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
  };

  const uploadPhoto = async (userId: string): Promise<string | null> => {
    if (!photoBlob) return null;

    const fileName = `${userId}-${Date.now()}.jpg`;
    const filePath = `${currentProfile?.company_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('employee-photos')
      .upload(filePath, photoBlob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading photo:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('employee-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!photoBlob) {
      toast.error('A foto do funcionário é obrigatória');
      return;
    }

    setIsRegistering(true);

    try {
      const validData = employeeSchema.parse(formData);
      
      const { error, user: newUser } = await createEmployee({
        email: validData.email,
        password: validData.password,
        fullName: validData.fullName,
        cpf: formData.cpf || undefined,
        pis: formData.pis || undefined,
        registration_number: formData.registration_number || undefined,
        department: formData.department || undefined,
        position: formData.position || undefined,
        hire_date: formData.hire_date || undefined,
        phone: formData.phone || undefined,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este email já está cadastrado');
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (newUser) {
        const photoUrl = await uploadPhoto(newUser.id);
        
        if (photoUrl) {
          const { data: newProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', newUser.id)
            .maybeSingle();

          if (newProfile) {
            await supabase
              .from('profiles')
              .update({ photo_url: photoUrl })
              .eq('id', newProfile.id);

            if (formData.schedule_id) {
              await supabase.from('employee_schedules').insert({
                profile_id: newProfile.id,
                schedule_id: formData.schedule_id,
                start_date: new Date().toISOString().split('T')[0],
                company_id: currentProfile?.company_id
              });
            }
          }
        }
      }

      toast.success('Usuário cadastrado com sucesso!');
      
      handlePhotoClear();
      setFormData({
        fullName: '',
        email: '',
        password: '',
        cpf: '',
        pis: '',
        registration_number: '',
        department: '',
        position: '',
        department_id: '',
        position_id: '',
        hire_date: '',
        phone: '',
        schedule_id: ''
      });
      
      fetchUsers();

    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error creating user:', error);
        toast.error('Erro ao cadastrar usuário');
      }
    } finally {
      setIsRegistering(false);
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
          new_role: newRole
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
        console.log('Role change notification sent');
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

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.department?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

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
        <div>
          <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie funções e permissões dos usuários do sistema
          </p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <UsersIcon className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Cadastrar
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
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id} className={!user.is_active ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.department || '-'}</TableCell>
                          <TableCell>{user.position || '-'}</TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(value: 'admin' | 'manager' | 'employee') => 
                                handleRoleChange(user.user_id, value)
                              }
                              disabled={updating === user.user_id}
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
                            <Badge variant={user.is_active ? 'default' : 'secondary'}>
                              {user.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={user.is_active ? 'outline' : 'default'}
                              size="sm"
                              onClick={() => handleToggleActive(user.user_id, user.id, user.is_active)}
                              disabled={updating === user.user_id}
                            >
                              {user.is_active ? 'Desativar' : 'Ativar'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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

        <TabsContent value="register">
          <div className="max-w-2xl mx-auto space-y-6">
            <SelfieCapture
              onCapture={handlePhotoCapture}
              capturedImage={capturedImage}
              onClear={handlePhotoClear}
              required
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Cadastrar Novo Usuário
                </CardTitle>
                <CardDescription>
                  Preencha os dados para criar a conta do usuário
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegisterSubmit} className="space-y-6">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                    <p className="text-sm font-medium">Credenciais de Acesso</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Email *</Label>
                        <Input
                          id="reg-email"
                          type="email"
                          placeholder="usuario@empresa.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Senha Inicial *</Label>
                        <Input
                          id="reg-password"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="reg-fullName">Nome Completo *</Label>
                      <Input
                        id="reg-fullName"
                        type="text"
                        placeholder="Nome do usuário"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-cpf">CPF</Label>
                      <Input
                        id="reg-cpf"
                        type="text"
                        placeholder="000.000.000-00"
                        value={formData.cpf}
                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-pis">PIS</Label>
                      <Input
                        id="reg-pis"
                        type="text"
                        placeholder="PIS/PASEP"
                        value={formData.pis}
                        onChange={(e) => setFormData({ ...formData, pis: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-registration">Matrícula</Label>
                      <Input
                        id="reg-registration"
                        type="text"
                        placeholder="Número da matrícula"
                        value={formData.registration_number}
                        onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-phone">Telefone/WhatsApp</Label>
                      <Input
                        id="reg-phone"
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-department">Departamento</Label>
                      <Select
                        value={formData.department_id || 'none'}
                        onValueChange={handleDepartmentChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-position">Cargo</Label>
                      <Select
                        value={formData.position_id || 'none'}
                        onValueChange={handlePositionChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {filteredPositions.map((pos) => (
                            <SelectItem key={pos.id} value={pos.id}>
                              {pos.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-hire-date">Data de Admissão</Label>
                      <Input
                        id="reg-hire-date"
                        type="date"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reg-schedule">Jornada de Trabalho</Label>
                      <Select 
                        value={formData.schedule_id} 
                        onValueChange={(v) => setFormData({ ...formData, schedule_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma jornada" />
                        </SelectTrigger>
                        <SelectContent>
                          {schedules.map((schedule) => (
                            <SelectItem key={schedule.id} value={schedule.id}>
                              {schedule.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      type="submit" 
                      className="gradient-primary"
                      disabled={isRegistering}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {isRegistering ? 'Cadastrando...' : 'Cadastrar Usuário'}
                    </Button>
                  </div>
                </form>
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
    </div>
  );
}
