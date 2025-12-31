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
import { Plus, Pencil, Trash2, Calendar, Clock, Printer, Download } from 'lucide-react';

// Educator types compatible with EducaNet and Brazilian education system
export const educatorTypes = {
  'PEB_I': 'PEB I - Ed. Infantil/Fund. Anos Iniciais',
  'PEB_II': 'PEB II - Fund. Anos Finais/Médio',
  'PEB_III': 'PEB III - Especialista',
  'PROFESSOR_AUXILIAR': 'Professor Auxiliar',
  'PROFESSOR_SUBSTITUTO': 'Professor Substituto',
  'MONITOR': 'Monitor/Estagiário',
  'COORDENADOR_PEDAGOGICO': 'Coordenador Pedagógico',
  'ORIENTADOR_EDUCACIONAL': 'Orientador Educacional',
  'SUPERVISOR_ESCOLAR': 'Supervisor Escolar',
};

export const teachingLevels = {
  'infantil': 'Educação Infantil',
  'fundamental_1': 'Ensino Fundamental - Anos Iniciais (1º ao 5º)',
  'fundamental_2': 'Ensino Fundamental - Anos Finais (6º ao 9º)',
  'medio': 'Ensino Médio',
  'eja': 'EJA - Educação de Jovens e Adultos',
  'tecnico': 'Ensino Técnico/Profissionalizante',
  'superior': 'Ensino Superior',
};

export const subjects = [
  'Português',
  'Matemática',
  'História',
  'Geografia',
  'Ciências',
  'Física',
  'Química',
  'Biologia',
  'Educação Física',
  'Artes',
  'Inglês',
  'Espanhol',
  'Filosofia',
  'Sociologia',
  'Ensino Religioso',
  'Informática',
  'Redação',
  'Literatura',
  'Polivalente',
  'Outro',
];

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

interface TeacherAssignment {
  id: string;
  profile_id: string;
  educator_type: string | null;
  teaching_level: string | null;
  subject: string | null;
  contract_weekly_hours: number | null;
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
  slot_number: number;
  start_time: string;
  end_time: string;
  subject: string | null;
  class_name: string | null;
  room: string | null;
  notes: string | null;
  is_active: boolean;
}

interface TeacherScheduleBoardProps {
  assignments: TeacherAssignment[];
  employees: Profile[];
  onRefresh: () => void;
}

export default function TeacherScheduleBoard({ assignments, employees, onRefresh }: TeacherScheduleBoardProps) {
  const { profile } = useAuth();
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [loading, setLoading] = useState(false);

  const [slotForm, setSlotForm] = useState({
    day_of_week: 1,
    slot_number: 1,
    start_time: '07:00',
    end_time: '07:50',
    subject: '',
    class_name: '',
    room: '',
    notes: '',
  });

  const teacherAssignments = assignments.filter(a => a.profile_id === selectedTeacher);
  const selectedAssignment = teacherAssignments[0];

  useEffect(() => {
    if (selectedTeacher) {
      fetchScheduleSlots();
    }
  }, [selectedTeacher]);

  const fetchScheduleSlots = async () => {
    if (!selectedTeacher) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teacher_schedule_slots')
        .select('*')
        .eq('profile_id', selectedTeacher)
        .eq('is_active', true)
        .order('day_of_week')
        .order('slot_number');

      if (error) throw error;
      setScheduleSlots(data || []);
    } catch (error) {
      console.error('Error fetching schedule slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlot = async () => {
    if (!selectedAssignment) {
      toast.error('Selecione um professor com atribuição');
      return;
    }

    try {
      const data = {
        assignment_id: selectedAssignment.id,
        profile_id: selectedTeacher,
        company_id: profile?.company_id,
        day_of_week: slotForm.day_of_week,
        slot_number: slotForm.slot_number,
        start_time: slotForm.start_time,
        end_time: slotForm.end_time,
        subject: slotForm.subject || null,
        class_name: slotForm.class_name || null,
        room: slotForm.room || null,
        notes: slotForm.notes || null,
      };

      if (editingSlot) {
        const { error } = await supabase
          .from('teacher_schedule_slots')
          .update(data)
          .eq('id', editingSlot.id);
        if (error) throw error;
        toast.success('Horário atualizado!');
      } else {
        const { error } = await supabase
          .from('teacher_schedule_slots')
          .insert(data);
        if (error) throw error;
        toast.success('Horário adicionado!');
      }

      setSlotDialogOpen(false);
      resetSlotForm();
      fetchScheduleSlots();
    } catch (error: any) {
      console.error('Error saving slot:', error);
      if (error.code === '23505') {
        toast.error('Já existe um horário neste dia e período');
      } else {
        toast.error('Erro ao salvar: ' + error.message);
      }
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm('Excluir este horário?')) return;
    try {
      const { error } = await supabase
        .from('teacher_schedule_slots')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Horário excluído!');
      fetchScheduleSlots();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const resetSlotForm = () => {
    setSlotForm({
      day_of_week: 1,
      slot_number: 1,
      start_time: '07:00',
      end_time: '07:50',
      subject: '',
      class_name: '',
      room: '',
      notes: '',
    });
    setEditingSlot(null);
  };

  const openEditSlot = (slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setSlotForm({
      day_of_week: slot.day_of_week,
      slot_number: slot.slot_number,
      start_time: slot.start_time,
      end_time: slot.end_time,
      subject: slot.subject || '',
      class_name: slot.class_name || '',
      room: slot.room || '',
      notes: slot.notes || '',
    });
    setSlotDialogOpen(true);
  };

  const getSlotForDayAndPeriod = (dayOfWeek: number, slotNumber: number) => {
    return scheduleSlots.find(s => s.day_of_week === dayOfWeek && s.slot_number === slotNumber);
  };

  const maxSlots = Math.max(8, ...scheduleSlots.map(s => s.slot_number));

  const handlePrintSchedule = () => {
    const teacher = employees.find(e => e.id === selectedTeacher);
    if (!teacher) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const scheduleHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quadro de Horários - ${teacher.full_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; font-size: 18px; }
          h2 { text-align: center; font-size: 14px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: center; font-size: 11px; }
          th { background-color: #f0f0f0; }
          .slot-info { font-weight: bold; }
          .class-name { font-size: 10px; color: #666; }
          .time { font-size: 9px; color: #999; }
          .educator-info { margin-top: 10px; font-size: 12px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>QUADRO DE HORÁRIOS</h1>
        <h2>${teacher.full_name}${teacher.registration_number ? ` - Mat. ${teacher.registration_number}` : ''}</h2>
        <p class="educator-info">
          <strong>Tipo:</strong> ${selectedAssignment?.educator_type ? educatorTypes[selectedAssignment.educator_type as keyof typeof educatorTypes] || selectedAssignment.educator_type : 'Não definido'}<br/>
          <strong>Nível:</strong> ${selectedAssignment?.teaching_level ? teachingLevels[selectedAssignment.teaching_level as keyof typeof teachingLevels] || selectedAssignment.teaching_level : 'Não definido'}<br/>
          <strong>Disciplina:</strong> ${selectedAssignment?.subject || 'Não definida'}
        </p>
        <table>
          <thead>
            <tr>
              <th>Período</th>
              ${daysOfWeek.filter(d => d.value >= 1 && d.value <= 5).map(d => `<th>${d.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: maxSlots }, (_, i) => i + 1).map(slotNum => `
              <tr>
                <td><strong>${slotNum}ª Aula</strong></td>
                ${daysOfWeek.filter(d => d.value >= 1 && d.value <= 5).map(d => {
                  const slot = getSlotForDayAndPeriod(d.value, slotNum);
                  if (slot) {
                    return `<td>
                      <div class="slot-info">${slot.subject || '-'}</div>
                      <div class="class-name">${slot.class_name || ''}</div>
                      <div class="time">${slot.start_time.slice(0,5)} - ${slot.end_time.slice(0,5)}</div>
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

  const selectedTeacherData = employees.find(e => e.id === selectedTeacher);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Label>Selecionar Professor</Label>
          <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Selecione o professor" />
            </SelectTrigger>
            <SelectContent>
              {assignments.map((assignment) => (
                <SelectItem key={assignment.id} value={assignment.profile_id}>
                  {assignment.profile?.full_name}
                  {assignment.educator_type && (
                    <span className="text-muted-foreground ml-2">
                      ({educatorTypes[assignment.educator_type as keyof typeof educatorTypes]?.split(' - ')[0] || assignment.educator_type})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTeacher && selectedAssignment && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintSchedule}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={() => { resetSlotForm(); setSlotDialogOpen(true); }} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Horário
            </Button>
          </div>
        )}
      </div>

      {selectedTeacher && selectedAssignment && (
        <>
          {/* Teacher Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedTeacherData?.full_name}</CardTitle>
                  <CardDescription>
                    {selectedTeacherData?.registration_number && `Matrícula: ${selectedTeacherData.registration_number}`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {educatorTypes[selectedAssignment.educator_type as keyof typeof educatorTypes] || selectedAssignment.educator_type || 'Tipo não definido'}
                  </Badge>
                  <Badge variant="secondary">
                    {teachingLevels[selectedAssignment.teaching_level as keyof typeof teachingLevels] || selectedAssignment.teaching_level || 'Nível não definido'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Disciplina:</span>{' '}
                  <span className="font-medium">{selectedAssignment.subject || 'Não definida'}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div>
                  <span className="text-muted-foreground">Carga Horária:</span>{' '}
                  <span className="font-medium">{selectedAssignment.contract_weekly_hours || 0}h/semana</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Board */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Quadro de Horários Semanal
              </CardTitle>
              <CardDescription>
                Formato compatível com EducaNet - Clique em um horário para editar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Período</TableHead>
                      {daysOfWeek.filter(d => d.value >= 1 && d.value <= 6).map(day => (
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
                            {slotNum}ª Aula
                          </div>
                        </TableCell>
                        {daysOfWeek.filter(d => d.value >= 1 && d.value <= 6).map(day => {
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
                                    slot_number: slotNum,
                                  }));
                                  setSlotDialogOpen(true);
                                }
                              }}
                            >
                              {slot ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-sm">{slot.subject}</div>
                                  {slot.class_name && (
                                    <div className="text-xs text-muted-foreground">{slot.class_name}</div>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                  </div>
                                  {slot.room && (
                                    <Badge variant="outline" className="text-xs">{slot.room}</Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">Clique para adicionar</span>
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

          {/* Schedule List */}
          <Card>
            <CardHeader>
              <CardTitle>Lista de Horários</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Disciplina</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Sala</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduleSlots.map(slot => (
                    <TableRow key={slot.id}>
                      <TableCell>{daysOfWeek.find(d => d.value === slot.day_of_week)?.label}</TableCell>
                      <TableCell>{slot.slot_number}ª Aula</TableCell>
                      <TableCell>{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</TableCell>
                      <TableCell>{slot.subject || '-'}</TableCell>
                      <TableCell>{slot.class_name || '-'}</TableCell>
                      <TableCell>{slot.room || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditSlot(slot)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSlot(slot.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {scheduleSlots.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum horário cadastrado para este professor
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedTeacher && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Selecione um professor para visualizar o quadro de horários</p>
          </CardContent>
        </Card>
      )}

      {/* Slot Dialog */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? 'Editar Horário' : 'Adicionar Horário'}
            </DialogTitle>
            <DialogDescription>
              Configure o horário de aula para o professor
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
                    {daysOfWeek.map(day => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Período (Nº da Aula)</Label>
                <Select
                  value={slotForm.slot_number.toString()}
                  onValueChange={(v) => setSlotForm({ ...slotForm, slot_number: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}ª Aula
                      </SelectItem>
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
              <Label>Disciplina</Label>
              <Select
                value={slotForm.subject || "none"}
                onValueChange={(v) => setSlotForm({ ...slotForm, subject: v === "none" ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {subjects.map(subject => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turma</Label>
                <Input
                  value={slotForm.class_name}
                  onChange={(e) => setSlotForm({ ...slotForm, class_name: e.target.value })}
                  placeholder="Ex: 5º Ano A"
                />
              </div>
              <div className="space-y-2">
                <Label>Sala</Label>
                <Input
                  value={slotForm.room}
                  onChange={(e) => setSlotForm({ ...slotForm, room: e.target.value })}
                  placeholder="Ex: Sala 101"
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
