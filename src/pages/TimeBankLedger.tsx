// Banco de horas com lançamentos: saldo do período por funcionário (apuração) + lançamentos, e ações
// em lote — zerar saldos, pagar saldos positivos ou lançar ajuste manual.
import { useState } from 'react';
import { PiggyBank, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { loadPeriod, fmtMin, fmtDate } from '@/lib/attendancePeriod';

const db = supabase as any;
type Row = { id: string; name: string; reg: string | null; period: number; entries: number; total: number };

export default function TimeBankLedger() {
  const { profile } = useAuth();
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');

  const calc = async () => {
    setBusy(true);
    try {
      const { people, days } = await loadPeriod(from, to);
      const { data: entries } = await db.from('time_bank_entries').select('profile_id, minutes').gte('entry_date', from).lte('entry_date', to);
      setRows(people.map((p) => {
        const period = days.filter((d) => d.person.id === p.id).reduce((a, d) => a + d.result.balanceMinutes, 0);
        const ent = (entries ?? []).filter((e: any) => e.profile_id === p.id).reduce((a: number, e: any) => a + e.minutes, 0);
        return { id: p.id, name: p.full_name, reg: p.registration_number, period, entries: ent, total: period + ent };
      }));
      setSel(new Set());
    } finally {
      setBusy(false);
    }
  };

  const apply = async (kind: 'reset' | 'payment') => {
    const targets = rows.filter((r) => sel.has(r.id) && r.total !== 0 && (kind === 'reset' || r.total > 0));
    if (!targets.length) return toast.error(kind === 'payment' ? 'Selecione funcionários com saldo positivo' : 'Selecione funcionários com saldo');
    if (!confirm(`${kind === 'reset' ? 'Zerar' : 'Pagar'} o saldo de ${targets.length} funcionário(s) em ${fmtDate(to)}?`)) return;
    const { error } = await db.from('time_bank_entries').insert(targets.map((r) => ({
      company_id: profile?.company_id, profile_id: r.id, entry_date: to, minutes: -r.total, kind,
      notes: notes.trim() || (kind === 'reset' ? 'Saldo zerado em lote' : 'Saldo pago em folha'),
    })));
    if (error) return toast.error(error.message);
    toast.success(`${targets.length} lançamento(s) gravado(s)`);
    calc();
  };

  const all = rows.length > 0 && sel.size === rows.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Lançamentos do banco de horas" description="Saldo do período por funcionário; zere ou pague os saldos em lote (fica registrado)." icon={PiggyBank} />
      <Card className="rounded-3xl">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div className="grid gap-2"><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button onClick={calc} disabled={busy || from > to} className="rounded-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Calcular saldos</Button>
          <div className="grid min-w-[220px] flex-1 gap-2"><Label>Observação dos lançamentos</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: fechamento de novembro" /></div>
          <Button variant="outline" onClick={() => apply('payment')} disabled={!sel.size} className="rounded-full">Pagar positivos</Button>
          <Button variant="destructive" onClick={() => apply('reset')} disabled={!sel.size} className="rounded-full">Zerar saldos</Button>
        </CardContent>
      </Card>
      {rows.length > 0 && (
        <Card className="rounded-3xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10"><Checkbox checked={all} onCheckedChange={(v) => setSel(v ? new Set(rows.map((r) => r.id)) : new Set())} /></TableHead>
                <TableHead>Funcionário</TableHead><TableHead>Matrícula</TableHead><TableHead>Apuração do período</TableHead><TableHead>Lançamentos</TableHead><TableHead>Saldo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={sel.has(r.id)} onCheckedChange={(v) => { const n = new Set(sel); if (v) n.add(r.id); else n.delete(r.id); setSel(n); }} /></TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.reg ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">{fmtMin(r.period)}</TableCell>
                    <TableCell className="tabular-nums">{fmtMin(r.entries)}</TableCell>
                    <TableCell className={`font-semibold tabular-nums ${r.total > 0 ? 'text-emerald-600' : r.total < 0 ? 'text-destructive' : ''}`}>{fmtMin(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
