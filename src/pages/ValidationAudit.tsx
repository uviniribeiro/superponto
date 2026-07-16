import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, RefreshCw, CheckCircle2, XCircle, Camera, QrCode, ShieldAlert, Filter, FileDown, FileBarChart } from 'lucide-react';
import { generateStandardPDF, addFooter } from '@/lib/pdfUtils';

interface Attempt {
  id: string;
  user_id: string;
  profile_id: string | null;
  company_id: string | null;
  method_type: string;
  success: boolean;
  reason: string | null;
  identifier_matched: string | null;
  confidence: number | null;
  user_agent: string | null;
  created_at: string;
  profiles?: { full_name: string; registration_number: string | null } | null;
}

export default function ValidationAudit() {
  const { profile, isAdmin, isManager } = useAuth();
  const canSeeAll = isAdmin || isManager;

  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);

  const [fEmployee, setFEmployee] = useState<string>('all');
  const [fMethod, setFMethod] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');
  const [fStart, setFStart] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [fEnd, setFEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('identification_validation_attempts')
      .select('*, profiles:profile_id(full_name, registration_number)')
      .gte('created_at', `${fStart}T00:00:00`)
      .lte('created_at', `${fEnd}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (fMethod !== 'all') q = q.eq('method_type', fMethod);
    if (fStatus !== 'all') q = q.eq('success', fStatus === 'success');
    if (canSeeAll && fEmployee !== 'all') q = q.eq('profile_id', fEmployee);

    const { data, error } = await q;
    if (error) {
      toast.error('Erro ao carregar auditoria: ' + error.message);
      setAttempts([]);
    } else {
      setAttempts((data as unknown as Attempt[]) || []);
    }
    setLoading(false);
  };

  const loadEmployees = async () => {
    if (!canSeeAll) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');
    setEmployees(data || []);
  };

  useEffect(() => {
    loadEmployees();
  }, [canSeeAll]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fEmployee, fMethod, fStatus, fStart, fEnd]);

  const stats = useMemo(() => {
    const total = attempts.length;
    const ok = attempts.filter(a => a.success).length;
    const fail = total - ok;
    const facial = attempts.filter(a => a.method_type === 'facial').length;
    const qr = attempts.filter(a => a.method_type === 'qrcode').length;
    return { total, ok, fail, facial, qr, rate: total ? Math.round((ok / total) * 100) : 0 };
  }, [attempts]);

  const monthly = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    const inMonth = attempts.filter(a => {
      const d = parseISO(a.created_at);
      return d >= start && d <= end;
    });
    const ok = inMonth.filter(a => a.success).length;
    return { total: inMonth.length, ok, fail: inMonth.length - ok };
  }, [attempts]);

  const exportCsv = () => {
    if (attempts.length === 0) {
      toast.info('Nada para exportar');
      return;
    }
    const header = ['Data/Hora', 'Funcionário', 'Matrícula', 'Método', 'Resultado', 'Confiança', 'Motivo', 'Dispositivo'];
    const rows = attempts.map(a => [
      format(parseISO(a.created_at), 'dd/MM/yyyy HH:mm:ss'),
      a.profiles?.full_name || '-',
      a.profiles?.registration_number || '-',
      a.method_type === 'facial' ? 'Facial' : a.method_type === 'qrcode' ? 'QR Code' : a.method_type,
      a.success ? 'Aprovado' : 'Reprovado',
      a.confidence != null ? `${a.confidence}%` : '-',
      (a.reason || '').replace(/[\r\n;]/g, ' '),
      (a.user_agent || '').replace(/[\r\n;]/g, ' ').slice(0, 80),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_validacoes_${fStart}_a_${fEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const methodIcon = (m: string) =>
    m === 'facial' ? <Camera className="h-3 w-3" /> : m === 'qrcode' ? <QrCode className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditoria de Validações</h1>
          <p className="text-muted-foreground">
            {canSeeAll
              ? 'Todas as tentativas de validação (facial e QR Code) da empresa.'
              : 'Suas tentativas de validação de ponto (facial e QR Code).'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardHeader className="pb-2"><CardDescription>Total no período</CardDescription><CardTitle className="text-2xl">{stats.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Aprovadas</CardDescription><CardTitle className="text-2xl text-emerald-600">{stats.ok}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Reprovadas</CardDescription><CardTitle className="text-2xl text-destructive">{stats.fail}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Taxa de sucesso</CardDescription><CardTitle className="text-2xl">{stats.rate}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Facial / QR</CardDescription><CardTitle className="text-2xl">{stats.facial}/{stats.qr}</CardTitle></CardHeader></Card>
      </div>

      {/* Monthly summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consolidado do mês atual ({format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })})</CardTitle>
          <CardDescription>Resumo agregado para conformidade e auditoria.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-muted-foreground">Tentativas no mês</p><p className="text-xl font-semibold">{monthly.total}</p></div>
          <div><p className="text-muted-foreground">Aprovadas</p><p className="text-xl font-semibold text-emerald-600">{monthly.ok}</p></div>
          <div><p className="text-muted-foreground">Reprovadas</p><p className="text-xl font-semibold text-destructive">{monthly.fail}</p></div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label>De</Label>
              <Input type="date" value={fStart} onChange={e => setFStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Método</Label>
              <Select value={fMethod} onValueChange={setFMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="facial">Facial</SelectItem>
                  <SelectItem value="qrcode">QR Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Aprovadas</SelectItem>
                  <SelectItem value="fail">Reprovadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canSeeAll && (
              <div className="space-y-1">
                <Label>Funcionário</Label>
                <Select value={fEmployee} onValueChange={setFEmployee}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tentativas</CardTitle>
          <CardDescription>{attempts.length} registro(s) — máx. 1000 por consulta.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando...</div>
          ) : attempts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Nenhuma tentativa encontrada no período.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    {canSeeAll && <TableHead>Funcionário</TableHead>}
                    <TableHead>Método</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead>Motivo / Política</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {format(parseISO(a.created_at), 'dd/MM/yyyy HH:mm:ss')}
                      </TableCell>
                      {canSeeAll && (
                        <TableCell className="text-sm">
                          {a.profiles?.full_name || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className="flex w-fit items-center gap-1">
                          {methodIcon(a.method_type)}
                          {a.method_type === 'facial' ? 'Facial' : a.method_type === 'qrcode' ? 'QR Code' : a.method_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.success ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 flex w-fit items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Aprovado
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex w-fit items-center gap-1">
                            <XCircle className="h-3 w-3" /> Reprovado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{a.confidence != null ? `${a.confidence}%` : '-'}</TableCell>
                      <TableCell className="text-sm max-w-[420px]">
                        <span className={a.success ? 'text-muted-foreground' : 'text-destructive'}>
                          {a.reason || (a.success ? 'OK' : 'Sem detalhes')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
