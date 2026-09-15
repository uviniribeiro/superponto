import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, MapPin, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOperationalLive } from '@/hooks/useOperationalLive';
import { RunningJourneys } from '@/components/operational/RunningJourneys';
import { OperationalRouteMap, detectAbnormalStops } from '@/components/operational/OperationalRouteMap';

/** Supervisão em tempo real: jornadas em andamento, GPS dos veículos e atrasos. */
export default function OperationalSupervision() {
  const liveData = useOperationalLive();
  const { schedules, positions, telemetry, loading, updatedAt, refetch } = liveData;

  const running = schedules.filter((s) => s.actualStartAt && !s.actualEndAt);
  const finished = schedules.filter((s) => s.actualEndAt);
  const late = schedules.filter((s) => s.situation === 'Atrasado');
  const notStarted = schedules.filter((s) => !s.actualStartAt && !s.actualEndAt);
  const stopAlerts = detectAbnormalStops(positions, schedules);

  const duration = (start: string) => {
    const mins = Math.floor((Date.now() - new Date(start).getTime()) / 60000);
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
  };

  const latestByVehicle = Array.from(
    positions.reduce((map, p) => (map.has(p.vehicleLabel) ? map : map.set(p.vehicleLabel, p)), new Map<string, typeof positions[number]>()).values(),
  );

  const cards = [
    { label: 'Jornadas em andamento', value: running.length, icon: Activity },
    { label: 'Ainda não iniciadas', value: notStarted.length, icon: AlertTriangle },
    { label: 'Atrasos no ponto', value: late.length, icon: AlertTriangle },
    { label: 'Alertas de parada', value: stopAlerts.length, icon: MapPin },
  ];

  return (
      <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <PageHeader
        title="Supervisão Operacional"
        description="Jornadas em andamento, posição dos veículos e atrasos, atualizando em tempo real."
        icon={Activity}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar
          </Button>
        }
      />

      <p className="mb-4 text-sm text-muted-foreground">
        {loading ? 'Carregando operação...' : `Última atualização: ${updatedAt?.toLocaleTimeString('pt-BR') ?? '—'}`}
      </p>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex min-h-24 items-center gap-2 p-3 sm:gap-3 sm:p-5">
              <div className="hidden h-11 w-11 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)] sm:flex">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-semibold sm:text-2xl">{value}</p>
                <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <RunningJourneys liveData={liveData} />
      </div>

      <div className="mt-6">
        <OperationalRouteMap positions={positions} schedules={schedules} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Jornadas do dia</CardTitle>
          <CardDescription>Início e fim reais da operação cruzados com escala e ponto.</CardDescription>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma escala hoje.</p>}
          {schedules.length > 0 && (
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Linha</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Previsto</TableHead>
                  <TableHead>Início real</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Ponto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.driverName}</TableCell>
                    <TableCell>{s.lineLabel}</TableCell>
                    <TableCell>{s.vehicleLabel}</TableCell>
                    <TableCell>{s.startTime} – {s.endTime}</TableCell>
                    <TableCell>
                      {s.actualStartAt ? new Date(s.actualStartAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell>
                      {s.actualEndAt ? 'Encerrada' : s.actualStartAt ? duration(s.actualStartAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.situation === 'Atrasado' ? 'destructive' : s.situation === 'Em dia' ? 'secondary' : 'outline'}>
                        {s.situation}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          )}
          {finished.length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{finished.length} jornada(s) já encerrada(s) hoje.</p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GPS dos veículos</CardTitle>
            <CardDescription>Última posição recebida de cada veículo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {latestByVehicle.length === 0 && <p className="text-muted-foreground">Nenhuma posição recebida.</p>}
            {latestByVehicle.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b pb-1 last:border-0">
                <span>{p.vehicleLabel} — {p.driverName}</span>
                <span className="text-muted-foreground">
                  {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                  {p.speedKmh != null && ` · ${Math.round(p.speedKmh)} km/h`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas de telemetria</CardTitle>
            <CardDescription>Eventos recentes enviados pelos rastreadores.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {telemetry.length === 0 && <p className="text-muted-foreground">Nenhum evento recente.</p>}
            {telemetry.slice(0, 12).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 border-b pb-1 last:border-0">
                <span>{t.eventType} — {t.vehicleLabel} · {t.driverName}</span>
                <Badge variant={t.severity === 'alta' ? 'destructive' : 'outline'}>{t.severity}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
