// Autorização prévia de horas extras por funcionário (por dia ou para o período inteiro).
import { useEffect, useState } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Row = { id: string; profile_id: string; start_date: string; end_date: string; approved_minutes: number; mode: 'per_day' | 'per_period'; notes: string | null; created_at: string };
type Person = { id: string; full_name: string; registration_number: string | null };

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMinutes = (v: string) => { const [h, m] = v.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const br = (d: string) => d.split('-').reverse().join('/');
const db = supabase as any;

export default function OvertimeAuthorizations() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ profile_id: '', start_date: today, end_date: today, hours: '01:00', mode: 'per_day', notes: '' });

  const load = async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      db.from('overtime_authorizations').select('*').order('start_date', { ascending: false }).limit(500),
      db.from('profiles').select('id, full_name, registration_number').eq('is_active', true).order('full_name'),
    ]);
    setRows(r ?? []);
    setPeople(p ?? []);
  };
  useEffect(() => { load(); }, []);

  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? '—';

  const save = async () => {
    const minutes = toMinutes(form.hours);
    if (!form.profile_id) return toast.error('Escolha o funcionário');
    if (minutes <= 0) return toast.error('Informe as horas autorizadas (HH:MM)');
    if (form.end_date < form.start_date) return toast.error('A data final não pode ser antes da inicial');
    const { error } = await db.from('overtime_authorizations').insert({
      company_id: profile?.company_id, profile_id: form.profile_id, start_date: form.start_date, end_date: form.end_date,
      approved_minutes: minutes, mode: form.mode, notes: form.notes.trim() || null,
    });
    if (error) return toast.error('Não foi possível salvar', { description: error.message });
    toast.success('Hora extra autorizada');
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta autorização?')) return;
    const { error } = await db.from('overtime_authorizations').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Autorização de horas extras" description="Autorize previamente as horas extras de cada funcionário, por dia ou para o período inteiro." icon={Clock}
        actions={<Button onClick={() => setOpen(true)} className="rounded-full"><Plus className="mr-2 h-4 w-4" />Nova autorização</Button>} />
      <Card className="rounded-3xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Funcionário</TableHead><TableHead>Período</TableHead><TableHead>Horas</TableHead><TableHead>Tipo</TableHead><TableHead>Observação</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nenhuma autorização ainda.</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{name(r.profile_id)}</TableCell>
                  <TableCell>{br(r.start_date)}{r.end_date !== r.start_date ? ` a ${br(r.end_date)}` : ''}</TableCell>
                  <TableCell className="tabular-nums">{hhmm(r.approved_minutes)}</TableCell>
                  <TableCell><Badge variant="secondary">{r.mode === 'per_day' ? 'Por dia' : 'No período'}</Badge></TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">{r.notes}</TableCell>
                  <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => remove(r.id)} title="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Nova autorização de hora extra</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Funcionário</Label>
              <Select value={form.profile_id} onValueChange={(v) => setForm({ ...form, profile_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
                <SelectContent>{people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}{p.registration_number ? ` (${p.registration_number})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>De</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Até</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Horas autorizadas</Label><Input type="time" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="per_day">Por dia (limite diário)</SelectItem><SelectItem value="per_period">No período (total)</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Observação</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Motivo da autorização" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Autorizar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
