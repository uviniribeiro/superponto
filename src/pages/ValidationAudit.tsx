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
import { Download, RefreshCw, CheckCircle2, XCircle, Camera, QrCode, ShieldAlert, Filter, FileDown, FileBarChart, ChevronRight } from 'lucide-react';
import { generateStandardPDF, addFooter } from '@/lib/pdfUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


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

  const exportPdf = async () => {
    if (attempts.length === 0) {
      toast.info('Nada para exportar');
      return;
    }
    try {
      const head = [['Data/Hora', 'Usuário', 'Método', 'Resultado', 'Motivo']];
      const body = attempts.map(a => [
        format(parseISO(a.created_at), 'dd/MM/yy HH:mm:ss'),
        a.profiles?.full_name || '-',
        a.method_type === 'facial' ? 'Facial' : a.method_type === 'qrcode' ? 'QR Code' : a.method_type,
        a.success ? 'Aprovado' : 'Reprovado',
        (a.reason || (a.success ? 'OK' : '-')).slice(0, 80),
      ]);
      const doc = await generateStandardPDF(
        {
          title: 'Auditoria de Validações',
          subtitle: canSeeAll ? 'Tentativas de validação da empresa' : 'Minhas tentativas de validação',
          period: { start: format(parseISO(fStart), 'dd/MM/yyyy'), end: format(parseISO(fEnd), 'dd/MM/yyyy') },
          orientation: 'landscape',
        },
        { head, body, footer: [[`Total: ${stats.total}`, `Aprovadas: ${stats.ok}`, `Reprovadas: ${stats.fail}`, `Taxa: ${stats.rate}%`, '']] }
      );
      addFooter(doc);
      doc.save(`auditoria_validacoes_${fStart}_a_${fEnd}.pdf`);
      toast.success('PDF exportado');
    } catch (e: any) {
      toast.error('Falha ao gerar PDF: ' + (e?.message || 'erro'));
    }
  };

  const generateMonthlyConsolidated = async () => {
    try {
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());
      let recordsQ = supabase
        .from('time_records')
        .select('recorded_at, record_type, profile_id, profiles:profile_id(full_name)')
        .gte('recorded_at', start.toISOString())
        .lte('recorded_at', end.toISOString())
        .order('recorded_at', { ascending: true })
        .limit(2000);
      if (canSeeAll && fEmployee !== 'all') recordsQ = recordsQ.eq('profile_id', fEmployee);
      const { data: recs, error } = await recordsQ;
      if (error) throw error;

      const inMonth = attempts.filter(a => {
        const d = parseISO(a.created_at);
        return d >= start && d <= end;
      });
      const okA = inMonth.filter(a => a.success).length;
      const facialA = inMonth.filter(a => a.method_type === 'facial').length;
      const qrA = inMonth.filter(a => a.method_type === 'qrcode').length;

      const typeLabel: Record<string, string> = {
        entry: 'Entrada', break_start: 'Início Interv.', break_end: 'Fim Interv.', exit: 'Saída',
      };
      const recBody = (recs || []).slice(0, 400).map((r: any) => [
        format(parseISO(r.recorded_at), 'dd/MM HH:mm'),
        r.profiles?.full_name || '-',
        typeLabel[r.record_type] || r.record_type,
      ]);

      const doc = await generateStandardPDF(
        {
          title: 'Relatório Mensal Consolidado',
          subtitle: 'Marcações de ponto e validações (facial + QR)',
          period: { start: format(start, 'dd/MM/yyyy'), end: format(end, 'dd/MM/yyyy') },
          orientation: 'portrait',
        },
        {
          head: [['Resumo', 'Valor']],
          body: [
            ['Marcações de ponto no mês', String(recs?.length || 0)],
            ['Tentativas de validação', String(inMonth.length)],
            ['Validações aprovadas', String(okA)],
            ['Validações reprovadas', String(inMonth.length - okA)],
            ['Método facial', String(facialA)],
            ['Método QR Code', String(qrA)],
            ['Taxa de sucesso', inMonth.length ? `${Math.round((okA / inMonth.length) * 100)}%` : '-'],
          ],
        },
        (doc, y) => {
          const jsdoc: any = doc;
          jsdoc.setFontSize(10);
          jsdoc.setFont('helvetica', 'bold');
          jsdoc.text(`Mês: ${format(start, "MMMM 'de' yyyy", { locale: ptBR })}`, 14, y);
          return y + 6;
        }
      );

      // Append records table on a new page
      const jsdoc: any = doc;
      jsdoc.addPage();
      jsdoc.setFontSize(12);
      jsdoc.setFont('helvetica', 'bold');
      jsdoc.text('Marcações de Ponto (até 400 primeiras)', 14, 20);
      const autoTable = (await import('jspdf-autotable')).default;
      autoTable(jsdoc, {
        startY: 25,
        head: [['Data/Hora', 'Funcionário', 'Tipo']],
        body: recBody,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
        margin: { left: 14, right: 14 },
      });

      addFooter(doc);
      doc.save(`relatorio_mensal_${format(start, 'yyyy-MM')}.pdf`);
      toast.success('Relatório mensal gerado');
    } catch (e: any) {
      toast.error('Falha ao gerar relatório: ' + (e?.message || 'erro'));
    }
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportPdf}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button onClick={generateMonthlyConsolidated}>
            <FileBarChart className="h-4 w-4 mr-2" />
            Relatório mensal
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
