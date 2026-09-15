import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOperationalLive } from '@/hooks/useOperationalLive';
import { RunningJourneys } from '@/components/operational/RunningJourneys';
import { OperationalRouteMap } from '@/components/operational/OperationalRouteMap';

/**
 * Painel de operação em tempo real: escalas do dia com horário previsto,
 * veículo e linha, além de GPS, telemetria e ocorrências recebidos do robô.
 */
export function OperationalLivePanel() {
  const liveData = useOperationalLive();
  const { positions, telemetry, occurrences } = liveData;

  return (
    <div className="space-y-4">
      <RunningJourneys compact liveData={liveData} />
      <OperationalRouteMap positions={positions} schedules={liveData.schedules} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas posições (GPS)</CardTitle>
            <CardDescription>Recebidas do terminal do motorista ou do robô da frota.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {positions.length === 0 && <p className="text-muted-foreground">Nenhuma posição recebida ainda.</p>}
            {positions.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b pb-1 last:border-0">
                <span>{p.vehicleLabel} — {p.driverName}</span>
                <span className="text-muted-foreground">
                  {p.speedKmh != null ? `${Math.round(p.speedKmh)} km/h · ` : ''}
                  {new Date(p.recordedAt).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Telemetria e ocorrências</CardTitle>
            <CardDescription>Eventos da frota cruzados com escala e motorista.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {telemetry.length === 0 && occurrences.length === 0 && (
              <p className="text-muted-foreground">Nenhum evento registrado hoje.</p>
            )}
            {telemetry.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 border-b pb-1 last:border-0">
                <span>{t.eventType} — {t.vehicleLabel} · {t.driverName}</span>
                <Badge variant={t.severity === 'alta' ? 'destructive' : 'outline'}>{t.severity}</Badge>
              </div>
            ))}
            {occurrences.slice(0, 8).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 border-b pb-1 last:border-0">
                <span>{o.type} — {o.driverName}</span>
                <Badge variant={o.resolved ? 'secondary' : 'destructive'}>{o.resolved ? 'Resolvida' : 'Em aberto'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
