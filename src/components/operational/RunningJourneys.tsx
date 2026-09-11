import { useOperationalLive, type LiveSchedule } from '@/hooks/useOperationalLive';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity } from 'lucide-react';

const time = (v: string | null) =>
  v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

/** Diferença em minutos entre o horário real de início e o previsto. */
export function startDiffMinutes(s: LiveSchedule) {
  if (!s.actualStartAt) return null;
  const d = new Date(s.actualStartAt);
  const [h, m] = s.startTime.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return d.getHours() * 60 + d.getMinutes() - (h * 60 + m);
}

function elapsed(s: LiveSchedule, now: number) {
  if (!s.actualStartAt) return '—';
  const end = s.actualEndAt ? new Date(s.actualEndAt).getTime() : now;
  const secs = Math.max(0, Math.floor((end - new Date(s.actualStartAt).getTime()) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(secs / 3600))}:${p(Math.floor((secs % 3600) / 60))}:${p(secs % 60)}`;
}

/** Lista das jornadas do dia com horário previsto, horário real e status. */
export function RunningJourneys({ compact = false }: { compact?: boolean }) {
  const { schedules, loading, updatedAt } = useOperationalLive();
  const now = Date.now();
  const running = schedules.filter((s) => s.actualStartAt && !s.actualEndAt);
  const rows = compact ? (running.length ? running : schedules) : schedules;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" /> Jornadas em andamento
        </CardTitle>
        <CardDescription>
          {running.length} em operação de {schedules.length} escalas de hoje
          {updatedAt && ` · atualizado ${updatedAt.toLocaleTimeString('pt-BR')}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma escala para hoje.</p>
        )}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Linha</TableHead>
                <TableHead>Previsto</TableHead>
                <TableHead>Real</TableHead>
                <TableHead>Cronômetro</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const diff = startDiffMinutes(s);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.driverName}</TableCell>
                    <TableCell>{s.vehicleLabel}</TableCell>
                    <TableCell>{s.lineLabel}</TableCell>
                    <TableCell>{s.startTime} – {s.endTime}</TableCell>
                    <TableCell>
                      {time(s.actualStartAt)}
                      {s.actualEndAt && ` – ${time(s.actualEndAt)}`}
                      {diff != null && (
                        <Badge className="ml-2" variant={diff > 5 ? 'destructive' : 'outline'}>
                          {diff > 0 ? `+${diff}` : diff} min
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">{elapsed(s, now)}</TableCell>
                    <TableCell>
                      <Badge variant={s.actualStartAt && !s.actualEndAt ? 'default' : 'secondary'}>
                        {s.actualEndAt ? 'Concluída' : s.actualStartAt ? 'Em andamento' : 'Não iniciada'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
