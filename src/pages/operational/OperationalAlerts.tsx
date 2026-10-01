import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, RadioTower, RefreshCw, ShieldX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AlertKind = 'bloqueio' | 'permissao' | 'comunicacao';
type AlertSeverity = 'alta' | 'media';

interface OperationalAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  occurredAt: string;
}

const isRecent = (value: string | null, minutes = 3) =>
  Boolean(value && Date.now() - new Date(value).getTime() < minutes * 60_000);

export default function OperationalAlerts() {
  const { profile } = useAuth();
  const companyId = profile?.company_id ?? null;
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [filter, setFilter] = useState<'todos' | AlertKind>('todos');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const [auditRes, permissionRes, commandRes, communicationRes, agentRes] = await Promise.all([
      supabase.from('audit_logs').select('id, action, description, created_at').eq('company_id', companyId).gte('created_at', since).order('created_at', { ascending: false }).limit(100),
      supabase.from('op_user_permissions').select('id, user_name, user_email, updated_at, can_create_schedules, can_swap_drivers, can_edit_occurrences, can_view_reports').eq('company_id', companyId),
      supabase.from('device_commands').select('id, command, status, error_message, updated_at').eq('company_id', companyId).in('status', ['failed', 'cancelled']).gte('updated_at', since).order('updated_at', { ascending: false }).limit(100),
      supabase.from('equipment_communication_logs').select('id, status, message, created_at').eq('company_id', companyId).gte('created_at', since).order('created_at', { ascending: false }).limit(100),
      supabase.from('communication_agents').select('id, name, status, last_heartbeat, queue_paused, updated_at').eq('company_id', companyId),
    ]);

    const next: OperationalAlert[] = [];
    for (const row of auditRes.data ?? []) {
      const text = `${row.action ?? ''} ${row.description ?? ''}`.toLowerCase();
      if (!/(bloque|negad|denied|sem permiss|inválid|invalid)/.test(text)) continue;
      next.push({ id: `audit-${row.id}`, kind: text.includes('permiss') || text.includes('negad') ? 'permissao' : 'bloqueio', severity: 'alta', title: row.action || 'Ação bloqueada', detail: row.description || 'A operação foi impedida pelas regras de segurança.', occurredAt: row.created_at });
    }
    for (const row of permissionRes.data ?? []) {
      if (row.can_create_schedules || row.can_swap_drivers || row.can_edit_occurrences || row.can_view_reports) continue;
      next.push({ id: `permission-${row.id}`, kind: 'permissao', severity: 'media', title: 'Acesso operacional sem ações liberadas', detail: `${row.user_name || row.user_email || 'Usuário'} não possui nenhuma permissão operacional.`, occurredAt: row.updated_at });
    }
    for (const row of commandRes.data ?? []) {
      next.push({ id: `command-${row.id}`, kind: 'comunicacao', severity: 'alta', title: `Comando ${row.status === 'failed' ? 'com falha' : 'cancelado'}`, detail: `${row.command}${row.error_message ? ` — ${row.error_message}` : ''}`, occurredAt: row.updated_at });
    }
    for (const row of communicationRes.data ?? []) {
      if (!['error', 'failed', 'offline', 'timeout'].includes(String(row.status).toLowerCase())) continue;
      next.push({ id: `communication-${row.id}`, kind: 'comunicacao', severity: 'alta', title: 'Falha de comunicação com relógio', detail: row.message || row.status, occurredAt: row.created_at });
    }
    for (const row of agentRes.data ?? []) {
      if (!isRecent(row.last_heartbeat) || row.queue_paused) {
        next.push({ id: `agent-${row.id}`, kind: 'comunicacao', severity: !isRecent(row.last_heartbeat) ? 'alta' : 'media', title: !isRecent(row.last_heartbeat) ? 'Robô local sem comunicação' : 'Fila de comandos pausada', detail: row.name || 'Robô local', occurredAt: row.last_heartbeat || row.updated_at });
      }
    }

    setAlerts(next.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
    setUpdatedAt(new Date());
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase.channel(`operational-alerts-${companyId}`);
    for (const table of ['audit_logs', 'op_user_permissions', 'device_commands', 'equipment_communication_logs', 'communication_agents']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `company_id=eq.${companyId}` }, () => void load());
    }
    channel.subscribe();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void load(), 30_000);
    return () => { void supabase.removeChannel(channel); window.clearInterval(timer); };
  }, [companyId, load]);

  const visible = useMemo(() => alerts.filter((alert) => filter === 'todos' || alert.kind === filter), [alerts, filter]);
  const counts = (kind: AlertKind) => alerts.filter((alert) => alert.kind === kind).length;
  const labels: Record<AlertKind, string> = { bloqueio: 'Ação bloqueada', permissao: 'Permissão inválida', comunicacao: 'Falha de comunicação' };
  const icons = { bloqueio: Ban, permissao: ShieldX, comunicacao: RadioTower };

  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <PageHeader title="Alertas Operacionais" description="Bloqueios, permissões e comunicação acompanhados em tempo real." icon={AlertTriangle} actions={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />Atualizar</Button>} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(['bloqueio', 'permissao', 'comunicacao'] as AlertKind[]).map((kind) => {
          const Icon = icons[kind];
          return <Card key={kind}><CardContent className="flex items-center gap-3 p-4"><Icon className="h-5 w-5 text-muted-foreground" /><div><p className="text-2xl font-semibold">{counts(kind)}</p><p className="text-xs text-muted-foreground">{labels[kind]}</p></div></CardContent></Card>;
        })}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div><CardTitle className="text-base">Eventos recentes</CardTitle><p className="mt-1 text-xs text-muted-foreground">Atualizado {updatedAt?.toLocaleTimeString('pt-BR') ?? '—'}</p></div>
          <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os alertas</SelectItem><SelectItem value="bloqueio">Ações bloqueadas</SelectItem><SelectItem value="permissao">Permissões</SelectItem><SelectItem value="comunicacao">Comunicação</SelectItem></SelectContent></Select>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando alertas...</p> : visible.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum alerta encontrado.</p> : visible.map((alert) => {
            const Icon = icons[alert.kind];
            return <div key={alert.id} className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{alert.title}</p><Badge variant={alert.severity === 'alta' ? 'destructive' : 'secondary'}>{alert.severity}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p></div><time className="whitespace-nowrap text-xs text-muted-foreground">{new Date(alert.occurredAt).toLocaleString('pt-BR')}</time></div>;
          })}
        </CardContent>
      </Card>
    </div>
  );
}