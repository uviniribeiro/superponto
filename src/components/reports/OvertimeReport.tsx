import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clock, Download, Eye, Printer, TrendingUp } from 'lucide-react';
import { format, parseISO, differenceInMinutes, eachDayOfInterval, isSameDay, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  profiles?: {
    full_name: string;
    department?: string | null;
    position?: string | null;
  };
}

interface CompanySettings {
  company_name: string;
  cnpj?: string | null;
}

interface OvertimeReportProps {
  records: TimeRecord[];
  companySettings: CompanySettings | null;
  startDate: string;
  endDate: string;
}

interface EmployeeOvertime {
  profileId: string;
  name: string;
  department: string;
  position: string;
  totalOvertimeMinutes: number;
  overtime50Minutes: number;
  overtime100Minutes: number;
  details: {
    date: Date;
    workedMinutes: number;
    expectedMinutes: number;
    overtimeMinutes: number;
    is100Percent: boolean;
  }[];
}

export function OvertimeReport({ records, companySettings, startDate, endDate }: OvertimeReportProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const calculateOvertime = (): EmployeeOvertime[] => {
    const employeeMap = new Map<string, EmployeeOvertime>();

    // Group records by employee and date
    const groupedByEmployee = new Map<string, TimeRecord[]>();
    records.forEach(record => {
      const key = record.profile_id;
      if (!groupedByEmployee.has(key)) {
        groupedByEmployee.set(key, []);
      }
      groupedByEmployee.get(key)!.push(record);
    });

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = eachDayOfInterval({ start, end });

    groupedByEmployee.forEach((empRecords, profileId) => {
      const firstRecord = empRecords.find(r => r.profiles);
      const employeeData: EmployeeOvertime = {
        profileId,
        name: firstRecord?.profiles?.full_name || 'N/A',
        department: firstRecord?.profiles?.department || 'N/A',
        position: firstRecord?.profiles?.position || 'N/A',
        totalOvertimeMinutes: 0,
        overtime50Minutes: 0,
        overtime100Minutes: 0,
        details: [],
      };

      days.forEach(day => {
        const dayRecords = empRecords.filter(r => isSameDay(parseISO(r.recorded_at), day));
        const entry = dayRecords.find(r => r.record_type === 'entry');
        const exit = dayRecords.find(r => r.record_type === 'exit');
        const breakStart = dayRecords.find(r => r.record_type === 'break_start');
        const breakEnd = dayRecords.find(r => r.record_type === 'break_end');

        if (entry && exit) {
          let workedMinutes = differenceInMinutes(parseISO(exit.recorded_at), parseISO(entry.recorded_at));
          
          if (breakStart && breakEnd) {
            workedMinutes -= differenceInMinutes(parseISO(breakEnd.recorded_at), parseISO(breakStart.recorded_at));
          } else {
            workedMinutes -= 60; // Default 1 hour break
          }

          const expectedMinutes = isWeekend(day) ? 0 : 480; // 8 hours
          const overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes);
          const is100Percent = isWeekend(day);

          if (overtimeMinutes > 0) {
            employeeData.totalOvertimeMinutes += overtimeMinutes;
            if (is100Percent) {
              employeeData.overtime100Minutes += overtimeMinutes;
            } else {
              // First 2 hours at 50%, rest at 100%
              const overtime50 = Math.min(overtimeMinutes, 120);
              const overtime100 = Math.max(0, overtimeMinutes - 120);
              employeeData.overtime50Minutes += overtime50;
              employeeData.overtime100Minutes += overtime100;
            }

            employeeData.details.push({
              date: day,
              workedMinutes,
              expectedMinutes,
              overtimeMinutes,
              is100Percent,
            });
          }
        }
      });

      if (employeeData.totalOvertimeMinutes > 0) {
        employeeMap.set(profileId, employeeData);
      }
    });

    return Array.from(employeeMap.values()).sort((a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes);
  };

  const overtimeData = calculateOvertime();

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const getTotals = () => {
    return overtimeData.reduce((acc, emp) => ({
      total: acc.total + emp.totalOvertimeMinutes,
      overtime50: acc.overtime50 + emp.overtime50Minutes,
      overtime100: acc.overtime100 + emp.overtime100Minutes,
    }), { total: 0, overtime50: 0, overtime100: 0 });
  };

  const totals = getTotals();

  const generatePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('RELATÓRIO DE HORAS EXTRAS', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}`, 105, 22, { align: 'center' });

    doc.text(`Empresa: ${companySettings?.company_name || ''}`, 14, 35);
    doc.text(`CNPJ: ${companySettings?.cnpj || ''}`, 14, 41);

    const tableData = overtimeData.map(emp => [
      emp.name,
      emp.department,
      formatMinutes(emp.overtime50Minutes),
      formatMinutes(emp.overtime100Minutes),
      formatMinutes(emp.totalOvertimeMinutes),
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Funcionário', 'Departamento', 'HE 50%', 'HE 100%', 'Total']],
      body: tableData,
      foot: [[
        'TOTAL',
        '',
        formatMinutes(totals.overtime50),
        formatMinutes(totals.overtime100),
        formatMinutes(totals.total),
      ]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    doc.setFontSize(8);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 105, 285, { align: 'center' });

    doc.save(`Relatorio_Horas_Extras_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Relatório de Horas Extras
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
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={generatePDF} className="gradient-primary">
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">HE 50%</span>
                </div>
                <p className="text-xl font-bold">{formatMinutes(totals.overtime50)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">HE 100%</span>
                </div>
                <p className="text-xl font-bold">{formatMinutes(totals.overtime100)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <p className="text-xl font-bold">{formatMinutes(totals.total)}</p>
              </CardContent>
            </Card>
          </div>

          {overtimeData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma hora extra registrada no período
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>HE 50%</TableHead>
                  <TableHead>HE 100%</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overtimeData.map((emp) => (
                  <TableRow key={emp.profileId}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{formatMinutes(emp.overtime50Minutes)}</TableCell>
                    <TableCell>{formatMinutes(emp.overtime100Minutes)}</TableCell>
                    <TableCell className="font-bold">{formatMinutes(emp.totalOvertimeMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Prévia - Relatório de Horas Extras</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh]">
            <div className="p-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">RELATÓRIO DE HORAS EXTRAS</h2>
                <p className="text-sm text-muted-foreground">
                  Período: {format(parseISO(startDate), 'dd/MM/yyyy')} a {format(parseISO(endDate), 'dd/MM/yyyy')}
                </p>
              </div>

              <Separator className="my-4" />

              <div className="mb-4">
                <p><strong>Empresa:</strong> {companySettings?.company_name}</p>
                <p><strong>CNPJ:</strong> {companySettings?.cnpj || 'N/A'}</p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>HE 50%</TableHead>
                    <TableHead>HE 100%</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overtimeData.map((emp) => (
                    <TableRow key={emp.profileId}>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{formatMinutes(emp.overtime50Minutes)}</TableCell>
                      <TableCell>{formatMinutes(emp.overtime100Minutes)}</TableCell>
                      <TableCell className="font-bold">{formatMinutes(emp.totalOvertimeMinutes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="flex justify-between font-bold">
                <span>TOTAIS:</span>
                <span>50%: {formatMinutes(totals.overtime50)}</span>
                <span>100%: {formatMinutes(totals.overtime100)}</span>
                <span>Total: {formatMinutes(totals.total)}</span>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
