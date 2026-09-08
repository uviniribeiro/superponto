import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useOperationalStore, OpDriverStatus } from '@/hooks/useOperationalStore';
import { useOperationalPermissions } from '@/hooks/useOperationalPermissions';

const empty = { name: '', registration: '', cnh: '', cnhCategory: 'D', cnhExpiry: '', phone: '', status: 'ativo' as OpDriverStatus };

export default function OperationalDrivers() {
  const { data, insert, update, remove } = useOperationalStore();
  const { canCreateSchedules } = useOperationalPermissions();
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const rows = data.drivers.filter((d) =>
    [d.name, d.registration, d.cnh].join(' ').toLowerCase().includes(search.toLowerCase()),
  );

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do motorista.');
      return;
    }
    insert('drivers', form);
    toast.success('Motorista cadastrado.');
    setForm(empty);
    setOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Motoristas"
        description="Dados operacionais dos motoristas: matrícula, CNH e situação."
        icon={Users}
        actions={
          <>
            <Input placeholder="Buscar nome, matrícula ou CNH" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[240px]" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canCreateSchedules}><Plus className="mr-1 h-4 w-4" /> Novo motorista</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo motorista</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5"><Label>Matrícula</Label><Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} /></div>
                    <div className="grid gap-1.5"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1.5"><Label>CNH</Label><Input value={form.cnh} onChange={(e) => setForm({ ...form, cnh: e.target.value })} /></div>
                    <div className="grid gap-1.5"><Label>Categoria</Label><Input value={form.cnhCategory} onChange={(e) => setForm({ ...form, cnhCategory: e.target.value })} /></div>
                    <div className="grid gap-1.5"><Label>Validade</Label><Input type="date" value={form.cnhExpiry} onChange={(e) => setForm({ ...form, cnhExpiry: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>CNH</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum motorista encontrado.</TableCell></TableRow>
              ) : rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.registration || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{d.cnh || '—'} <Badge variant="outline" className="ml-1">{d.cnhCategory}</Badge></TableCell>
                  <TableCell>{d.cnhExpiry ? d.cnhExpiry.split('-').reverse().join('/') : '—'}</TableCell>
                  <TableCell>{d.phone || '—'}</TableCell>
                  <TableCell>
                    <Select value={d.status} onValueChange={(v) => update('drivers', d.id, { status: v as OpDriverStatus })}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="ferias">Férias</SelectItem>
                        <SelectItem value="afastado">Afastado</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" disabled={!canCreateSchedules} onClick={() => { remove('drivers', d.id); toast.success('Motorista removido.'); }}>
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
