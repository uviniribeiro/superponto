import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  GraduationCap, 
  Users, 
  Clock, 
  Calendar as CalendarIcon,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';

interface TeacherConfiguration {
  id: string;
  name: string;
  is_active: boolean;
}

interface TeacherAssignment {
  id: string;
  profile_id: string;
  educator_type: string | null;
  subject: string | null;
  contract_weekly_hours: number | null;
  profile?: {
    full_name: string;
  };
}

interface ClassRecord {
  id: string;
  number_of_classes: number;
  total_minutes: number;
  class_date: string;
  profile?: {
    full_name: string;
  };
}

const educatorTypes: Record<string, string> = {
  'PEB_I': 'PEB I - Educação Infantil',
  'PEB_II': 'PEB II - Ensino Fundamental',
  'PEB_III': 'PEB III - Ensino Médio',
};

export default function TeacherDashboard() {
  useSEO({
    title: 'Dashboard Professor | SuperPonto',
    description: 'Dashboard do módulo professor com visão geral de professores e aulas.',
  });

  const [configurations, setConfigurations] = useState<TeacherConfiguration[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [records, setRecords] = useState<ClassRecord[]>([]);
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

      const [configsRes, assignmentsRes, recordsRes] = await Promise.all([
        supabase.from('class_hour_configurations').select('id, name, is_active').order('name'),
        supabase.from('employee_class_hour_assignments').select(`
          id, profile_id, educator_type, subject, contract_weekly_hours,
          profile:profiles(full_name)
        `).order('created_at', { ascending: false }),
        supabase.from('class_records').select(`
          id, number_of_classes, total_minutes, class_date,
          profile:profiles(full_name)
        `).gte('class_date', startDate).lte('class_date', endDate).order('class_date', { ascending: false }),
      ]);

      if (configsRes.data) setConfigurations(configsRes.data);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as TeacherAssignment[]);
      if (recordsRes.data) setRecords(recordsRes.data as unknown as ClassRecord[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => ({
    totalTeachers: assignments.length,
    totalClasses: records.reduce((sum, r) => sum + r.number_of_classes, 0),
    totalHours: records.reduce((sum, r) => sum + r.total_minutes, 0) / 60,
    activeConfigs: configurations.filter(c => c.is_active).length,
  }), [assignments, records, configurations]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(filterMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setFilterMonth(newDate);
  };

  if (loading && configurations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GraduationCap className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Dashboard Professor
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do módulo professor
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
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Professores</p>
                <p className="text-2xl lg:text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalTeachers}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Aulas</p>
                <p className="text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-400">{stats.totalClasses}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <BookOpen className="h-5 w-5 lg:h-6 lg:w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Horas Aula</p>
                <p className="text-2xl lg:text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.totalHours.toFixed(1)}h</p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Configurações</p>
                <p className="text-2xl lg:text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.activeConfigs}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/10">
                <Settings className="h-5 w-5 lg:h-6 lg:w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Professores Atribuídos
            </CardTitle>
            <CardDescription>Professores com configuração de hora aula ativa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignments.slice(0, 5).map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {assignment.profile?.full_name?.charAt(0) || 'P'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{assignment.profile?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{assignment.subject || 'Disciplina não definida'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {assignment.contract_weekly_hours ? `${assignment.contract_weekly_hours}h/sem` : 'Horista'}
                    </p>
                  </div>
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum professor atribuído</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Aulas Recentes
            </CardTitle>
            <CardDescription>Registros de aulas do período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {records.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div>
                    <p className="font-medium text-sm">{record.profile?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(record.class_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{record.number_of_classes} aulas</p>
                    <p className="text-xs text-muted-foreground">{(record.total_minutes / 60).toFixed(1)}h</p>
                  </div>
                </div>
              ))}
              {records.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma aula registrada no período</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
