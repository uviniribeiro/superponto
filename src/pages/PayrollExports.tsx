import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, FileSpreadsheet, FileText, Loader2, RefreshCw, Calculator } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

interface PayrollExport {
  id: string;
  export_type: string;
  period_start: string;
  period_end: string;
  status: string;
  employee_count: number | null;
  total_hours: number | null;
  created_at: string;
}

interface EmployeeSummary {
  profile_id: string;
  full_name: string;
  registration_number: string | null;
  pis: string | null;
  cpf: string | null;
  department: string | null;
  position: string | null;
  total_worked_minutes: number;
  overtime_minutes: number;
  absence_days: number;
  late_days: number;
}

export default function PayrollExports() {
  const { company, user } = useAuth();
  const [exports, setExports] = useState<PayrollExport[]>([]);
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exportType, setExportType] = useState('timesheet');

  useEffect(() => {
    fetchExports();
  }, []);

  useEffect(() => {
    if (periodStart && periodEnd) {
      calculateSummaries();
    }
  }, [periodStart, periodEnd]);

  const fetchExports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll_exports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: 'Erro ao carregar exportações',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setExports(data || []);
    }
    setLoading(false);
  };

  const calculateSummaries = async () => {
    // Fetch all employees
    const { data: employees } = await supabase
      .from('profiles')
      .select('id, full_name, registration_number, pis, cpf, department, position')
      .eq('is_active', true)
      .order('full_name');

    if (!employees) return;

    // Fetch time records for the period
    const { data: records } = await supabase
      .from('time_records')
      .select('profile_id, recorded_at, record_type')
      .gte('recorded_at', `${periodStart}T00:00:00`)
      .lte('recorded_at', `${periodEnd}T23:59:59`)
      .order('recorded_at');

    if (!records) return;

    // Fetch employee schedules
    const { data: schedules } = await supabase
      .from('employee_schedules')
      .select('profile_id, work_schedules(weekly_hours)')
      .in('profile_id', employees.map(e => e.id));

    const scheduleMap = new Map(
      (schedules || []).map(s => [s.profile_id, (s.work_schedules as any)?.weekly_hours || 44])
    );

    // Group records by employee and date
    const summaries: EmployeeSummary[] = employees.map(emp => {
      const empRecords = records.filter(r => r.profile_id === emp.id);
      
      // Group by date
      const byDate: { [date: string]: string[] } = {};
      empRecords.forEach(r => {
        const date = format(parseISO(r.recorded_at), 'yyyy-MM-dd');
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(r.recorded_at);
      });

      // Calculate worked hours
      let totalWorkedMinutes = 0;
      Object.values(byDate).forEach(times => {
        times.sort();
        for (let i = 0; i < times.length - 1; i += 2) {
          if (times[i + 1]) {
            totalWorkedMinutes += differenceInMinutes(
              parseISO(times[i + 1]),
              parseISO(times[i])
            );
          }
        }
      });

      // Calculate expected hours based on schedule
      const weeklyHours = scheduleMap.get(emp.id) || 44;
      const workDays = Math.ceil(
        (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24)
      );
      const expectedMinutes = (weeklyHours / 5) * (workDays * 5 / 7) * 60;
      
      const overtimeMinutes = Math.max(0, totalWorkedMinutes - expectedMinutes);
      const absenceDays = Object.keys(byDate).length < (workDays * 5 / 7) 
        ? Math.round((workDays * 5 / 7) - Object.keys(byDate).length) 
        : 0;

      return {
        profile_id: emp.id,
        full_name: emp.full_name,
        registration_number: emp.registration_number,
        pis: emp.pis,
        cpf: emp.cpf,
        department: emp.department,
        position: emp.position,
        total_worked_minutes: totalWorkedMinutes,
        overtime_minutes: overtimeMinutes,
        absence_days: absenceDays,
        late_days: 0,
      };
    });

    setEmployeeSummaries(summaries);
  };

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const generateExport = async () => {
    setGenerating(true);
    
    try {
      let content = '';
      let filename = '';
      
      if (exportType === 'timesheet') {
        // Generate timesheet export
        content = generateTimesheetExport();
        filename = `folha-ponto-${periodStart}-${periodEnd}.csv`;
      } else if (exportType === 'esocial') {
        // Generate eSocial export
        content = generateESocialExport();
        filename = `esocial-s2299-${periodStart}-${periodEnd}.txt`;
      } else if (exportType === 'totvs') {
        // Generate TOTVS export
        content = generateTOTVSExport();
        filename = `totvs-${periodStart}-${periodEnd}.txt`;
      } else if (exportType === 'senior') {
        // Generate Senior export
        content = generateSeniorExport();
        filename = `senior-${periodStart}-${periodEnd}.txt`;
      }

      // Save export record
      await supabase.from('payroll_exports').insert({
        company_id: company?.id,
        export_type: exportType,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'completed',
        employee_count: employeeSummaries.length,
        total_hours: Math.round(employeeSummaries.reduce((sum, e) => sum + e.total_worked_minutes, 0) / 60),
        created_by: user?.id,
      });

      // Download file
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();

      toast({
        title: 'Exportação concluída',
        description: `Arquivo ${filename} gerado com sucesso`,
      });

      fetchExports();
    } catch (error: any) {
      toast({
        title: 'Erro na exportação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateTimesheetExport = () => {
    const headers = [
      'Matrícula',
      'Nome',
      'CPF',
      'PIS',
      'Departamento',
      'Cargo',
      'Horas Trabalhadas',
      'Horas Extras',
      'Faltas (dias)',
      'Atrasos (dias)',
    ];

    const rows = employeeSummaries.map(emp => [
      emp.registration_number || '',
      emp.full_name,
      emp.cpf || '',
      emp.pis || '',
      emp.department || '',
      emp.position || '',
      formatMinutes(emp.total_worked_minutes),
      formatMinutes(emp.overtime_minutes),
      emp.absence_days.toString(),
      emp.late_days.toString(),
    ]);

    return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  };

  const generateESocialExport = () => {
    // Simplified eSocial S-1200 format
    const lines: string[] = [];
    
    employeeSummaries.forEach(emp => {
      if (!emp.pis || !emp.cpf) return;
      
      // Header
      lines.push(`|S1200|${format(new Date(), 'yyyyMMdd')}|`);
      // Worker identification
      lines.push(`|cpfTrab|${emp.cpf.replace(/\D/g, '')}|`);
      lines.push(`|nisTrab|${emp.pis.replace(/\D/g, '')}|`);
      lines.push(`|matricula|${emp.registration_number || ''}|`);
      // Worked info
      lines.push(`|qtdHrsTrab|${formatMinutes(emp.total_worked_minutes)}|`);
      lines.push(`|qtdHrsExtra|${formatMinutes(emp.overtime_minutes)}|`);
      lines.push('---');
    });

    return lines.join('\n');
  };

  const generateTOTVSExport = () => {
    // TOTVS Protheus format
    const lines: string[] = [];
    
    employeeSummaries.forEach(emp => {
      const line = [
        (emp.registration_number || '').padStart(6, '0'),
        emp.full_name.substring(0, 40).padEnd(40, ' '),
        formatMinutes(emp.total_worked_minutes).replace(':', ''),
        formatMinutes(emp.overtime_minutes).replace(':', ''),
        emp.absence_days.toString().padStart(2, '0'),
        periodStart.replace(/-/g, ''),
        periodEnd.replace(/-/g, ''),
      ].join('');
      
      lines.push(line);
    });

    return lines.join('\n');
  };

  const generateSeniorExport = () => {
    // Senior Sistemas format
    const lines: string[] = [];
    
    lines.push(`H;${format(new Date(), 'ddMMyyyy')};FOLHA DE PONTO;${company?.id || ''}`);
    
    employeeSummaries.forEach((emp, idx) => {
      lines.push([
        'D',
        (idx + 1).toString().padStart(6, '0'),
        emp.registration_number || '',
        emp.full_name,
        Math.round(emp.total_worked_minutes / 60).toString(),
        Math.round(emp.overtime_minutes / 60).toString(),
        emp.absence_days.toString(),
      ].join(';'));
    });

    lines.push(`T;${employeeSummaries.length}`);

    return lines.join('\n');
  };

  const getExportTypeLabel = (type: string) => {
    switch (type) {
      case 'timesheet':
        return 'Folha de Ponto';
      case 'esocial':
        return 'eSocial';
      case 'totvs':
        return 'TOTVS';
      case 'senior':
        return 'Senior';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          icon={FileSpreadsheet}
          title="Integração com Folha de Pagamento"
          description="Exporte dados para sistemas de folha e eSocial"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">Gerar Exportação</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          {/* Export Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Configurar Exportação
              </CardTitle>
              <CardDescription>
                Selecione o período e formato de exportação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Formato</Label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timesheet">Folha de Ponto (CSV)</SelectItem>
                      <SelectItem value="esocial">eSocial (TXT)</SelectItem>
                      <SelectItem value="totvs">TOTVS Protheus</SelectItem>
                      <SelectItem value="senior">Senior Sistemas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={generateExport} disabled={generating} className="w-full">
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Resumo do Período
                  </CardTitle>
                  <CardDescription>
                    {format(parseISO(periodStart), "dd 'de' MMMM", { locale: ptBR })} a {format(parseISO(periodEnd), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={calculateSummaries}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-right">Horas Trab.</TableHead>
                    <TableHead className="text-right">Horas Extras</TableHead>
                    <TableHead className="text-right">Faltas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeSummaries.map((emp) => (
                    <TableRow key={emp.profile_id}>
                      <TableCell className="font-mono text-sm">
                        {emp.registration_number || '-'}
                      </TableCell>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell>{emp.department || '-'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMinutes(emp.total_worked_minutes)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {emp.overtime_minutes > 0 ? (
                          <span className="text-green-600">+{formatMinutes(emp.overtime_minutes)}</span>
                        ) : (
                          '00:00'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {emp.absence_days > 0 ? (
                          <Badge variant="destructive">{emp.absence_days} dias</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Exportações</CardTitle>
              <CardDescription>
                Últimas exportações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : exports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma exportação realizada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Funcionários</TableHead>
                      <TableHead>Total Horas</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell>
                          {format(parseISO(exp.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getExportTypeLabel(exp.export_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(exp.period_start), 'dd/MM/yyyy')} - {format(parseISO(exp.period_end), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>{exp.employee_count || '-'}</TableCell>
                        <TableCell>{exp.total_hours ? `${exp.total_hours}h` : '-'}</TableCell>
                        <TableCell>
                          <Badge className={exp.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}>
                            {exp.status === 'completed' ? 'Concluído' : 'Processando'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
