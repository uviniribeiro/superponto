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
import { User, Briefcase, FileText, Key, X, Save, Upload, ListPlus, Settings2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { EXTRA_FIELDS, FIELD_GROUPS, MODEL_LABEL, visibleFields, type FormConfig, type FormModel } from '@/lib/employeeFormFields';
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
  const { profile, isAdmin } = useAuth();
  const [formCfg, setFormCfg] = useState<FormConfig>({ model: 'padrao' });
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgDraft, setCfgDraft] = useState<FormConfig>({ model: 'padrao' });
  // Campos que já têm lugar nas abas principais (guardados nos dados complementares)
  const MAIN_EXTRA = ['gender', 'address', 'rg', 'ctps_number', 'ctps_series'];
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
    if (!open || !profile?.company_id) return;
    (supabase as any).from('companies').select('employee_form').eq('id', profile.company_id).maybeSingle()
      .then(({ data }: any) => data?.employee_form && setFormCfg(data.employee_form));
    if (employee?.id) {
      (supabase as any).from('profiles').select('extra_data').eq('id', employee.id).maybeSingle()
        .then(({ data }: any) => {
          const x = (data?.extra_data ?? {}) as Record<string, string>;
          setExtra(x);
          setFormData((prev) => ({ ...prev, gender: x.gender ?? prev.gender, address: x.address ?? prev.address, rg: x.rg ?? prev.rg, ctps_number: x.ctps_number ?? prev.ctps_number, ctps_series: x.ctps_series ?? prev.ctps_series }));
        });
    } else setExtra({});
  }, [open, employee?.id, profile?.company_id]);

  const fields = visibleFields(formCfg);

  const saveCfg = async () => {
    const { error } = await (supabase as any).from('companies').update({ employee_form: cfgDraft }).eq('id', profile?.company_id);
    if (error) return toast.error('Não foi possível salvar o modelo do cadastro.');
    setFormCfg(cfgDraft);
    setCfgOpen(false);
    toast.success('Modelo do cadastro atualizado para a empresa.');
  };

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

    const missing = fields.filter((f) => f.required && !(f.key in formData ? (formData as any)[f.key] : extra[f.key])?.toString().trim());
    if (missing.length) {
      setActiveTab('complementar');
      toast.error(`Preencha: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const extraData: Record<string, string> = {};
      for (const [k, v] of Object.entries({ ...extra, gender: formData.gender, address: formData.address, rg: formData.rg, ctps_number: formData.ctps_number, ctps_series: formData.ctps_series })) {
        if (v != null && String(v).trim()) extraData[k] = String(v).trim();
      }
      const updateData = {
        extra_data: extraData,
        full_name: formData.full_name.trim(),
        email: formData.email || null,
        phone: formData.phone || null,
        cpf: formData.cpf || null,
        pis: formData.pis || null,
        registration_number: formData.registration_number || null,
        department: formData.department || null,
        position: formData.position || null,
        hire_date: formData.hire_date || null,
        birth_date: formData.birth_date || null,
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
                value="complementar"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
              >
                <ListPlus className="w-4 h-4 mr-2" />
                Complementar
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
            <TabsContent value="complementar" className="m-0 max-h-[55vh] space-y-5 overflow-y-auto pr-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Modelo da empresa: <strong>{MODEL_LABEL[formCfg.model].split(' — ')[0]}</strong></p>
                {isAdmin && <Button size="sm" variant="outline" onClick={() => { setCfgDraft(formCfg); setCfgOpen(true); }}><Settings2 className="mr-2 h-4 w-4" />Configurar modelo</Button>}
              </div>
              {fields.filter((f) => !MAIN_EXTRA.includes(f.key)).length === 0 && <p className="text-sm text-muted-foreground">O modelo Simplificado não usa dados complementares.</p>}
              {FIELD_GROUPS.map((g) => {
                const list = fields.filter((f) => f.group === g && !MAIN_EXTRA.includes(f.key));
                if (!list.length) return null;
                return (
                  <div key={g} className="space-y-3">
                    <h3 className="font-medium">{g}</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {list.map((f) => (
                        <div key={f.key} className={`space-y-2 ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                          <Label>{f.label}{f.required ? ' *' : ''}</Label>
                          {f.type === 'select' ? (
                            <Select value={extra[f.key] ?? ''} onValueChange={(v) => setExtra({ ...extra, [f.key]: v })}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>{f.options!.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : f.type === 'textarea' ? (
                            <Textarea value={extra[f.key] ?? ''} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })} rows={2} />
                          ) : (
                            <Input type={f.type} value={extra[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </TabsContent>

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
      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent className="max-w-2xl">
          <h2 className="text-lg font-semibold">Modelo do cadastro de funcionários</h2>
          <p className="text-sm text-muted-foreground">Vale para todos os cadastros desta empresa. Pode ser trocado a qualquer momento; nenhum dado é apagado.</p>
          <div className="space-y-2">
            {(Object.keys(MODEL_LABEL) as FormModel[]).map((m) => (
              <label key={m} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${cfgDraft.model === m ? 'border-primary bg-primary/5' : ''}`}>
                <input type="radio" name="model" className="mt-1" checked={cfgDraft.model === m} onChange={() => setCfgDraft({ ...cfgDraft, model: m })} />
                <span className="text-sm">{MODEL_LABEL[m]}</span>
              </label>
            ))}
          </div>
          {cfgDraft.model === 'personalizado' && (
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border p-3">
              {FIELD_GROUPS.map((g) => (
                <div key={g}>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{g}</p>
                  {EXTRA_FIELDS.filter((f) => f.group === g).map((f) => {
                    const c = cfgDraft.fields?.[f.key] ?? { show: false, required: false };
                    const set = (v: { show: boolean; required: boolean }) => setCfgDraft({ ...cfgDraft, fields: { ...(cfgDraft.fields ?? {}), [f.key]: v } });
                    return (
                      <div key={f.key} className="flex items-center gap-4 py-1 text-sm">
                        <label className="flex flex-1 items-center gap-2"><Checkbox checked={c.show} onCheckedChange={(v) => set({ show: !!v, required: !!v && c.required })} />{f.label}</label>
                        <label className="flex items-center gap-2 text-muted-foreground"><Checkbox checked={c.required} disabled={!c.show} onCheckedChange={(v) => set({ ...c, required: !!v })} />obrigatório</label>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCfgOpen(false)}>Cancelar</Button>
            <Button onClick={saveCfg}>Salvar modelo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
