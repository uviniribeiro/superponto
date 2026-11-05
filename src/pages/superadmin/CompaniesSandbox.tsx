import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CnpjInput } from '@/components/shared/CnpjInput';
import { PontoMaxLogo } from '@/components/shared/PontoMaxLogo';
import { toast } from 'sonner';
import { Building2, FlaskConical, Pencil, Plus, Search, Trash2 } from 'lucide-react';

/**
 * Test-only sandbox: drafts live in this browser and never grant real access.
 * Real companies and accounts are created only when the backend is active.
 */
interface DraftCompany { id: string; name: string; cnpj: string; email: string; createdAt: string }

const KEY = 'pontomax.sandbox.companies.v1';
const load = (): DraftCompany[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function CompaniesSandbox() {
  const [items, setItems] = useState<DraftCompany[]>(load);
  const [form, setForm] = useState({ name: '', cnpj: '', email: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [lookup, setLookup] = useState('');
  const [matches, setMatches] = useState<DraftCompany[] | null>(null);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim()) return toast.error('Informe o nome da empresa.');
    if (!emailOk(email)) return toast.error('E-mail responsável inválido.');
    if (editing) {
      setItems((l) => l.map((c) => (c.id === editing ? { ...c, ...form, email } : c)));
      toast.success('Empresa de teste atualizada.');
    } else {
      setItems((l) => [...l, { id: crypto.randomUUID(), name: form.name.trim(), cnpj: form.cnpj, email, createdAt: new Date().toISOString() }]);
      toast.success('Empresa de teste cadastrada.');
    }
    setForm({ name: '', cnpj: '', email: '' });
    setEditing(null);
  };

  const testLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const found = items.filter((c) => c.email === lookup.trim().toLowerCase());
    if (found.length === 0) return toast.error('Nenhuma empresa de teste com esse e-mail.');
    if (found.length === 1) return toast.success(`Abriria a empresa: ${found[0].name}`);
    setMatches(found);
  };

  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);

  return (
    <div className="min-h-screen bg-muted/40 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PontoMaxLogo />
          <Button asChild variant="outline"><Link to="/super-admin-auth">Voltar ao login</Link></Button>
        </div>

        <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <FlaskConical className="h-5 w-5 shrink-0 text-primary" />
          <p><strong>Modo de teste.</strong> Os cadastros ficam só neste navegador e não criam acesso real. Nenhuma senha é gerada aqui: as contas reais e senhas temporárias serão criadas quando o banco for reativado.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{editing ? 'Editar empresa' : 'Nova empresa'}</CardTitle>
            <CardDescription>Nome, CNPJ e e-mail responsável.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="n">Nome</Label><Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="c">CNPJ</Label><CnpjInput id="c" value={form.cnpj} onChange={(v: string) => setForm({ ...form, cnpj: v })} /></div>
              <div className="space-y-1.5"><Label htmlFor="e">E-mail responsável</Label><Input id="e" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="flex gap-2 md:col-span-3">
                <Button type="submit"><Plus className="mr-1 h-4 w-4" />{editing ? 'Salvar' : 'Cadastrar'}</Button>
                {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setForm({ name: '', cnpj: '', email: '' }); }}>Cancelar</Button>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Testar entrada por e-mail</CardTitle><CardDescription>Mostra qual empresa abriria, ou a lista quando houver mais de uma.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={testLogin} className="flex flex-col gap-2 sm:flex-row">
              <Input type="email" placeholder="email@empresa.com" value={lookup} onChange={(e) => setLookup(e.target.value)} />
              <Button type="submit"><Search className="mr-1 h-4 w-4" />Testar</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Empresas de teste <Badge variant="secondary">{items.length}</Badge></CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>CNPJ</TableHead><TableHead>E-mail responsável</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {sorted.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma empresa cadastrada.</TableCell></TableRow>}
                {sorted.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.cnpj || '—'}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => { setEditing(c.id); setForm({ name: c.name, cnpj: c.cnpj, email: c.email }); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setItems((l) => l.filter((x) => x.id !== c.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!matches} onOpenChange={(o) => !o && setMatches(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Escolha a empresa</DialogTitle><DialogDescription>Este e-mail pertence a mais de uma empresa.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {matches?.map((c) => (
              <Button key={c.id} variant="outline" className="w-full justify-start" onClick={() => { toast.success(`Abriria a empresa: ${c.name}`); setMatches(null); }}>
                <Building2 className="mr-2 h-4 w-4" />{c.name}{c.cnpj && <span className="ml-auto text-xs text-muted-foreground">{c.cnpj}</span>}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
