import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Play, Square, Timer } from 'lucide-react';
import { toast } from 'sonner';
import type { LiveSchedule } from '@/hooks/useOperationalLive';

/** Cronômetro da jornada: registra início e fim reais da operação da escala. */
export function JourneyTimer({
  schedule,
  profileId,
  onChange,
}: {
  schedule: LiveSchedule;
  profileId: string | null;
  onChange: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!schedule.actualStartAt || schedule.actualEndAt) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [schedule.actualStartAt, schedule.actualEndAt]);

  const elapsed = (() => {
    if (!schedule.actualStartAt) return '00:00:00';
    const end = schedule.actualEndAt ? new Date(schedule.actualEndAt) : new Date();
    const secs = Math.max(0, Math.floor((end.getTime() - new Date(schedule.actualStartAt).getTime()) / 1000));
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(secs / 3600))}:${p(Math.floor((secs % 3600) / 60))}:${p(secs % 60)}`;
  })();
  void tick;

  const update = async (patch: Record<string, unknown>, msg: string) => {
    setSaving(true);
    const { error } = await supabase.from('op_schedules').update(patch).eq('id', schedule.id);
    setSaving(false);
    if (error) toast.error('Não foi possível registrar', { description: error.message });
    else { toast.success(msg); onChange(); }
  };

  const start = () => update(
    { actual_start_at: new Date().toISOString(), started_by: profileId, status: 'em_andamento' },
    currentStartDeviation > 5
      ? `Operação iniciada com ${currentStartDeviation} min de atraso`
      : 'Operação iniciada',
  );
  const finish = () => update(
    { actual_end_at: new Date().toISOString(), ended_by: profileId, status: 'concluida' },
    currentEndDeviation < 0
      ? `Operação encerrada ${Math.abs(currentEndDeviation)} min antes do previsto`
      : 'Operação encerrada',
  );

  const plannedMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  };
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentStartDeviation = nowMinutes - plannedMinutes(schedule.startTime);
  const currentEndDeviation = nowMinutes - plannedMinutes(schedule.endTime);

  const startDelay = (() => {
    if (!schedule.actualStartAt) return null;
    const d = new Date(schedule.actualStartAt);
    const [h, m] = schedule.startTime.split(':').map(Number);
    return d.getHours() * 60 + d.getMinutes() - (h * 60 + m);
  })();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="h-4 w-4" /> {schedule.lineLabel} · {schedule.startTime}
        </CardTitle>
        <CardDescription>
          Veículo {schedule.vehicleLabel} · serviço {schedule.serviceLabel} ·
          {' '}ponto {schedule.firstPunch ?? 'não registrado'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!schedule.actualStartAt && currentStartDeviation > 5 && (
          <Alert variant="destructive">
            <AlertTitle>Início atrasado</AlertTitle>
            <AlertDescription>
              A operação está {currentStartDeviation} minutos atrasada. O horário real será registrado ao iniciar.
            </AlertDescription>
          </Alert>
        )}
        {schedule.actualStartAt && !schedule.actualEndAt && currentEndDeviation < 0 && (
          <Alert>
            <AlertTitle>Saída antecipada</AlertTitle>
            <AlertDescription>
              Encerrar agora antecipa a saída em {Math.abs(currentEndDeviation)} minutos. O horário real será registrado.
            </AlertDescription>
          </Alert>
        )}
        <p className="font-mono text-4xl font-semibold tabular-nums">{elapsed}</p>
        <div className="flex flex-wrap items-center gap-2">
          {!schedule.actualStartAt && (
            <Button onClick={start} disabled={saving}><Play className="mr-2 h-4 w-4" /> Iniciar operação</Button>
          )}
          {schedule.actualStartAt && !schedule.actualEndAt && (
            <Button variant="destructive" onClick={finish} disabled={saving}>
              <Square className="mr-2 h-4 w-4" /> Encerrar operação
            </Button>
          )}
          {schedule.actualEndAt && <Badge variant="secondary">Operação encerrada</Badge>}
          {startDelay != null && (
            <Badge variant={startDelay > 5 ? 'destructive' : 'outline'}>
              Início {startDelay > 0 ? `${startDelay} min após` : `${Math.abs(startDelay)} min antes`} do previsto
            </Badge>
          )}
          <Badge variant={schedule.situation === 'Atrasado' ? 'destructive' : 'outline'}>
            Ponto: {schedule.situation}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
