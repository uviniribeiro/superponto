// E-mails agendados com as ocorrências do dia anterior (faltas, atrasos, marcações incompletas e
// déficit de intervalo). O envio é feito pela função occurrence-digest, chamada de hora em hora.
import { useEffect, useState } from 'react';
import { MailCheck, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const OCC = [['absence', 'Faltas'], ['late', 'Atrasos'], ['incomplete', 'Marcações incompletas'], ['break', 'Déficit de intervalo']] as const;
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const db = supabase as any;
type Row = { id: string; name: string; emails: string[]; occurrences: string[]; send_hour: number; weekdays: number[]; is_active: boolean; last_sent_at: string | null };

export default function NotificationSchedules() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', emails: '', occurrences: ['absence', 'late'] as string[], send_hour: 7, weekdays: [1, 2, 3, 4, 5] });

  const load = async () => setRows((await db.from('notification_schedules').select('*').order('name')).data ?? []);
  useEffect(() => { load(); }, []);

  const save = async () => {
    const emails = f.emails.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    if (f.name.trim().length < 3) return toast.error('Dê um nome ao agendamento');
    if (!emails.length || emails.some((e) => !/^\S+@\S+\.\S+$/.test(e))) return toast.error('Informe e-mails válidos');
    if (!f.occurrences.length || !f.weekdays.length) return toast.error('Escolha ao menos uma ocorrência e um dia');
    const { error } = await db.from('notification_schedules').insert({ company_id: profile?.company_id, name: f.name.trim(), emails, occurrences: f.occurrences, send_hour: f.send_hour, weekdays: f.weekdays });
    if (error) return toast.error(error.message);
    toast.success('Agendamento criado');
    setOpen(false);
    load();
  };
  const toggle = async (r: Row) => { await db.from('notification_schedules').update({ is_active: !r.is_active }).eq('id', r.id); load(); };
  const remove = async (r: Row) => { if (confirm(`Remover "${r.name}"?`)) { await db.from('notification_schedules').delete().eq('id', r.id); load(); } };
  const flip = (list: (string | number)[], v: string | number) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-6">
      <PageHeader title="E-mails agendados" description="Receba por e-mail as ocorrências do dia anterior, nos dias e no horário escolhidos." icon={MailCheck}
        actions={<Button onClick={() => setOpen(true)} className="rounded-full"><Plus className="mr-2 h-4 w-4" />Novo agendamento</Button>} />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 && <Card className="rounded-3xl"><CardContent className="p-6 text-muted-foreground">Nenhum agendamento ainda.</CardContent></Card>}
        {rows.map((r) => (
          <Card key={r.id} className="rounded-3xl">
            <CardContent className="grid gap-2 p-5">
              <div className="flex items-center justify-between"><p className="font-semibold">{r.name}</p><div className="flex items-center gap-2"><Switch checked={r.is_active} onCheckedChange={() => toggle(r)} /><Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>
              <p className="text-sm text-muted-foreground">{r.occurrences.map((o) => OCC.find((x) => x[0] === o)?.[1]).join(', ')} · {r.weekdays.sort().map((d) => WD[d]).join(', ')} às {String(r.send_hour).padStart(2, '0')}h</p>
              <p className="truncate text-sm">{r.emails.join(', ')}</p>
              <p className="text-xs text-muted-foreground">Último envio: {r.last_sent_at ? new Date(r.last_sent_at).toLocaleString('pt-BR') : 'ainda não enviado'}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Novo e-mail agendado</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Ocorrências para o RH" /></div>
            <div className="grid gap-2"><Label>E-mails (separados por vírgula)</Label><Input value={f.emails} onChange={(e) => setF({ ...f, emails: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Ocorrências</Label><div className="flex flex-wrap gap-4">{OCC.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><Checkbox checked={f.occurrences.includes(k)} onCheckedChange={() => setF({ ...f, occurrences: flip(f.occurrences, k) as string[] })} />{l}</label>)}</div></div>
            <div className="grid gap-2"><Label>Dias</Label><div className="flex flex-wrap gap-3">{WD.map((l, i) => <label key={i} className="flex items-center gap-1.5 text-sm"><Checkbox checked={f.weekdays.includes(i)} onCheckedChange={() => setF({ ...f, weekdays: flip(f.weekdays, i) as number[] })} />{l}</label>)}</div></div>
            <div className="grid gap-2"><Label>Horário (6h às 20h, Brasília)</Label><Input type="number" min={6} max={20} value={f.send_hour} onChange={(e) => setF({ ...f, send_hour: Math.min(20, Math.max(6, Number(e.target.value))) })} className="w-28" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
