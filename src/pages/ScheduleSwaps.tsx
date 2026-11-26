// Troca de escala e de folga: o funcionário pede, o gestor aprova (respeitando a política de níveis) e a
// escala agendada dos envolvidos é atualizada.
import { useEffect, useState } from 'react';
import { ArrowLeftRight, Plus, Check, X } from 'lucide-react';
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
import { addApproval, levelsFor } from '@/lib/approvalPolicy';
import { fmtDate } from '@/lib/attendancePeriod';

const db = supabase as any;
type Row = { id: string; company_id: string; requester_id: string; target_id: string | null; kind: 'swap' | 'day_off'; swap_date: string; target_date: string | null; reason: string; status: string; approvals: unknown };
const STATUS: Record<string, [string, 'secondary' | 'default' | 'destructive' | 'outline']> = { pending: ['Pendente', 'secondary'], approved: ['Aprovada', 'default'], rejected: ['Recusada', 'destructive'], cancelled: ['Cancelada', 'outline'] };

/** Grava o dia na escala agendada (substitui o que houver no dia). */
async function setDay(companyId: string, profileId: string, date: string, work: boolean, note: string) {
  await db.from('scheduled_scales').delete().eq('profile_id', profileId).eq('scale_date', date);
  const { error } = await db.from('scheduled_scales').insert({ company_id: companyId, profile_id: profileId, scale_date: date, is_work_day: work, notes: note });
  if (error) throw error;
}

export default function ScheduleSwaps() {
  const { profile, isAdmin, isManager } = useAuth();
  const manager = isAdmin || isManager;
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<{ id: string; full_name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'day_off', target_id: '', swap_date: '', target_date: '', reason: '' });

  const load = async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      db.from('schedule_swap_requests').select('*').order('created_at', { ascending: false }).limit(300),
      db.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);
    setRows(r ?? []);
    setPeople(p ?? []);
  };
  useEffect(() => { load(); }, []);
  const name = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? '—';

  const create = async () => {
    if (!form.swap_date || form.reason.trim().length < 3) return toast.error('Informe a data e o motivo');
    if (form.kind === 'swap' && (!form.target_id || !form.target_date)) return toast.error('Na troca, escolha o colega e a data dele');
    const { error } = await db.from('schedule_swap_requests').insert({
      company_id: profile?.company_id, requester_id: profile?.id, kind: form.kind, swap_date: form.swap_date, reason: form.reason.trim(),
      target_id: form.kind === 'swap' ? form.target_id : null, target_date: form.target_date || null,
    });
    if (error) return toast.error(error.message);
    toast.success('Pedido enviado ao gestor');
    setOpen(false);
    load();
  };

  const review = async (r: Row, ok: boolean) => {
    try {
      if (!ok) {
        await db.from('schedule_swap_requests').update({ status: 'rejected', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', r.id);
        toast.success('Pedido recusado');
        return load();
      }
      if (r.requester_id === profile?.id) return toast.error('Quem pediu não aprova o próprio pedido');
      const step = addApproval(r.approvals, await levelsFor('schedule_swaps'), { id: profile!.id, name: profile!.full_name ?? '' });
      if (step.error) return toast.error(step.error);
      if (!step.final) {
        await db.from('schedule_swap_requests').update({ approvals: step.approvals }).eq('id', r.id);
        toast.success('Aprovação registrada; aguarda o próximo nível');
        return load();
      }
      const note = `Troca aprovada: ${r.reason}`;
      if (r.kind === 'day_off') {
        await setDay(r.company_id, r.requester_id, r.swap_date, false, note);
        if (r.target_date) await setDay(r.company_id, r.requester_id, r.target_date, true, note);
      } else {
        await setDay(r.company_id, r.requester_id, r.swap_date, false, note);
        await setDay(r.company_id, r.requester_id, r.target_date!, true, note);
        await setDay(r.company_id, r.target_id!, r.swap_date, true, note);
        await setDay(r.company_id, r.target_id!, r.target_date!, false, note);
      }
      await db.from('schedule_swap_requests').update({ status: 'approved', approvals: step.approvals, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', r.id);
      toast.success('Troca aprovada e escala atualizada');
      load();
    } catch (e) {
      toast.error('Não foi possível concluir', { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Troca de escala e folga" description="Peça para trocar o dia com um colega ou folgar em outra data; o gestor aprova e a escala é atualizada." icon={ArrowLeftRight}
        actions={<Button onClick={() => setOpen(true)} className="rounded-full"><Plus className="mr-2 h-4 w-4" />Novo pedido</Button>} />
      <Card className="rounded-3xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Solicitante</TableHead><TableHead>Tipo</TableHead><TableHead>Datas</TableHead><TableHead>Colega</TableHead><TableHead>Motivo</TableHead><TableHead>Situação</TableHead>{manager && <TableHead />}</TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Nenhum pedido.</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{name(r.requester_id)}</TableCell>
                  <TableCell>{r.kind === 'swap' ? 'Troca com colega' : 'Troca de folga'}</TableCell>
                  <TableCell>{fmtDate(r.swap_date)}{r.target_date ? ` ↔ ${fmtDate(r.target_date)}` : ''}</TableCell>
                  <TableCell>{r.target_id ? name(r.target_id) : '—'}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{r.reason}</TableCell>
                  <TableCell><Badge variant={STATUS[r.status]?.[1]}>{STATUS[r.status]?.[0] ?? r.status}</Badge>{r.status === 'pending' && Array.isArray(r.approvals) && r.approvals.length > 0 && <span className="ml-2 text-xs text-muted-foreground">{r.approvals.length} aprovação(ões)</span>}</TableCell>
                  {manager && <TableCell className="text-right">{r.status === 'pending' && <><Button size="icon" variant="ghost" onClick={() => review(r, true)} title="Aprovar"><Check className="h-4 w-4 text-emerald-600" /></Button><Button size="icon" variant="ghost" onClick={() => review(r, false)} title="Recusar"><X className="h-4 w-4 text-destructive" /></Button></>}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Novo pedido de troca</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="day_off">Trocar minha folga de dia</SelectItem><SelectItem value="swap">Trocar o dia com um colega</SelectItem></SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>{form.kind === 'swap' ? 'Meu dia (passo para o colega)' : 'Dia em que vou folgar'}</Label><Input type="date" value={form.swap_date} onChange={(e) => setForm({ ...form, swap_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{form.kind === 'swap' ? 'Dia do colega (eu trabalho)' : 'Dia em que vou trabalhar (opcional)'}</Label><Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></div>
            </div>
            {form.kind === 'swap' && (
              <Select value={form.target_id} onValueChange={(v) => setForm({ ...form, target_id: v })}>
                <SelectTrigger><SelectValue placeholder="Colega…" /></SelectTrigger>
                <SelectContent>{people.filter((p) => p.id !== profile?.id).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="grid gap-2"><Label>Motivo</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={create}>Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
