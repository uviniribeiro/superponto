import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOperationalStore, OpVehicleStatus } from '@/hooks/useOperationalStore';
import { useOperationalPermissions } from '@/hooks/useOperationalPermissions';

const empty = { plate: '', number: '', model: '', capacity: 40, status: 'operando' as OpVehicleStatus, garage: '' };

export default function OperationalVehicles() {
  const { data, insert, update, remove } = useOperationalStore();
  const { canCreateSchedules } = useOperationalPermissions();
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);

  const save = () => {
    if (!form.plate.trim() || !form.number.trim()) {
      toast.error('Informe placa e número do carro.');
      return;
    }
    insert('vehicles', { ...form, plate: form.plate.toUpperCase() });
    toast.success('Veículo cadastrado.');
    setForm(empty);
    setOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Veículos"
        description="Frota operacional: carro, placa, garagem e disponibilidade."
        icon={Bus}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canCreateSchedules}><Plus className="mr-1 h-4 w-4" /> Novo veículo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo veículo</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Número do carro</Label><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Placa</Label><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} /></div>
                </div>
                <div className="grid gap-1.5"><Label>Modelo</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Capacidade</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
                  <div className="grid gap-1.5"><Label>Garagem</Label><Input value={form.garage} onChange={(e) => setForm({ ...form, garage: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carro</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Garagem</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.vehicles.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum veículo cadastrado.</TableCell></TableRow>
              ) : data.vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.number}</TableCell>
                  <TableCell className="font-mono text-xs">{v.plate}</TableCell>
                  <TableCell>{v.model || '—'}</TableCell>
                  <TableCell>{v.capacity}</TableCell>
                  <TableCell>{v.garage || '—'}</TableCell>
                  <TableCell>
                    <Select value={v.status} onValueChange={(s) => update('vehicles', v.id, { status: s as OpVehicleStatus })}>
                      <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operando">Operando</SelectItem>
                        <SelectItem value="manutencao">Manutenção</SelectItem>
                        <SelectItem value="reserva">Reserva</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" disabled={!canCreateSchedules} onClick={() => { remove('vehicles', v.id); toast.success('Veículo removido.'); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
