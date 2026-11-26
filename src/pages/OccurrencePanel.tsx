// Painel de ocorrências do gestor: situação do dia (ou de um dia escolhido) com faltas, atrasos,
// marcações incompletas, déficit de intervalo e afastados.
import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { loadPeriod, fmtMin, fmtTime, type DayRow } from '@/lib/attendancePeriod';

const GROUPS: { key: string; label: string; test: (d: DayRow) => boolean; info: (d: DayRow) => string }[] = [
  { key: 'absent', label: 'Faltas', test: (d) => d.result.isAbsent && !d.absenceReason, info: () => 'sem marcação' },
  { key: 'late', label: 'Atrasos', test: (d) => d.result.lateMinutes > 0, info: (d) => `${fmtMin(d.result.lateMinutes)} de atraso` },
  { key: 'incomplete', label: 'Marcação incompleta', test: (d) => d.result.incomplete, info: (d) => d.punches.map((p) => fmtTime(p.at)).join(' ') },
  { key: 'break', label: 'Déficit de intervalo', test: (d) => d.result.intraJourneyShortfallMinutes > 0, info: (d) => `faltaram ${fmtMin(d.result.intraJourneyShortfallMinutes)}` },
  { key: 'leave', label: 'Afastados', test: (d) => !!d.absenceReason, info: (d) => d.absenceReason ?? '' },
];

export default function OccurrencePanel() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const [day, setDay] = useState(today);
  const [rows, setRows] = useState<DayRow[] | null>(null);

  useEffect(() => { setRows(null); loadPeriod(day, day).then((r) => setRows(r.days)); }, [day]);

  return (
    <div className="space-y-6">
      <PageHeader title="Painel de ocorrências" description="Quem faltou, atrasou ou está com marcação pendente no dia." icon={AlertTriangle}
        actions={<Input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="w-44 rounded-full" />} />
      {!rows ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GROUPS.map((g) => {
            const list = rows.filter(g.test);
            return (
              <Card key={g.key} className="rounded-3xl">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between"><p className="font-semibold">{g.label}</p><span className="rounded-full bg-muted px-3 py-0.5 text-sm font-bold tabular-nums">{list.length}</span></div>
                  {list.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum.</p> : (
                    <ul className="max-h-64 space-y-1.5 overflow-auto text-sm">
                      {list.map((d) => <li key={d.person.id} className="flex justify-between gap-3"><span className="truncate">{d.person.full_name}</span><span className="shrink-0 text-muted-foreground tabular-nums">{g.info(d)}</span></li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
