import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, FileText, Plus, Trash2 } from 'lucide-react';

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  nsr: number;
}

interface DaySummary {
  date: Date;
  records: TimeRecord[];
  entry?: string;
  breakStart?: string;
  breakEnd?: string;
  exit?: string;
  workedMinutes: number;
  expectedMinutes: number;
  balance: number;
  isHoliday: boolean;
  isWeekend: boolean;
  observations: string[];
}

interface DayEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: DaySummary | null;
  employeeId: string;
  companyId: string;
  onSave: () => void;
}

const JUSTIFICATION_TYPES = [
  { value: 'medical', label: 'Atestado Médico' },
  { value: 'vacation', label: 'Férias' },
  { value: 'leave', label: 'Licença' },
  { value: 'absence_justified', label: 'Falta Justificada' },
  { value: 'absence_unjustified', label: 'Falta Injustificada' },
  { value: 'remote_work', label: 'Trabalho Remoto' },
  { value: 'training', label: 'Treinamento' },
  { value: 'other', label: 'Outro' },
];

export function DayEditDialog({ open, onOpenChange, day, employeeId, companyId, onSave }: DayEditDialogProps) {
  const [activeTab, setActiveTab] = useState('records');
  const [loading, setLoading] = useState(false);
  
  // Records state
  const [entryTime, setEntryTime] = useState('');
  const [breakStartTime, setBreakStartTime] = useState('');
  const [breakEndTime, setBreakEndTime] = useState('');
  const [exitTime, setExitTime] = useState('');
  
  // Justification state
  const [justificationType, setJustificationType] = useState('');
  const [justificationNote, setJustificationNote] = useState('');
  
  // Time bank adjustment state
  const [adjustmentMinutes, setAdjustmentMinutes] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  useEffect(() => {
    if (day) {
      setEntryTime(day.entry || '');
      setBreakStartTime(day.breakStart || '');
      setBreakEndTime(day.breakEnd || '');
      setExitTime(day.exit || '');
      setJustificationType('');
      setJustificationNote('');
      setAdjustmentMinutes('');
      setAdjustmentReason('');
    }
  }, [day]);

  const handleSaveRecords = async () => {
    if (!day) return;
    setLoading(true);
    
    try {
      const dateStr = format(day.date, 'yyyy-MM-dd');
      
      // Delete existing records for this day
      const { error: deleteError } = await supabase
        .from('time_records')
        .delete()
        .eq('profile_id', employeeId)
        .gte('recorded_at', `${dateStr}T00:00:00`)
        .lte('recorded_at', `${dateStr}T23:59:59`);
      
      if (deleteError) throw deleteError;
      
      // Insert new records
      const recordsToInsert = [];
      
      if (entryTime) {
        recordsToInsert.push({
          profile_id: employeeId,
          company_id: companyId,
          record_type: 'entry',
          recorded_at: `${dateStr}T${entryTime}:00`,
          device_info: 'Ajuste Manual - Espelho de Ponto',
        });
      }
      
      if (breakStartTime) {
        recordsToInsert.push({
          profile_id: employeeId,
          company_id: companyId,
          record_type: 'break_start',
          recorded_at: `${dateStr}T${breakStartTime}:00`,
          device_info: 'Ajuste Manual - Espelho de Ponto',
        });
      }
      
      if (breakEndTime) {
        recordsToInsert.push({
          profile_id: employeeId,
          company_id: companyId,
          record_type: 'break_end',
          recorded_at: `${dateStr}T${breakEndTime}:00`,
          device_info: 'Ajuste Manual - Espelho de Ponto',
        });
      }
      
      if (exitTime) {
        recordsToInsert.push({
          profile_id: employeeId,
          company_id: companyId,
          record_type: 'exit',
          recorded_at: `${dateStr}T${exitTime}:00`,
          device_info: 'Ajuste Manual - Espelho de Ponto',
        });
      }
      
      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('time_records')
          .insert(recordsToInsert);
        
        if (insertError) throw insertError;
      }
      
      toast.success('Registros atualizados com sucesso!');
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving records:', error);
      toast.error('Erro ao salvar registros: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJustification = async () => {
    if (!day || !justificationType) {
      toast.error('Selecione o tipo de justificativa');
      return;
    }
    
    setLoading(true);
    
    try {
      const dateStr = format(day.date, 'yyyy-MM-dd');
      
      // Create adjustment request for justification
      const { error } = await supabase
        .from('adjustment_requests')
        .insert({
          profile_id: employeeId,
          company_id: companyId,
          request_type: 'justification',
          reason: `${JUSTIFICATION_TYPES.find(j => j.value === justificationType)?.label}: ${justificationNote}`,
          status: 'approved',
          original_time: `${dateStr}T00:00:00`,
          reviewed_at: new Date().toISOString(),
          review_notes: `Tipo: ${justificationType}`,
        });
      
      if (error) throw error;
      
      toast.success('Justificativa registrada com sucesso!');
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving justification:', error);
      toast.error('Erro ao salvar justificativa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTimeBankAdjustment = async () => {
    if (!day || !adjustmentMinutes || !adjustmentReason) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    setLoading(true);
    
    try {
      const dateStr = format(day.date, 'yyyy-MM-dd');
      const minutes = parseInt(adjustmentMinutes);
      const adjustedMinutes = adjustmentType === 'debit' ? -minutes : minutes;
      
      // Create adjustment request for time bank
      const { error } = await supabase
        .from('adjustment_requests')
        .insert({
          profile_id: employeeId,
          company_id: companyId,
          request_type: 'time_bank_adjustment',
          reason: adjustmentReason,
          status: 'approved',
          original_time: `${dateStr}T00:00:00`,
          requested_time: `${dateStr}T${String(Math.floor(Math.abs(adjustedMinutes) / 60)).padStart(2, '0')}:${String(Math.abs(adjustedMinutes) % 60).padStart(2, '0')}:00`,
          reviewed_at: new Date().toISOString(),
          review_notes: `Ajuste manual de banco de horas: ${adjustmentType === 'credit' ? '+' : '-'}${minutes} minutos`,
        });
      
      if (error) throw error;
      
      toast.success('Ajuste de banco de horas registrado com sucesso!');
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving time bank adjustment:', error);
      toast.error('Erro ao salvar ajuste: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!day) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Editar Dia - {format(day.date, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
          </DialogTitle>
          <DialogDescription>
            Faça tratamentos, lance justificativas ou ajuste o banco de horas manualmente.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="records">Registros</TabsTrigger>
            <TabsTrigger value="justification">Justificativa</TabsTrigger>
            <TabsTrigger value="timebank">Banco de Horas</TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Ajuste os horários de entrada, intervalo e saída para este dia.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entrada</Label>
                <Input
                  type="time"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Saída Intervalo</Label>
                <Input
                  type="time"
                  value={breakStartTime}
                  onChange={(e) => setBreakStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Retorno Intervalo</Label>
                <Input
                  type="time"
                  value={breakEndTime}
                  onChange={(e) => setBreakEndTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Saída</Label>
                <Input
                  type="time"
                  value={exitTime}
                  onChange={(e) => setExitTime(e.target.value)}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveRecords} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Registros'}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="justification" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Registre uma justificativa para este dia (atestado, férias, licença, etc).
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Justificativa</Label>
                <Select value={justificationType} onValueChange={setJustificationType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {JUSTIFICATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={justificationNote}
                  onChange={(e) => setJustificationNote(e.target.value)}
                  placeholder="Descreva detalhes da justificativa..."
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveJustification} disabled={loading || !justificationType}>
                {loading ? 'Salvando...' : 'Registrar Justificativa'}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="timebank" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Faça ajustes manuais no banco de horas do funcionário para este dia.
            </p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Ajuste</Label>
                  <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as 'credit' | 'debit')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Crédito (+)</SelectItem>
                      <SelectItem value="debit">Débito (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Minutos</Label>
                  <Input
                    type="number"
                    value={adjustmentMinutes}
                    onChange={(e) => setAdjustmentMinutes(e.target.value)}
                    placeholder="Ex: 60"
                    min="1"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Motivo do Ajuste</Label>
                <Textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Descreva o motivo do ajuste..."
                  rows={3}
                />
              </div>
              
              {adjustmentMinutes && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm">
                    <strong>Resumo:</strong> {adjustmentType === 'credit' ? 'Adicionando' : 'Removendo'}{' '}
                    <span className={adjustmentType === 'credit' ? 'text-green-600' : 'text-red-600'}>
                      {adjustmentType === 'credit' ? '+' : '-'}
                      {Math.floor(parseInt(adjustmentMinutes) / 60)}h{parseInt(adjustmentMinutes) % 60}min
                    </span>{' '}
                    ao banco de horas
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveTimeBankAdjustment} 
                disabled={loading || !adjustmentMinutes || !adjustmentReason}
              >
                {loading ? 'Salvando...' : 'Registrar Ajuste'}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
