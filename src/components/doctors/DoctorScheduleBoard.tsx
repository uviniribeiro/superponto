import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Calendar, Clock, Printer } from 'lucide-react';
import { medicalSpecialties, healthUnits } from '@/pages/doctor/DoctorAssignments';

const daysOfWeek = [
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 0, label: 'Domingo', short: 'Dom' },
];

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
}

interface DoctorAssignment {
  id: string;
  profile_id: string;
  specialty: string | null;
  crm: string | null;
  crm_state: string | null;
  contract_weekly_hours: number | null;
  health_unit: string | null;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
}

interface ScheduleSlot {
  id: string;
  assignment_id: string;
  profile_id: string;
  day_of_week: number;
  shift_number: number;
  start_time: string;
  end_time: string;
  health_unit: string | null;
  sector: string | null;
  room: string | null;
  notes: string | null;
  is_active: boolean;
}

interface DoctorScheduleBoardProps {
  assignments: DoctorAssignment[];
  employees: Profile[];
  onRefresh: () => void;
}

export default function DoctorScheduleBoard({ assignments, employees, onRefresh }: DoctorScheduleBoardProps) {
  const { profile } = useAuth();
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [loading, setLoading] = useState(false);

  const [slotForm, setSlotForm] = useState({
    day_of_week: 1,
    shift_number: 1,
    start_time: '07:00',
    end_time: '19:00',
    health_unit: '',
    sector: '',
    room: '',
    notes: '',
  });

  const doctorAssignments = assignments.filter(a => a.profile_id === selectedDoctor);
  const selectedAssignment = doctorAssignments[0];

  useEffect(() => {
    if (selectedDoctor) {
      fetchScheduleSlots();
    }
  }, [selectedDoctor]);

  const fetchScheduleSlots = async () => {
    if (!selectedDoctor) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('doctor_schedule_slots')
        .select('*')
        .eq('profile_id', selectedDoctor)
        .eq('is_active', true)
        .order('day_of_week')
        .order('shift_number');

      if (error) throw error;
      setScheduleSlots((data || []).map(d => ({ ...d, room: d.room ?? null })) as ScheduleSlot[]);
    } catch (error) {
      console.error('Error fetching schedule slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlot = async () => {
    if (!selectedAssignment) {
      toast.error('Selecione um médico com atribuição');
      return;
    }

    try {
      const data = {
        assignment_id: selectedAssignment.id,
        profile_id: selectedDoctor,
        company_id: profile?.company_id,
        day_of_week: slotForm.day_of_week,
        shift_number: slotForm.shift_number,
        start_time: slotForm.start_time,
        end_time: slotForm.end_time,
        health_unit: slotForm.health_unit || null,
        sector: slotForm.sector || null,
        room: slotForm.room || null,
        notes: slotForm.notes || null,
      };

      if (editingSlot) {
        const { error } = await supabase
          .from('doctor_schedule_slots')
          .update(data)
          .eq('id', editingSlot.id);
        if (error) throw error;
        toast.success('Plantão atualizado!');
      } else {
        const { error } = await supabase
          .from('doctor_schedule_slots')
          .insert(data);
        if (error) throw error;
        toast.success('Plantão adicionado!');
      }

      setSlotDialogOpen(false);
      resetSlotForm();
      fetchScheduleSlots();
    } catch (error: any) {
      console.error('Error saving slot:', error);
      if (error.code === '23505') {
        toast.error('Já existe um plantão neste dia e período');
      } else {
        toast.error('Erro ao salvar: ' + error.message);
      }
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm('Excluir este plantão?')) return;
    try {
      const { error } = await supabase
        .from('doctor_schedule_slots')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Plantão excluído!');
      fetchScheduleSlots();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const resetSlotForm = () => {
    setSlotForm({
      day_of_week: 1,
      shift_number: 1,
      start_time: '07:00',
      end_time: '19:00',
      health_unit: '',
      sector: '',
      room: '',
      notes: '',
    });
    setEditingSlot(null);
  };

  const openEditSlot = (slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setSlotForm({
      day_of_week: slot.day_of_week,
      shift_number: slot.shift_number,
      start_time: slot.start_time,
      end_time: slot.end_time,
      health_unit: slot.health_unit || '',
      sector: slot.sector || '',
      room: slot.room || '',
      notes: slot.notes || '',
    });
    setSlotDialogOpen(true);
  };

  const getSlotForDayAndPeriod = (dayOfWeek: number, shiftNumber: number) => {
    return scheduleSlots.find(s => s.day_of_week === dayOfWeek && s.shift_number === shiftNumber);
  };

  const maxSlots = Math.max(3, ...scheduleSlots.map(s => s.shift_number));

  const handlePrintSchedule = () => {
    const doctor = employees.find(e => e.id === selectedDoctor);
    if (!doctor) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const scheduleHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quadro de Plantões - ${doctor.full_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; font-size: 18px; }
          h2 { text-align: center; font-size: 14px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; }
          th { background-color: #f0f0f0; }
          .slot-info { font-weight: bold; }
          .unit-name { font-size: 10px; color: #666; }
          .time { font-size: 9px; color: #999; }
          .doctor-info { margin-top: 10px; font-size: 12px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>QUADRO DE PLANTÕES</h1>
        <h2>${doctor.full_name}${doctor.registration_number ? ` - Mat. ${doctor.registration_number}` : ''}</h2>
        <p class="doctor-info">
          <strong>CRM:</strong> ${selectedAssignment?.crm || 'Não informado'}/${selectedAssignment?.crm_state || ''}<br/>
          <strong>Especialidade:</strong> ${selectedAssignment?.specialty || 'Não definida'}<br/>
          <strong>Unidade Principal:</strong> ${selectedAssignment?.health_unit || 'Não definida'}
        </p>
        <table>
          <thead>
            <tr>
              <th>Plantão</th>
              ${daysOfWeek.map(d => `<th>${d.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: maxSlots }, (_, i) => i + 1).map(slotNum => `
              <tr>
                <td><strong>${slotNum}º Plantão</strong></td>
                ${daysOfWeek.map(d => {
                  const slot = getSlotForDayAndPeriod(d.value, slotNum);
                  if (slot) {
                    return `<td>
                      <div class="time">${slot.start_time.slice(0,5)} - ${slot.end_time.slice(0,5)}</div>
                      <div class="unit-name">${slot.health_unit || ''}</div>
                      ${slot.sector ? `<div class="unit-name">${slot.sector}</div>` : ''}
                    </td>`;
                  }
                  return '<td>-</td>';
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(scheduleHTML);
    printWindow.document.close();
  };

  const selectedDoctorData = employees.find(e => e.id === selectedDoctor);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Label>Selecionar Médico</Label>
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Selecione o médico" />
            </SelectTrigger>
            <SelectContent>
              {assignments.map((assignment) => (
                <SelectItem key={assignment.id} value={assignment.profile_id}>
                  {assignment.profile?.full_name}
                  {assignment.specialty && (
                    <span className="text-muted-foreground ml-2">
                      ({assignment.specialty})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedDoctor && selectedAssignment && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintSchedule}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={() => { resetSlotForm(); setSlotDialogOpen(true); }} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Plantão
            </Button>
          </div>
        )}
      </div>

      {selectedDoctor && selectedAssignment && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedDoctorData?.full_name}</CardTitle>
                  <CardDescription>
                    {selectedDoctorData?.registration_number && `Matrícula: ${selectedDoctorData.registration_number}`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    CRM {selectedAssignment.crm || 'N/A'}/{selectedAssignment.crm_state || 'N/A'}
                  </Badge>
                  <Badge variant="secondary">
                    {selectedAssignment.specialty || 'Especialidade não definida'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Unidade:</span>{' '}
                  <span className="font-medium">{selectedAssignment.health_unit || 'Não definida'}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div>
                  <span className="text-muted-foreground">Carga Horária:</span>{' '}
                  <span className="font-medium">{selectedAssignment.contract_weekly_hours || 0}h/semana</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Quadro de Plantões Semanal
              </CardTitle>
              <CardDescription>
                Clique em um horário para editar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Plantão</TableHead>
                      {daysOfWeek.map(day => (
                        <TableHead key={day.value} className="text-center min-w-[120px]">
                          {day.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: maxSlots }, (_, i) => i + 1).map(slotNum => (
                      <TableRow key={slotNum}>
                        <TableCell className="font-medium bg-muted/50">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {slotNum}º Plantão
                          </div>
                        </TableCell>
                        {daysOfWeek.map(day => {
                          const slot = getSlotForDayAndPeriod(day.value, slotNum);
                          return (
                            <TableCell 
                              key={day.value} 
                              className={`text-center p-2 ${slot ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'} cursor-pointer transition-colors`}
                              onClick={() => {
                                if (slot) {
                                  openEditSlot(slot);
                                } else {
                                  setSlotForm(prev => ({
                                    ...prev,
                                    day_of_week: day.value,
                                    shift_number: slotNum,
                                  }));
                                  setSlotDialogOpen(true);
                                }
                              }}
                            >
                              {slot ? (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">
                                    {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                  </div>
                                  {slot.health_unit && (
                                    <div className="text-xs font-medium">{slot.health_unit}</div>
                                  )}
                                  {slot.sector && (
                                    <Badge variant="outline" className="text-xs">{slot.sector}</Badge>
                                  )}
                                  {slot.room && (
                                    <Badge variant="secondary" className="text-xs">{slot.room}</Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plantões Cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scheduleSlots.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">
                        {daysOfWeek.find(d => d.value === slot.day_of_week)?.label} - {slot.shift_number}º Plantão
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                        {slot.health_unit && ` • ${slot.health_unit}`}
                        {slot.sector && ` • ${slot.sector}`}
                        {slot.room && ` • ${slot.room}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditSlot(slot)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSlot(slot.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {scheduleSlots.length === 0 && (
                  <p className="text-center py-4 text-muted-foreground">
                    Nenhum plantão cadastrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedDoctor && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Selecione um médico para visualizar o quadro de plantões</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? 'Editar Plantão' : 'Adicionar Plantão'}
            </DialogTitle>
            <DialogDescription>
              Configure o plantão para o dia selecionado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dia da Semana</Label>
                <Select
                  value={slotForm.day_of_week.toString()}
                  onValueChange={(v) => setSlotForm({ ...slotForm, day_of_week: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map(d => (
                      <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número do Plantão</Label>
                <Select
                  value={slotForm.shift_number.toString()}
                  onValueChange={(v) => setSlotForm({ ...slotForm, shift_number: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}º Plantão</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Início</Label>
                <Input
                  type="time"
                  value={slotForm.start_time}
                  onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora Fim</Label>
                <Input
                  type="time"
                  value={slotForm.end_time}
                  onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Unidade de Saúde</Label>
              <Select
                value={slotForm.health_unit || "none"}
                onValueChange={(v) => setSlotForm({ ...slotForm, health_unit: v === "none" ? "" : v })}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Setor</Label>
                <Input
                  value={slotForm.sector}
                  onChange={(e) => setSlotForm({ ...slotForm, sector: e.target.value })}
                  placeholder="Ex: Emergência, UTI, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Sala/Consultório</Label>
                <Input
                  value={slotForm.room}
                  onChange={(e) => setSlotForm({ ...slotForm, room: e.target.value })}
                  placeholder="Ex: Sala 5, Consultório 12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                value={slotForm.notes}
                onChange={(e) => setSlotForm({ ...slotForm, notes: e.target.value })}
                placeholder="Observações opcionais"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSlot} className="gradient-primary">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}