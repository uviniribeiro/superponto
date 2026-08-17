import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Users, Search, Edit, UserCheck, UserX, UserPlus, Key, Upload, Camera, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format } from 'date-fns';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { CsvImportDialog } from '@/components/employees/CsvImportDialog';
import { PhotoCapture } from '@/components/employees/PhotoCapture';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { validateCPF, validatePIS, formatCPF, formatPIS } from '@/lib/validators';

import { resolveStorageUrl } from "@/lib/storageUrl";
import { PageHeader } from '@/components/shared/PageHeader';
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
  photo_url: string | null;
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
  const { isAdmin, profile } = useAuth();
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
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  // Reactivation dialog state
  const [isReactivationDialogOpen, setIsReactivationDialogOpen] = useState(false);
  const [employeeToReactivate, setEmployeeToReactivate] = useState<Employee | null>(null);
  const [useNewRegistration, setUseNewRegistration] = useState(false);
  const [newRegistrationNumber, setNewRegistrationNumber] = useState('');
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
    schedule_id: '',
    is_active: true
  });

  useEffect(() => {
    fetchEmployees();
    fetchSchedules();
    fetchDepartmentsAndPositions();
  }, []);

  const fetchEmployees = async () => {
    try {
      // Filter out system users (suporte, admin) - they are access users only, not employees
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or('is_system_user.is.null,is_system_user.eq.false')
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

  const handlePhotoCapture = (blob: Blob) => {
    setPhotoBlob(blob);
    setCapturedImage(URL.createObjectURL(blob));
  };

  const handlePhotoClear = () => {
    setPhotoBlob(null);
    if (capturedImage && !capturedImage.startsWith('http')) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
  };

  const uploadPhoto = async (employeeId: string): Promise<string | null> => {
    if (!photoBlob) return null;

    const fileName = `${employeeId}-${Date.now()}.jpg`;
    const filePath = `${profile?.company_id}/${fileName}`;

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

  const handleSave = async () => {
    try {
      const validData = employeeSchema.parse(formData);

      if (editingEmployee) {
        // Upload new photo if provided
        let photoUrl = editingEmployee.photo_url;
        if (photoBlob) {
          const newPhotoUrl = await uploadPhoto(editingEmployee.id);
          if (newPhotoUrl) {
            photoUrl = newPhotoUrl;
          }
        }

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
            photo_url: photoUrl,
            is_active: formData.is_active,
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
    // If reactivating an inactive employee, show the reactivation dialog
    if (!employee.is_active) {
      setEmployeeToReactivate(employee);
      setUseNewRegistration(false);
      setNewRegistrationNumber('');
      setIsReactivationDialogOpen(true);
      return;
    }
    
    // If deactivating, proceed directly
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', employee.id);

      if (error) throw error;
      toast.success('Funcionário desativado');
      fetchEmployees();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleReactivateEmployee = async () => {
    if (!employeeToReactivate) return;
    
    try {
      const updateData: { is_active: boolean; registration_number?: string } = { is_active: true };
      
      // If user chose to use a new registration number
      if (useNewRegistration && newRegistrationNumber.trim()) {
        updateData.registration_number = newRegistrationNumber.trim();
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', employeeToReactivate.id);

      if (error) throw error;
      
      toast.success('Funcionário reativado com sucesso!');
      setIsReactivationDialogOpen(false);
      setEmployeeToReactivate(null);
      setUseNewRegistration(false);
      setNewRegistrationNumber('');
      fetchEmployees();
    } catch (error) {
      console.error('Error reactivating employee:', error);
      toast.error('Erro ao reativar funcionário');
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
      schedule_id: '',
      is_active: true
    });
    setEditingEmployee(null);
    handlePhotoClear();
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    // Find matching department and position IDs based on names
    const matchingDept = departments.find(d => d.name === employee.department);
    const matchingPos = allPositions.find(p => p.name === employee.position);
    
    // Set existing photo if available
    if (employee.photo_url) {
      setCapturedImage(null);
      resolveStorageUrl(employee.photo_url).then((url) => setCapturedImage(url));
    } else {
      setCapturedImage(null);
    }
    setPhotoBlob(null);
    
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
      schedule_id: '',
      is_active: employee.is_active
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
      const { error } = await supabase.functions.invoke('admin-change-password', {
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

  // Unified filter: searches by name, registration number, email, department, and status
  const filteredEmployees = employees.filter(emp => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    
    // Check status keywords
    if (term === 'ativo' || term === 'ativos') return emp.is_active;
    if (term === 'inativo' || term === 'inativos') return !emp.is_active;
    
    // Search across multiple fields
    return (
      emp.full_name.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term) ||
      emp.department?.toLowerCase().includes(term) ||
      emp.position?.toLowerCase().includes(term) ||
      emp.registration_number?.toLowerCase().includes(term) ||
      emp.cpf?.includes(term) ||
      emp.pis?.includes(term)
    );
  });

  // Calculate statistics
  const activeCount = employees.filter(e => e.is_active).length;
  const inactiveCount = employees.filter(e => !e.is_active).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Funcionários"
          description="Gerencie o cadastro de colaboradores" icon={Users}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
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

      {/* Employee Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{employees.length}</p>
              <p className="text-xs text-muted-foreground">Total Cadastrados</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-success/10">
              <UserCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Ativos (Licenças)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted">
              <UserX className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inactiveCount}</p>
              <p className="text-xs text-muted-foreground">Inativos</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Lista de Funcionários</CardTitle>
              <CardDescription>
                {filteredEmployees.length} de {employees.length} funcionários 
                {searchTerm && ` • Filtrando por: "${searchTerm}"`}
              </CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, matrícula, CPF, status..."
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
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do funcionário
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Photo Section */}
              <PhotoCapture
                onCapture={handlePhotoCapture}
                capturedImage={capturedImage}
                onClear={handlePhotoClear}
              />

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
                  <Label className="flex items-center gap-2">
                    CPF *
                    {formData.cpf && (
                      validateCPF(formData.cpf).valid ? 
                        <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                  </Label>
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    className={formData.cpf && !validateCPF(formData.cpf).valid ? 'border-red-500' : ''}
                    required
                  />
                  {formData.cpf && !validateCPF(formData.cpf).valid && (
                    <p className="text-xs text-red-500">{validateCPF(formData.cpf).message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    PIS *
                    {formData.pis && (
                      validatePIS(formData.pis).valid ? 
                        <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                  </Label>
                  <Input
                    value={formData.pis}
                    onChange={(e) => setFormData({ ...formData, pis: e.target.value })}
                    placeholder="000.00000.00-0"
                    className={formData.pis && !validatePIS(formData.pis).valid ? 'border-red-500' : ''}
                    required
                  />
                  {formData.pis && !validatePIS(formData.pis).valid && (
                    <p className="text-xs text-red-500">{validatePIS(formData.pis).message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Matrícula *</Label>
                  <Input
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    required
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
                  <Label>Data de Admissão *</Label>
                  <Input
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    required
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
                
                {/* Status field */}
                <div className="space-y-2 col-span-2">
                  <Label>Status do Funcionário</Label>
                  <Select 
                    value={formData.is_active ? 'active' : 'inactive'} 
                    onValueChange={(v) => setFormData({ ...formData, is_active: v === 'active' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-green-500" />
                          Ativo
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center gap-2">
                          <UserX className="h-4 w-4 text-red-500" />
                          Inativo (Demitido)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ScrollArea>

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

      {/* Reactivation Dialog */}
      <Dialog open={isReactivationDialogOpen} onOpenChange={setIsReactivationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reativar Funcionário</DialogTitle>
            <DialogDescription>
              Deseja reativar o funcionário <strong>{employeeToReactivate?.full_name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Matrícula atual: <strong>{employeeToReactivate?.registration_number || 'Não definida'}</strong>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Deseja utilizar a mesma matrícula?</p>
              <div className="flex gap-3">
                <Button
                  variant={!useNewRegistration ? 'default' : 'outline'}
                  onClick={() => setUseNewRegistration(false)}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Sim, manter matrícula
                </Button>
                <Button
                  variant={useNewRegistration ? 'default' : 'outline'}
                  onClick={() => setUseNewRegistration(true)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Não, nova matrícula
                </Button>
              </div>
            </div>

            {useNewRegistration && (
              <div className="space-y-2">
                <Label>Nova Matrícula *</Label>
                <Input
                  value={newRegistrationNumber}
                  onChange={(e) => setNewRegistrationNumber(e.target.value)}
                  placeholder="Digite a nova matrícula"
                  autoFocus
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsReactivationDialogOpen(false);
              setEmployeeToReactivate(null);
              setUseNewRegistration(false);
              setNewRegistrationNumber('');
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleReactivateEmployee}
              disabled={useNewRegistration && !newRegistrationNumber.trim()}
              className="gradient-primary"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Reativar Funcionário
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
      
      <HelpButton pageKey="employees" />
    </div>
  );
}