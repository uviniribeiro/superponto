import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    'Operação iniciada',
  );
  const finish = () => update(
    { actual_end_at: new Date().toISOString(), ended_by: profileId, status: 'concluida' },
    'Operação encerrada',
  );

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
