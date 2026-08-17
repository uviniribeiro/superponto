import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  MapPin, 
  Monitor, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  Download,
  Fingerprint,
  Key,
  Smartphone
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';

interface SecurityLog {
  id: string;
  event_type: string;
  severity: string;
  ip_address: string | null;
  user_agent: string | null;
  location: string | null;
  metadata: unknown;
  created_at: string;
}

interface SecurityStats {
  totalEvents: number;
  successfulLogins: number;
  failedLogins: number;
  suspiciousEvents: number;
  uniqueIPs: number;
  twoFactorEnabled: boolean;
  webauthnCredentials: number;
}

const eventTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  login: { label: 'Login', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
  login_failed: { label: 'Login Falhou', icon: <XCircle className="h-4 w-4 text-red-500" /> },
  logout: { label: 'Logout', icon: <Activity className="h-4 w-4 text-blue-500" /> },
  '2fa_enabled': { label: '2FA Ativado', icon: <ShieldCheck className="h-4 w-4 text-green-500" /> },
  '2fa_disabled': { label: '2FA Desativado', icon: <ShieldAlert className="h-4 w-4 text-yellow-500" /> },
  password_changed: { label: 'Senha Alterada', icon: <Key className="h-4 w-4 text-blue-500" /> },
  suspicious_activity: { label: 'Atividade Suspeita', icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
  webauthn_registered: { label: 'Biometria Registrada', icon: <Fingerprint className="h-4 w-4 text-green-500" /> },
  webauthn_login: { label: 'Login Biométrico', icon: <Fingerprint className="h-4 w-4 text-blue-500" /> },
  webauthn_removed: { label: 'Biometria Removida', icon: <Fingerprint className="h-4 w-4 text-yellow-500" /> },
};

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const CHART_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

export default function SecurityDashboard() {
  const { user, isAdmin } = useAuth();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    if (user) {
      fetchSecurityData();
    }
  }, [user, filter, timeRange]);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      // Calcular data inicial baseado no range
      const now = new Date();
      let startDate = new Date();
      switch (timeRange) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
      }

      // Buscar logs
      let query = supabase
        .from('security_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('severity', filter);
      }

      const { data: logsData, error: logsError } = await query;

      if (logsError) throw logsError;
      setLogs(logsData || []);

      // Calcular estatísticas
      const allLogs = logsData || [];
      const successfulLogins = allLogs.filter(l => l.event_type === 'login').length;
      const failedLogins = allLogs.filter(l => l.event_type === 'login_failed').length;
      const suspiciousEvents = allLogs.filter(l => l.severity === 'critical' || l.event_type === 'suspicious_activity').length;
      const uniqueIPs = new Set(allLogs.map(l => l.ip_address).filter(Boolean)).size;

      // Buscar status 2FA e WebAuthn
      const { data: profile } = await supabase
        .from('profiles')
        .select('two_factor_enabled')
        .eq('user_id', user?.id)
        .single();

      const { data: webauthnCreds } = await supabase
        .from('webauthn_credentials')
        .select('id')
        .eq('user_id', user?.id);

      setStats({
        totalEvents: allLogs.length,
        successfulLogins,
        failedLogins,
        suspiciousEvents,
        uniqueIPs,
        twoFactorEnabled: profile?.two_factor_enabled || false,
        webauthnCredentials: webauthnCreds?.length || 0,
      });
    } catch (error) {
      console.error('Erro ao buscar dados de segurança:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventsByType = () => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      counts[log.event_type] = (counts[log.event_type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: eventTypeLabels[name]?.label || name,
      value,
    }));
  };

  const getEventsBySeverity = () => {
    const counts: Record<string, number> = { info: 0, warning: 0, critical: 0 };
    logs.forEach(log => {
      counts[log.severity] = (counts[log.severity] || 0) + 1;
    });
    return [
      { name: 'Info', value: counts.info, color: '#3b82f6' },
      { name: 'Aviso', value: counts.warning, color: '#f59e0b' },
      { name: 'Crítico', value: counts.critical, color: '#ef4444' },
    ];
  };

  const getEventsOverTime = () => {
    const dayMap: Record<string, number> = {};
    logs.forEach(log => {
      const day = format(new Date(log.created_at), 'dd/MM');
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    return Object.entries(dayMap)
      .slice(-7)
      .map(([day, count]) => ({ day, count }));
  };

  const parseUserAgent = (ua: string) => {
    if (!ua) return 'Desconhecido';
    if (ua.includes('Mobile')) return 'Mobile';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    return 'Desktop';
  };

  const exportLogs = () => {
    const csv = [
      ['Data', 'Evento', 'Severidade', 'IP', 'Dispositivo', 'Localização'].join(','),
      ...logs.map(log => [
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
        eventTypeLabels[log.event_type]?.label || log.event_type,
        log.severity,
        log.ip_address || 'N/A',
        parseUserAgent(log.user_agent),
        log.location || 'N/A',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Dashboard de Segurança"
          description="Monitore a atividade de segurança da sua conta" icon={Shield}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchSecurityData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Alertas de Segurança */}
      {stats && (
        <>
          {!stats.twoFactorEnabled && (
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                <strong>Recomendação:</strong> Ative a autenticação de dois fatores (2FA) para maior segurança.
              </AlertDescription>
            </Alert>
          )}
          {stats.suspiciousEvents > 0 && (
            <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-700 dark:text-red-300">
                <strong>Atenção:</strong> {stats.suspiciousEvents} evento(s) suspeito(s) detectado(s) recentemente.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Logins Bem-sucedidos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.successfulLogins || 0}</div>
            <p className="text-xs text-muted-foreground">Acessos autenticados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tentativas Falhas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.failedLogins || 0}</div>
            <p className="text-xs text-muted-foreground">Logins rejeitados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">IPs Únicos</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueIPs || 0}</div>
            <p className="text-xs text-muted-foreground">Locais diferentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Status */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Autenticação 2FA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.twoFactorEnabled ? (
              <div className="flex items-center gap-2 text-green-600">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-medium">Ativo</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-medium">Não configurado</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              Login Biométrico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.webauthnCredentials && stats.webauthnCredentials > 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-medium">{stats.webauthnCredentials} dispositivo(s)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="h-5 w-5" />
                <span>Não configurado</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Eventos Críticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.suspiciousEvents === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Nenhum detectado</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-medium">{stats?.suspiciousEvents} evento(s)</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Eventos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={getEventsByType()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {getEventsByType().map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Atividade por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getEventsOverTime()}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle>Log de Atividades</CardTitle>
              <CardDescription>Histórico detalhado de eventos de segurança</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Aviso</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum evento de segurança registrado</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {eventTypeLabels[log.event_type]?.icon || <Activity className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {eventTypeLabels[log.event_type]?.label || log.event_type}
                        </span>
                        <Badge className={severityColors[log.severity]}>
                          {log.severity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                        {log.ip_address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {log.ip_address}
                          </span>
                        )}
                        {log.user_agent && (
                          <span className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            {parseUserAgent(log.user_agent)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'dd/MM HH:mm')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
