import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  FileText, 
  Calendar as CalendarIcon,
  Printer
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';

interface DoctorAssignment {
  id: string;
  profile_id: string;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
  shift_configuration?: {
    name: string;
    duration_hours: number;
  };
  specialty: string | null;
  crm: string | null;
  crm_state: string | null;
}

interface ShiftRecord {
  id: string;
  shift_date: string;
  total_hours: number;
  shift_type: string | null;
  is_night_shift: boolean;
  is_weekend: boolean;
  is_holiday: boolean;
  notes: string | null;
}

export default function DoctorMirror() {
  useSEO({
    title: 'Espelho de Ponto | Módulo Médico',
    description: 'Visualize o espelho de ponto dos médicos.',
  });

  const [assignments, setAssignments] = useState<DoctorAssignment[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState(new Date());
  const [records, setRecords] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (selectedDoctor) {
      fetchRecords();
    }
  }, [selectedDoctor, filterMonth]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('doctor_assignments')
        .select(`
          id, profile_id, specialty, crm, crm_state,
          profile:profiles(full_name, registration_number),
          shift_configuration:medical_shift_configurations(name, duration_hours)
        `)
        .eq('is_active', true);

      if (error) throw error;
      setAssignments(data as unknown as DoctorAssignment[]);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Erro ao carregar médicos');
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('medical_shift_records')
        .select('*')
        .eq('profile_id', selectedDoctor)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate)
        .order('shift_date');

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedAssignment = assignments.find(a => a.profile_id === selectedDoctor);
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(filterMonth),
    end: endOfMonth(filterMonth)
  });

  const getRecordForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return records.find(r => r.shift_date === dateStr);
  };

  const getDayName = (dayIndex: number) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[dayIndex];
  };

  const totalShifts = records.length;
  const totalHours = records.reduce((sum, r) => sum + r.total_hours, 0);
  const nightShifts = records.filter(r => r.is_night_shift).length;
  const weekendShifts = records.filter(r => r.is_weekend).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Espelho de Ponto
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize o espelho de ponto do médico
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(filterMonth, 'MMM yyyy', { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filterMonth}
                onSelect={(date) => date && setFilterMonth(date)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" className="gap-2" onClick={handlePrint} disabled={!selectedDoctor}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Doctor Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Selecionar Médico</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione o médico" />
            </SelectTrigger>
            <SelectContent>
              {assignments.map((a) => (
                <SelectItem key={a.id} value={a.profile_id}>
                  {a.profile?.full_name} - {a.crm ? `CRM ${a.crm}/${a.crm_state}` : 'Sem CRM'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Mirror Content */}
      {selectedDoctor ? (
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="print:pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{selectedAssignment?.profile?.full_name}</CardTitle>
                <CardDescription>
                  CRM: {selectedAssignment?.crm || 'N/A'}/{selectedAssignment?.crm_state || ''} | 
                  Especialidade: {selectedAssignment?.specialty || 'N/A'} |
                  Configuração: {selectedAssignment?.shift_configuration?.name}
                </CardDescription>
              </div>
              <Badge variant="outline">
                {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Data</TableHead>
                      <TableHead className="w-16">Dia</TableHead>
                      <TableHead className="text-center">Horas</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daysInMonth.map((day) => {
                      const record = getRecordForDay(day);
                      const dayOfWeek = getDay(day);
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      return (
                        <TableRow key={day.toISOString()} className={isWeekend ? 'bg-muted/30' : ''}>
                          <TableCell className="font-medium">
                            {format(day, 'dd/MM', { locale: ptBR })}
                          </TableCell>
                          <TableCell className={isWeekend ? 'text-muted-foreground' : ''}>
                            {getDayName(dayOfWeek)}
                          </TableCell>
                          <TableCell className="text-center">
                            {record ? (
                              <Badge variant="default">{record.total_hours}h</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {record ? (
                              <div className="flex justify-center gap-1">
                                {record.is_night_shift && <Badge variant="secondary" className="text-xs">N</Badge>}
                                {record.is_weekend && <Badge variant="secondary" className="text-xs">FDS</Badge>}
                                {record.is_holiday && <Badge variant="secondary" className="text-xs">F</Badge>}
                                {!record.is_night_shift && !record.is_weekend && !record.is_holiday && 
                                  <Badge variant="outline" className="text-xs">Reg</Badge>
                                }
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {record?.notes || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Summary */}
                <div className="mt-6 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Plantões</p>
                    <p className="text-2xl font-bold">{totalShifts}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Horas</p>
                    <p className="text-2xl font-bold">{totalHours}h</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Plantões Noturnos</p>
                    <p className="text-2xl font-bold">{nightShifts}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Fins de Semana</p>
                    <p className="text-2xl font-bold">{weekendShifts}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione um médico para visualizar o espelho de ponto</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
