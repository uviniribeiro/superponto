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
  registration_number: string | null;
  total_classes: number;
  total_minutes: number;
  total_records: number;
  configuration_name: string | null;
}

export default function TeacherSummary() {
  useSEO({
    title: 'Resumo | Módulo Professor',
    description: 'Resumo consolidado das aulas por professor.',
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

      // Fetch records with profiles and configurations
      const { data: records, error } = await supabase
        .from('class_records')
        .select(`
          profile_id,
          number_of_classes,
          total_minutes,
          profile:profiles(full_name, registration_number),
          class_hour_configuration:class_hour_configurations(name)
        `)
        .gte('class_date', startDate)
        .lte('class_date', endDate);

      if (error) throw error;

      // Group by profile
      const grouped = (records || []).reduce((acc: { [key: string]: SummaryData }, record: any) => {
        const id = record.profile_id;
        if (!acc[id]) {
          acc[id] = {
            profile_id: id,
            full_name: record.profile?.full_name || 'Desconhecido',
            registration_number: record.profile?.registration_number,
            total_classes: 0,
            total_minutes: 0,
            total_records: 0,
            configuration_name: record.class_hour_configuration?.name
          };
        }
        acc[id].total_classes += record.number_of_classes;
        acc[id].total_minutes += record.total_minutes;
        acc[id].total_records += 1;
        return acc;
      }, {});

      setData(Object.values(grouped).sort((a, b) => b.total_minutes - a.total_minutes));
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
    classes: data.reduce((sum, d) => sum + d.total_classes, 0),
    minutes: data.reduce((sum, d) => sum + d.total_minutes, 0),
    records: data.reduce((sum, d) => sum + d.total_records, 0),
    teachers: data.length
  }), [data]);

  const handleExport = () => {
    const csv = [
      ['Professor', 'Matrícula', 'Configuração', 'Aulas', 'Horas', 'Registros'].join(','),
      ...data.map(d => [
        d.full_name,
        d.registration_number || '',
        d.configuration_name || '',
        d.total_classes,
        (d.total_minutes / 60).toFixed(2),
        d.total_records
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo-professores-${format(filterMonth, 'yyyy-MM')}.csv`;
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
            Resumo de Aulas
          </h1>
          <p className="text-muted-foreground mt-1">
            Consolidado mensal por professor
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
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4 lg:p-6">
            <p className="text-sm text-muted-foreground">Professores</p>
            <p className="text-2xl lg:text-3xl font-bold text-blue-600 dark:text-blue-400">
              {totals.teachers}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4 lg:p-6">
            <p className="text-sm text-muted-foreground">Total Aulas</p>
            <p className="text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-400">
              {totals.classes}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4 lg:p-6">
            <p className="text-sm text-muted-foreground">Total Horas</p>
            <p className="text-2xl lg:text-3xl font-bold text-purple-600 dark:text-purple-400">
              {(totals.minutes / 60).toFixed(1)}h
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4 lg:p-6">
            <p className="text-sm text-muted-foreground">Registros</p>
            <p className="text-2xl lg:text-3xl font-bold text-orange-600 dark:text-orange-400">
              {totals.records}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo por Professor</CardTitle>
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
                  <TableHead>Professor</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Configuração</TableHead>
                  <TableHead className="text-center">Aulas</TableHead>
                  <TableHead className="text-center">Horas</TableHead>
                  <TableHead className="text-center">Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.profile_id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell>{row.registration_number || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.configuration_name || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{row.total_classes}</TableCell>
                    <TableCell className="text-center">{(row.total_minutes / 60).toFixed(1)}h</TableCell>
                    <TableCell className="text-center">{row.total_records}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro de aula neste mês</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
