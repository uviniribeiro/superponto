import { useMemo, useState } from 'react';
import { AlertTriangle, Gauge, MapPin, Route } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LivePosition, LiveSchedule } from '@/hooks/useOperationalLive';

const STOP_SPEED_KMH = 3;
const ABNORMAL_STOP_MINUTES = 10;

function distanceMeters(a: LivePosition, b: LivePosition) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
}

export interface StopAlert {
  scheduleId: string;
  vehicleLabel: string;
  driverName: string;
  stoppedMinutes: number;
  lastPosition: LivePosition;
}

export function detectAbnormalStops(positions: LivePosition[], schedules: LiveSchedule[]): StopAlert[] {
  const activeIds = new Set(schedules.filter((s) => s.actualStartAt && !s.actualEndAt).map((s) => s.id));
  const groups = new Map<string, LivePosition[]>();
  positions.forEach((position) => {
    if (!position.scheduleId || !activeIds.has(position.scheduleId)) return;
    const group = groups.get(position.scheduleId) ?? [];
    group.push(position);
    groups.set(position.scheduleId, group);
  });

  return Array.from(groups.entries()).flatMap(([scheduleId, values]) => {
    const ordered = [...values].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    const latest = ordered[0];
    if (!latest || (latest.speedKmh ?? 0) > STOP_SPEED_KMH) return [];
    const stationary = ordered.filter((position) =>
      (position.speedKmh ?? 0) <= STOP_SPEED_KMH && distanceMeters(latest, position) <= 100,
    );
    const oldest = stationary.at(-1);
    if (!oldest) return [];
    const stoppedMinutes = Math.floor((new Date(latest.recordedAt).getTime() - new Date(oldest.recordedAt).getTime()) / 60000);
    return stoppedMinutes >= ABNORMAL_STOP_MINUTES
      ? [{ scheduleId, vehicleLabel: latest.vehicleLabel, driverName: latest.driverName, stoppedMinutes, lastPosition: latest }]
      : [];
  });
}

function RoutePreview({ points }: { points: LivePosition[] }) {
  const path = useMemo(() => {
    if (points.length < 2) return '';
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lngRange = Math.max(maxLng - minLng, 0.0001);
    return points.map((p, index) => {
      const x = 8 + ((p.longitude - minLng) / lngRange) * 84;
      const y = 92 - ((p.latitude - minLat) / latRange) * 84;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  }, [points]);

  return (
    <div className="relative aspect-[16/7] min-h-40 overflow-hidden rounded-lg border bg-muted/40">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] [background-size:24px_24px]" />
      {path ? (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Trajeto recente do veículo">
          <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          <circle cx="92" cy="8" r="3" fill="hsl(var(--primary))" />
        </svg>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Aguardando mais posições para desenhar o trajeto.</div>
      )}
    </div>
  );
}

export function OperationalRouteMap({ positions, schedules }: { positions: LivePosition[]; schedules: LiveSchedule[] }) {
  const journeys = schedules.filter((s) => s.actualStartAt && !s.actualEndAt);
  const available = journeys.filter((s) => positions.some((p) => p.scheduleId === s.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = available.find((s) => s.id === selectedId) ?? available[0] ?? null;
  const route = selected
    ? positions.filter((p) => p.scheduleId === selected.id).sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    : [];
  const latest = route.at(-1) ?? null;
  const alerts = detectAbnormalStops(positions, schedules);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Route className="h-4 w-4" /> GPS e trajetos</CardTitle>
        <CardDescription>Posições reais recebidas do terminal ou rastreador, sem recarregar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {available.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {available.map((schedule) => (
              <Button key={schedule.id} size="sm" variant={selected?.id === schedule.id ? 'default' : 'outline'} onClick={() => setSelectedId(schedule.id)}>
                {schedule.vehicleLabel}
              </Button>
            ))}
          </div>
        )}
        {selected ? <RoutePreview points={route} /> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma jornada em andamento com GPS.</p>}
        {latest && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><span className="text-muted-foreground">Motorista</span><p className="font-medium">{latest.driverName}</p></div>
            <div><span className="text-muted-foreground">Linha</span><p className="font-medium">{selected?.lineLabel}</p></div>
            <div><span className="text-muted-foreground">Velocidade</span><p className="flex items-center gap-1 font-medium"><Gauge className="h-4 w-4" /> {Math.round(latest.speedKmh ?? 0)} km/h</p></div>
            <div><span className="text-muted-foreground">Último sinal</span><p className="font-medium">{new Date(latest.recordedAt).toLocaleTimeString('pt-BR')}</p></div>
          </div>
        )}
        {alerts.map((alert) => (
          <div key={alert.scheduleId} className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div><p className="font-semibold">Parada anormal · {alert.vehicleLabel}</p><p className="text-muted-foreground">{alert.driverName} está parado há {alert.stoppedMinutes} minutos fora do fluxo esperado.</p></div>
            <Badge variant="destructive" className="ml-auto">Alerta</Badge>
          </div>
        ))}
        {latest && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}</p>}
      </CardContent>
    </Card>
  );
}