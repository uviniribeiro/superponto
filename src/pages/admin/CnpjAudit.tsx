import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowRight, Download, FileSearch, Loader2, PlayCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { PageHeader } from '@/components/shared/PageHeader';

interface AuditRow {
  id: string;
  created_at: string;
  user_name: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  description: string | null;
}

interface FlaggedRow {
  id: string;
  detected_at: string;
  title: string;
  technical_detail: string | null;
  entity_table: string | null;
  entity_id: string | null;
  status: string;
}

const TABLE_LABEL: Record<string, string> = {
  companies: 'Empresa',
  unions: 'Sindicato',
};

function cnpjOf(data: Record<string, unknown> | null | undefined) {
  if (!data) return '—';
  const v = (data as { cnpj?: string }).cnpj;
  return v ? String(v) : '—';
}

export default function CnpjAudit() {
  useSEO({
    title: 'Auditoria de CNPJ | Ponto Max',
    description: 'Histórico da revalidação quinzenal e de todas as alterações de CNPJ, com valor anterior e atual.',
  });

  const [tab, setTab] = useState('history');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [flagged, setFlagged] = useState<FlaggedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: audit }, { data: diag }] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('id, created_at, user_name, action, table_name, record_id, old_data, new_data, description')
        .ilike('action', '%cnpj%')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('system_diagnostics')
        .select('id, detected_at, title, technical_detail, entity_table, entity_id, status')
        .eq('code', 'cnpj_invalido')
        .order('detected_at', { ascending: false })
        .limit(500),
    ]);
    setRows((audit as AuditRow[]) || []);
    setFlagged((diag as FlaggedRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runRevalidation = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('cnpj-revalidator', { body: { dryRun } });
      if (error) throw error;
      const total = data?.outcomes?.length ?? data?.total ?? 0;
      toast.success(
        dryRun
          ? `Simulação concluída: ${total} CNPJ(s) precisariam de ajuste.`
          : `Revalidação concluída: ${total} CNPJ(s) analisados/corrigidos.`
      );
      await load();
    } catch {
      toast.error('Não foi possível executar a revalidação agora.');
    } finally {
      setRunning(false);
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.user_name, r.description, r.table_name, cnpjOf(r.old_data), cnpjOf(r.new_data)]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const filteredFlagged = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flagged;
    return flagged.filter(f =>
      [f.title, f.technical_detail, f.entity_table].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [flagged, search]);

  const exportCsv = () => {
    const header = ['Data', 'Responsável', 'Origem', 'CNPJ anterior', 'CNPJ atual', 'Motivo'];
    const lines = filteredRows.map(r => [
      new Date(r.created_at).toLocaleString('pt-BR'),
      r.user_name || '',
      TABLE_LABEL[r.table_name || ''] || r.table_name || '',
      cnpjOf(r.old_data),
      cnpjOf(r.new_data),
      (r.description || '').replace(/[\r\n;]+/g, ' '),
    ]);
    const csv = [header, ...lines].map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria_cnpj_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Auditoria de CNPJ"
          description="Histórico da revalidação quinzenal e de toda alteração de CNPJ, com o valor anterior e o atual." icon={FileSearch}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button variant="outline" onClick={() => runRevalidation(true)} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Simular revalidação
          </Button>
          <Button onClick={() => runRevalidation(false)} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Revalidar agora
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!filteredRows.length}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold tabular-nums">{rows.length}</p>
            <p className="text-xs text-muted-foreground">Alterações registradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold tabular-nums">
              {rows.filter(r => (r.description || '').toLowerCase().includes('dígito')).length}
            </p>
            <p className="text-xs text-muted-foreground">Correções de dígito verificador</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold tabular-nums">{flagged.filter(f => f.status === 'open').length}</p>
            <p className="text-xs text-muted-foreground">Pendentes de análise manual</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="history">Alterações</TabsTrigger>
            <TabsTrigger value="flagged">Inconsistências</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          className="max-w-xs"
          placeholder="Buscar por CNPJ, responsável ou motivo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : tab === 'history' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de alterações</CardTitle>
            <CardDescription>Inclui alterações manuais e as correções feitas pela revalidação quinzenal.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filteredRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma alteração de CNPJ registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Anterior → Atual</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(r.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm">{r.user_name || 'Sistema'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{TABLE_LABEL[r.table_name || ''] || r.table_name}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        <span className="text-muted-foreground line-through">{cnpjOf(r.old_data)}</span>
                        <ArrowRight className="mx-2 inline h-3 w-3" />
                        <span className="font-semibold">{cnpjOf(r.new_data)}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" /> CNPJs que precisam de análise manual
            </CardTitle>
            <CardDescription>Casos em que a correção automática do dígito verificador não é possível.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredFlagged.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma inconsistência pendente.</p>
            ) : filteredFlagged.map(f => (
              <div key={f.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{f.title}</p>
                  <Badge variant={f.status === 'open' ? 'destructive' : 'secondary'}>
                    {f.status === 'open' ? 'Aberto' : 'Resolvido'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(f.detected_at).toLocaleString('pt-BR')} · {TABLE_LABEL[f.entity_table || ''] || f.entity_table}
                </p>
                {f.technical_detail && (
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/60 p-2 text-xs">{f.technical_detail}</pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
