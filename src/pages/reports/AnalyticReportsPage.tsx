// Relatórios analíticos: espelho diário (vários funcionários), absenteísmo, assiduidade, analíticos de
// atraso/extra/falta, déficit de intervalo, marcação incompleta, intervalo não calculável, marcação
// mobile e falhas de login. Filtros por período e departamento; exporta CSV e imprime.
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Printer, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { loadPeriod, fmtMin, fmtTime, fmtDate, type DayRow, type PersonRow } from '@/lib/attendancePeriod';

type Report = { key: string; label: string; single?: boolean; build: (days: DayRow[], people: PersonRow[]) => { cols: string[]; rows: (string | number)[][] } };

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');
const who = (p: PersonRow) => [p.full_name, p.registration_number ?? '', p.department ?? ''];
const byPerson = (days: DayRow[]) => {
  const m = new Map<string, DayRow[]>();
  for (const d of days) { if (!m.has(d.person.id)) m.set(d.person.id, []); m.get(d.person.id)!.push(d); }
  return [...m.values()];
};
const punchList = (d: DayRow) => d.punches.map((p) => fmtTime(p.at)).join(' ');

const REPORTS: Report[] = [
  {
    key: 'daily', label: 'Espelho diário (todos os funcionários)', single: true,
    build: (days) => ({
      cols: ['Funcionário', 'Matrícula', 'Departamento', 'Marcações', 'Trabalhadas', 'Previstas', 'Saldo', 'Situação'],
      rows: days.map((d) => [...who(d.person), punchList(d) || '—', fmtMin(d.result.workedMinutes), fmtMin(d.result.expectedMinutes), fmtMin(d.result.balanceMinutes),
        d.absenceReason ? `Afastado (${d.absenceReason})` : d.result.isAbsent ? 'Falta' : d.result.incomplete ? 'Incompleto' : !d.scheduled && !d.punches.length ? 'Folga' : d.result.lateMinutes ? `Atraso ${fmtMin(d.result.lateMinutes)}` : 'Normal']),
    }),
  },
  {
    key: 'absenteeism', label: 'Absenteísmo',
    build: (days) => ({
      cols: ['Funcionário', 'Matrícula', 'Departamento', 'Horas previstas', 'Faltas (horas)', 'Atrasos', 'Saídas antecipadas', 'Absenteísmo'],
      rows: byPerson(days).map((ds) => {
        const exp = ds.reduce((a, d) => a + d.result.expectedMinutes, 0);
        const abs = ds.reduce((a, d) => a + d.result.absenceMinutes, 0);
        const late = ds.reduce((a, d) => a + d.result.lateMinutes, 0);
        const early = ds.reduce((a, d) => a + d.result.earlyLeaveMinutes, 0);
        return [...who(ds[0].person), fmtMin(exp), fmtMin(abs), fmtMin(late), fmtMin(early), pct(abs + late + early, exp)];
      }),
    }),
  },
  {
    key: 'assiduity', label: 'Assiduidade',
    build: (days) => ({
      cols: ['Funcionário', 'Matrícula', 'Departamento', 'Dias previstos', 'Dias trabalhados', 'Faltas', 'Dias com atraso', 'Assiduidade'],
      rows: byPerson(days).map((ds) => {
        const sched = ds.filter((d) => d.scheduled && !d.absenceReason);
        const absent = sched.filter((d) => d.result.isAbsent).length;
        const late = sched.filter((d) => d.result.lateMinutes > 0).length;
        return [...who(ds[0].person), sched.length, sched.length - absent, absent, late, pct(sched.length - absent - late, sched.length)];
      }),
    }),
  },
  { key: 'late', label: 'Analítico de atraso', build: (days) => ({ cols: ['Funcionário', 'Matrícula', 'Departamento', 'Data', 'Marcações', 'Atraso', 'Saída antecipada'], rows: days.filter((d) => d.result.lateMinutes || d.result.earlyLeaveMinutes).map((d) => [...who(d.person), fmtDate(d.date), punchList(d), fmtMin(d.result.lateMinutes), fmtMin(d.result.earlyLeaveMinutes)]) }) },
  { key: 'overtime', label: 'Analítico de extra', build: (days) => ({ cols: ['Funcionário', 'Matrícula', 'Departamento', 'Data', 'Marcações', 'Trabalhadas', 'Extra', 'Noturno'], rows: days.filter((d) => d.result.overtimeMinutes > 0).map((d) => [...who(d.person), fmtDate(d.date), punchList(d), fmtMin(d.result.workedMinutes), fmtMin(d.result.overtimeMinutes), fmtMin(d.result.nightMinutes)]) }) },
  { key: 'absence', label: 'Analítico de falta', build: (days) => ({ cols: ['Funcionário', 'Matrícula', 'Departamento', 'Data', 'Horas previstas'], rows: days.filter((d) => d.result.isAbsent && !d.absenceReason).map((d) => [...who(d.person), fmtDate(d.date), fmtMin(d.result.expectedMinutes)]) }) },
  { key: 'break', label: 'Déficit de intervalo', build: (days) => ({ cols: ['Funcionário', 'Matrícula', 'Departamento', 'Data', 'Marcações', 'Intervalo feito', 'Déficit'], rows: days.filter((d) => d.result.intraJourneyShortfallMinutes > 0).map((d) => [...who(d.person), fmtDate(d.date), punchList(d), fmtMin(d.result.breakMinutes), fmtMin(d.result.intraJourneyShortfallMinutes)]) }) },
  { key: 'incomplete', label: 'Marcação incompleta', build: (days) => ({ cols: ['Funcionário', 'Matrícula', 'Departamento', 'Data', 'Marcações'], rows: days.filter((d) => d.result.incomplete).map((d) => [...who(d.person), fmtDate(d.date), punchList(d)]) }) },
  {
    key: 'uncalc', label: 'Intervalo não calculável',
    build: (days) => ({ cols: ['Funcionário', 'Matrícula', 'Departamento', 'Data', 'Marcações', 'Motivo'], rows: days.filter((d) => { const s = d.punches.filter((p) => p.type === 'break_start').length, e = d.punches.filter((p) => p.type === 'break_end').length; return s !== e; }).map((d) => [...who(d.person), fmtDate(d.date), punchList(d), 'Início e fim de intervalo não formam pares']) }),
  },
  { key: 'mobile', label: 'Marcações pelo celular', build: (days) => ({ cols: ['Funcionário', 'Matrícula', 'Departamento', 'Data', 'Hora', 'Tipo'], rows: days.flatMap((d) => d.punches.filter((p) => p.mobile).map((p) => [...who(d.person), fmtDate(d.date), fmtTime(p.at), ({ entry: 'Entrada', exit: 'Saída', break_start: 'Início intervalo', break_end: 'Fim intervalo' } as Record<string, string>)[p.type] ?? p.type])) }) },
  { key: 'logins', label: 'Falhas de login', build: (_d, people) => ({ cols: ['Funcionário', 'Matrícula', 'Departamento', 'Tentativas com falha', 'Última falha'], rows: people.filter((p) => (p.failed_login_attempts ?? 0) > 0).map((p) => [...who(p), p.failed_login_attempts ?? 0, p.last_failed_login ? new Date(p.last_failed_login).toLocaleString('pt-BR') : '—']) }) },
];

export default function AnalyticReportsPage() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const [key, setKey] = useState('daily');
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [department, setDepartment] = useState('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [data, setData] = useState<{ people: PersonRow[]; days: DayRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const report = REPORTS.find((r) => r.key === key)!;

  useEffect(() => {
    (supabase as any).from('profiles').select('department').eq('is_active', true).then(({ data: d }: any) =>
      setDepartments([...new Set((d ?? []).map((x: any) => x.department).filter(Boolean))].sort() as string[]));
  }, []);

  const run = async () => {
    setBusy(true);
    try {
      const f = report.single ? to : from;
      setData(await loadPeriod(f, to, { department: department === 'all' ? undefined : department }));
    } finally {
      setBusy(false);
    }
  };

  const table = useMemo(() => (data ? report.build(data.days, data.people) : null), [data, report]);

  const csv = () => {
    if (!table) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const body = [table.cols, ...table.rows].map((r) => r.map(esc).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
    a.download = `${report.key}-${from}-${to}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios analíticos" description="Espelho diário, absenteísmo, assiduidade, atrasos, extras, faltas, intervalos e mais." icon={BarChart3} />
      <Card className="rounded-3xl print:hidden">
        <CardContent className="grid gap-4 p-5 md:grid-cols-5 md:items-end">
          <div className="grid gap-2 md:col-span-2">
            <Label>Relatório</Label>
            <Select value={key} onValueChange={(v) => { setKey(v); setData(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPORTS.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!report.single && <div className="grid gap-2"><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>}
          <div className="grid gap-2"><Label>{report.single ? 'Dia' : 'Até'}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="grid gap-2">
            <Label>Departamento</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 md:col-span-5">
            <Button onClick={run} disabled={busy || (!report.single && from > to)} className="rounded-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar</Button>
            <Button variant="outline" onClick={csv} disabled={!table?.rows.length} className="rounded-full"><Download className="mr-2 h-4 w-4" />CSV / Excel</Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!table?.rows.length} className="rounded-full"><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
          </div>
        </CardContent>
      </Card>

      {table && (
        <Card className="rounded-3xl">
          <CardContent className="p-0">
            <div className="px-5 pt-4 text-sm text-muted-foreground">{report.label} · {report.single ? fmtDate(to) : `${fmtDate(from)} a ${fmtDate(to)}`} · {table.rows.length} linha(s)</div>
            <Table>
              <TableHeader><TableRow>{table.cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {table.rows.length === 0 && <TableRow><TableCell colSpan={table.cols.length} className="py-10 text-center text-muted-foreground">Nada encontrado no período.</TableCell></TableRow>}
                {table.rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j > 2 ? 'tabular-nums' : ''}>{c}</TableCell>)}</TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
