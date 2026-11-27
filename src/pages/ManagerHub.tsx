// Central do Gestor: um "semáforo" com tudo que precisa de atenção — pendências do período, solicitações
// aguardando e alertas ao vivo de hoje (atraso, sem intervalo, hora extra começando) — e tratamento em
// massa (abonar vários dias de uma vez), sem abrir funcionário por funcionário.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Coffee, Loader2, RefreshCw, Siren, Timer, TrafficCone, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { loadPeriod, fmtDate, fmtTime, type DayRow } from '@/lib/attendancePeriod';

const db = supabase as any;
const TZ = 'America/Sao_Paulo';
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
const nowMin = () => { const [h, m] = new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number); return h * 60 + m; };
const toMin = (t?: string | null) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

type Issue = { key: string; day: DayRow; kind: 'incomplete' | 'absent' | 'late' | 'short_break'; label: string };
type Live = { day: DayRow; kind: 'late' | 'no_break' | 'overtime' | 'present'; label: string };

const ABONO_TYPES = [
  { value: 'absence_justified', label: 'Falta justificada' },
  { value: 'medical', label: 'Atestado médico' },
  { value: 'training', label: 'Treinamento' },
  { value: 'remote_work', label: 'Trabalho remoto' },
  { value: 'other', label: 'Outro' },
];

export default function ManagerHub() {
  const { profile } = useAuth();
  const t = today();
  const [from, setFrom] = useState(t.slice(0, 8) + '01');
  const [to, setTo] = useState(t);
  const [days, setDays] = useState<DayRow[]>([]);
  const [todayRows, setTodayRows] = useState<DayRow[]>([]);
  const [pending, setPending] = useState({ adjustments: 0, absences: 0 });
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | Issue['kind']>('all');
  const [abono, setAbono] = useState(false);
  const [abonoType, setAbonoType] = useState('absence_justified');
  const [abonoReason, setAbonoReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadLive = useCallback(async () => {
    const r = await loadPeriod(t, t);
    setTodayRows(r.days);
    setUpdatedAt(new Date());
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const end = to >= t ? new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE', { timeZone: TZ }) : to; // período sem hoje (hoje fica no "ao vivo")
      const [period, adj, abs] = await Promise.all([
        from <= end ? loadPeriod(from, end) : Promise.resolve({ days: [] as DayRow[] }),
        db.from('adjustment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        db.from('employee_absences').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        loadLive(),
      ]);
      setDays(period.days);
      setPending({ adjustments: adj.count ?? 0, absences: abs.count ?? 0 });
      setSel(new Set());
    } finally {
      setLoading(false);
    }
  }, [from, to, t, loadLive]);

  useEffect(() => { load(); }, [load]);
  // Ao vivo: atualiza a cada minuto
  useEffect(() => { const i = setInterval(loadLive, 60_000); return () => clearInterval(i); }, [loadLive]);

  const issues = useMemo<Issue[]>(() => {
    const out: Issue[] = [];
    for (const d of days) {
      if (d.absenceReason) continue;
      const k = `${d.person.id}|${d.date}`;
      if (d.punches.length % 2 === 1 || d.result.incomplete) out.push({ key: k, day: d, kind: 'incomplete', label: `Marcação faltando (${d.punches.length} registro${d.punches.length === 1 ? '' : 's'})` });
      else if (d.scheduled && d.punches.length === 0) out.push({ key: k, day: d, kind: 'absent', label: 'Falta sem justificativa' });
      else if (d.result.lateMinutes > 0) out.push({ key: k, day: d, kind: 'late', label: `Atraso de ${d.result.lateMinutes} min` });
      else if (d.result.intraJourneyShortfallMinutes > 0) out.push({ key: k, day: d, kind: 'short_break', label: `Intervalo curto (faltaram ${d.result.intraJourneyShortfallMinutes} min)` });
    }
    return out;
  }, [days]);

  const live = useMemo<Live[]>(() => {
    const n = nowMin();
    const out: Live[] = [];
    for (const d of todayRows) {
      if (d.absenceReason) continue;
      const start = toMin(d.expectedStart), end = toMin(d.expectedEnd), tol = d.tolerance ?? 10;
      const p = d.punches;
      const last = p.at(-1);
      if (d.scheduled && p.length === 0 && start != null && n > start + tol) { out.push({ day: d, kind: 'late', label: `Não marcou a entrada (previsto ${d.expectedStart?.slice(0, 5)})` }); continue; }
      if (p.length === 1) {
        const inMin = (Date.now() - new Date(p[0].at).getTime()) / 60000;
        if (inMin > 6 * 60) out.push({ day: d, kind: 'no_break', label: `Trabalhando há ${Math.floor(inMin / 60)}h${String(Math.round(inMin % 60)).padStart(2, '0')} sem intervalo` });
      }
      if (p.length % 2 === 1 && end != null && n > end + tol) out.push({ day: d, kind: 'overtime', label: `Hora extra em andamento (saída prevista ${d.expectedEnd?.slice(0, 5)})` });
      else if (p.length % 2 === 1 && last) out.push({ day: d, kind: 'present', label: `Presente desde ${fmtTime(p[0].at)}` });
    }
    return out;
  }, [todayRows]);

  const shown = filter === 'all' ? issues : issues.filter((i) => i.kind === filter);
  const byPerson = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const i of shown) m.set(i.day.person.id, [...(m.get(i.day.person.id) ?? []), i]);
    return [...m.values()];
  }, [shown]);

  const applyAbono = async () => {
    const chosen = issues.filter((i) => sel.has(i.key));
    if (!chosen.length) return;
    if (!abonoReason.trim()) return toast.error('Informe o motivo do abono.');
    setSaving(true);
    try {
      const { error } = await db.from('employee_absences').insert(chosen.map((i) => ({
        company_id: profile?.company_id, profile_id: i.day.person.id, absence_type: abonoType, start_date: i.day.date, end_date: i.day.date, total_days: 1,
        reason: abonoReason.trim(), status: 'approved', approved_by: profile?.id, approved_at: new Date().toISOString(), notes: 'Abono em massa pela Central do Gestor',
      })));
      if (error) throw error;
      toast.success(`${chosen.length} dia(s) abonado(s).`);
      setAbono(false);
      setAbonoReason('');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível abonar.');
    } finally {
      setSaving(false);
    }
  };

  const liveCount = (k: Live['kind']) => live.filter((l) => l.kind === k).length;
  const lights = [
    { title: 'Pendências do período', value: issues.length, sub: `${new Set(issues.map((i) => i.day.person.id)).size} funcionário(s)`, color: issues.length ? 'bg-red-500' : 'bg-emerald-500', icon: AlertTriangle },
    { title: 'Solicitações aguardando', value: pending.adjustments + pending.absences, sub: `${pending.adjustments} ajuste(s) · ${pending.absences} afastamento(s)`, color: pending.adjustments + pending.absences ? 'bg-amber-500' : 'bg-emerald-500', icon: ClipboardCheck },
    { title: 'Alertas agora', value: liveCount('late') + liveCount('no_break') + liveCount('overtime'), sub: `${liveCount('present')} presente(s) agora`, color: liveCount('late') + liveCount('no_break') + liveCount('overtime') ? 'bg-amber-500' : 'bg-emerald-500', icon: Siren },
  ];

  const LIVE_ICON = { late: UserX, no_break: Coffee, overtime: Timer, present: CheckCircle2 } as const;
  const LIVE_TONE = { late: 'text-red-600', no_break: 'text-amber-600', overtime: 'text-amber-600', present: 'text-emerald-600' } as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Central do Gestor" description="O que precisa da sua atenção, em um só lugar — e resolvido em poucos cliques." icon={TrafficCone}
        actions={<Button variant="outline" className="rounded-full" onClick={load} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Atualizar</Button>} />

      <div className="grid gap-4 md:grid-cols-3">
        {lights.map((l) => (
          <Card key={l.title} className="rounded-3xl">
            <CardContent className="flex items-center gap-4 p-5">
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl text-white ${l.color}`}><l.icon className="h-6 w-6" /></span>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{l.title}</p>
                <p className="text-3xl font-bold tabular-nums">{loading ? '…' : l.value}</p>
                <p className="text-xs text-muted-foreground">{l.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 font-semibold">Ao vivo — hoje</p>
            {updatedAt && <span className="text-xs text-muted-foreground">atualizado às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · a cada minuto</span>}
          </div>
          {live.filter((l) => l.kind !== 'present').length === 0
            ? <p className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Nenhum alerta agora.</p>
            : (
              <div className="grid gap-2 md:grid-cols-2">
                {live.filter((l) => l.kind !== 'present').map((l, i) => {
                  const Icon = LIVE_ICON[l.kind];
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-2xl border p-3">
                      <Icon className={`h-5 w-5 ${LIVE_TONE[l.kind]}`} />
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{l.day.person.full_name}</p><p className="text-xs text-muted-foreground">{l.label}</p></div>
                    </div>
                  );
                })}
              </div>
            )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <p className="mr-auto font-semibold">Pendências do período</p>
            <div className="grid gap-1"><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="grid gap-1"><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas ({issues.length})</SelectItem>
                <SelectItem value="incomplete">Marcação faltando ({issues.filter((i) => i.kind === 'incomplete').length})</SelectItem>
                <SelectItem value="absent">Faltas ({issues.filter((i) => i.kind === 'absent').length})</SelectItem>
                <SelectItem value="late">Atrasos ({issues.filter((i) => i.kind === 'late').length})</SelectItem>
                <SelectItem value="short_break">Intervalo curto ({issues.filter((i) => i.kind === 'short_break').length})</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setAbono(true)} disabled={!sel.size}>Abonar selecionados ({sel.size})</Button>
          </div>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            : byPerson.length === 0 ? <p className="flex items-center gap-2 py-6 text-emerald-600"><CheckCircle2 className="h-5 w-5" /> Tudo em dia neste período.</p>
            : (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground"><Checkbox checked={shown.length > 0 && shown.every((i) => sel.has(i.key))} onCheckedChange={(v) => setSel(v ? new Set(shown.map((i) => i.key)) : new Set())} /> Selecionar todas as exibidas</label>
                {byPerson.map((list) => (
                  <div key={list[0].day.person.id} className="rounded-2xl border p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Checkbox checked={list.every((i) => sel.has(i.key))} onCheckedChange={(v) => { const n = new Set(sel); list.forEach((i) => (v ? n.add(i.key) : n.delete(i.key))); setSel(n); }} />
                      <p className="font-semibold">{list[0].day.person.full_name}</p>
                      {list[0].day.person.registration_number && <span className="text-xs text-muted-foreground">mat. {list[0].day.person.registration_number}</span>}
                      <Badge variant="secondary">{list.length} dia(s)</Badge>
                      <Button asChild size="sm" variant="ghost" className="ml-auto"><Link to="/mirror-point">Abrir espelho</Link></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {list.map((i) => (
                        <label key={i.key} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${sel.has(i.key) ? 'border-primary bg-primary/5' : ''}`}>
                          <Checkbox checked={sel.has(i.key)} onCheckedChange={(v) => { const n = new Set(sel); if (v) n.add(i.key); else n.delete(i.key); setSel(n); }} />
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="tabular-nums">{fmtDate(i.day.date)}</span>
                          <span className="text-muted-foreground">· {i.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          <div className="flex flex-wrap gap-2 border-t pt-3 text-sm">
            <span className="text-muted-foreground">Solicitações:</span>
            <Button asChild size="sm" variant="outline"><Link to="/adjustments">Ajustes de marcação ({pending.adjustments})</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/leave-management">Afastamentos ({pending.absences})</Link></Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={abono} onOpenChange={setAbono}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abonar {sel.size} dia(s)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2"><Label>Tipo</Label>
              <Select value={abonoType} onValueChange={setAbonoType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ABONO_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid gap-2"><Label>Motivo (fica no histórico)</Label><Input value={abonoReason} onChange={(e) => setAbonoReason(e.target.value)} placeholder="Ex.: queda de energia no relógio em 12/11" /></div>
            <p className="text-xs text-muted-foreground">Os dias saem das pendências e deixam de contar como falta ou atraso no cálculo.</p>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAbono(false)}>Cancelar</Button><Button onClick={applyAbono} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Abonar</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
