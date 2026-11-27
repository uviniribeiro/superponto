// Refeitório: tipos de refeição por horário (preço, parte paga pelo funcionário e limite por dia),
// terminais do refeitório e relatório de consumo e custo (por funcionário, departamento e refeição),
// pronto para o desconto em folha.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, UtensilsCrossed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReportExportMenu } from '@/components/reports/ReportExportMenu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { TurnstileConfig } from '@/lib/turnstile';

const db = supabase as any;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
type MealType = { id?: string; name: string; start_time: string; end_time: string; price: number; employee_share: number; daily_limit: number; is_active: boolean };
const EMPTY: MealType = { name: '', start_time: '11:00', end_time: '14:00', price: 0, employee_share: 0, daily_limit: 1, is_active: true };

export default function Cafeteria() {
  const { profile } = useAuth();
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const [types, setTypes] = useState<MealType[]>([]);
  const [draft, setDraft] = useState<MealType>(EMPTY);
  const [terminals, setTerminals] = useState<{ id: string; name: string; purpose: string; turnstile: TurnstileConfig | null; turnstile_online: boolean | null; turnstile_seen_at: string | null }[]>([]);
  const [gateFor, setGateFor] = useState<{ id: string; name: string } | null>(null);
  const [gate, setGate] = useState<TurnstileConfig>({ vendor: 'controlid', entry: 'clockwise', exitButton: true, offlineUnlock: true });
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [group, setGroup] = useState<'employee' | 'department' | 'meal' | 'day'>('employee');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTypes = useCallback(async () => {
    const [{ data: t }, { data: k }] = await Promise.all([
      db.from('meal_types').select('*').order('start_time'),
      db.from('kiosk_terminals').select('id, name, purpose, turnstile, turnstile_online, turnstile_seen_at').neq('status', 'revoked').order('name'),
    ]);
    setTypes(t ?? []);
    setTerminals(k ?? []);
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from('meal_records')
      .select('id, recorded_at, meal_name, price, employee_amount, verification, profiles:profile_id(full_name, registration_number, department)')
      .gte('recorded_at', new Date(`${from}T00:00:00-03:00`).toISOString()).lte('recorded_at', new Date(`${to}T23:59:59-03:00`).toISOString())
      .order('recorded_at', { ascending: false }).limit(20000);
    setRecords(data ?? []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { loadTypes(); }, [loadTypes]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const saveType = async () => {
    if (!draft.name.trim()) return toast.error('Dê um nome à refeição (ex.: Almoço).');
    const row = { ...draft, name: draft.name.trim(), company_id: profile?.company_id };
    const { error } = draft.id ? await db.from('meal_types').update(row).eq('id', draft.id) : await db.from('meal_types').insert(row);
    if (error) return toast.error(error.message);
    toast.success('Refeição salva.');
    setDraft(EMPTY);
    loadTypes();
  };

  const setPurpose = async (id: string, purpose: string) => {
    const { error } = await db.from('kiosk_terminals').update({ purpose }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(purpose === 'meal' ? 'Terminal passa a registrar refeições.' : 'Terminal volta a registrar ponto.');
    loadTypes();
  };

  const saveGate = async () => {
    if (!gateFor) return;
    if (gate.vendor !== 'none' && !gate.host?.trim()) return toast.error(gate.vendor === 'controlid' ? 'Informe o IP da catraca.' : 'Informe a URL de liberação.');
    const { error } = await db.from('kiosk_terminals').update({ turnstile: gate.vendor === 'none' ? null : { ...gate, host: gate.host?.trim() } }).eq('id', gateFor.id);
    if (error) return toast.error(error.message);
    toast.success('Catraca configurada. O terminal recebe a configuração em até 1 minuto (ou ao reabrir).');
    setGateFor(null);
    loadTypes();
  };

  const summary = useMemo(() => {
    const key = (r: any) => group === 'employee' ? `${r.profiles?.full_name ?? '—'}${r.profiles?.registration_number ? ` (${r.profiles.registration_number})` : ''}`
      : group === 'department' ? r.profiles?.department || 'Sem departamento'
      : group === 'meal' ? r.meal_name
      : new Date(r.recorded_at).toLocaleDateString('pt-BR');
    const m = new Map<string, { qty: number; total: number; employee: number }>();
    for (const r of records) {
      const k = key(r);
      const cur = m.get(k) ?? { qty: 0, total: 0, employee: 0 };
      cur.qty++; cur.total += Number(r.price); cur.employee += Number(r.employee_amount);
      m.set(k, cur);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v, company: v.total - v.employee })).sort((a, b) => b.qty - a.qty);
  }, [records, group]);

  const totals = summary.reduce((a, s) => ({ qty: a.qty + s.qty, total: a.total + s.total, employee: a.employee + s.employee }), { qty: 0, total: 0, employee: 0 });
  const GROUP_LABEL = { employee: 'Funcionário', department: 'Departamento', meal: 'Refeição', day: 'Dia' };

  return (
    <div className="space-y-6">
      <PageHeader title="Refeitório" description="Refeições por horário, registro no terminal (com conferência do rosto) e relatório de consumo e custo." icon={UtensilsCrossed} />
      <Tabs defaultValue="consumo">
        <TabsList className="rounded-full">
          <TabsTrigger value="consumo" className="rounded-full">Consumo e custo</TabsTrigger>
          <TabsTrigger value="refeicoes" className="rounded-full">Refeições e horários</TabsTrigger>
          <TabsTrigger value="terminais" className="rounded-full">Terminais do refeitório</TabsTrigger>
        </TabsList>

        <TabsContent value="consumo" className="space-y-4">
          <Card className="rounded-3xl"><CardContent className="flex flex-wrap items-end gap-3 p-5">
            <div className="grid gap-1"><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Agrupar por</Label>
              <Select value={group} onValueChange={(v) => setGroup(v as any)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(GROUP_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="ml-auto flex gap-2">
              <ReportExportMenu disabled={!summary.length} getData={() => ({
                title: `Refeitório — consumo por ${GROUP_LABEL[group].toLowerCase()}`, period: { start: from, end: to },
                columns: [GROUP_LABEL[group], 'Refeições', 'Valor total', 'Parte do funcionário (desconto)', 'Parte da empresa'],
                rows: summary.map((s) => [s.key, s.qty, brl(s.total), brl(s.employee), brl(s.company)]),
                totals: ['TOTAL', totals.qty, brl(totals.total), brl(totals.employee), brl(totals.total - totals.employee)],
              })} />
            </div>
          </CardContent></Card>
          <div className="grid gap-4 sm:grid-cols-4">
            {[['Refeições', String(totals.qty)], ['Valor total', brl(totals.total)], ['Desconto dos funcionários', brl(totals.employee)], ['Custo da empresa', brl(totals.total - totals.employee)]].map(([l, v]) => (
              <Card key={l} className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-bold tabular-nums">{v}</p></CardContent></Card>
            ))}
          </div>
          <Card className="rounded-3xl"><CardContent className="p-0">
            {loading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>{GROUP_LABEL[group]}</TableHead><TableHead className="text-right">Refeições</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Empresa</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summary.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma refeição no período.</TableCell></TableRow>}
                  {summary.map((s) => (
                    <TableRow key={s.key}><TableCell className="font-medium">{s.key}</TableCell><TableCell className="text-right tabular-nums">{s.qty}</TableCell><TableCell className="text-right tabular-nums">{brl(s.total)}</TableCell><TableCell className="text-right tabular-nums">{brl(s.employee)}</TableCell><TableCell className="text-right tabular-nums">{brl(s.company)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="refeicoes" className="space-y-4">
          <Card className="rounded-3xl"><CardContent className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-7">
            <div className="grid gap-1 lg:col-span-2"><Label>Refeição</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Almoço" /></div>
            <div className="grid gap-1"><Label>Das</Label><Input type="time" value={draft.start_time.slice(0, 5)} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Às</Label><Input type="time" value={draft.end_time.slice(0, 5)} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Preço (R$)</Label><Input type="number" min={0} step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></div>
            <div className="grid gap-1"><Label>Funcionário paga (%)</Label><Input type="number" min={0} max={100} value={draft.employee_share} onChange={(e) => setDraft({ ...draft, employee_share: Number(e.target.value) })} /></div>
            <div className="grid gap-1"><Label>Limite por dia</Label><Input type="number" min={1} max={10} value={draft.daily_limit} onChange={(e) => setDraft({ ...draft, daily_limit: Number(e.target.value) })} /></div>
            <div className="flex items-end gap-2 sm:col-span-3 lg:col-span-7">
              <Button onClick={saveType}><Plus className="mr-2 h-4 w-4" />{draft.id ? 'Salvar alterações' : 'Adicionar refeição'}</Button>
              {draft.id && <Button variant="ghost" onClick={() => setDraft(EMPTY)}>Cancelar</Button>}
            </div>
          </CardContent></Card>
          <Card className="rounded-3xl"><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Refeição</TableHead><TableHead>Horário</TableHead><TableHead>Preço</TableHead><TableHead>Funcionário paga</TableHead><TableHead>Limite/dia</TableHead><TableHead>Ativa</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {types.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cadastre as refeições (ex.: Café 06:00–08:00, Almoço 11:00–14:00, Jantar 18:00–21:00).</TableCell></TableRow>}
                {types.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => setDraft(t)}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="tabular-nums">{t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)}</TableCell>
                    <TableCell className="tabular-nums">{brl(Number(t.price))}</TableCell>
                    <TableCell className="tabular-nums">{Number(t.employee_share)}%</TableCell>
                    <TableCell>{t.daily_limit}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}><Switch checked={t.is_active} onCheckedChange={async (v) => { await db.from('meal_types').update({ is_active: v }).eq('id', t.id); loadTypes(); }} /></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}><Button size="icon" variant="ghost" onClick={async () => { if (!confirm(`Excluir ${t.name}?`)) return; await db.from('meal_types').delete().eq('id', t.id); loadTypes(); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="terminais">
          <Card className="rounded-3xl"><CardContent className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">Escolha quais terminais ficam no refeitório: neles, a identificação (rosto, QR Code, crachá, PIN…) registra a refeição do horário em vez do ponto. Novos terminais são ativados no <Link className="text-primary underline" to="/kiosk-terminals">app do terminal</Link>.</p>
            {terminals.length === 0 && <p className="text-sm text-muted-foreground">Nenhum terminal ativado.</p>}
            {terminals.map((k) => (
              <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
                <div>
                  <span className="font-medium">{k.name}</span>
                  <p className="text-xs text-muted-foreground">
                    {k.turnstile ? `Catraca ${k.turnstile.vendor === 'controlid' ? 'Control iD' : 'HTTP'} · ${k.turnstile.host}` : 'Sem catraca'}
                    {k.turnstile && k.turnstile_seen_at ? ` · ${k.turnstile_online ? 'online' : 'sem resposta'} em ${new Date(k.turnstile_seen_at).toLocaleString('pt-BR')}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setGateFor(k); setGate(k.turnstile ?? { vendor: 'controlid', entry: 'clockwise', exitButton: true, offlineUnlock: true }); }}>Catraca</Button>
                <Select value={k.purpose ?? 'punch'} onValueChange={(v) => setPurpose(k.id, v)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="punch">Registro de ponto</SelectItem><SelectItem value="meal">Refeitório</SelectItem></SelectContent>
                </Select>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!gateFor} onOpenChange={(o) => !o && setGateFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Catraca do terminal {gateFor?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O terminal libera a catraca na hora, direto pela rede local, assim que a identificação é aceita. Terminal e catraca precisam estar na mesma rede.</p>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label>Catraca</Label>
              <Select value={gate.vendor} onValueChange={(v) => setGate({ ...gate, vendor: v as TurnstileConfig['vendor'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="controlid">Control iD (iDBlock, iDFlex…)</SelectItem>
                  <SelectItem value="http">HTTP genérico (placa de relé / controladora)</SelectItem>
                  <SelectItem value="none">Nenhuma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {gate.vendor === 'controlid' && (
              <>
                <div className="grid gap-1"><Label>IP da catraca</Label><Input value={gate.host ?? ''} onChange={(e) => setGate({ ...gate, host: e.target.value })} placeholder="192.168.0.50" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label>Usuário</Label><Input value={gate.login ?? ''} onChange={(e) => setGate({ ...gate, login: e.target.value })} placeholder="admin" /></div>
                  <div className="grid gap-1"><Label>Senha</Label><Input type="password" value={gate.password ?? ''} onChange={(e) => setGate({ ...gate, password: e.target.value })} placeholder="admin" /></div>
                </div>
                <div className="grid gap-1"><Label>Sentido da entrada</Label>
                  <Select value={gate.entry ?? 'clockwise'} onValueChange={(v) => setGate({ ...gate, entry: v as TurnstileConfig['entry'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="clockwise">Horário</SelectItem><SelectItem value="anticlockwise">Anti-horário</SelectItem><SelectItem value="both">Os dois sentidos</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}
            {gate.vendor === 'http' && (
              <>
                <div className="grid gap-1"><Label>URL de liberação da entrada</Label><Input value={gate.host ?? ''} onChange={(e) => setGate({ ...gate, host: e.target.value })} placeholder="http://192.168.0.60/relay/0?turn=on&timer=3" /></div>
                <div className="grid gap-1"><Label>URL de liberação da saída (opcional)</Label><Input value={gate.exitUrl ?? ''} onChange={(e) => setGate({ ...gate, exitUrl: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1"><Label>Método</Label>
                    <Select value={gate.method ?? 'GET'} onValueChange={(v) => setGate({ ...gate, method: v as 'GET' | 'POST' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem></SelectContent></Select>
                  </div>
                  <div className="grid gap-1"><Label>Corpo (POST, opcional)</Label><Input value={gate.body ?? ''} onChange={(e) => setGate({ ...gate, body: e.target.value })} placeholder='{"open":true}' /></div>
                </div>
              </>
            )}
            {gate.vendor !== 'none' && (
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2"><Checkbox checked={gate.exitButton !== false} onCheckedChange={(v) => setGate({ ...gate, exitButton: !!v })} /> Botão "Liberar saída" na tela do terminal</label>
                <label className="flex items-center gap-2"><Checkbox checked={gate.offlineUnlock !== false} onCheckedChange={(v) => setGate({ ...gate, offlineUnlock: !!v })} /> Sem internet, liberar mesmo assim (a refeição é conferida ao reconectar)</label>
                <label className="flex items-center gap-2"><Checkbox checked={!!gate.onPunch} onCheckedChange={(v) => setGate({ ...gate, onPunch: !!v })} /> Liberar também no registro de ponto (terminal de ponto com catraca)</label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setGateFor(null)}>Cancelar</Button><Button onClick={saveGate}>Salvar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
