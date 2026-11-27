// Painel de indicadores do ponto: absenteísmo, pontualidade, horas extras, intervalo e saldo, por
// departamento, com tendência semanal e quem mais pesa em cada indicador. Leitura direta, sem montar
// cubos de BI: escolha o período e clique no indicador.
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReportExportMenu } from '@/components/reports/ReportExportMenu';
import { loadPeriod, fmtMin, type DayRow } from '@/lib/attendancePeriod';

type Agg = { expected: number; absence: number; scheduledDays: number; workedDays: number; onTime: number; overtime: number; shortBreak: number; balance: number; people: Set<string> };
const empty = (): Agg => ({ expected: 0, absence: 0, scheduledDays: 0, workedDays: 0, onTime: 0, overtime: 0, shortBreak: 0, balance: 0, people: new Set() });

function add(a: Agg, d: DayRow) {
  a.people.add(d.person.id);
  if (d.absenceReason) return;
  const r = d.result;
  if (d.scheduled) {
    a.scheduledDays++;
    a.expected += r.expectedMinutes;
    a.absence += r.absenceMinutes + (r.isAbsent ? 0 : r.lateMinutes + r.earlyLeaveMinutes);
  }
  if (d.punches.length) {
    a.workedDays++;
    if (r.lateMinutes === 0) a.onTime++;
  }
  a.overtime += r.overtimeMinutes;
  if (r.intraJourneyShortfallMinutes > 0) a.shortBreak++;
  a.balance += r.balanceMinutes;
}

const pct = (n: number, d: number) => (d ? (100 * n) / d : 0);
const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

const METRICS = [
  { key: 'abs', label: 'Absenteísmo', hint: 'horas perdidas (faltas, atrasos e saídas antecipadas) ÷ horas previstas', value: (a: Agg) => pct(a.absence, a.expected), fmt: fmtPct, goodLow: true },
  { key: 'pont', label: 'Pontualidade', hint: 'dias trabalhados sem atraso', value: (a: Agg) => pct(a.onTime, a.workedDays), fmt: fmtPct, goodLow: false },
  { key: 'he', label: 'Horas extras', hint: 'total do período', value: (a: Agg) => a.overtime, fmt: (v: number) => fmtMin(Math.round(v)), goodLow: true },
  { key: 'int', label: 'Intervalo curto', hint: 'dias com intervalo abaixo do mínimo', value: (a: Agg) => a.shortBreak, fmt: (v: number) => String(v), goodLow: true },
  { key: 'bal', label: 'Saldo do período', hint: 'soma dos saldos diários', value: (a: Agg) => a.balance, fmt: (v: number) => fmtMin(Math.round(v)), goodLow: false },
] as const;

/** Segunda-feira da semana (AAAA-MM-DD). */
const weekOf = (iso: string) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

export default function Indicators() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const start = new Date(Date.now() - 89 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(today);
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<(typeof METRICS)[number]['key']>('abs');

  useEffect(() => {
    if (from > to) return;
    setLoading(true);
    loadPeriod(from, to).then((r) => setDays(r.days)).finally(() => setLoading(false));
  }, [from, to]);

  const m = METRICS.find((x) => x.key === metric)!;
  const { total, byDept, byWeek, byPerson } = useMemo(() => {
    const total = empty();
    const dep = new Map<string, Agg>(), wk = new Map<string, Agg>(), per = new Map<string, { name: string; dept: string; a: Agg }>();
    for (const d of days) {
      add(total, d);
      const dn = d.person.department || 'Sem departamento';
      add(dep.get(dn) ?? dep.set(dn, empty()).get(dn)!, d);
      const w = weekOf(d.date);
      add(wk.get(w) ?? wk.set(w, empty()).get(w)!, d);
      const p = per.get(d.person.id) ?? per.set(d.person.id, { name: d.person.full_name, dept: dn, a: empty() }).get(d.person.id)!;
      add(p.a, d);
    }
    return {
      total,
      byDept: [...dep.entries()].map(([name, a]) => ({ name, a })),
      byWeek: [...wk.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([w, a]) => ({ week: w.split('-').reverse().slice(0, 2).join('/'), value: Number(m.value(a).toFixed(2)) })),
      byPerson: [...per.values()],
    };
  }, [days, m]);

  const ranked = [...byDept].sort((a, b) => (m.goodLow ? m.value(b.a) - m.value(a.a) : m.value(a.a) - m.value(b.a)));
  const people = [...byPerson].sort((a, b) => (m.goodLow ? m.value(b.a) - m.value(a.a) : m.value(a.a) - m.value(b.a))).slice(0, 10);
  const yFmt = (v: number) => (metric === 'abs' || metric === 'pont' ? `${v}%` : metric === 'he' || metric === 'bal' ? `${Math.round(v / 60)}h` : String(v));

  return (
    <div className="space-y-6">
      <PageHeader title="Indicadores do ponto" description="Absenteísmo, pontualidade, horas extras, intervalo e saldo — por departamento e ao longo das semanas." icon={BarChart3}
        actions={<ReportExportMenu disabled={!byDept.length} getData={() => ({
          title: 'Indicadores do ponto por departamento', period: { start: from, end: to },
          columns: ['Departamento', 'Funcionários', ...METRICS.map((x) => x.label)],
          rows: byDept.map((d) => [d.name, d.a.people.size, ...METRICS.map((x) => x.fmt(x.value(d.a)))]),
          totals: ['TOTAL', total.people.size, ...METRICS.map((x) => x.fmt(x.value(total)))],
        })} />} />

      <Card className="rounded-3xl"><CardContent className="flex flex-wrap items-end gap-3 p-5">
        <div className="grid gap-1"><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="grid gap-1"><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {loading && <Loader2 className="mb-2 h-5 w-5 animate-spin text-muted-foreground" />}
      </CardContent></Card>

      {/* Indicadores: clique para ver tendência, departamentos e pessoas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {METRICS.map((x) => (
          <button key={x.key} type="button" onClick={() => setMetric(x.key)}
            className={`rounded-3xl border p-4 text-left transition ${metric === x.key ? 'border-primary bg-primary/5 shadow-sm' : 'bg-card hover:bg-muted/50'}`}>
            <p className="text-sm text-muted-foreground">{x.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{loading ? '…' : x.fmt(x.value(total))}</p>
            <p className="mt-1 text-xs text-muted-foreground">{x.hint}</p>
          </button>
        ))}
      </div>

      <Card className="rounded-3xl"><CardContent className="p-5">
        <p className="mb-3 font-semibold">{m.label} por semana</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={byWeek} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} tickFormatter={yFmt} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => [m.fmt(v), m.label]} labelFormatter={(l) => `Semana de ${l}`}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, color: 'hsl(var(--popover-foreground))' }} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.12} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl"><CardContent className="p-0">
          <p className="p-5 pb-2 font-semibold">Departamentos — {m.label.toLowerCase()} (pior primeiro)</p>
          <Table>
            <TableHeader><TableRow><TableHead>Departamento</TableHead><TableHead className="text-right">Pessoas</TableHead><TableHead className="w-1/2">{m.label}</TableHead></TableRow></TableHeader>
            <TableBody>
              {ranked.map((d) => {
                const v = m.value(d.a);
                const max = Math.max(...ranked.map((r) => Math.abs(m.value(r.a))), 1);
                return (
                  <TableRow key={d.name}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.a.people.size}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(Math.abs(v) / max) * 100}%` }} /></div>
                        <span className="w-20 text-right tabular-nums text-sm">{m.fmt(v)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
        <Card className="rounded-3xl"><CardContent className="p-0">
          <p className="p-5 pb-2 font-semibold">Quem mais pesa — {m.label.toLowerCase()}</p>
          <Table>
            <TableHeader><TableRow><TableHead>Funcionário</TableHead><TableHead>Departamento</TableHead><TableHead className="text-right">{m.label}</TableHead></TableRow></TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.name}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-muted-foreground">{p.dept}</TableCell><TableCell className="text-right tabular-nums">{m.fmt(m.value(p.a))}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </div>
  );
}
