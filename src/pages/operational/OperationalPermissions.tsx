import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOperationalStore } from '@/hooks/useOperationalStore';
import { useOperationalPermissions } from '@/hooks/useOperationalPermissions';

const empty = {
  userId: '',
  userName: '',
  userEmail: '',
  role: '',
  canCreateSchedules: false,
  canSwapDrivers: false,
  canEditOccurrences: false,
  canViewReports: true,
};

export default function OperationalPermissions() {
  const { data, insert, update, remove } = useOperationalStore();
  const { canManagePermissions } = useOperationalPermissions();
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);

  const available = data.employees.filter(
    (e) => e.userId && !data.permissions.some((p) => p.userId === e.userId),
  );

  const save = async () => {
    if (!form.userId) {
      toast.error('Escolha o usuário.');
      return;
    }
    try {
      await insert('permissions', form);
      toast.success('Permissões salvas.');
      setForm(empty);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };


  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Permissões do Controle Operacional"
        description="Defina quem pode criar escalas, trocar motoristas e alterar ocorrências."
        icon={ShieldCheck}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canManagePermissions}><Plus className="mr-1 h-4 w-4" /> Adicionar usuário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Permissões do usuário</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Usuário</Label>
                  <Select
                    value={form.userId}
                    onValueChange={(v) => {
                      const emp = available.find((e) => e.userId === v);
                      setForm({ ...form, userId: v, userName: emp?.name ?? '', userEmail: emp?.email ?? '' });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Escolha um usuário" /></SelectTrigger>
                    <SelectContent>
                      {available.map((e) => (
                        <SelectItem key={e.userId} value={e.userId}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5"><Label>Função</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Tráfego, coordenação..." /></div>
                {([
                  ['canCreateSchedules', 'Criar e apagar escalas'],
                  ['canSwapDrivers', 'Trocar motorista e veículo'],
                  ['canEditOccurrences', 'Registrar e resolver ocorrências'],
                  ['canViewReports', 'Ver relatórios operacionais'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                    <span className="text-sm">{label}</span>
                    <Switch checked={form[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
                  </div>
                ))}
              </div>
              <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {!canManagePermissions && (
        <p className="mb-4 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
          Apenas o administrador pode alterar estas permissões.
        </p>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Usuários com acesso ao módulo</CardTitle>
          <CardDescription>As alterações valem para as telas de Escalas, Operação do Dia e Ocorrências.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-center">Escalas</TableHead>
                <TableHead className="text-center">Trocas</TableHead>
                <TableHead className="text-center">Ocorrências</TableHead>
                <TableHead className="text-center">Relatórios</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.permissions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum usuário configurado.</TableCell></TableRow>
              ) : data.permissions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.userName}</p>
                    <p className="text-xs text-muted-foreground">{p.userEmail}</p>
                  </TableCell>
                  <TableCell>{p.role || '—'}</TableCell>
                  {([
                    'canCreateSchedules',
                    'canSwapDrivers',
                    'canEditOccurrences',
                    'canViewReports',
                  ] as const).map((key) => (
                    <TableCell key={key} className="text-center">
                      <Switch
                        checked={p[key]}
                        disabled={!canManagePermissions}
                        onCheckedChange={(v) => {
                          update('permissions', p.id, { [key]: v });
                          toast.success('Permissão atualizada.');
                        }}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button variant="ghost" size="icon" disabled={!canManagePermissions} onClick={() => { remove('permissions', p.id); toast.success('Usuário removido.'); }}>
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
