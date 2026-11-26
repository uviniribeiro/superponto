// Bloqueio de acesso por período: enquanto vigente, o usuário não entra no sistema.
import { useEffect, useState } from 'react';
import { Ban, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Row = { id: string; profile_id: string; starts_at: string; ends_at: string | null; reason: string };
const db = supabase as any;
const dt = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'sem fim');
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function AccessBlocks() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<{ id: string; full_name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ profile_id: '', starts_at: local(new Date()), ends_at: '', reason: '' });

  const load = async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      db.from('access_blocks').select('*').order('starts_at', { ascending: false }).limit(500),
      db.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);
    setRows(r ?? []);
    setPeople(p ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.profile_id) return toast.error('Escolha o usuário');
    if (form.reason.trim().length < 3) return toast.error('Informe o motivo');
    if (form.profile_id === profile?.id) return toast.error('Você não pode bloquear o próprio acesso');
    const { error } = await db.from('access_blocks').insert({
      company_id: profile?.company_id, profile_id: form.profile_id, reason: form.reason.trim(),
      starts_at: new Date(form.starts_at).toISOString(), ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    });
    if (error) return toast.error('Não foi possível salvar', { description: error.message });
    toast.success('Bloqueio registrado');
    setOpen(false);
    setForm({ profile_id: '', starts_at: local(new Date()), ends_at: '', reason: '' });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este bloqueio? O usuário volta a poder entrar.')) return;
    const { error } = await db.from('access_blocks').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const now = Date.now();
  const active = (r: Row) => Date.parse(r.starts_at) <= now && (!r.ends_at || Date.parse(r.ends_at) > now);

  return (
    <div className="space-y-6">
      <PageHeader title="Bloqueio de acesso" description="Impeça o acesso de um usuário por um período (com motivo)." icon={Ban}
        actions={<Button onClick={() => setOpen(true)} className="rounded-full"><Plus className="mr-2 h-4 w-4" />Novo bloqueio</Button>} />
      <Card className="rounded-3xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Motivo</TableHead><TableHead>Situação</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum bloqueio.</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{people.find((p) => p.id === r.profile_id)?.full_name ?? '—'}</TableCell>
                  <TableCell>{dt(r.starts_at)}</TableCell>
                  <TableCell>{dt(r.ends_at)}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{r.reason}</TableCell>
                  <TableCell>{active(r) ? <Badge variant="destructive">Vigente</Badge> : Date.parse(r.starts_at) > now ? <Badge variant="secondary">Agendado</Badge> : <Badge variant="outline">Encerrado</Badge>}</TableCell>
                  <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => remove(r.id)} title="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Novo bloqueio de acesso</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Usuário</Label>
              <Select value={form.profile_id} onValueChange={(v) => setForm({ ...form, profile_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Início</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Fim (opcional)</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Motivo</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex.: férias, afastamento, desligamento" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Bloquear</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
