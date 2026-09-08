import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Gauge, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useOperationalStore, OpOccurrenceSeverity } from '@/hooks/useOperationalStore';
import { useOperationalPermissions } from '@/hooks/useOperationalPermissions';

export default function OperationalDay() {
  const { data, insert, update } = useOperationalStore();
  const { canSwapDrivers, canEditOccurrences } = useOperationalPermissions();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [occ, setOcc] = useState({ scheduleId: '', type: '', severity: 'media' as OpOccurrenceSeverity, description: '' });
  const [openOcc, setOpenOcc] = useState(false);

  const schedules = useMemo(() => data.schedules.filter((s) => s.date === date), [data.schedules, date]);
  const driver = (id: string) => data.drivers.find((d) => d.id === id);
  const vehicle = (id: string) => data.vehicles.find((v) => v.id === id);
  const line = (id: string) => data.lines.find((l) => l.id === id);

  const saveOcc = () => {
    if (!occ.type.trim()) {
      toast.error('Descreva o tipo da ocorrência.');
      return;
    }
    const sched = data.schedules.find((s) => s.id === occ.scheduleId);
    insert('occurrences', {
      date,
      scheduleId: occ.scheduleId || undefined,
      driverId: sched?.driverId,
      vehicleId: sched?.vehicleId,
      type: occ.type.trim(),
      severity: occ.severity,
      description: occ.description.trim(),
      resolved: false,
    });
    toast.success('Ocorrência registrada.');
    setOpenOcc(false);
    setOcc({ scheduleId: '', type: '', severity: 'media', description: '' });
  };

  const dayOccurrences = data.occurrences.filter((o) => o.date === date);

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Operação do Dia"
        description="Acompanhamento em tempo real das escalas, trocas de motorista e ocorrências."
        icon={Gauge}
        actions={<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px]" />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {schedules.length === 0 && (
          <p className="py-10 text-center text-muted-foreground lg:col-span-2">Nenhuma escala para esta data.</p>
        )}
        {schedules.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Linha {line(s.lineId)?.code} · Carro {vehicle(s.vehicleId)?.number}</CardTitle>
                <Badge variant={s.status === 'em_andamento' ? 'default' : 'secondary'}>{s.status.replace('_', ' ')}</Badge>
              </div>
              <CardDescription>
                {driver(s.driverId)?.name ?? 'Sem motorista'} · {s.startTime} às {s.endTime}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Select
                value={s.driverId}
                disabled={!canSwapDrivers}
                onValueChange={(v) => {
                  update('schedules', s.id, { driverId: v });
                  toast.success('Motorista trocado.');
                }}
              >
                <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Trocar motorista" /></SelectTrigger>
                <SelectContent>
                  {data.drivers.filter((d) => d.status === 'ativo').map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={s.vehicleId}
                disabled={!canSwapDrivers}
                onValueChange={(v) => {
                  update('schedules', s.id, { vehicleId: v });
                  toast.success('Veículo trocado.');
                }}
              >
                <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Trocar veículo" /></SelectTrigger>
                <SelectContent>
                  {data.vehicles.filter((v) => v.status !== 'inativo').map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.number} · {v.plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={!canSwapDrivers}
                onClick={() => update('schedules', s.id, { status: s.status === 'em_andamento' ? 'concluida' : 'em_andamento' })}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                {s.status === 'em_andamento' ? 'Encerrar' : 'Iniciar'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Ocorrências do dia
            </CardTitle>
            <CardDescription>Atrasos, quebras, desvios e substituições.</CardDescription>
          </div>
          <Dialog open={openOcc} onOpenChange={setOpenOcc}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canEditOccurrences}>Registrar ocorrência</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova ocorrência</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Escala relacionada</Label>
                  <Select value={occ.scheduleId} onValueChange={(v) => setOcc((o) => ({ ...o, scheduleId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {schedules.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {line(s.lineId)?.code} · {driver(s.driverId)?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Tipo</Label>
                  <Input value={occ.type} onChange={(e) => setOcc((o) => ({ ...o, type: e.target.value }))} placeholder="Atraso, quebra, desvio..." />
                </div>
                <div className="grid gap-1.5">
                  <Label>Gravidade</Label>
                  <Select value={occ.severity} onValueChange={(v) => setOcc((o) => ({ ...o, severity: v as OpOccurrenceSeverity }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Descrição</Label>
                  <Textarea value={occ.description} onChange={(e) => setOcc((o) => ({ ...o, description: e.target.value }))} rows={3} />
                </div>
              </div>
              <DialogFooter><Button onClick={saveOcc}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {dayOccurrences.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma ocorrência registrada.</p>
          ) : dayOccurrences.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{o.type}</p>
                <p className="truncate text-xs text-muted-foreground">{o.description || 'Sem detalhes'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={o.severity === 'alta' ? 'destructive' : 'secondary'}>{o.severity}</Badge>
                <Button
                  size="sm"
                  variant={o.resolved ? 'outline' : 'default'}
                  disabled={!canEditOccurrences}
                  onClick={() => update('occurrences', o.id, { resolved: !o.resolved })}
                >
                  {o.resolved ? 'Reabrir' : 'Resolver'}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
