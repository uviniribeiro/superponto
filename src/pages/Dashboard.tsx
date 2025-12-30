import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Clock, Users, CalendarCheck, AlertCircle, ArrowRight, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  todayRecords: number;
  pendingAdjustments: number;
  activeEmployees: number;
  myTodayRecords: { record_type: string; recorded_at: string }[];
}

export default function Dashboard() {
  const { profile, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    todayRecords: 0,
    pendingAdjustments: 0,
    activeEmployees: 0,
    myTodayRecords: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, [profile]);

  const fetchDashboardStats = async () => {
    if (!profile) return;

    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      // My today's records
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
        // Total records today
        const { count: todayCount } = await supabase
          .from('time_records')
          .select('*', { count: 'exact', head: true })
          .gte('recorded_at', startOfDay)
          .lte('recorded_at', endOfDay);

        // Pending adjustments
        const { count: pendingCount } = await supabase
          .from('adjustment_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Active employees
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
        <Button onClick={() => navigate('/time-clock')} size="lg" className="gradient-primary">
          <Clock className="mr-2 h-5 w-5" />
          Registrar Ponto
        </Button>
      </div>

      {/* Stats Grid for Admin/Manager */}
      {(isAdmin || isManager) && (
        <div className="grid gap-4 md:grid-cols-3">
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
        </div>
      )}

      {/* My Today's Records */}
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
    </div>
  );
}