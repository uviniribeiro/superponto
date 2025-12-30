import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Clock, Users, CalendarCheck, AlertCircle, ArrowRight, TrendingUp, BarChart3, Timer, UserX, Building2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, differenceInMinutes, parseISO, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

interface DashboardStats {
  todayRecords: number;
  pendingAdjustments: number;
  activeEmployees: number;
  myTodayRecords: { record_type: string; recorded_at: string }[];
}

interface DailyHours {
  date: string;
  hours: number;
  day: string;
}

interface AttendanceData {
  name: string;
  value: number;
  color: string;
}

export default function Dashboard() {
  const { profile, company, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const [copiedCode, setCopiedCode] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    todayRecords: 0,
    pendingAdjustments: 0,
    activeEmployees: 0,
    myTodayRecords: []
  });
  const [loading, setLoading] = useState(true);
  const [weeklyHours, setWeeklyHours] = useState<DailyHours[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ totalHours: 0, avgHours: 0, delays: 0, absences: 0 });

  useEffect(() => {
    fetchDashboardStats();
    if (profile) {
      fetchWeeklyHours();
      if (isAdmin || isManager) {
        fetchAttendanceStats();
      }
    }
  }, [profile, isAdmin, isManager]);

  const fetchDashboardStats = async () => {
    if (!profile) return;

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const { data: myRecords } = await supabase
        .from('time_records')
        .select('record_type, recorded_at')
        .eq('profile_id', profile.id)
        .gte('recorded_at', startOfDay)
        .lte('recorded_at', endOfDay)
        .order('recorded_at', { ascending: true });

      setStats(prev => ({
        ...prev,
        myTodayRecords: myRecords || []
      }));

      if (isAdmin || isManager) {
        const { count: todayCount } = await supabase
          .from('time_records')
          .select('*', { count: 'exact', head: true })
          .gte('recorded_at', startOfDay)
          .lte('recorded_at', endOfDay);

        const { count: pendingCount } = await supabase
          .from('adjustment_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        const { count: employeeCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        setStats(prev => ({
          ...prev,
          todayRecords: todayCount || 0,
          pendingAdjustments: pendingCount || 0,
          activeEmployees: employeeCount || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyHours = async () => {
    if (!profile) return;

    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      const { data: records } = await supabase
        .from('time_records')
        .select('record_type, recorded_at')
        .eq('profile_id', profile.id)
        .gte('recorded_at', weekStart.toISOString())
        .lte('recorded_at', weekEnd.toISOString())
        .order('recorded_at', { ascending: true });

      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const dailyData: DailyHours[] = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayRecords = (records || []).filter(r => 
          format(parseISO(r.recorded_at), 'yyyy-MM-dd') === dayStr
        );

        let totalMinutes = 0;
        const entries = dayRecords.filter(r => r.record_type === 'entry');
        const exits = dayRecords.filter(r => r.record_type === 'exit');

        entries.forEach((entry, i) => {
          const exit = exits[i];
          if (exit) {
            totalMinutes += differenceInMinutes(parseISO(exit.recorded_at), parseISO(entry.recorded_at));
          }
        });

        // Subtract break time
        const breakStarts = dayRecords.filter(r => r.record_type === 'break_start');
        const breakEnds = dayRecords.filter(r => r.record_type === 'break_end');
        breakStarts.forEach((bs, i) => {
          const be = breakEnds[i];
          if (be) {
            totalMinutes -= differenceInMinutes(parseISO(be.recorded_at), parseISO(bs.recorded_at));
          }
        });

        return {
          date: dayStr,
          hours: Math.max(0, totalMinutes / 60),
          day: format(day, 'EEE', { locale: ptBR })
        };
      });

      setWeeklyHours(dailyData);

      // Calculate monthly stats
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      const { data: monthRecords } = await supabase
        .from('time_records')
        .select('record_type, recorded_at')
        .eq('profile_id', profile.id)
        .gte('recorded_at', monthStart.toISOString())
        .lte('recorded_at', monthEnd.toISOString());

      let monthlyMinutes = 0;
      const monthDays = eachDayOfInterval({ start: monthStart, end: today });
      let daysWithRecords = 0;

      monthDays.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayRecords = (monthRecords || []).filter(r => 
          format(parseISO(r.recorded_at), 'yyyy-MM-dd') === dayStr
        );

        if (dayRecords.length > 0) daysWithRecords++;

        const entries = dayRecords.filter(r => r.record_type === 'entry');
        const exits = dayRecords.filter(r => r.record_type === 'exit');

        entries.forEach((entry, i) => {
          const exit = exits[i];
          if (exit) {
            monthlyMinutes += differenceInMinutes(parseISO(exit.recorded_at), parseISO(entry.recorded_at));
          }
        });
      });

      setMonthlyStats({
        totalHours: Math.round(monthlyMinutes / 60),
        avgHours: daysWithRecords > 0 ? Math.round((monthlyMinutes / 60) / daysWithRecords * 10) / 10 : 0,
        delays: 0, // Would need schedule comparison
        absences: 0 // Would need schedule comparison
      });

    } catch (error) {
      console.error('Error fetching weekly hours:', error);
    }
  };

  const fetchAttendanceStats = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();

      const { count: totalEmployees } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { data: todayEntries } = await supabase
        .from('time_records')
        .select('profile_id')
        .eq('record_type', 'entry')
        .gte('recorded_at', startOfDay);

      const uniquePresent = new Set(todayEntries?.map(r => r.profile_id) || []).size;
      const absent = (totalEmployees || 0) - uniquePresent;

      setAttendanceData([
        { name: 'Presentes', value: uniquePresent, color: '#22c55e' },
        { name: 'Ausentes', value: Math.max(0, absent), color: '#ef4444' },
      ]);
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
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

  const currentDate = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const copyCompanyCode = () => {
    if (company?.company_code) {
      navigator.clipboard.writeText(company.company_code);
      setCopiedCode(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'}!
          </h1>
          <p className="text-muted-foreground capitalize">{currentDate}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/time-clock')} size="lg" className="gradient-primary">
            <Clock className="mr-2 h-5 w-5" />
            Registrar Ponto
          </Button>
        </div>
      </div>

      {/* Company Code Card for Admins */}
      {isAdmin && company && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Código da Empresa</p>
                  <p className="text-2xl font-bold tracking-wider">{company.company_code}</p>
                </div>
              </div>
              <div className="flex flex-col md:items-end gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyCompanyCode}
                  className="gap-2"
                >
                  {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode ? 'Copiado!' : 'Copiar Código'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Compartilhe com seus funcionários para login
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid for Admin/Manager */}
      {(isAdmin || isManager) && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Registros Hoje
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.todayRecords}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ajustes Pendentes
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.pendingAdjustments}</div>
              {stats.pendingAdjustments > 0 && (
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-sm"
                  onClick={() => navigate('/adjustments')}
                >
                  Ver pendentes <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Funcionários Ativos
              </CardTitle>
              <Users className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeEmployees}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Horas Este Mês
              </CardTitle>
              <Timer className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{monthlyStats.totalHours}h</div>
              <p className="text-sm text-muted-foreground">Média: {monthlyStats.avgHours}h/dia</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Hours Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Horas Trabalhadas na Semana
            </CardTitle>
            <CardDescription>Suas horas por dia nesta semana</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyHours}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="day" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${value}h`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}h`, 'Horas']}
                  />
                  <Bar 
                    dataKey="hours" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Pie Chart (Admin/Manager only) */}
        {(isAdmin || isManager) && attendanceData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Presença Hoje
              </CardTitle>
              <CardDescription>Status dos funcionários hoje</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {attendanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Today's Records - Full width if not admin */}
        {!(isAdmin || isManager) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                Meus Registros de Hoje
              </CardTitle>
              <CardDescription>
                Acompanhe seus registros de ponto do dia
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Clock className="h-6 w-6 animate-pulse-soft text-primary" />
                </div>
              ) : stats.myTodayRecords.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {stats.myTodayRecords.map((record, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50"
                    >
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{getRecordTypeLabel(record.record_type)}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(record.recorded_at), 'HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhum registro hoje</p>
                  <Button 
                    variant="link" 
                    onClick={() => navigate('/time-clock')}
                    className="mt-2"
                  >
                    Registrar agora <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* My Today's Records for Admin/Manager */}
      {(isAdmin || isManager) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Meus Registros de Hoje
            </CardTitle>
            <CardDescription>
              Acompanhe seus registros de ponto do dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Clock className="h-6 w-6 animate-pulse-soft text-primary" />
              </div>
            ) : stats.myTodayRecords.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-4">
                {stats.myTodayRecords.map((record, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50"
                  >
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{getRecordTypeLabel(record.record_type)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(record.recorded_at), 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum registro hoje</p>
                <Button 
                  variant="link" 
                  onClick={() => navigate('/time-clock')}
                  className="mt-2"
                >
                  Registrar agora <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}