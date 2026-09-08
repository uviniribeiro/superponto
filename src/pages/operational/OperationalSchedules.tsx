import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOperationalStore, OpScheduleStatus } from '@/hooks/useOperationalStore';
import { useOperationalPermissions } from '@/hooks/useOperationalPermissions';

const statusLabel: Record<OpScheduleStatus, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export default function OperationalSchedules() {
  const { data, insert, update, remove } = useOperationalStore();
  const { canCreateSchedules } = useOperationalPermissions();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    driverId: '',
    vehicleId: '',
    lineId: '',
    serviceId: '',
    startTime: '05:00',
    endTime: '13:00',
  });

  const rows = useMemo(() => data.schedules.filter((s) => s.date === date), [data.schedules, date]);
  const nameOf = (id: string) => data.drivers.find((d) => d.id === id)?.name ?? '—';
  const vehicleOf = (id: string) => data.vehicles.find((v) => v.id === id)?.number ?? '—';
  const lineOf = (id: string) => data.lines.find((l) => l.id === id)?.code ?? '—';
  const serviceOf = (id: string) => data.services.find((s) => s.id === id)?.code ?? '—';

  const save = () => {
    if (!form.driverId || !form.vehicleId || !form.lineId || !form.serviceId) {
      toast.error('Escolha motorista, veículo, linha e serviço.');
      return;
    }
    insert('schedules', { ...form, date, status: 'planejada' });
    toast.success('Escala criada.');
    setOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Escalas"
        description="Planejamento diário: motorista, veículo, linha e serviço."
        icon={CalendarClock}
        actions={
          <>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px]" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canCreateSchedules}>
                  <Plus className="mr-1 h-4 w-4" /> Nova escala
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova escala — {date.split('-').reverse().join('/')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>Motorista</Label>
                    <Select value={form.driverId} onValueChange={(v) => setForm((f) => ({ ...f, driverId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {data.drivers.filter((d) => d.status === 'ativo').map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Veículo</Label>
                    <Select value={form.vehicleId} onValueChange={(v) => setForm((f) => ({ ...f, vehicleId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {data.vehicles.filter((v) => v.status !== 'inativo').map((v) => (
                          <SelectItem key={v.id} value={v.id}>{v.number} · {v.plate}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Linha</Label>
                    <Select value={form.lineId} onValueChange={(v) => setForm((f) => ({ ...f, lineId: v, serviceId: '' }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {data.lines.filter((l) => l.active).map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.code} · {l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Serviço</Label>
                    <Select value={form.serviceId} onValueChange={(v) => setForm((f) => ({ ...f, serviceId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {data.services.filter((s) => !form.lineId || s.lineId === form.lineId).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.code} · {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Início</Label>
                      <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Término</Label>
                      <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={save}>Salvar escala</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {!canCreateSchedules && (
        <p className="mb-4 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
          Você não tem permissão para criar escalas. Fale com a coordenação.
        </p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Escalas do dia ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead>Carro</TableHead>
                <TableHead>Linha</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma escala nesta data.</TableCell></TableRow>
              ) : rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{nameOf(s.driverId)}</TableCell>
                  <TableCell>{vehicleOf(s.vehicleId)}</TableCell>
                  <TableCell>{lineOf(s.lineId)}</TableCell>
                  <TableCell>{serviceOf(s.serviceId)}</TableCell>
                  <TableCell className="font-mono text-xs">{s.startTime} – {s.endTime}</TableCell>
                  <TableCell>
                    <Select value={s.status} onValueChange={(v) => update('schedules', s.id, { status: v as OpScheduleStatus })}>
                      <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" disabled={!canCreateSchedules} onClick={() => { remove('schedules', s.id); toast.success('Escala removida.'); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {(['planejada', 'em_andamento', 'concluida', 'cancelada'] as OpScheduleStatus[]).map((st) => (
          <Badge key={st} variant="outline">{statusLabel[st]}: {rows.filter((r) => r.status === st).length}</Badge>
        ))}
      </div>
    </div>
  );
}
