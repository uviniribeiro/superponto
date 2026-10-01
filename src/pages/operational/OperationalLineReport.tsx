import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOperationalStore } from '@/hooks/useOperationalStore';
import { useOperationalPermissions } from '@/hooks/useOperationalPermissions';

interface GpsPoint { schedule_id: string | null; latitude: number; longitude: number; speed_kmh: number | null; recorded_at: string }
interface ActualTimes { actual_start_at: string | null; actual_end_at: string | null }
const ALL = 'todos';
const meters = (a: GpsPoint, b: GpsPoint) => {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const clock = (value: string | null) => value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

export default function OperationalLineReport() {
  const { profile, company } = useAuth();
  const { data, loading: storeLoading } = useOperationalStore();
  const { canViewReports } = useOperationalPermissions();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(today);
  const [line, setLine] = useState(ALL);
  const [driver, setDriver] = useState(ALL);
  const [vehicle, setVehicle] = useState(ALL);
  const [gps, setGps] = useState<GpsPoint[]>([]);
  const [actual, setActual] = useState<Record<string, ActualTimes>>({});
  const [loading, setLoading] = useState(false);

  const loadMetrics = useCallback(async () => {
    if (!profile?.company_id || !canViewReports) return;
    setLoading(true);
    const schedules = data.schedules.filter((item) => item.date >= start && item.date <= end);
    const ids = schedules.map((item) => item.id);
    if (ids.length === 0) { setGps([]); setActual({}); setLoading(false); return; }
    const [gpsRes, scheduleRes] = await Promise.all([
      supabase.from('op_gps_positions').select('schedule_id, latitude, longitude, speed_kmh, recorded_at').eq('company_id', profile.company_id).gte('recorded_at', `${start}T00:00:00`).lte('recorded_at', `${end}T23:59:59`).in('schedule_id', ids).order('recorded_at').limit(10000),
      supabase.from('op_schedules').select('id, actual_start_at, actual_end_at').eq('company_id', profile.company_id).in('id', ids),
    ]);
    setGps((gpsRes.data ?? []).map((point) => ({ ...point, latitude: Number(point.latitude), longitude: Number(point.longitude), speed_kmh: point.speed_kmh == null ? null : Number(point.speed_kmh) })));
    setActual(Object.fromEntries((scheduleRes.data ?? []).map((item) => [item.id, { actual_start_at: item.actual_start_at, actual_end_at: item.actual_end_at }])));
    setLoading(false);
  }, [profile?.company_id, canViewReports, data.schedules, start, end]);

  useEffect(() => { void loadMetrics(); }, [loadMetrics]);

  const rows = useMemo(() => data.schedules.filter((item) => item.date >= start && item.date <= end)
    .filter((item) => line === ALL || item.lineId === line).filter((item) => driver === ALL || item.driverId === driver).filter((item) => vehicle === ALL || item.vehicleId === vehicle)
    .map((item) => {
      const points = gps.filter((point) => point.schedule_id === item.id);
      let distanceM = 0;
      let stoppedMs = 0;
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const delta = new Date(current.recorded_at).getTime() - new Date(previous.recorded_at).getTime();
        if (meters(previous, current) < 1000) distanceM += meters(previous, current);
        if ((previous.speed_kmh ?? 0) <= 3 && (current.speed_kmh ?? 0) <= 3 && delta > 0 && delta <= 10 * 60_000) stoppedMs += delta;
      }
      const times = actual[item.id];
      return { ...item, lineName: data.lines.find((value) => value.id === item.lineId)?.name ?? '—', driverName: data.drivers.find((value) => value.id === item.driverId)?.name ?? 'Sem motorista', vehicleName: data.vehicles.find((value) => value.id === item.vehicleId)?.number || data.vehicles.find((value) => value.id === item.vehicleId)?.plate || '—', actualStart: times?.actual_start_at ?? null, actualEnd: times?.actual_end_at ?? null, distanceKm: distanceM / 1000, stoppedMinutes: Math.round(stoppedMs / 60_000) };
    }), [data, start, end, line, driver, vehicle, gps, actual]);

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({ Data: row.date, Linha: row.lineName, Motorista: row.driverName, Veículo: row.vehicleName, 'Início previsto': row.startTime, 'Fim previsto': row.endTime, 'Início real': clock(row.actualStart), 'Fim real': clock(row.actualEnd), 'Distância (km)': Number(row.distanceKm.toFixed(2)), 'Tempo parado (min)': row.stoppedMinutes, Status: row.status })));
    sheet['!cols'] = [12, 24, 28, 14, 15, 15, 13, 13, 16, 19, 14].map((wch) => ({ wch }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Jornadas por linha');
    XLSX.writeFile(book, `jornadas-por-linha-${start}-${end}.xlsx`);
  };

  if (!canViewReports) return <div className="container mx-auto px-4 py-8"><Card><CardContent className="py-10 text-center text-muted-foreground">Seu perfil não possui permissão para visualizar relatórios operacionais.</CardContent></Card></div>;
  const busy = loading || storeLoading;
  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <PageHeader title="Jornadas por Linha" description="Horários previstos e reais, distância percorrida e tempo de parada por jornada." icon={FileSpreadsheet} actions={<><Button variant="outline" size="sm" onClick={() => void loadMetrics()}><RefreshCw className="mr-1 h-4 w-4" />Atualizar</Button><Button size="sm" onClick={() => void exportExcel()} disabled={rows.length === 0}><Download className="mr-1 h-4 w-4" />Excel</Button></>} />
      <Card className="mb-4"><CardContent className="grid gap-3 pt-6 sm:grid-cols-2 xl:grid-cols-5"><div><Label>De</Label><Input className="mt-1" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></div><div><Label>Até</Label><Input className="mt-1" type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></div>{[[line, setLine, 'Linha', data.lines.map((item) => [item.id, `${item.code} — ${item.name}`])], [driver, setDriver, 'Motorista', data.drivers.map((item) => [item.id, item.name])], [vehicle, setVehicle, 'Veículo', data.vehicles.map((item) => [item.id, `${item.number} ${item.plate}`.trim()])]].map(([value, setter, label, options]) => <div key={label as string}><Label>{label as string}</Label><Select value={value as string} onValueChange={setter as (value: string) => void}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos</SelectItem>{(options as string[][]).map(([id, text]) => <SelectItem key={id} value={id}>{text}</SelectItem>)}</SelectContent></Select></div>)}</CardContent></Card>
      <Card><CardContent className="overflow-x-auto pt-6"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Linha</TableHead><TableHead>Motorista</TableHead><TableHead>Veículo</TableHead><TableHead>Previsto</TableHead><TableHead>Real</TableHead><TableHead>Distância</TableHead><TableHead>Parado</TableHead></TableRow></TableHeader><TableBody>{busy ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Carregando jornadas...</TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Nenhuma jornada no período selecionado.</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id}><TableCell>{new Date(`${row.date}T12:00:00`).toLocaleDateString('pt-BR')}</TableCell><TableCell className="font-medium">{row.lineName}</TableCell><TableCell>{row.driverName}</TableCell><TableCell>{row.vehicleName}</TableCell><TableCell>{row.startTime}–{row.endTime}</TableCell><TableCell>{clock(row.actualStart)}–{clock(row.actualEnd)}</TableCell><TableCell>{row.distanceKm.toFixed(2)} km</TableCell><TableCell>{row.stoppedMinutes} min</TableCell></TableRow>)}</TableBody></Table><p className="mt-4 text-xs text-muted-foreground">Fonte: {company?.name ?? 'empresa atual'} · posições GPS recebidas no período selecionado.</p></CardContent></Card>
    </div>
  );
}