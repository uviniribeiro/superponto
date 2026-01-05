import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Printer, Download, Eye, Clock, AlertCircle } from 'lucide-react';
import { format, parseISO, differenceInMinutes, eachDayOfInterval, isSameDay, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  nsr: number;
}

interface Employee {
  id: string;
  full_name: string;
  cpf?: string | null;
  pis?: string | null;
  registration_number?: string | null;
  department?: string | null;
  position?: string | null;
}

interface CompanySettings {
  company_name: string;
  cnpj?: string | null;
  cei?: string | null;
  address?: string | null;
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

interface MirrorPointReportProps {
  employee: Employee;
  records: TimeRecord[];
  holidays: Date[];
  companySettings: CompanySettings | null;
  startDate: string;
  endDate: string;
  workSchedule?: {
    monday_start?: string | null;
    monday_end?: string | null;
    tuesday_start?: string | null;
    tuesday_end?: string | null;
    wednesday_start?: string | null;
    wednesday_end?: string | null;
    thursday_start?: string | null;
    thursday_end?: string | null;
    friday_start?: string | null;
    friday_end?: string | null;
    saturday_start?: string | null;
    saturday_end?: string | null;
    sunday_start?: string | null;
    sunday_end?: string | null;
    break_duration_minutes?: number | null;
  } | null;
}

export function MirrorPointReport({
  employee,
  records,
  holidays,
  companySettings,
  startDate,
  endDate,
  workSchedule
}: MirrorPointReportProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const processRecords = (): DailySummary[] => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = eachDayOfInterval({ start, end });
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

      if (entry && exit) {
        const entryTime = parseISO(entry.recorded_at);
        const exitTime = parseISO(exit.recorded_at);
        workedMinutes = differenceInMinutes(exitTime, entryTime);

        if (breakStart && breakEnd) {
          const breakMinutes = differenceInMinutes(
            parseISO(breakEnd.recorded_at),
            parseISO(breakStart.recorded_at)
          );
          workedMinutes -= breakMinutes;
        } else if (workSchedule?.break_duration_minutes) {
          workedMinutes -= workSchedule.break_duration_minutes;
          observations.push('Intervalo não registrado');
        }
      }

      let expectedMinutes = 0;
      if (workSchedule && !isHolidayDay) {
        const dayOfWeek = format(day, 'EEEE', { locale: ptBR }).toLowerCase();
        const dayMap: Record<string, { start: string | null | undefined; end: string | null | undefined }> = {
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

    return summaries;
  };

  const dailySummaries = processRecords();

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

  const totals = getTotals();

  const generatePDF = () => {
    const doc = new jsPDF();
    const monthName = format(parseISO(startDate), 'MMMM/yyyy', { locale: ptBR });

    doc.setFontSize(16);
    doc.text('ESPELHO DE PONTO ELETRÔNICO', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Conforme Portarias 671/2021 e 1510/2009 do MTE', 105, 22, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Empresa: ${companySettings?.company_name || ''}`, 14, 35);
    doc.text(`CNPJ: ${companySettings?.cnpj || ''}`, 14, 41);

    doc.text(`Funcionário: ${employee.full_name}`, 14, 51);
    doc.text(`CPF: ${employee.cpf || 'Não informado'}`, 14, 57);
    doc.text(`PIS: ${employee.pis || 'Não informado'}`, 110, 57);
    doc.text(`Matrícula: ${employee.registration_number || 'Não informado'}`, 14, 63);
    doc.text(`Cargo: ${employee.position || 'Não informado'}`, 110, 63);
    doc.text(`Período: ${monthName.toUpperCase()}`, 14, 69);

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
      startY: 76,
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

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Horas Previstas: ${formatMinutes(totals.expectedTotal)}`, 14, finalY);
    doc.text(`Horas Trabalhadas: ${formatMinutes(totals.workedTotal)}`, 70, finalY);
    doc.text(`Saldo: ${(totals.balanceTotal >= 0 ? '+' : '') + formatMinutes(totals.balanceTotal)}`, 140, finalY);
    doc.text(`Faltas: ${totals.absences} dia(s)`, 14, finalY + 6);

    const sigY = finalY + 25;
    doc.line(14, sigY, 90, sigY);
    doc.line(120, sigY, 196, sigY);
    doc.text('Assinatura do Empregado', 52, sigY + 5, { align: 'center' });
    doc.text('Assinatura do Empregador', 158, sigY + 5, { align: 'center' });

    doc.setFontSize(8);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 105, 290, { align: 'center' });

    doc.save(`Espelho_Ponto_${employee.full_name.replace(/\s/g, '_')}_${format(parseISO(startDate), 'yyyy-MM')}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Espelho de Ponto - {employee.full_name}
          </CardTitle>
          <CardDescription>
            Período: {format(parseISO(startDate), 'dd/MM/yyyy')} a {format(parseISO(endDate), 'dd/MM/yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Prévia
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={generatePDF} className="gradient-primary">
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Previsto</span>
                </div>
                <p className="text-xl font-bold">{formatMinutes(totals.expectedTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Trabalhado</span>
                </div>
                <p className="text-xl font-bold">{formatMinutes(totals.workedTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Saldo</span>
                </div>
                <p className={`text-xl font-bold ${totals.balanceTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(totals.balanceTotal >= 0 ? '+' : '') + formatMinutes(totals.balanceTotal)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Faltas</span>
                </div>
                <p className="text-xl font-bold">{totals.absences} dia(s)</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Prévia - Espelho de Ponto</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh]">
            <div ref={printRef} className="p-4 print:p-0">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">ESPELHO DE PONTO ELETRÔNICO</h2>
                <p className="text-sm text-muted-foreground">Conforme Portarias 671/2021 e 1510/2009 do MTE</p>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p><strong>Empresa:</strong> {companySettings?.company_name}</p>
                  <p><strong>CNPJ:</strong> {companySettings?.cnpj || 'N/A'}</p>
                </div>
                <div>
                  <p><strong>Funcionário:</strong> {employee.full_name}</p>
                  <p><strong>Matrícula:</strong> {employee.registration_number || 'N/A'}</p>
                </div>
              </div>

              <Separator className="my-4" />

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
                    <TableHead>Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySummaries.map((d, idx) => (
                    <TableRow key={idx} className={d.isHoliday || d.isWeekend ? 'bg-muted/50' : ''}>
                      <TableCell>{format(d.date, 'dd/MM')}</TableCell>
                      <TableCell>{format(d.date, 'EEE', { locale: ptBR })}</TableCell>
                      <TableCell>{d.isHoliday ? 'FERIADO' : d.entry || '-'}</TableCell>
                      <TableCell>{d.isHoliday ? '-' : d.breakStart || '-'}</TableCell>
                      <TableCell>{d.isHoliday ? '-' : d.breakEnd || '-'}</TableCell>
                      <TableCell>{d.isHoliday ? '-' : d.exit || '-'}</TableCell>
                      <TableCell>{d.isHoliday ? '-' : formatMinutes(d.workedMinutes)}</TableCell>
                      <TableCell className={d.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {d.isHoliday ? '-' : (d.balance >= 0 ? '+' : '') + formatMinutes(d.balance)}
                      </TableCell>
                      <TableCell>
                        {d.observations.length > 0 ? (
                          <Badge variant={d.observations.includes('Falta') ? 'destructive' : 'secondary'}>
                            {d.observations.join(', ')}
                          </Badge>
                        ) : (d.isHoliday ? 'Feriado' : d.isWeekend ? 'Folga' : '-')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="grid grid-cols-4 gap-4 text-sm font-medium">
                <p>Previsto: {formatMinutes(totals.expectedTotal)}</p>
                <p>Trabalhado: {formatMinutes(totals.workedTotal)}</p>
                <p className={totals.balanceTotal >= 0 ? 'text-green-600' : 'text-red-600'}>
                  Saldo: {(totals.balanceTotal >= 0 ? '+' : '') + formatMinutes(totals.balanceTotal)}
                </p>
                <p>Faltas: {totals.absences} dia(s)</p>
              </div>

              <div className="mt-12 grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="border-t border-foreground mt-8 pt-2">
                    Assinatura do Empregado
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-t border-foreground mt-8 pt-2">
                    Assinatura do Empregador
                  </div>
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-8">
                Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
