import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Printer, Calendar, User, Building2, Clock, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, differenceInMinutes, addDays, isWeekend, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCPF, formatPIS } from '@/hooks/useDocumentMask';

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  nsr: number;
}

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  cpf: string | null;
  pis: string | null;
  registration_number: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
}

interface CompanySettings {
  company_name: string;
  cnpj: string | null;
  cei: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface WorkSchedule {
  name: string;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
  weekly_hours: number | null;
  tolerance_minutes: number | null;
  break_duration_minutes: number | null;
}

interface DailySummary {
  date: Date;
  records: TimeRecord[];
  entry?: string;
  breakStart?: string;
  breakEnd?: string;
  exit?: string;
  workedMinutes: number;
  expectedMinutes: number;
  balance: number;
  isHoliday: boolean;
  isWeekend: boolean;
  observations: string[];
}

export default function MirrorPoint() {
  const { profile, company } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<Employee | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [holidays, setHolidays] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEmployees();
    fetchCompanySettings();
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      const emp = employees.find(e => e.id === selectedEmployee);
      setSelectedEmployeeData(emp || null);
      fetchEmployeeSchedule(selectedEmployee);
      fetchRecords();
    }
  }, [selectedEmployee, month]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name');
    setEmployees((data || []) as Employee[]);
  };

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    setCompanySettings(data);
  };

  const fetchHolidays = async () => {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const endOfYear = new Date(new Date().getFullYear(), 11, 31);
    
    const { data } = await supabase
      .from('holidays')
      .select('date')
      .gte('date', format(startOfYear, 'yyyy-MM-dd'))
      .lte('date', format(endOfYear, 'yyyy-MM-dd'));
    
    setHolidays((data || []).map(h => parseISO(h.date)));
  };

  const fetchEmployeeSchedule = async (employeeId: string) => {
    const { data } = await supabase
      .from('employee_schedules')
      .select(`
        schedule_id,
        work_schedules (*)
      `)
      .eq('profile_id', employeeId)
      .is('end_date', null)
      .limit(1)
      .maybeSingle();

    if (data?.work_schedules) {
      setWorkSchedule(data.work_schedules as unknown as WorkSchedule);
    } else {
      setWorkSchedule(null);
    }
  };

  const fetchRecords = async () => {
    if (!selectedEmployee) return;
    setLoading(true);

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = startOfMonth(new Date(year, monthNum - 1));
    const endDate = endOfMonth(new Date(year, monthNum - 1));

    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('profile_id', selectedEmployee)
        .gte('recorded_at', startDate.toISOString())
        .lte('recorded_at', endDate.toISOString())
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      setRecords(data || []);
      processRecords(data || [], startDate, endDate);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const processRecords = (records: TimeRecord[], startDate: Date, endDate: Date) => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const summaries: DailySummary[] = [];

    days.forEach(day => {
      const dayRecords = records.filter(r => 
        isSameDay(parseISO(r.recorded_at), day)
      );

      const isHolidayDay = holidays.some(h => isSameDay(h, day));
      const isWeekendDay = isWeekend(day);

      const entry = dayRecords.find(r => r.record_type === 'entry');
      const breakStart = dayRecords.find(r => r.record_type === 'break_start');
      const breakEnd = dayRecords.find(r => r.record_type === 'break_end');
      const exit = dayRecords.find(r => r.record_type === 'exit');

      let workedMinutes = 0;
      let observations: string[] = [];

      // Calculate worked time
      if (entry && exit) {
        const entryTime = parseISO(entry.recorded_at);
        const exitTime = parseISO(exit.recorded_at);
        workedMinutes = differenceInMinutes(exitTime, entryTime);

        // Subtract break time if available
        if (breakStart && breakEnd) {
          const breakMinutes = differenceInMinutes(
            parseISO(breakEnd.recorded_at),
            parseISO(breakStart.recorded_at)
          );
          workedMinutes -= breakMinutes;
        } else if (workSchedule?.break_duration_minutes) {
          // Use default break time if not registered
          workedMinutes -= workSchedule.break_duration_minutes;
          observations.push('Intervalo não registrado');
        }
      }

      // Calculate expected minutes based on schedule
      let expectedMinutes = 0;
      if (workSchedule && !isHolidayDay) {
        const dayOfWeek = format(day, 'EEEE', { locale: ptBR }).toLowerCase();
        const dayMap: Record<string, { start: string | null; end: string | null }> = {
          'segunda-feira': { start: workSchedule.monday_start, end: workSchedule.monday_end },
          'terça-feira': { start: workSchedule.tuesday_start, end: workSchedule.tuesday_end },
          'quarta-feira': { start: workSchedule.wednesday_start, end: workSchedule.wednesday_end },
          'quinta-feira': { start: workSchedule.thursday_start, end: workSchedule.thursday_end },
          'sexta-feira': { start: workSchedule.friday_start, end: workSchedule.friday_end },
          'sábado': { start: workSchedule.saturday_start, end: workSchedule.saturday_end },
          'domingo': { start: workSchedule.sunday_start, end: workSchedule.sunday_end },
        };

        const schedule = dayMap[dayOfWeek];
        if (schedule?.start && schedule?.end) {
          const [startH, startM] = schedule.start.split(':').map(Number);
          const [endH, endM] = schedule.end.split(':').map(Number);
          expectedMinutes = (endH * 60 + endM) - (startH * 60 + startM);
          if (workSchedule.break_duration_minutes) {
            expectedMinutes -= workSchedule.break_duration_minutes;
          }
        }
      }

      // Check for missing records
      if (!entry && expectedMinutes > 0 && !isHolidayDay && !isWeekendDay) {
        observations.push('Falta');
      } else if (entry && !exit && expectedMinutes > 0) {
        observations.push('Saída não registrada');
      }

      const balance = workedMinutes - expectedMinutes;

      summaries.push({
        date: day,
        records: dayRecords,
        entry: entry ? format(parseISO(entry.recorded_at), 'HH:mm') : undefined,
        breakStart: breakStart ? format(parseISO(breakStart.recorded_at), 'HH:mm') : undefined,
        breakEnd: breakEnd ? format(parseISO(breakEnd.recorded_at), 'HH:mm') : undefined,
        exit: exit ? format(parseISO(exit.recorded_at), 'HH:mm') : undefined,
        workedMinutes,
        expectedMinutes,
        balance,
        isHoliday: isHolidayDay,
        isWeekend: isWeekendDay,
        observations,
      });
    });

    setDailySummaries(summaries);
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const getTotals = () => {
    const workedTotal = dailySummaries.reduce((acc, d) => acc + d.workedMinutes, 0);
    const expectedTotal = dailySummaries.reduce((acc, d) => acc + d.expectedMinutes, 0);
    const balanceTotal = workedTotal - expectedTotal;
    const absences = dailySummaries.filter(d => d.observations.includes('Falta')).length;

    return { workedTotal, expectedTotal, balanceTotal, absences };
  };

  const generatePDF = () => {
    if (!selectedEmployeeData || dailySummaries.length === 0) {
      toast.error('Selecione um funcionário e período');
      return;
    }

    const doc = new jsPDF();
    const totals = getTotals();
    const [year, monthNum] = month.split('-').map(Number);
    const monthName = format(new Date(year, monthNum - 1), 'MMMM/yyyy', { locale: ptBR });

    // Header
    doc.setFontSize(16);
    doc.text('ESPELHO DE PONTO ELETRÔNICO', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Conforme Portarias 671/2021 e 1510/2009 do MTE', 105, 22, { align: 'center' });

    // Company Info
    doc.setFontSize(10);
    doc.text(`Empresa: ${companySettings?.company_name || company?.name || ''}`, 14, 35);
    doc.text(`CNPJ: ${companySettings?.cnpj || ''}`, 14, 41);
    if (companySettings?.cei) {
      doc.text(`CEI: ${companySettings.cei}`, 14, 47);
    }

    // Employee Info
    doc.text(`Funcionário: ${selectedEmployeeData.full_name}`, 14, 57);
    doc.text(`CPF: ${selectedEmployeeData.cpf ? formatCPF(selectedEmployeeData.cpf) : 'Não informado'}`, 14, 63);
    doc.text(`PIS: ${selectedEmployeeData.pis ? formatPIS(selectedEmployeeData.pis) : 'Não informado'}`, 110, 63);
    doc.text(`Matrícula: ${selectedEmployeeData.registration_number || 'Não informado'}`, 14, 69);
    doc.text(`Cargo: ${selectedEmployeeData.position || 'Não informado'}`, 110, 69);
    doc.text(`Período: ${monthName.toUpperCase()}`, 14, 75);

    // Table
    const tableData = dailySummaries.map(d => [
      format(d.date, 'dd/MM'),
      format(d.date, 'EEE', { locale: ptBR }).toUpperCase(),
      d.isHoliday ? 'FERIADO' : d.entry || '-',
      d.isHoliday ? '-' : d.breakStart || '-',
      d.isHoliday ? '-' : d.breakEnd || '-',
      d.isHoliday ? '-' : d.exit || '-',
      d.isHoliday ? '-' : formatMinutes(d.workedMinutes),
      d.isHoliday ? '-' : (d.balance >= 0 ? '+' : '') + formatMinutes(d.balance),
      d.observations.join(', ') || (d.isHoliday ? 'Feriado' : d.isWeekend ? 'Folga' : '-'),
    ]);

    autoTable(doc, {
      startY: 82,
      head: [['Data', 'Dia', 'Entrada', 'Saída Int.', 'Retorno', 'Saída', 'Trabalhado', 'Saldo', 'Obs.']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 14 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
        6: { cellWidth: 22 },
        7: { cellWidth: 18 },
        8: { cellWidth: 40 },
      },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Horas Previstas: ${formatMinutes(totals.expectedTotal)}`, 14, finalY);
    doc.text(`Horas Trabalhadas: ${formatMinutes(totals.workedTotal)}`, 70, finalY);
    doc.text(`Saldo: ${(totals.balanceTotal >= 0 ? '+' : '') + formatMinutes(totals.balanceTotal)}`, 140, finalY);
    doc.text(`Faltas: ${totals.absences} dia(s)`, 14, finalY + 6);

    // Signature
    const sigY = finalY + 25;
    doc.line(14, sigY, 90, sigY);
    doc.line(120, sigY, 196, sigY);
    doc.text('Assinatura do Empregado', 52, sigY + 5, { align: 'center' });
    doc.text('Assinatura do Empregador', 158, sigY + 5, { align: 'center' });

    // Footer
    doc.setFontSize(8);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 105, 290, { align: 'center' });
    doc.text('Documento gerado eletronicamente - PontoMax', 105, 295, { align: 'center' });

    doc.save(`Espelho_Ponto_${selectedEmployeeData.full_name.replace(/\s/g, '_')}_${month}.pdf`);
    toast.success('Espelho de ponto gerado com sucesso!');
  };

  const totals = getTotals();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Espelho de Ponto
          </h1>
          <p className="text-muted-foreground">Conforme Portarias 671/2021 e 1510/2009 do MTE</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês/Ano</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={generatePDF} disabled={!selectedEmployee || loading} className="w-full gradient-primary">
                <Printer className="mr-2 h-4 w-4" />
                Gerar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Info */}
      {selectedEmployeeData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados do Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{selectedEmployeeData.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-mono">{selectedEmployeeData.cpf ? formatCPF(selectedEmployeeData.cpf) : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PIS</p>
                <p className="font-mono">{selectedEmployeeData.pis ? formatPIS(selectedEmployeeData.pis) : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Matrícula</p>
                <p className="font-mono">{selectedEmployeeData.registration_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cargo</p>
                <p className="font-medium">{selectedEmployeeData.position || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Departamento</p>
                <p className="font-medium">{selectedEmployeeData.department || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Jornada</p>
                <p className="font-medium">{workSchedule?.name || 'Não definida'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Carga Semanal</p>
                <p className="font-medium">{workSchedule?.weekly_hours ? `${workSchedule.weekly_hours}h` : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totals Summary */}
      {dailySummaries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Horas Previstas</p>
                  <p className="text-2xl font-bold">{formatMinutes(totals.expectedTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Horas Trabalhadas</p>
                  <p className="text-2xl font-bold text-success">{formatMinutes(totals.workedTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className={`h-5 w-5 ${totals.balanceTotal >= 0 ? 'text-success' : 'text-destructive'}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className={`text-2xl font-bold ${totals.balanceTotal >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {(totals.balanceTotal >= 0 ? '+' : '')}{formatMinutes(totals.balanceTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertCircle className={`h-5 w-5 ${totals.absences > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Faltas</p>
                  <p className={`text-2xl font-bold ${totals.absences > 0 ? 'text-destructive' : ''}`}>{totals.absences}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Records Table */}
      {dailySummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registros do Período</CardTitle>
            <CardDescription>
              {format(new Date(month + '-01'), 'MMMM/yyyy', { locale: ptBR }).toUpperCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída Int.</TableHead>
                    <TableHead>Retorno</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Trabalhado</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySummaries.map((day) => (
                    <TableRow 
                      key={day.date.toISOString()} 
                      className={day.isHoliday ? 'bg-amber-500/10' : day.isWeekend ? 'bg-muted/50' : ''}
                    >
                      <TableCell className="font-mono">{format(day.date, 'dd/MM')}</TableCell>
                      <TableCell className="font-medium uppercase">
                        {format(day.date, 'EEE', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono">{day.isHoliday ? '-' : day.entry || '-'}</TableCell>
                      <TableCell className="font-mono">{day.isHoliday ? '-' : day.breakStart || '-'}</TableCell>
                      <TableCell className="font-mono">{day.isHoliday ? '-' : day.breakEnd || '-'}</TableCell>
                      <TableCell className="font-mono">{day.isHoliday ? '-' : day.exit || '-'}</TableCell>
                      <TableCell className="font-mono">
                        {day.isHoliday ? '-' : formatMinutes(day.workedMinutes)}
                      </TableCell>
                      <TableCell className={`font-mono ${day.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {day.isHoliday ? '-' : (day.balance >= 0 ? '+' : '') + formatMinutes(day.balance)}
                      </TableCell>
                      <TableCell>
                        {day.isHoliday ? (
                          <Badge variant="secondary">Feriado</Badge>
                        ) : day.isWeekend && day.expectedMinutes === 0 ? (
                          <Badge variant="outline">Folga</Badge>
                        ) : day.observations.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {day.observations.map((obs, i) => (
                              <Badge 
                                key={i} 
                                variant={obs === 'Falta' ? 'destructive' : 'secondary'}
                              >
                                {obs}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Notice */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Observações Legais:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Este espelho de ponto está em conformidade com a Portaria 671/2021 do MTE.</li>
              <li>Os registros são armazenados de forma inviolável conforme Portaria 1510/2009.</li>
              <li>O funcionário deve conferir seus registros e comunicar divergências em até 72 horas.</li>
              <li>Alterações de horário só podem ser realizadas mediante solicitação formal ao RH.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
