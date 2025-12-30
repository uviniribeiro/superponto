import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Users, Search, Edit, UserCheck, UserX, UserPlus, Key, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { CsvImportDialog } from '@/components/employees/CsvImportDialog';

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  cpf: string | null;
  pis: string | null;
  registration_number: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  phone: string | null;
  is_active: boolean;
}

interface Schedule {
  id: string;
  name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface PositionOption {
  id: string;
  name: string;
  department_id: string | null;
}

const employeeSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  cpf: z.string().optional(),
  pis: z.string().optional(),
  registration_number: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  hire_date: z.string().optional(),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirmação deve ter pelo menos 6 caracteres'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export default function Employees() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [allPositions, setAllPositions] = useState<PositionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState<Employee | null>(null);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
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
    fetchEmployees();
    fetchSchedules();
    fetchDepartmentsAndPositions();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    const { data } = await supabase.from('work_schedules').select('id, name');
    setSchedules(data || []);
  };

  const fetchDepartmentsAndPositions = async () => {
    const [deptsRes, posRes] = await Promise.all([
      supabase.from('departments').select('id, name').eq('is_active', true).order('name'),
      supabase.from('positions').select('id, name, department_id').eq('is_active', true).order('name')
    ]);
    setDepartments(deptsRes.data || []);
    setAllPositions(posRes.data || []);
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
    const pos = allPositions.find(p => p.id === posId);
    setFormData({
      ...formData,
      position_id: posId === 'none' ? '' : posId,
      position: pos?.name || ''
    });
  };

  const filteredPositions = formData.department_id
    ? allPositions.filter(p => p.department_id === formData.department_id || !p.department_id)
    : allPositions;

  const handleSave = async () => {
    try {
      const validData = employeeSchema.parse(formData);

      if (editingEmployee) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: validData.full_name,
            email: validData.email,
            cpf: formData.cpf || null,
            pis: formData.pis || null,
            registration_number: formData.registration_number || null,
            department: formData.department || null,
            position: formData.position || null,
            hire_date: formData.hire_date || null,
            phone: formData.phone || null,
          })
          .eq('id', editingEmployee.id);

        if (error) throw error;

        // Update schedule if selected
        if (formData.schedule_id) {
          await supabase
            .from('employee_schedules')
            .upsert({
              profile_id: editingEmployee.id,
              schedule_id: formData.schedule_id,
              start_date: new Date().toISOString().split('T')[0]
            }, { onConflict: 'profile_id,schedule_id,start_date' });
        }

        toast.success('Funcionário atualizado com sucesso!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error saving employee:', error);
        toast.error('Erro ao salvar funcionário');
      }
    }
  };

  const toggleEmployeeStatus = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id);

      if (error) throw error;
      toast.success(employee.is_active ? 'Funcionário desativado' : 'Funcionário ativado');
      fetchEmployees();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
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
    setEditingEmployee(null);
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    // Find matching department and position IDs based on names
    const matchingDept = departments.find(d => d.name === employee.department);
    const matchingPos = allPositions.find(p => p.name === employee.position);
    
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      cpf: employee.cpf || '',
      pis: employee.pis || '',
      registration_number: employee.registration_number || '',
      department: employee.department || '',
      position: employee.position || '',
      department_id: matchingDept?.id || '',
      position_id: matchingPos?.id || '',
      hire_date: employee.hire_date || '',
      phone: employee.phone || '',
      schedule_id: ''
    });
    setIsDialogOpen(true);
  };

  const openPasswordDialog = (employee: Employee) => {
    setSelectedEmployeeForPassword(employee);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setIsPasswordDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!selectedEmployeeForPassword) return;

    try {
      const validData = passwordSchema.parse(passwordData);
      setChangingPassword(true);

      // Call edge function to change user password
      const { error } = await supabaseClient.functions.invoke('admin-change-password', {
        body: {
          userId: selectedEmployeeForPassword.user_id,
          newPassword: validData.newPassword
        }
      });

      if (error) throw error;

      toast.success('Senha alterada com sucesso!');
      setIsPasswordDialogOpen(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setSelectedEmployeeForPassword(null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error changing password:', error);
        toast.error('Erro ao alterar senha');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Funcionários
          </h1>
          <p className="text-muted-foreground">Gerencie o cadastro de colaboradores</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCsvDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
            <Button onClick={() => navigate('/employees/register')} className="gradient-primary">
              <UserPlus className="h-4 w-4 mr-2" />
              Cadastrar Funcionário
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Lista de Funcionários</CardTitle>
              <CardDescription>{employees.length} funcionários cadastrados</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar funcionário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse-soft">Carregando...</div>
            </div>
          ) : filteredEmployees.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.full_name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{(employee as any).phone || '-'}</TableCell>
                      <TableCell>{employee.department || '-'}</TableCell>
                      <TableCell>{employee.position || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                          {employee.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(employee)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openPasswordDialog(employee)}
                                title="Alterar Senha"
                              >
                                <Key className="h-4 w-4 text-warning" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleEmployeeStatus(employee)}
                                title={employee.is_active ? 'Desativar' : 'Ativar'}
                              >
                                {employee.is_active ? (
                                  <UserX className="h-4 w-4 text-destructive" />
                                ) : (
                                  <UserCheck className="h-4 w-4 text-success" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum funcionário encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do funcionário
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>PIS</Label>
              <Input
                value={formData.pis}
                onChange={(e) => setFormData({ ...formData, pis: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
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
              <Label>Cargo</Label>
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
              <Label>Data de Admissão</Label>
              <Input
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone/WhatsApp</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Jornada de Trabalho</Label>
              <Select value={formData.schedule_id} onValueChange={(v) => setFormData({ ...formData, schedule_id: v })}>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Alterar senha de {selectedEmployeeForPassword?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Nova Senha</Label>
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword}
              className="gradient-primary"
            >
              {changingPassword ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={isCsvDialogOpen}
        onOpenChange={setIsCsvDialogOpen}
        onImportComplete={fetchEmployees}
      />
    </div>
  );
}