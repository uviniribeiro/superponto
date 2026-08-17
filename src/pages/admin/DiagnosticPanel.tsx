import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertTriangle, Bug, CheckCircle2, Loader2, RefreshCw, Wrench, ShieldAlert, Info, PlayCircle,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { PageHeader } from '@/components/shared/PageHeader';

interface Diagnostic {
  id: string;
  code: string;
  severity: string;
  title: string;
  user_message: string;
  technical_detail: string | null;
  entity_table: string | null;
  entity_id: string | null;
  auto_fixable: boolean;
  fix_action: string | null;
  status: string;
  occurrences: number;
  detected_at: string;
  fixed_at: string | null;
  fix_result: string | null;
}

const SEVERITY: Record<string, { label: string; icon: typeof Info; className: string }> = {
  error: { label: 'Crítico', icon: ShieldAlert, className: 'bg-destructive/15 text-destructive border-destructive/30' },
  warning: { label: 'Atenção', icon: AlertTriangle, className: 'bg-warning/15 text-warning border-warning/30' },
  info: { label: 'Informativo', icon: Info, className: 'bg-muted text-muted-foreground border-border' },
};

export default function DiagnosticPanel() {
  useSEO({
    title: 'Painel de Diagnóstico | Ponto Max',
    description: 'Erros detectados no sistema, detalhes técnicos e correção automática com um clique.',
  });

  const [items, setItems] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [fixing, setFixing] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_diagnostics')
      .select('*')
      .eq('status', status)
      .order('detected_at', { ascending: false })
      .limit(300);
    if (error) toast.error('Não foi possível carregar os diagnósticos.');
    setItems((data as Diagnostic[]) || []);
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      [i.title, i.code, i.technical_detail, i.entity_table].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [items, search]);

  const fixable = filtered.filter(i => i.auto_fixable && i.status === 'open');

  const runFix = async (ids: string[], label: string) => {
    setFixing(label);
    try {
      const { data, error } = await supabase.functions.invoke('system-autofix', { body: { diagnosticIds: ids } });
      if (error) throw error;
      toast.success(`${data?.fixed ?? 0} erro(s) corrigido(s). ${data?.failed ? `${data.failed} exigem análise manual.` : ''}`);
      await load();
    } catch {
      toast.error('Falha ao executar a correção automática.');
    } finally {
      setFixing(null);
    }
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const { error } = await supabase.functions.invoke('system-robot', { body: { manual: true } });
      if (error) throw error;
      toast.success('Varredura concluída. O sistema permaneceu no ar durante a verificação.');
      await load();
    } catch {
      toast.error('Não foi possível executar a varredura agora.');
    } finally {
      setScanning(false);
    }
  };

  const counts = useMemo(() => ({
    error: items.filter(i => i.severity === 'error').length,
    warning: items.filter(i => i.severity === 'warning').length,
    info: items.filter(i => i.severity === 'info').length,
  }), [items]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Painel de Diagnóstico"
          description="Os usuários veem apenas “Ocorreu um erro”. Aqui o administrador vê o motivo real e corrige com um clique." icon={Bug}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button variant="outline" onClick={runScan} disabled={scanning}>
            {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Rodar varredura agora
          </Button>
          <Button onClick={() => runFix(fixable.map(f => f.id), 'all')} disabled={!fixable.length || fixing === 'all'}>
            {fixing === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
            Corrigir tudo ({fixable.length})
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['error', 'warning', 'info'] as const).map((s) => {
          const meta = SEVERITY[s];
          const Icon = meta.icon;
          return (
            <Card key={s}>
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold tabular-nums">{counts[s]}</p>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="open">Abertos</TabsTrigger>
            <TabsTrigger value="fixed">Corrigidos</TabsTrigger>
            <TabsTrigger value="ignored">Ignorados</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          className="max-w-xs"
          placeholder="Buscar por título, código ou detalhe"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="font-medium">Nenhum erro nesta situação</p>
            <p className="text-sm text-muted-foreground">O robô verifica o sistema todos os dias às 03:00.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const meta = SEVERITY[d.severity] ?? SEVERITY.info;
            return (
              <Card key={d.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{d.title}</CardTitle>
                      <CardDescription>
                        {d.code} · detectado em {new Date(d.detected_at).toLocaleString('pt-BR')}
                        {d.occurrences > 1 && ` · ${d.occurrences} ocorrências`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                      {d.auto_fixable && d.status === 'open' && (
                        <Button size="sm" onClick={() => runFix([d.id], d.id)} disabled={fixing === d.id}>
                          {fixing === d.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                          Corrigir
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Mensagem exibida ao usuário: “{d.user_message}”
                  </p>
                  {d.technical_detail && (
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-2 text-xs">
                      {d.technical_detail}
                    </pre>
                  )}
                  {d.fix_result && (
                    <p className="text-xs text-success">Resultado: {d.fix_result}</p>
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
