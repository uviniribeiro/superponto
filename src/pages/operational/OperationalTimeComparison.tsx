import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck } from 'lucide-react';
import { useOperationalStore } from '@/hooks/useOperationalStore';

const ALL = 'todos';

export default function OperationalTimeComparison() {
  const { data, loading } = useOperationalStore();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [driver, setDriver] = useState(ALL);
  const [line, setLine] = useState(ALL);

  const rows = useMemo(() => {
    return data.schedules
      .filter((s) => s.date === date)
      .filter((s) => (driver === ALL ? true : s.driverId === driver))
      .filter((s) => (line === ALL ? true : s.lineId === line))
      .map((s) => {
        const driverName = data.drivers.find((d) => d.id === s.driverId)?.name ?? 'Sem motorista';
        const lineName = data.lines.find((l) => l.id === s.lineId)?.name ?? '—';
        const first = data.timeRecords
          .filter((r) => r.profileId === s.driverId && r.recordedAt.slice(0, 10) === date)
          .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[0];

        if (!s.driverId) return { id: s.id, driverName, lineName, planned: s.startTime, actual: '—', diff: null as number | null, status: 'Sem motorista' };
        if (!first) return { id: s.id, driverName, lineName, planned: s.startTime, actual: '—', diff: null, status: 'Sem registro' };

        const rec = new Date(first.recordedAt);
        const actual = `${String(rec.getHours()).padStart(2, '0')}:${String(rec.getMinutes()).padStart(2, '0')}`;
        const [ph, pm] = s.startTime.split(':').map(Number);
        const diff = rec.getHours() * 60 + rec.getMinutes() - (ph * 60 + pm);
        const status = diff > 5 ? 'Atrasado' : diff < -30 ? 'Muito adiantado' : 'Em dia';
        return { id: s.id, driverName, lineName, planned: s.startTime, actual, diff, status };
      });
  }, [data, date, driver, line]);

  const tone = (status: string) =>
    status === 'Atrasado' ? 'destructive' : status === 'Em dia' ? 'secondary' : 'outline';

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Conferência Ponto x Escala"
        description="Compare o horário planejado da escala com a primeira batida de ponto do motorista."
        icon={ClipboardCheck}
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Motorista</Label>
            <Select value={driver} onValueChange={setDriver}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {data.drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Linha</Label>
            <Select value={line} onValueChange={setLine}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {data.lines.map((l) => <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead>Linha</TableHead>
                <TableHead>Escala</TableHead>
                <TableHead>Ponto</TableHead>
                <TableHead>Diferença</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma escala nesta data.</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.driverName}</TableCell>
                  <TableCell>{r.lineName}</TableCell>
                  <TableCell>{r.planned}</TableCell>
                  <TableCell>{r.actual}</TableCell>
                  <TableCell>{r.diff === null ? '—' : `${r.diff > 0 ? '+' : ''}${r.diff} min`}</TableCell>
                  <TableCell><Badge variant={tone(r.status)}>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
