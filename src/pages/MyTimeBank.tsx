// Meu extrato do banco de horas: saldo de cada dia do mês, lançamentos (zerado, pago, ajuste) e total.
import { ReportExportMenu } from '@/components/reports/ReportExportMenu';
import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { loadPeriod, fmtMin, fmtDate, fmtTime, type DayRow } from '@/lib/attendancePeriod';

const KIND: Record<string, string> = { reset: 'Saldo zerado', payment: 'Pago em folha', manual: 'Ajuste', carry: 'Saldo transportado' };

export default function MyTimeBank() {
  const { profile } = useAuth();
  const now = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const [month, setMonth] = useState(now.slice(0, 7));
  const [days, setDays] = useState<DayRow[]>([]);
  const [entries, setEntries] = useState<{ entry_date: string; minutes: number; kind: string; notes: string | null }[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    const from = `${month}-01`;
    const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const to = `${month}-${String(last).padStart(2, '0')}`;
    const end = to > now ? now : to;
    loadPeriod(from, end, { profileId: profile.id }).then((r) => setDays(r.days));
    (supabase as any).from('time_bank_entries').select('entry_date, minutes, kind, notes').eq('profile_id', profile.id).gte('entry_date', from).lte('entry_date', to).order('entry_date')
      .then(({ data }: any) => setEntries(data ?? []));
  }, [month, profile?.id]);

  const periodo = days.reduce((a, d) => a + d.result.balanceMinutes, 0);
  const lanc = entries.reduce((a, e) => a + e.minutes, 0);
  let acc = 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Meu banco de horas" description="Saldo de cada dia e os lançamentos do mês." icon={Wallet}
        actions={<ReportExportMenu disabled={!days.length} getData={() => ({ title: `Extrato do banco de horas — ${profile?.full_name ?? ''}`, period: { start: `${month}-01`, end: days.at(-1)?.date ?? `${month}-01` },
          columns: ['Data', 'Trabalhadas', 'Previstas', 'Saldo do dia', 'Observação'],
          rows: [...days.filter((d) => d.scheduled || d.punches.length).map((d) => [fmtDate(d.date), fmtMin(d.result.workedMinutes), fmtMin(d.result.expectedMinutes), fmtMin(d.result.balanceMinutes), d.absenceReason ?? '']), ...entries.map((e) => [fmtDate(e.entry_date), '', '', fmtMin(e.minutes), `${KIND[e.kind] ?? e.kind}${e.notes ? ` — ${e.notes}` : ''}`])],
          totals: ['SALDO DO MÊS', '', '', fmtMin(periodo + lanc), ''] })} />} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="rounded-3xl"><CardContent className="p-5"><Label>Mês</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-2" /></CardContent></Card>
        {[['Saldo dos dias', periodo], ['Lançamentos', lanc], ['Saldo do mês', periodo + lanc]].map(([l, v]) => (
          <Card key={l as string} className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{l}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${(v as number) < 0 ? 'text-destructive' : ''}`}>{fmtMin(v as number)}</p></CardContent></Card>
        ))}
      </div>
      <Card className="rounded-3xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Marcações</TableHead><TableHead>Trabalhadas</TableHead><TableHead>Previstas</TableHead><TableHead>Saldo do dia</TableHead><TableHead>Acumulado</TableHead></TableRow></TableHeader>
            <TableBody>
              {days.filter((d) => d.scheduled || d.punches.length).map((d) => {
                acc += d.result.balanceMinutes;
                return (
                  <TableRow key={d.date}>
                    <TableCell>{fmtDate(d.date)}</TableCell>
                    <TableCell className="tabular-nums">{d.punches.map((p) => fmtTime(p.at)).join(' ') || (d.absenceReason ? `Afastado: ${d.absenceReason}` : '—')}</TableCell>
                    <TableCell className="tabular-nums">{fmtMin(d.result.workedMinutes)}</TableCell>
                    <TableCell className="tabular-nums">{fmtMin(d.result.expectedMinutes)}</TableCell>
                    <TableCell className={`tabular-nums ${d.result.balanceMinutes < 0 ? 'text-destructive' : ''}`}>{fmtMin(d.result.balanceMinutes)}</TableCell>
                    <TableCell className="tabular-nums">{fmtMin(acc)}</TableCell>
                  </TableRow>
                );
              })}
              {entries.map((e, i) => (
                <TableRow key={`e${i}`} className="bg-muted/40">
                  <TableCell>{fmtDate(e.entry_date)}</TableCell>
                  <TableCell colSpan={3}>{KIND[e.kind] ?? e.kind}{e.notes ? ` — ${e.notes}` : ''}</TableCell>
                  <TableCell className="tabular-nums">{fmtMin(e.minutes)}</TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
