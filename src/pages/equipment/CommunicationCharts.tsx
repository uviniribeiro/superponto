// Gráficos de comunicação: contatos e marcações recebidas por dia, por equipamento, e envio de comandos
// para um grupo de relógios (REP) de uma vez.
import { useEffect, useMemo, useState } from 'react';
import { Activity, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const db = supabase as any;
type Eq = { id: string; name: string; group_name: string | null };
const COMMANDS = [
  { value: 'collect_records', label: 'Coletar marcações' },
  { value: 'sync_time', label: 'Acertar data e hora' },
  { value: 'push_employees', label: 'Enviar funcionários' },
  { value: 'set_employer', label: 'Enviar empregador' },
];

export default function CommunicationCharts() {
  const { profile } = useAuth();
  const [equipment, setEquipment] = useState<Eq[]>([]);
  const [logs, setLogs] = useState<{ equipment_id: string; created_at: string; status: string; records_synced: number | null }[]>([]);
  const [days, setDays] = useState(14);
  const [eqFilter, setEqFilter] = useState('all');
  const [group, setGroup] = useState('');
  const [newGroup, setNewGroup] = useState({ equipment: '', name: '' });
  const [command, setCommand] = useState('collect_records');

  const load = async () => {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [{ data: eq }, { data: lg }] = await Promise.all([
      db.from('time_clock_equipment').select('id, name, group_name').order('name'),
      db.from('equipment_communication_logs').select('equipment_id, created_at, status, records_synced').gte('created_at', since).limit(20000),
    ]);
    setEquipment(eq ?? []);
    setLogs(lg ?? []);
  };
  useEffect(() => { load(); }, [days]);

  const chart = useMemo(() => {
    const m = new Map<string, { day: string; contatos: number; falhas: number; marcacoes: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      m.set(d, { day: d.slice(8, 10) + '/' + d.slice(5, 7), contatos: 0, falhas: 0, marcacoes: 0 });
    }
    for (const l of logs) {
      if (eqFilter !== 'all' && l.equipment_id !== eqFilter) continue;
      const d = new Date(l.created_at).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      const row = m.get(d);
      if (!row) continue;
      if (l.status === 'success') row.contatos++; else row.falhas++;
      row.marcacoes += l.records_synced ?? 0;
    }
    return [...m.values()];
  }, [logs, days, eqFilter]);

  const groups = [...new Set(equipment.map((e) => e.group_name).filter(Boolean))] as string[];

  const setEquipmentGroup = async () => {
    if (!newGroup.equipment) return toast.error('Escolha o equipamento');
    const { error } = await db.from('time_clock_equipment').update({ group_name: newGroup.name.trim() || null }).eq('id', newGroup.equipment);
    if (error) return toast.error(error.message);
    toast.success(newGroup.name.trim() ? 'Equipamento incluído no grupo' : 'Equipamento retirado do grupo');
    load();
  };

  const sendToGroup = async () => {
    const targets = equipment.filter((e) => e.group_name === group);
    if (!targets.length) return toast.error('Escolha um grupo com equipamentos');
    const { error } = await db.from('device_commands').insert(targets.map((e) => ({ company_id: profile?.company_id, equipment_id: e.id, command, payload: { group }, status: 'pending' })));
    if (error) return toast.error(error.message);
    toast.success(`Comando enviado para ${targets.length} equipamento(s) do grupo ${group}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Gráficos de comunicação e grupos" description="Contatos, falhas e marcações recebidas por dia; comandos para um grupo de relógios." icon={Activity} />
      <Card className="rounded-3xl">
        <CardHeader className="flex flex-row flex-wrap items-end gap-3">
          <CardTitle className="mr-auto text-base">Comunicação por dia</CardTitle>
          <Select value={eqFilter} onValueChange={setEqFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os equipamentos</SelectItem>{equipment.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{[7, 14, 30, 60].map((d) => <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>)}</SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="contatos" name="Contatos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="falhas" name="Falhas" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="marcacoes" name="Marcações recebidas" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader><CardTitle className="text-base">Grupo do equipamento</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Select value={newGroup.equipment} onValueChange={(v) => setNewGroup({ equipment: v, name: equipment.find((e) => e.id === v)?.group_name ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Equipamento…" /></SelectTrigger>
              <SelectContent>{equipment.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}{e.group_name ? ` (${e.group_name})` : ''}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid gap-2"><Label>Nome do grupo (vazio = sem grupo)</Label><Input value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} placeholder="Ex.: Sede, Escolas zona norte" list="sp-groups" /></div>
            <datalist id="sp-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            <Button onClick={setEquipmentGroup} className="w-fit rounded-full">Salvar</Button>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader><CardTitle className="text-base">Comando para o grupo</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger><SelectValue placeholder={groups.length ? 'Grupo…' : 'Nenhum grupo ainda'} /></SelectTrigger>
              <SelectContent>{groups.map((g) => <SelectItem key={g} value={g}>{g} ({equipment.filter((e) => e.group_name === g).length})</SelectItem>)}</SelectContent>
            </Select>
            <Select value={command} onValueChange={setCommand}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COMMANDS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={sendToGroup} disabled={!group} className="w-fit rounded-full"><Send className="mr-2 h-4 w-4" />Enviar para o grupo</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
