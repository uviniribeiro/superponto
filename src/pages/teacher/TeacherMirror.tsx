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

interface TeacherAssignment {
  id: string;
  profile_id: string;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
  class_hour_configuration?: {
    name: string;
    duration_minutes: number;
  };
}

interface ClassRecord {
  id: string;
  class_date: string;
  number_of_classes: number;
  total_minutes: number;
  notes: string | null;
}

export default function TeacherMirror() {
  useSEO({
    title: 'Espelho de Ponto | Módulo Professor',
    description: 'Visualize o espelho de ponto dos professores.',
  });

  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState(new Date());
  const [records, setRecords] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      fetchRecords();
    }
  }, [selectedTeacher, filterMonth]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_class_hour_assignments')
        .select(`
          id, profile_id,
          profile:profiles(full_name, registration_number),
          class_hour_configuration:class_hour_configurations(name, duration_minutes)
        `)
        .eq('is_active', true);

      if (error) throw error;
      setAssignments(data as unknown as TeacherAssignment[]);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Erro ao carregar professores');
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('class_records')
        .select('*')
        .eq('profile_id', selectedTeacher)
        .gte('class_date', startDate)
        .lte('class_date', endDate)
        .order('class_date');

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

  const selectedAssignment = assignments.find(a => a.profile_id === selectedTeacher);
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(filterMonth),
    end: endOfMonth(filterMonth)
  });

  const getRecordForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return records.find(r => r.class_date === dateStr);
  };

  const getDayName = (dayIndex: number) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[dayIndex];
  };

  const totalClasses = records.reduce((sum, r) => sum + r.number_of_classes, 0);
  const totalMinutes = records.reduce((sum, r) => sum + r.total_minutes, 0);

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
            Visualize o espelho de ponto do professor
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

          <Button variant="outline" className="gap-2" onClick={handlePrint} disabled={!selectedTeacher}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Teacher Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Selecionar Professor</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione o professor" />
            </SelectTrigger>
            <SelectContent>
              {assignments.map((a) => (
                <SelectItem key={a.id} value={a.profile_id}>
                  {a.profile?.full_name} - {a.profile?.registration_number || 'Sem matrícula'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Mirror Content */}
      {selectedTeacher ? (
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="print:pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{selectedAssignment?.profile?.full_name}</CardTitle>
                <CardDescription>
                  Matrícula: {selectedAssignment?.profile?.registration_number || 'N/A'} | 
                  Configuração: {selectedAssignment?.class_hour_configuration?.name}
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
                      <TableHead className="text-center">Aulas</TableHead>
                      <TableHead className="text-center">Horas</TableHead>
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
                              <Badge variant="default">{record.number_of_classes}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {record ? `${(record.total_minutes / 60).toFixed(1)}h` : '-'}
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
                    <p className="text-sm text-muted-foreground">Total de Registros</p>
                    <p className="text-2xl font-bold">{records.length}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total de Aulas</p>
                    <p className="text-2xl font-bold">{totalClasses}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total de Horas</p>
                    <p className="text-2xl font-bold">{(totalMinutes / 60).toFixed(1)}h</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Média/Registro</p>
                    <p className="text-2xl font-bold">
                      {records.length > 0 ? (totalClasses / records.length).toFixed(1) : 0}
                    </p>
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
            <p>Selecione um professor para visualizar o espelho de ponto</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
