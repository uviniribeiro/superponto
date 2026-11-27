// Portaria: quem está dentro agora, entradas e saídas registradas nos terminais com catraca, e exportação.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DoorOpen, Loader2, LogIn, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReportExportMenu } from '@/components/reports/ReportExportMenu';

const db = supabase as any;

export default function GateControl() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from('gate_access_logs')
      .select('id, recorded_at, direction, verification, profile_id, profiles:profile_id(full_name, registration_number, department), kiosk_terminals:terminal_id(name)')
      .gte('recorded_at', new Date(`${from}T00:00:00-03:00`).toISOString()).lte('recorded_at', new Date(`${to}T23:59:59-03:00`).toISOString())
      .order('recorded_at', { ascending: false }).limit(20000);
    setRows(data ?? []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (to !== today) return; const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load, to, today]);

  const inside = useMemo(() => {
    const last = new Map<string, any>();
    for (const r of rows) if (!last.has(r.profile_id)) last.set(r.profile_id, r); // rows já vêm do mais novo para o mais antigo
    return [...last.values()].filter((r) => r.direction === 'in');
  }, [rows]);
  const shown = useMemo(() => { const t = q.toLowerCase(); return t ? rows.filter((r) => `${r.profiles?.full_name} ${r.profiles?.registration_number ?? ''}`.toLowerCase().includes(t)) : rows; }, [rows, q]);

  return (
    <div className="space-y-6">
      <PageHeader title="Portaria" description="Entradas e saídas nos terminais com catraca e quem está dentro agora." icon={DoorOpen}
        actions={<ReportExportMenu disabled={!rows.length} getData={() => ({
          title: 'Portaria — entradas e saídas', period: { start: from, end: to },
          columns: ['Data e hora', 'Funcionário', 'Matrícula', 'Departamento', 'Sentido', 'Terminal', 'Identificação'],
          rows: shown.map((r) => [new Date(r.recorded_at).toLocaleString('pt-BR'), r.profiles?.full_name ?? '', r.profiles?.registration_number ?? '', r.profiles?.department ?? '', r.direction === 'in' ? 'Entrada' : 'Saída', r.kiosk_terminals?.name ?? '', r.verification ?? '']),
        })} />} />
      <Card className="rounded-3xl"><CardContent className="flex flex-wrap items-end gap-3 p-5">
        <div className="grid gap-1"><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="grid gap-1"><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar funcionário" className="max-w-xs" />
        {loading && <Loader2 className="mb-2 h-5 w-5 animate-spin" />}
      </CardContent></Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Dentro agora</p><p className="text-3xl font-bold tabular-nums">{inside.length}</p></CardContent></Card>
        <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Entradas</p><p className="text-3xl font-bold tabular-nums">{rows.filter((r) => r.direction === 'in').length}</p></CardContent></Card>
        <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">Saídas</p><p className="text-3xl font-bold tabular-nums">{rows.filter((r) => r.direction === 'out').length}</p></CardContent></Card>
      </div>
      {inside.length > 0 && (
        <Card className="rounded-3xl"><CardContent className="p-5">
          <p className="mb-2 font-semibold">Dentro agora</p>
          <div className="flex flex-wrap gap-2">{inside.map((r) => <Badge key={r.profile_id} variant="secondary">{r.profiles?.full_name} · desde {new Date(r.recorded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Badge>)}</div>
        </CardContent></Card>
      )}
      <Card className="rounded-3xl"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Data e hora</TableHead><TableHead>Funcionário</TableHead><TableHead>Sentido</TableHead><TableHead>Terminal</TableHead><TableHead>Identificação</TableHead></TableRow></TableHeader>
          <TableBody>
            {shown.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhum acesso no período.</TableCell></TableRow>}
            {shown.slice(0, 1000).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap tabular-nums">{new Date(r.recorded_at).toLocaleString('pt-BR')}</TableCell>
                <TableCell className="font-medium">{r.profiles?.full_name}{r.profiles?.registration_number ? <span className="text-muted-foreground"> · {r.profiles.registration_number}</span> : null}</TableCell>
                <TableCell>{r.direction === 'in' ? <span className="inline-flex items-center gap-1 text-emerald-600"><LogIn className="h-4 w-4" />Entrada</span> : <span className="inline-flex items-center gap-1 text-amber-600"><LogOut className="h-4 w-4" />Saída</span>}</TableCell>
                <TableCell>{r.kiosk_terminals?.name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{r.verification}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
