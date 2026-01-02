import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Clock, Plus, Minus } from 'lucide-react';

interface TimeBankAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  companyId: string;
  onSave: () => void;
}

const ADJUSTMENT_REASONS = [
  { value: 'compensation', label: 'Compensação de Horas' },
  { value: 'overtime_payment', label: 'Pagamento de Horas Extras' },
  { value: 'bank_transfer', label: 'Transferência de Banco' },
  { value: 'correction', label: 'Correção de Registro' },
  { value: 'agreement', label: 'Acordo com Funcionário' },
  { value: 'legal', label: 'Determinação Legal' },
  { value: 'other', label: 'Outro' },
];

export function TimeBankAdjustmentDialog({ 
  open, 
  onOpenChange, 
  employeeId, 
  employeeName,
  companyId, 
  onSave 
}: TimeBankAdjustmentDialogProps) {
  const [loading, setLoading] = useState(false);
  
  const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reasonType, setReasonType] = useState('');
  const [reasonNote, setReasonNote] = useState('');

  const handleSave = async () => {
    if (!hours && !minutes) {
      toast.error('Informe as horas ou minutos do ajuste');
      return;
    }
    
    if (!reasonType) {
      toast.error('Selecione o motivo do ajuste');
      return;
    }
    
    setLoading(true);
    
    try {
      const totalMinutes = (parseInt(hours || '0') * 60) + parseInt(minutes || '0');
      const adjustedMinutes = adjustmentType === 'debit' ? -totalMinutes : totalMinutes;
      
      const reasonLabel = ADJUSTMENT_REASONS.find(r => r.value === reasonType)?.label || reasonType;
      
      // Create adjustment request
      const { error } = await supabase
        .from('adjustment_requests')
        .insert({
          profile_id: employeeId,
          company_id: companyId,
          request_type: 'time_bank_manual_adjustment',
          reason: `${reasonLabel}${reasonNote ? ': ' + reasonNote : ''}`,
          status: 'approved',
          original_time: `${startDate}T00:00:00`,
          requested_time: `${endDate}T${String(Math.floor(Math.abs(adjustedMinutes) / 60)).padStart(2, '0')}:${String(Math.abs(adjustedMinutes) % 60).padStart(2, '0')}:00`,
          reviewed_at: new Date().toISOString(),
          review_notes: `Ajuste manual: ${adjustmentType === 'credit' ? '+' : '-'}${hours || 0}h${minutes || 0}min | Período: ${startDate} a ${endDate}`,
        });
      
      if (error) throw error;
      
      toast.success('Ajuste de banco de horas registrado com sucesso!');
      onSave();
      onOpenChange(false);
      
      // Reset form
      setHours('');
      setMinutes('');
      setReasonType('');
      setReasonNote('');
    } catch (error: any) {
      console.error('Error saving adjustment:', error);
      toast.error('Erro ao salvar ajuste: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTotalDisplay = () => {
    const h = parseInt(hours || '0');
    const m = parseInt(minutes || '0');
    if (h === 0 && m === 0) return null;
    return `${adjustmentType === 'credit' ? '+' : '-'}${h}h${m.toString().padStart(2, '0')}min`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ajuste Manual de Banco de Horas
          </DialogTitle>
          <DialogDescription>
            Funcionário: <strong>{employeeName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tipo de Ajuste */}
          <div className="space-y-2">
            <Label>Tipo de Ajuste</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjustmentType === 'credit' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustmentType('credit')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crédito
              </Button>
              <Button
                type="button"
                variant={adjustmentType === 'debit' ? 'destructive' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustmentType('debit')}
              >
                <Minus className="h-4 w-4 mr-2" />
                Débito
              </Button>
            </div>
          </div>

          {/* Horas e Minutos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horas</Label>
              <Input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Minutos</Label>
              <Input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                min="0"
                max="59"
              />
            </div>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo do Ajuste</Label>
            <Select value={reasonType} onValueChange={setReasonType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="Detalhes adicionais sobre o ajuste..."
              rows={3}
            />
          </div>

          {/* Resumo */}
          {getTotalDisplay() && (
            <div className="p-4 rounded-lg bg-muted border">
              <p className="text-sm font-medium mb-2">Resumo do Ajuste:</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valor:</span>
                <span className={`text-lg font-bold ${adjustmentType === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {getTotalDisplay()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-muted-foreground">Período:</span>
                <span className="text-sm">{startDate} a {endDate}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || (!hours && !minutes) || !reasonType}
          >
            {loading ? 'Salvando...' : 'Confirmar Ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
