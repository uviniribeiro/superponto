// Log de processos: o que foi feito no sistema (inclusões, alterações e exclusões), por quem e quando,
// a partir da auditoria (audit_logs). Também traz o relatório de permissões por perfil.
import { useEffect, useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { menuCategories } from '@/components/layout/CollapsibleSidebar';

type Log = { id: string; created_at: string; user_name: string; action: string; table_name: string; description: string | null; menu_section: string | null; ip_address: string | null };
const ACTION: Record<string, string> = { INSERT: 'Inclusão', UPDATE: 'Alteração', DELETE: 'Exclusão', insert: 'Inclusão', update: 'Alteração', delete: 'Exclusão' };
const ROLES = [['admin', 'Administrador'], ['manager', 'Gestor'], ['employee', 'Funcionário']] as const;

export default function ProcessLog() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<{ role: string; name: string }[]>([]);

  useEffect(() => {
    const db = supabase as any;
    db.from('audit_logs').select('id, created_at, user_name, action, table_name, description, menu_section, ip_address').order('created_at', { ascending: false }).limit(1000).then(({ data }: any) => setLogs(data ?? []));
    Promise.all([db.from('user_roles').select('user_id, role'), db.from('profiles').select('user_id, full_name')]).then(([r, p]: any[]) => {
      const name = new Map((p.data ?? []).map((x: any) => [x.user_id, x.full_name]));
      setUsers((r.data ?? []).filter((x: any) => name.has(x.user_id)).map((x: any) => ({ role: x.role, name: name.get(x.user_id) as string })));
    });
  }, []);

  const filtered = useMemo(() => { const t = q.toLowerCase(); return t ? logs.filter((l) => `${l.user_name} ${l.table_name} ${l.description ?? ''} ${l.menu_section ?? ''}`.toLowerCase().includes(t)) : logs; }, [logs, q]);

  return (
    <div className="space-y-6">
      <PageHeader title="Log de processos e permissões" description="Quem fez o quê no sistema, e o que cada perfil pode acessar." icon={ScrollText} />
      <Tabs defaultValue="log">
        <TabsList className="rounded-full"><TabsTrigger value="log" className="rounded-full">Log de processos</TabsTrigger><TabsTrigger value="roles" className="rounded-full">Funcionalidades por perfil</TabsTrigger><TabsTrigger value="users" className="rounded-full">Usuários por perfil</TabsTrigger></TabsList>
        <TabsContent value="log" className="space-y-3">
          <Input placeholder="Buscar por usuário, tela ou descrição…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md rounded-full" />
          <Card className="rounded-3xl"><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Data e hora</TableHead><TableHead>Usuário</TableHead><TableHead>Ação</TableHead><TableHead>Onde</TableHead><TableHead>Descrição</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>}
                {filtered.slice(0, 500).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{new Date(l.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{l.user_name}</TableCell>
                    <TableCell>{ACTION[l.action] ?? l.action}</TableCell>
                    <TableCell>{l.menu_section ?? l.table_name}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{l.description}</TableCell>
                    <TableCell className="text-muted-foreground">{l.ip_address ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="roles">
          <div className="grid gap-4 lg:grid-cols-3">
            {ROLES.map(([key, label]) => (
              <Card key={key} className="rounded-3xl"><CardContent className="p-5">
                <p className="mb-3 font-semibold">{label}</p>
                {menuCategories.filter((c) => c.roles.includes(key)).map((c) => {
                  const items = c.items.filter((i) => i.roles.includes(key));
                  return items.length ? <div key={c.id} className="mb-3"><p className="text-xs font-semibold uppercase text-muted-foreground">{c.title}</p><p className="text-sm">{items.map((i) => i.title).join(' · ')}</p></div> : null;
                })}
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="users">
          <div className="grid gap-4 lg:grid-cols-3">
            {ROLES.map(([key, label]) => {
              const list = users.filter((u) => u.role === key);
              return <Card key={key} className="rounded-3xl"><CardContent className="p-5"><p className="mb-3 font-semibold">{label} <span className="text-muted-foreground">({list.length})</span></p><ul className="max-h-80 space-y-1 overflow-auto text-sm">{list.map((u, i) => <li key={i}>{u.name}</li>)}</ul></CardContent></Card>;
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
