import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, parseISO, eachDayOfInterval, isWeekend, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CalendarIcon, ClipboardList, Printer, Download, Shield, FileText } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
  pis: string | null;
  cpf: string | null;
  position: string | null;
  department: string | null;
}

interface GroupedEmployee {
  key: string;
  full_name: string;
  cpf: string | null;
  profiles: Profile[];
}

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  nsr: number;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

interface DailyTimesheet {
  date: string;
  dayOfWeek: string;
  records: TimeRecord[];
  entry: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  exit: string | null;
  workedMinutes: number;
  isHoliday: boolean;
  holidayName: string | null;
}

interface CompanySettings {
  company_name: string;
  cnpj: string | null;
  cei: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

export default function Timesheet() {
  const { profile, isAdmin, isManager } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedEmployeeGroup, setSelectedEmployeeGroup] = useState<string>('');
  const [selectedRegistration, setSelectedRegistration] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [timesheetData, setTimesheetData] = useState<DailyTimesheet[]>([]);
  const [filterMonth, setFilterMonth] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeesRes, holidaysRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, registration_number, pis, cpf, position, department').eq('is_active', true).order('full_name'),
        supabase.from('holidays').select('id, date, name'),
        supabase.from('company_settings').select('company_name, cnpj, cei, address, city, state').limit(1).maybeSingle(),
      ]);

      if (employeesRes.data) setEmployees(employeesRes.data as Profile[]);
      if (holidaysRes.data) setHolidays(holidaysRes.data);
      if (settingsRes.data) setCompanySettings(settingsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Group employees by CPF
  const groupedEmployees = useMemo(() => {
    const groups: Map<string, GroupedEmployee> = new Map();
    
    employees.forEach(emp => {
      const key = emp.cpf || emp.id;
      
      if (groups.has(key)) {
        groups.get(key)!.profiles.push(emp);
      } else {
        groups.set(key, {
          key,
          full_name: emp.full_name,
          cpf: emp.cpf,
          profiles: [emp],
        });
      }
    });
    
    return Array.from(groups.values());
  }, [employees]);

  const availableRegistrations = useMemo(() => {
    if (!selectedEmployeeGroup) return [];
    const group = groupedEmployees.find(g => g.key === selectedEmployeeGroup);
    return group?.profiles || [];
  }, [selectedEmployeeGroup, groupedEmployees]);

  const fetchTimeRecords = async (profileId: string) => {
    if (!profileId) {
      setTimesheetData([]);
      return;
    }

    const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('profile_id', profileId)
        .gte('recorded_at', `${startDate}T00:00:00`)
        .lte('recorded_at', `${endDate}T23:59:59`)
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      
      setTimeRecords(data || []);
      processTimesheetData(data || [], startDate, endDate);
    } catch (error) {
      console.error('Error fetching time records:', error);
      toast.error('Erro ao carregar registros de ponto');
    }
  };

  const processTimesheetData = (timeRecordsData: TimeRecord[], startDate: string, endDate: string) => {
    const days = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    const timesheetRows: DailyTimesheet[] = days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayOfWeek = format(day, 'EEEE', { locale: ptBR });
      
      const holiday = holidays.find(h => h.date === dateStr);
      
      const dayRecords = timeRecordsData.filter(r => 
        format(parseISO(r.recorded_at), 'yyyy-MM-dd') === dateStr
      );
      
      const entry = dayRecords.find(r => r.record_type === 'entry');
      const breakStart = dayRecords.find(r => r.record_type === 'break_start');
      const breakEnd = dayRecords.find(r => r.record_type === 'break_end');
      const exit = dayRecords.find(r => r.record_type === 'exit');

      let workedMinutes = 0;
      if (entry && exit) {
        const entryTime = parseISO(entry.recorded_at);
        const exitTime = parseISO(exit.recorded_at);
        workedMinutes = differenceInMinutes(exitTime, entryTime);
        
        if (breakStart && breakEnd) {
          const breakStartTime = parseISO(breakStart.recorded_at);
          const breakEndTime = parseISO(breakEnd.recorded_at);
          workedMinutes -= differenceInMinutes(breakEndTime, breakStartTime);
        }
      }

      return {
        date: dateStr,
        dayOfWeek,
        records: dayRecords,
        entry: entry ? format(parseISO(entry.recorded_at), 'HH:mm') : null,
        breakStart: breakStart ? format(parseISO(breakStart.recorded_at), 'HH:mm') : null,
        breakEnd: breakEnd ? format(parseISO(breakEnd.recorded_at), 'HH:mm') : null,
        exit: exit ? format(parseISO(exit.recorded_at), 'HH:mm') : null,
        workedMinutes,
        isHoliday: !!holiday,
        holidayName: holiday?.name || null,
      };
    });

    setTimesheetData(timesheetRows);
  };

  const calculateTotals = () => {
    const totalWorkedMinutes = timesheetData.reduce((sum, d) => sum + d.workedMinutes, 0);
    const totalDaysWorked = timesheetData.filter(d => d.workedMinutes > 0).length;
    return { totalWorkedMinutes, totalDaysWorked };
  };

  const formatMinutesToHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handlePrintTimesheet = () => {
    const emp = employees.find(e => e.id === selectedEmployee);
    if (!emp) return;

    const totals = calculateTotals();
    const printWindow = window.open('', '', 'height=842,width=595');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Espelho de Ponto - ${emp.full_name}</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 7pt; 
              line-height: 1.2;
              width: 100%;
              max-width: 190mm;
              margin: 0 auto;
            }
            h1 { font-size: 10pt; text-align: center; margin-bottom: 2px; font-weight: bold; }
            h2 { font-size: 8pt; text-align: center; margin-bottom: 4px; color: #444; }
            .header { 
              border: 0.5pt solid #000; 
              padding: 4px 6px; 
              margin-bottom: 4px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 2px;
            }
            .header-item { font-size: 7pt; }
            .header-item strong { font-weight: bold; }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 4px;
              font-size: 6.5pt;
            }
            th, td { 
              border: 0.5pt solid #000; 
              padding: 1px 2px; 
              text-align: center;
              white-space: nowrap;
            }
            th { 
              background-color: #e0e0e0; 
              font-weight: bold; 
              font-size: 6pt;
            }
            .weekend { background-color: #f5f5f5; }
            .holiday { background-color: #ffe0e0; }
            .totals { 
              border: 0.5pt solid #000; 
              padding: 4px 6px; 
              margin-bottom: 6px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 2px;
              font-size: 7pt;
            }
            .signature-area { 
              margin-top: 10px; 
              display: flex; 
              justify-content: space-around;
            }
            .signature-line { 
              width: 70mm; 
              border-top: 0.5pt solid #000; 
              text-align: center; 
              padding-top: 2px;
              font-size: 6pt;
            }
            .legal-notice { 
              margin-top: 6px; 
              font-size: 5pt; 
              text-align: center; 
              color: #666;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <h1>ESPELHO DE PONTO ELETRÔNICO</h1>
          <h2>Portaria 671/2021 MTE - Arts. 76 a 79</h2>
          
          <div class="header">
            <div class="header-item"><strong>Empresa:</strong> ${companySettings?.company_name || 'N/A'}</div>
            <div class="header-item"><strong>CNPJ:</strong> ${companySettings?.cnpj || 'N/A'}</div>
            <div class="header-item"><strong>Endereço:</strong> ${companySettings?.address || 'N/A'}</div>
            <div class="header-item"><strong>Cidade/UF:</strong> ${companySettings?.city || ''} - ${companySettings?.state || ''}</div>
            <div class="header-item"><strong>Funcionário:</strong> ${emp.full_name}</div>
            <div class="header-item"><strong>PIS:</strong> ${emp.pis || 'N/A'}</div>
            <div class="header-item"><strong>Matrícula:</strong> ${emp.registration_number || 'N/A'}</div>
            <div class="header-item"><strong>CPF:</strong> ${emp.cpf || 'N/A'}</div>
            <div class="header-item"><strong>Cargo:</strong> ${emp.position || 'N/A'}</div>
            <div class="header-item"><strong>Período:</strong> ${format(startOfMonth(filterMonth), 'dd/MM/yyyy')} a ${format(endOfMonth(filterMonth), 'dd/MM/yyyy')}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 12%">Data</th>
                <th style="width: 8%">Dia</th>
                <th style="width: 10%">Entrada</th>
                <th style="width: 10%">Saída Int.</th>
                <th style="width: 10%">Ret. Int.</th>
                <th style="width: 10%">Saída</th>
                <th style="width: 12%">Total</th>
                <th style="width: 28%">Observação</th>
              </tr>
            </thead>
            <tbody>
              ${timesheetData.map(row => `
                <tr class="${isWeekend(parseISO(row.date)) ? 'weekend' : ''} ${row.isHoliday ? 'holiday' : ''}">
                  <td>${format(parseISO(row.date), 'dd/MM')}</td>
                  <td>${row.dayOfWeek.slice(0, 3)}</td>
                  <td>${row.entry || '-'}</td>
                  <td>${row.breakStart || '-'}</td>
                  <td>${row.breakEnd || '-'}</td>
                  <td>${row.exit || '-'}</td>
                  <td>${row.workedMinutes > 0 ? formatMinutesToHours(row.workedMinutes) : '-'}</td>
                  <td style="text-align: left; font-size: 5pt;">${row.isHoliday ? row.holidayName : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div><strong>Total Dias Trabalhados:</strong> ${totals.totalDaysWorked}</div>
            <div><strong>Total Horas Trabalhadas:</strong> ${formatMinutesToHours(totals.totalWorkedMinutes)}</div>
          </div>
          
          <div class="signature-area">
            <div class="signature-line">Assinatura do Funcionário</div>
            <div class="signature-line">Assinatura do Responsável</div>
          </div>
          
          <div class="legal-notice">
            Documento gerado conforme Portaria 671/2021 do Ministério do Trabalho e Previdência - Arts. 76 a 79.
            Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const generateAFD = () => {
    if (!selectedEmployee || timeRecords.length === 0) {
      toast.error('Selecione um funcionário e busque os registros primeiro');
      return;
    }

    const emp = employees.find(e => e.id === selectedEmployee);
    const startDate = format(startOfMonth(filterMonth), 'ddMMyyyy');
    const endDate = format(endOfMonth(filterMonth), 'ddMMyyyy');

    const lines: string[] = [];
    
    const header = [
      '1',
      '1',
      (companySettings?.cnpj || '00000000000000').replace(/\D/g, '').padStart(14, '0'),
      '000000000000',
      (companySettings?.company_name || 'EMPRESA').padEnd(150, ' ').slice(0, 150),
      '00000000000000000',
      startDate,
      endDate,
      format(new Date(), 'ddMMyyyyHHmmss'),
    ].join('');
    lines.push(header);

    timeRecords.forEach(record => {
      const recordDate = parseISO(record.recorded_at);
      const line = [
        '3',
        record.nsr.toString().padStart(9, '0'),
        '1',
        (emp?.pis || '00000000000').replace(/\D/g, '').padStart(11, '0'),
        format(recordDate, 'ddMMyyyy'),
        format(recordDate, 'HHmm'),
      ].join('');
      lines.push(line);
    });

    const trailer = [
      '9',
      lines.length.toString().padStart(9, '0'),
    ].join('');
    lines.push(trailer);

    const content = lines.join('\r\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AFD_${emp?.registration_number || 'funcionario'}_${format(filterMonth, 'yyyyMM')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Arquivo AFD gerado com sucesso!');
  };

  if (!isAdmin && !isManager) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas administradores e gestores podem acessar o espelho de ponto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
          title="Espelho de Ponto"
          description="Visualize e imprima o espelho de ponto dos funcionários" icon={ClipboardList}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Selecione o funcionário e o período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select
                value={selectedEmployeeGroup}
                onValueChange={(v) => {
                  setSelectedEmployeeGroup(v);
                  setSelectedRegistration('');
                  setSelectedEmployee('');
                  setTimesheetData([]);
                  setTimeRecords([]);
                  const group = groupedEmployees.find(g => g.key === v);
                  if (group && group.profiles.length === 1) {
                    setSelectedRegistration(group.profiles[0].id);
                    setSelectedEmployee(group.profiles[0].id);
                    fetchTimeRecords(group.profiles[0].id);
                  }
                }}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {groupedEmployees.map((group) => (
                    <SelectItem key={group.key} value={group.key}>
                      {group.full_name} {group.profiles.length > 1 ? `(${group.profiles.length} matrículas)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {availableRegistrations.length > 1 && (
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Select
                  value={selectedRegistration}
                  onValueChange={(v) => {
                    setSelectedRegistration(v);
                    setSelectedEmployee(v);
                    fetchTimeRecords(v);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Selecione a matrícula" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRegistrations.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.registration_number || 'Sem matrícula'} 
                        {p.position ? ` - ${p.position}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Mês</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filterMonth}
                    onSelect={(date) => {
                      if (date) {
                        setFilterMonth(date);
                        if (selectedEmployee) fetchTimeRecords(selectedEmployee);
                      }
                    }}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrintTimesheet} disabled={!selectedEmployee || timesheetData.length === 0}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir A4
              </Button>
              <Button variant="outline" onClick={generateAFD} disabled={!selectedEmployee || timeRecords.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Gerar AFD
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedEmployee && timesheetData.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Dias Trabalhados</CardDescription>
                <CardTitle className="text-2xl">{calculateTotals().totalDaysWorked}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Horas</CardDescription>
                <CardTitle className="text-2xl">{formatMinutesToHours(calculateTotals().totalWorkedMinutes)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card ref={printRef}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Espelho de Ponto - {employees.find(e => e.id === selectedEmployee)?.full_name}
              </CardTitle>
              <CardDescription className="space-y-1">
                <div>
                  Matrícula: {employees.find(e => e.id === selectedEmployee)?.registration_number || 'Não informada'}
                  {employees.find(e => e.id === selectedEmployee)?.position && 
                    ` | Cargo: ${employees.find(e => e.id === selectedEmployee)?.position}`
                  }
                </div>
                <div>
                  Período: {format(startOfMonth(filterMonth), 'dd/MM/yyyy')} a {format(endOfMonth(filterMonth), 'dd/MM/yyyy')} | 
                  Conforme Portaria 671/2021 MTE
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Data</TableHead>
                      <TableHead className="w-[60px]">Dia</TableHead>
                      <TableHead className="w-[70px]">Entrada</TableHead>
                      <TableHead className="w-[70px]">Saída Int.</TableHead>
                      <TableHead className="w-[70px]">Ret. Int.</TableHead>
                      <TableHead className="w-[70px]">Saída</TableHead>
                      <TableHead className="w-[80px]">Total</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheetData.map((row) => (
                      <TableRow 
                        key={row.date}
                        className={cn(
                          isWeekend(parseISO(row.date)) && 'bg-muted/50',
                          row.isHoliday && 'bg-destructive/10'
                        )}
                      >
                        <TableCell className="font-mono text-sm">
                          {format(parseISO(row.date), 'dd/MM')}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {row.dayOfWeek.slice(0, 3)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.entry || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.breakStart || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.breakEnd || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.exit || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.workedMinutes > 0 ? formatMinutesToHours(row.workedMinutes) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.isHoliday ? row.holidayName : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedEmployee && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Selecione um funcionário para visualizar o espelho de ponto</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}