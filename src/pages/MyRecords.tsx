import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FileText, Plus, Clock, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';

interface TimeRecord {
  id: string;
  record_type: string;
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

export default function MyRecords() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    request_type: 'addition',
    requested_time: '',
    reason: ''
  });

  useEffect(() => {
    if (profile) fetchRecords();
  }, [profile, startDate, endDate]);

  const fetchRecords = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('profile_id', profile.id)
        .gte('recorded_at', `${startDate}T00:00:00`)
        .lte('recorded_at', `${endDate}T23:59:59`)
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustmentRequest = async () => {
    if (!profile) return;

    if (!adjustmentData.requested_time || !adjustmentData.reason.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const { error } = await supabase.from('adjustment_requests').insert({
        profile_id: profile.id,
        request_type: adjustmentData.request_type,
        requested_time: new Date(adjustmentData.requested_time).toISOString(),
        reason: adjustmentData.reason.trim()
      });

      if (error) throw error;

      toast.success('Solicitação enviada com sucesso!');
      setIsDialogOpen(false);
      setAdjustmentData({ request_type: 'addition', requested_time: '', reason: '' });
    } catch (error) {
      console.error('Error creating adjustment request:', error);
      toast.error('Erro ao enviar solicitação');
    }
  };

  const getRecordTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      entry: 'Entrada',
      break_start: 'Início Intervalo',
      break_end: 'Fim Intervalo',
      exit: 'Saída'
    };
    return labels[type] || type;
  };

  const getRecordTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      entry: 'default',
      break_start: 'secondary',
      break_end: 'secondary',
      exit: 'outline'
    };
    return (
      <Badge variant={variants[type] || 'default'}>
        {getRecordTypeLabel(type)}
      </Badge>
    );
  };

  // Agrupa registros por dia
  const groupedRecords = records.reduce((acc, record) => {
    const date = format(new Date(record.recorded_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(record);
    return acc;
  }, {} as Record<string, TimeRecord[]>);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Meus Registros"
          description="Visualize e solicite ajustes nos seus registros" icon={FileText}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="mr-2 h-4 w-4" />
              Solicitar Ajuste
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Ajuste de Ponto</DialogTitle>
              <DialogDescription>
                Preencha os dados para solicitar um ajuste
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Ajuste</Label>
                <Select 
                  value={adjustmentData.request_type} 
                  onValueChange={(v) => setAdjustmentData({ ...adjustmentData, request_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="addition">Adição de registro</SelectItem>
                    <SelectItem value="correction">Correção de horário</SelectItem>
                    <SelectItem value="deletion">Exclusão de registro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Data e Hora *</Label>
                <Input
                  type="datetime-local"
                  value={adjustmentData.requested_time}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, requested_time: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Textarea
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  placeholder="Descreva o motivo do ajuste..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdjustmentRequest} className="gradient-primary">
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
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
            <div className="flex items-end">
              <Button onClick={fetchRecords} variant="outline" className="w-full">
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registros */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse-soft">Carregando...</div>
        </div>
      ) : Object.keys(groupedRecords).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedRecords).map(([date, dayRecords]) => (
            <Card key={date}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  {format(new Date(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </CardTitle>
                <CardDescription>{dayRecords.length} registros</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dayRecords.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-4">
                        {getRecordTypeBadge(record.record_type)}
                        <span className="font-mono text-lg font-medium">
                          {format(new Date(record.recorded_at), 'HH:mm:ss')}
                        </span>
                      </div>
                      {record.address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground max-w-xs truncate">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{record.address}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum registro encontrado no período</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}