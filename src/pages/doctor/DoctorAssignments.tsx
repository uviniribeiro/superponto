import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CalendarIcon, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const medicalSpecialties = [
  'Clínica Geral',
  'Pediatria',
  'Ginecologia e Obstetrícia',
  'Cardiologia',
  'Ortopedia',
  'Neurologia',
  'Dermatologia',
  'Oftalmologia',
  'Otorrinolaringologia',
  'Urologia',
  'Psiquiatria',
  'Cirurgia Geral',
  'Anestesiologia',
  'Radiologia',
  'Emergência',
  'UTI',
  'Outra',
];

export const healthUnits = [
  'UBS - Unidade Básica de Saúde',
  'UPA - Unidade de Pronto Atendimento',
  'Hospital Municipal',
  'CAPS - Centro de Atenção Psicossocial',
  'CEO - Centro de Especialidades Odontológicas',
  'SAMU',
  'Ambulatório',
  'Outro',
];

export const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 
  'SP', 'SE', 'TO'
];

interface ShiftConfiguration {
  id: string;
  name: string;
  duration_hours: number;
}

interface WorkSchedule {
  id: string;
  name: string;
}

interface DoctorAssignment {
  id: string;
  profile_id: string;
  shift_configuration_id: string;
  start_date: string;
  contract_type: string | null;
  contract_weekly_hours: number | null;
  contract_monthly_hours: number | null;
  work_schedule_id: string | null;
  specialty: string | null;
  crm: string | null;
  crm_state: string | null;
  health_unit: string | null;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
  shift_configuration?: ShiftConfiguration;
  work_schedule?: WorkSchedule;
}

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
}

const contractTypeLabels: Record<string, string> = {
  'hourly': 'Plantonista',
  'part_time': 'Tempo Parcial',
  'full_time': 'Tempo Integral',
};

interface DoctorAssignmentsProps {
  assignments: DoctorAssignment[];
  configurations: ShiftConfiguration[];
  employees: Profile[];
  schedules: WorkSchedule[];
  onRefresh: () => void;
}

export default function DoctorAssignments({ 
  assignments, 
  configurations, 
  employees, 
  schedules, 
  onRefresh 
}: DoctorAssignmentsProps) {
  const { profile } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<DoctorAssignment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    profile_id: '',
    shift_configuration_id: '',
    start_date: new Date(),
    contract_type: 'hourly',
    contract_weekly_hours: '',
    contract_monthly_hours: '',
    work_schedule_id: '',
    specialty: '',
    crm: '',
    crm_state: '',
    health_unit: '',
  });

  const resetForm = () => {
    setForm({
      profile_id: '',
      shift_configuration_id: '',
      start_date: new Date(),
      contract_type: 'hourly',
      contract_weekly_hours: '',
      contract_monthly_hours: '',
      work_schedule_id: '',
      specialty: '',
      crm: '',
      crm_state: '',
      health_unit: '',
    });
    setEditingAssignment(null);
  };

  const openEdit = (assignment: DoctorAssignment) => {
    setEditingAssignment(assignment);
    setForm({
      profile_id: assignment.profile_id,
      shift_configuration_id: assignment.shift_configuration_id,
      start_date: new Date(assignment.start_date),
      contract_type: assignment.contract_type || 'hourly',
      contract_weekly_hours: assignment.contract_weekly_hours?.toString() || '',
      contract_monthly_hours: assignment.contract_monthly_hours?.toString() || '',
      work_schedule_id: assignment.work_schedule_id || '',
      specialty: assignment.specialty || '',
      crm: assignment.crm || '',
      crm_state: assignment.crm_state || '',
      health_unit: assignment.health_unit || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.profile_id || !form.shift_configuration_id) {
      toast.error('Selecione o médico e a configuração');
      return;
    }

    try {
      const data = {
        profile_id: form.profile_id,
        shift_configuration_id: form.shift_configuration_id,
        start_date: format(form.start_date, 'yyyy-MM-dd'),
        contract_type: form.contract_type,
        contract_weekly_hours: form.contract_weekly_hours ? parseFloat(form.contract_weekly_hours) : null,
        contract_monthly_hours: form.contract_monthly_hours ? parseFloat(form.contract_monthly_hours) : null,
        work_schedule_id: form.work_schedule_id || null,
        specialty: form.specialty || null,
        crm: form.crm || null,
        crm_state: form.crm_state || null,
        health_unit: form.health_unit || null,
        company_id: profile?.company_id,
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('doctor_assignments')
          .update(data)
          .eq('id', editingAssignment.id);
        if (error) throw error;
        toast.success('Atribuição atualizada!');
      } else {
        const { error } = await supabase
          .from('doctor_assignments')
          .insert(data);
        if (error) throw error;
        toast.success('Médico atribuído!');
      }

      setDialogOpen(false);
      resetForm();
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta atribuição?')) return;
    try {
      const { error } = await supabase.from('doctor_assignments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Atribuição removida!');
      onRefresh();
    } catch (error: any) {
      toast.error('Erro ao remover: ' + error.message);
    }
  };

  const filteredAssignments = assignments.filter(a => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      a.profile?.full_name?.toLowerCase().includes(search) ||
      a.profile?.registration_number?.toLowerCase().includes(search) ||
      a.specialty?.toLowerCase().includes(search) ||
      a.crm?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-4" data-tour="doctor-assignments">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CRM ou especialidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gradient-primary btn-press">
          <Plus className="h-4 w-4 mr-2" />
          Atribuir Médico
        </Button>
      </div>

      <Card className="animate-fade-in">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Médico</TableHead>
                <TableHead>CRM</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Configuração</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.map((assignment) => (
                <TableRow key={assignment.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">
                    {assignment.profile?.full_name}
                    {assignment.profile?.registration_number && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        #{assignment.profile.registration_number}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {assignment.crm ? (
                      <Badge variant="outline">{assignment.crm}/{assignment.crm_state}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{assignment.specialty || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {assignment.shift_configuration?.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {contractTypeLabels[assignment.contract_type || 'hourly']}
                  </TableCell>
                  <TableCell>{assignment.health_unit || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(assignment)} className="btn-press">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(assignment.id)} className="btn-press">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAssignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum médico atribuído'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Editar Atribuição' : 'Atribuir Médico'}
            </DialogTitle>
            <DialogDescription>
              Configure o plantão e escala específica para o médico
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Médico *</Label>
                <Select
                  value={form.profile_id}
                  onValueChange={(v) => setForm({ ...form, profile_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} {emp.registration_number ? `(${emp.registration_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Configuração de Plantão *</Label>
                <Select
                  value={form.shift_configuration_id}
                  onValueChange={(v) => setForm({ ...form, shift_configuration_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a configuração" />
                  </SelectTrigger>
                  <SelectContent>
                    {configurations.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name} ({config.duration_hours}h)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>CRM</Label>
                <Input
                  value={form.crm}
                  onChange={(e) => setForm({ ...form, crm: e.target.value })}
                  placeholder="123456"
                />
              </div>
              <div className="space-y-2">
                <Label>Estado CRM</Label>
                <Select
                  value={form.crm_state || "none"}
                  onValueChange={(v) => setForm({ ...form, crm_state: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {brazilianStates.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Especialidade</Label>
                <Select
                  value={form.specialty || "none"}
                  onValueChange={(v) => setForm({ ...form, specialty: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {medicalSpecialties.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Contrato</Label>
                <Select
                  value={form.contract_type}
                  onValueChange={(v) => setForm({ ...form, contract_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Plantonista</SelectItem>
                    <SelectItem value="part_time">Tempo Parcial</SelectItem>
                    <SelectItem value="full_time">Tempo Integral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade de Saúde</Label>
                <Select
                  value={form.health_unit || "none"}
                  onValueChange={(v) => setForm({ ...form, health_unit: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {healthUnits.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Carga Semanal (h)</Label>
                <Input
                  type="number"
                  value={form.contract_weekly_hours}
                  onChange={(e) => setForm({ ...form, contract_weekly_hours: e.target.value })}
                  placeholder="Ex: 24"
                />
              </div>
              <div className="space-y-2">
                <Label>Carga Mensal (h)</Label>
                <Input
                  type="number"
                  value={form.contract_monthly_hours}
                  onChange={(e) => setForm({ ...form, contract_monthly_hours: e.target.value })}
                  placeholder="Ex: 96"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.start_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.start_date}
                      onSelect={(date) => date && setForm({ ...form, start_date: date })}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Jornada/Escala (opcional)</Label>
              <Select
                value={form.work_schedule_id || "none"}
                onValueChange={(v) => setForm({ ...form, work_schedule_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}