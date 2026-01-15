import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { User, Briefcase, FileText, Key, X, Save, Upload } from 'lucide-react';
import { formatCPF, formatPIS } from '@/lib/validators';

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: any;
  onSuccess: () => void;
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

interface WorkSchedule {
  id: string;
  name: string;
}

export function EmployeeFormDialog({ open, onOpenChange, employee, onSuccess }: EmployeeFormDialogProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('pessoal');
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);

  // Form data organized by tabs
  const [formData, setFormData] = useState({
    // Pessoal
    full_name: '',
    birth_date: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    // Profissional
    registration_number: '',
    department_id: '',
    department: '',
    position_id: '',
    position: '',
    schedule_id: '',
    hire_date: '',
    termination_date: '',
    cost_center: '',
    status: 'active',
    // Documentos
    cpf: '',
    pis: '',
    rg: '',
    ctps_number: '',
    ctps_series: '',
    // Acesso
    card_number: '',
    pin_code: '',
  });

  useEffect(() => {
    if (open) {
      fetchOptions();
      if (employee) {
        setFormData({
          full_name: employee.full_name || '',
          birth_date: employee.birth_date || '',
          gender: employee.gender || '',
          phone: employee.phone || '',
          email: employee.email || '',
          address: employee.address || '',
          registration_number: employee.registration_number || '',
          department_id: employee.department_id || '',
          department: employee.department || '',
          position_id: employee.position_id || '',
          position: employee.position || '',
          schedule_id: '',
          hire_date: employee.hire_date || '',
          termination_date: employee.termination_date || '',
          cost_center: employee.cost_center || '',
          status: employee.is_active ? 'active' : 'inactive',
          cpf: employee.cpf || '',
          pis: employee.pis || '',
          rg: employee.rg || '',
          ctps_number: employee.ctps_number || '',
          ctps_series: employee.ctps_series || '',
          card_number: employee.card_number || '',
          pin_code: employee.pin_code || '',
        });
      } else {
        resetForm();
      }
    }
  }, [open, employee]);

  const fetchOptions = async () => {
    const [deptRes, posRes, schedRes] = await Promise.all([
      supabase.from('departments').select('id, name').eq('is_active', true).order('name'),
      supabase.from('positions').select('id, name, department_id').eq('is_active', true).order('name'),
      supabase.from('work_schedules').select('id, name').order('name'),
    ]);

    setDepartments(deptRes.data || []);
    setPositions(posRes.data || []);
    setSchedules(schedRes.data || []);
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      birth_date: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      registration_number: '',
      department_id: '',
      department: '',
      position_id: '',
      position: '',
      schedule_id: '',
      hire_date: '',
      termination_date: '',
      cost_center: '',
      status: 'active',
      cpf: '',
      pis: '',
      rg: '',
      ctps_number: '',
      ctps_series: '',
      card_number: '',
      pin_code: '',
    });
    setActiveTab('pessoal');
  };

  const handleDepartmentChange = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    setFormData(prev => ({
      ...prev,
      department_id: deptId === 'none' ? '' : deptId,
      department: dept?.name || '',
      position_id: '',
      position: '',
    }));
  };

  const handlePositionChange = (posId: string) => {
    const pos = positions.find(p => p.id === posId);
    setFormData(prev => ({
      ...prev,
      position_id: posId === 'none' ? '' : posId,
      position: pos?.name || '',
    }));
  };

  const filteredPositions = formData.department_id
    ? positions.filter(p => p.department_id === formData.department_id || !p.department_id)
    : positions;

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      toast.error('Nome completo é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        full_name: formData.full_name.trim(),
        email: formData.email || null,
        phone: formData.phone || null,
        cpf: formData.cpf || null,
        pis: formData.pis || null,
        registration_number: formData.registration_number || null,
        department: formData.department || null,
        position: formData.position || null,
        hire_date: formData.hire_date || null,
        is_active: formData.status === 'active',
      };

      if (employee) {
        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', employee.id);

        if (error) throw error;
        toast.success('Funcionário atualizado!');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Erro ao salvar funcionário');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header with Avatar */}
        <div className="p-6 pb-4 bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                  {formData.full_name ? getInitials(formData.full_name) : 'FN'}
                </AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Upload className="h-3 w-3" />
              </button>
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {employee ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Preencha os dados do colaborador
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 border-b">
            <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-0">
              <TabsTrigger 
                value="pessoal"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
              >
                <User className="w-4 h-4 mr-2" />
                Pessoal
              </TabsTrigger>
              <TabsTrigger 
                value="profissional"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Profissional
              </TabsTrigger>
              <TabsTrigger 
                value="documentos"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
              >
                <FileText className="w-4 h-4 mr-2" />
                Documentos
              </TabsTrigger>
              <TabsTrigger 
                value="acesso"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
              >
                <Key className="w-4 h-4 mr-2" />
                Acesso
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            {/* Dados Pessoais */}
            <TabsContent value="pessoal" className="m-0 space-y-4">
              <h3 className="font-medium mb-4">Dados Pessoais</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Nome completo do funcionário"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gênero</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(v) => setFormData({ ...formData, gender: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Endereço completo"
                />
              </div>
            </TabsContent>

            {/* Dados Profissionais */}
            <TabsContent value="profissional" className="m-0 space-y-4">
              <h3 className="font-medium mb-4">Dados Profissionais</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matrícula *</Label>
                  <Input
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    placeholder="Número da matrícula"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select
                    value={formData.department_id}
                    onValueChange={handleDepartmentChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select
                    value={formData.position_id}
                    onValueChange={handlePositionChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {filteredPositions.map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Escala de Trabalho</Label>
                  <Select
                    value={formData.schedule_id}
                    onValueChange={(v) => setFormData({ ...formData, schedule_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a escala" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {schedules.map((sch) => (
                        <SelectItem key={sch.id} value={sch.id}>{sch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Admissão *</Label>
                  <Input
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Demissão</Label>
                  <Input
                    type="date"
                    value={formData.termination_date}
                    onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Centro de Custo</Label>
                  <Input
                    value={formData.cost_center}
                    onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                    placeholder="Centro de custo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Documentos */}
            <TabsContent value="documentos" className="m-0 space-y-4">
              <h3 className="font-medium mb-4">Documentos</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PIS/PASEP *</Label>
                  <Input
                    value={formData.pis}
                    onChange={(e) => setFormData({ ...formData, pis: formatPIS(e.target.value) })}
                    placeholder="000.00000.00-0"
                    maxLength={14}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input
                    value={formData.rg}
                    onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                    placeholder="Número do RG"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CTPS - Número</Label>
                  <Input
                    value={formData.ctps_number}
                    onChange={(e) => setFormData({ ...formData, ctps_number: e.target.value })}
                    placeholder="Número da CTPS"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CTPS - Série</Label>
                <Input
                  value={formData.ctps_series}
                  onChange={(e) => setFormData({ ...formData, ctps_series: e.target.value })}
                  placeholder="Série da CTPS"
                  className="max-w-xs"
                />
              </div>
            </TabsContent>

            {/* Acesso */}
            <TabsContent value="acesso" className="m-0 space-y-4">
              <h3 className="font-medium mb-4">Dados de Acesso (Ponto)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número do Cartão</Label>
                  <Input
                    value={formData.card_number}
                    onChange={(e) => setFormData({ ...formData, card_number: e.target.value })}
                    placeholder="Número do cartão de proximidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código PIN</Label>
                  <Input
                    value={formData.pin_code}
                    onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                    placeholder="Código de acesso"
                    type="password"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                O cadastro biométrico deve ser realizado diretamente no equipamento REP ou através do software de coleta.
              </p>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
