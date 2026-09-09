import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Route, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOperationalStore } from '@/hooks/useOperationalStore';
import { useOperationalPermissions } from '@/hooks/useOperationalPermissions';

const emptyLine = { code: '', name: '', origin: '', destination: '', km: 0, active: true };
const emptyService = { lineId: '', code: '', name: '', startTime: '05:00', endTime: '13:00', trips: 6 };

export default function OperationalLines() {
  const { data, insert, update, remove } = useOperationalStore();
  const { canCreateSchedules } = useOperationalPermissions();
  const [line, setLine] = useState(emptyLine);
  const [service, setService] = useState(emptyService);
  const [openLine, setOpenLine] = useState(false);
  const [openService, setOpenService] = useState(false);

  const saveLine = () => {
    if (!line.code.trim() || !line.name.trim()) {
      toast.error('Informe código e nome da linha.');
      return;
    }
    insert('lines', line);
    toast.success('Linha cadastrada.');
    setLine(emptyLine);
    setOpenLine(false);
  };

  const saveService = () => {
    if (!service.lineId || !service.code.trim()) {
      toast.error('Escolha a linha e informe o código do serviço.');
      return;
    }
    insert('services', service);
    toast.success('Serviço cadastrado.');
    setService(emptyService);
    setOpenService(false);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Linhas e Serviços"
        description="Itinerários da operação e os serviços (tabelas de horário) de cada linha."
        icon={Route}
      />

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Linhas</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Linhas ({data.lines.length})</CardTitle>
                <CardDescription>Origem, destino e quilometragem.</CardDescription>
              </div>
              <Dialog open={openLine} onOpenChange={setOpenLine}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!canCreateSchedules}><Plus className="mr-1 h-4 w-4" /> Nova linha</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova linha</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5"><Label>Código</Label><Input value={line.code} onChange={(e) => setLine({ ...line, code: e.target.value })} /></div>
                      <div className="grid gap-1.5"><Label>Km</Label><Input type="number" step="0.1" value={line.km} onChange={(e) => setLine({ ...line, km: Number(e.target.value) })} /></div>
                    </div>
                    <div className="grid gap-1.5"><Label>Nome</Label><Input value={line.name} onChange={(e) => setLine({ ...line, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5"><Label>Origem</Label><Input value={line.origin} onChange={(e) => setLine({ ...line, origin: e.target.value })} /></div>
                      <div className="grid gap-1.5"><Label>Destino</Label><Input value={line.destination} onChange={(e) => setLine({ ...line, destination: e.target.value })} /></div>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={saveLine}>Salvar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Trajeto</TableHead>
                    <TableHead>Km</TableHead>
                    <TableHead>Ativa</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma linha cadastrada.</TableCell></TableRow>
                  ) : data.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.code}</TableCell>
                      <TableCell>{l.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.origin} → {l.destination}</TableCell>
                      <TableCell>{l.km}</TableCell>
                      <TableCell>
                        <Switch checked={l.active} disabled={!canCreateSchedules} onCheckedChange={(v) => update('lines', l.id, { active: v })} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" disabled={!canCreateSchedules} onClick={() => { remove('lines', l.id); toast.success('Linha removida.'); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Serviços ({data.services.length})</CardTitle>
                <CardDescription>Horários e número de viagens por serviço.</CardDescription>
              </div>
              <Dialog open={openService} onOpenChange={setOpenService}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!canCreateSchedules}><Plus className="mr-1 h-4 w-4" /> Novo serviço</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo serviço</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label>Linha</Label>
                      <Select value={service.lineId} onValueChange={(v) => setService({ ...service, lineId: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {data.lines.map((l) => <SelectItem key={l.id} value={l.id}>{l.code} · {l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5"><Label>Código</Label><Input value={service.code} onChange={(e) => setService({ ...service, code: e.target.value })} /></div>
                      <div className="grid gap-1.5"><Label>Viagens</Label><Input type="number" value={service.trips} onChange={(e) => setService({ ...service, trips: Number(e.target.value) })} /></div>
                    </div>
                    <div className="grid gap-1.5"><Label>Nome</Label><Input value={service.name} onChange={(e) => setService({ ...service, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5"><Label>Início</Label><Input type="time" value={service.startTime} onChange={(e) => setService({ ...service, startTime: e.target.value })} /></div>
                      <div className="grid gap-1.5"><Label>Término</Label><Input type="time" value={service.endTime} onChange={(e) => setService({ ...service, endTime: e.target.value })} /></div>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={saveService}>Salvar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Viagens</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.services.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum serviço cadastrado.</TableCell></TableRow>
                  ) : data.services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.code} <span className="text-muted-foreground">· {s.name}</span></TableCell>
                      <TableCell><Badge variant="outline">{data.lines.find((l) => l.id === s.lineId)?.code ?? '—'}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{s.startTime} – {s.endTime}</TableCell>
                      <TableCell>{s.trips}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" disabled={!canCreateSchedules} onClick={() => { remove('services', s.id); toast.success('Serviço removido.'); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
