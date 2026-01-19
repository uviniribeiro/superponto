import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  BarChart3, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';

interface SummaryData {
  profile_id: string;
  full_name: string;
  crm: string | null;
  crm_state: string | null;
  specialty: string | null;
  total_shifts: number;
  total_hours: number;
  night_shifts: number;
  weekend_shifts: number;
  holiday_shifts: number;
}

export default function DoctorSummary() {
  useSEO({
    title: 'Resumo | Módulo Médico',
    description: 'Resumo consolidado dos plantões por médico.',
  });

  const [data, setData] = useState<SummaryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [filterMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

      // Fetch records with profiles
      const { data: records, error } = await supabase
        .from('medical_shift_records')
        .select(`
          profile_id,
          total_hours,
          is_night_shift,
          is_weekend,
          is_holiday,
          profile:profiles(full_name)
        `)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate);

      if (error) throw error;

      // Fetch assignments for CRM info
      const { data: assignments } = await supabase
        .from('doctor_assignments')
        .select('profile_id, crm, crm_state, specialty');

      const assignmentMap = (assignments || []).reduce((acc: any, a: any) => {
        acc[a.profile_id] = a;
        return acc;
      }, {});

      // Group by profile
      const grouped = (records || []).reduce((acc: { [key: string]: SummaryData }, record: any) => {
        const id = record.profile_id;
        const assignment = assignmentMap[id];
        
        if (!acc[id]) {
          acc[id] = {
            profile_id: id,
            full_name: record.profile?.full_name || 'Desconhecido',
            crm: assignment?.crm,
            crm_state: assignment?.crm_state,
            specialty: assignment?.specialty,
            total_shifts: 0,
            total_hours: 0,
            night_shifts: 0,
            weekend_shifts: 0,
            holiday_shifts: 0
          };
        }
        acc[id].total_shifts += 1;
        acc[id].total_hours += record.total_hours;
        if (record.is_night_shift) acc[id].night_shifts += 1;
        if (record.is_weekend) acc[id].weekend_shifts += 1;
        if (record.is_holiday) acc[id].holiday_shifts += 1;
        return acc;
      }, {});

      setData(Object.values(grouped).sort((a, b) => b.total_hours - a.total_hours));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(filterMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setFilterMonth(newDate);
  };

  const totals = useMemo(() => ({
    shifts: data.reduce((sum, d) => sum + d.total_shifts, 0),
    hours: data.reduce((sum, d) => sum + d.total_hours, 0),
    night: data.reduce((sum, d) => sum + d.night_shifts, 0),
    doctors: data.length
  }), [data]);

  const handleExport = () => {
    const csv = [
      ['Médico', 'CRM', 'Especialidade', 'Plantões', 'Horas', 'Noturnos', 'FDS', 'Feriados'].join(','),
      ...data.map(d => [
        d.full_name,
        d.crm ? `${d.crm}/${d.crm_state}` : '',
        d.specialty || '',
        d.total_shifts,
        d.total_hours,
        d.night_shifts,
        d.weekend_shifts,
        d.holiday_shifts
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo-medicos-${format(filterMonth, 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Resumo de Plantões
          </h1>
          <p className="text-muted-foreground mt-1">
            Consolidado mensal por médico
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-8 px-3 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={filterMonth}
                  onSelect={(date) => date && setFilterMonth(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={data.length === 0}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4 lg:p-6">
            <p className="text-sm text-muted-foreground">Médicos</p>
            <p className="text-2xl lg:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {totals.doctors}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4 lg:p-6">
            <p className="text-sm text-muted-foreground">Total Plantões</p>
            <p className="text-2xl lg:text-3xl font-bold text-blue-600 dark:text-blue-400">
              {totals.shifts}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4 lg:p-6">
            <p className="text-sm text-muted-foreground">Total Horas</p>
            <p className="text-2xl lg:text-3xl font-bold text-purple-600 dark:text-purple-400">
              {totals.hours}h
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4 lg:p-6">
            <p className="text-sm text-muted-foreground">Noturnos</p>
            <p className="text-2xl lg:text-3xl font-bold text-orange-600 dark:text-orange-400">
              {totals.night}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo por Médico</CardTitle>
          <CardDescription>
            Dados consolidados de {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Médico</TableHead>
                  <TableHead>CRM</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead className="text-center">Plantões</TableHead>
                  <TableHead className="text-center">Horas</TableHead>
                  <TableHead className="text-center">Noturnos</TableHead>
                  <TableHead className="text-center">FDS</TableHead>
                  <TableHead className="text-center">Feriados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.profile_id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell>{row.crm ? `${row.crm}/${row.crm_state}` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.specialty || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{row.total_shifts}</TableCell>
                    <TableCell className="text-center">{row.total_hours}h</TableCell>
                    <TableCell className="text-center">{row.night_shifts}</TableCell>
                    <TableCell className="text-center">{row.weekend_shifts}</TableCell>
                    <TableCell className="text-center">{row.holiday_shifts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro de plantão neste mês</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
