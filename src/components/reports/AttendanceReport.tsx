import React, { useState } from 'react';
import { ReportExportMenu } from '@/components/reports/ReportExportMenu';
import type { ReportData } from '@/lib/reportExport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Users, Download, Eye, Printer, Clock } from 'lucide-react';
import { format, parseISO, differenceInMinutes, eachDayOfInterval, isSameDay, isWeekend } from 'date-fns';
import { 
  createA4PDF, 
  getContentStartY, 
  addCompanyInfo, 
  addTable, 
  addFooter, 
  formatMinutesToHHMM,
  getCompanyBranding 
} from '@/lib/pdfUtils';

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

interface AttendanceReportProps {
  records: TimeRecord[];
  employees: { id: string; full_name: string; department?: string | null }[];
  holidays: Date[];
  companySettings: CompanySettings | null;
  startDate: string;
  endDate: string;
}

interface EmployeeAttendance {
  profileId: string;
  name: string;
  department: string;
  workDays: number;
  presentDays: number;
  absentDays: number;
  totalWorkedMinutes: number;
  attendanceRate: number;
}

export function AttendanceReport({ records, employees, holidays, companySettings, startDate, endDate }: AttendanceReportProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const calculateAttendance = (): EmployeeAttendance[] => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const allDays = eachDayOfInterval({ start, end });
    const workDays = allDays.filter(day => 
      !isWeekend(day) && !holidays.some(h => isSameDay(h, day))
    );
    const totalWorkDays = workDays.length;

    return employees.map(emp => {
      let presentDays = 0;
      let totalWorkedMinutes = 0;

      workDays.forEach(day => {
        const dayRecords = records.filter(r => 
          r.profile_id === emp.id && isSameDay(parseISO(r.recorded_at), day)
        );

        if (dayRecords.length > 0) {
          presentDays++;
          
          const entry = dayRecords.find(r => r.record_type === 'entry');
          const exit = dayRecords.find(r => r.record_type === 'exit');
          const breakStart = dayRecords.find(r => r.record_type === 'break_start');
          const breakEnd = dayRecords.find(r => r.record_type === 'break_end');

          if (entry && exit) {
            let worked = differenceInMinutes(parseISO(exit.recorded_at), parseISO(entry.recorded_at));
            if (breakStart && breakEnd) {
              worked -= differenceInMinutes(parseISO(breakEnd.recorded_at), parseISO(breakStart.recorded_at));
            } else {
              worked -= 60;
            }
            totalWorkedMinutes += Math.max(0, worked);
          }
        }
      });

      const absentDays = totalWorkDays - presentDays;
      const attendanceRate = totalWorkDays > 0 ? (presentDays / totalWorkDays) * 100 : 0;

      return {
        profileId: emp.id,
        name: emp.full_name,
        department: emp.department || 'N/A',
        workDays: totalWorkDays,
        presentDays,
        absentDays,
        totalWorkedMinutes,
        attendanceRate,
      };
    }).sort((a, b) => b.attendanceRate - a.attendanceRate);
  };

  const attendanceData = calculateAttendance();

  const formatMinutes = (minutes: number): string => {
    return formatMinutesToHHMM(minutes);
  };

  const getAverages = () => {
    if (attendanceData.length === 0) return { avgRate: 0, avgWorked: 0 };
    
    const totalRate = attendanceData.reduce((acc, emp) => acc + emp.attendanceRate, 0);
    const totalWorked = attendanceData.reduce((acc, emp) => acc + emp.totalWorkedMinutes, 0);
    
    return {
      avgRate: totalRate / attendanceData.length,
      avgWorked: totalWorked / attendanceData.length,
    };
  };

  const averages = getAverages();

  /** Mesmo conteúdo do PDF, para todos os formatos de exportação e o envio por e-mail. */
  const reportData = (): ReportData => {
    const tableData = attendanceData.map(emp => [
      emp.name,
      emp.department,
      String(emp.workDays),
      String(emp.presentDays),
      String(emp.absentDays),
      formatMinutes(emp.totalWorkedMinutes),
      `${emp.attendanceRate.toFixed(1)}%`,
    ]);
    return { title: 'Relatório de Frequência', period: { start: startDate, end: endDate }, columns: [['Funcionário', 'Departamento', 'Dias Úteis', 'Presentes', 'Ausentes', 'Horas', '% Freq.']][0], rows: tableData, totals: undefined };
  };


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-500" />
            Relatório de Frequência
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
            <ReportExportMenu getData={reportData} disabled={false} />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Funcionários</span>
                </div>
                <p className="text-xl font-bold">{attendanceData.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Média Frequência</span>
                </div>
                <p className="text-xl font-bold">{averages.avgRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Média Horas</span>
                </div>
                <p className="text-xl font-bold">{formatMinutes(Math.round(averages.avgWorked))}</p>
              </CardContent>
            </Card>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Dias Úteis</TableHead>
                <TableHead>Presentes</TableHead>
                <TableHead>Ausentes</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>% Freq.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceData.map((emp) => (
                <TableRow key={emp.profileId}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell>{emp.workDays}</TableCell>
                  <TableCell className="text-green-600">{emp.presentDays}</TableCell>
                  <TableCell className="text-red-600">{emp.absentDays}</TableCell>
                  <TableCell>{formatMinutes(emp.totalWorkedMinutes)}</TableCell>
                  <TableCell>
                    <span className={emp.attendanceRate >= 90 ? 'text-green-600' : emp.attendanceRate >= 75 ? 'text-yellow-600' : 'text-red-600'}>
                      {emp.attendanceRate.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Prévia - Relatório de Frequência</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh]">
            <div className="p-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">RELATÓRIO DE FREQUÊNCIA</h2>
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
                    <TableHead>Dias Úteis</TableHead>
                    <TableHead>Presentes</TableHead>
                    <TableHead>Ausentes</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>% Freq.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map((emp) => (
                    <TableRow key={emp.profileId}>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.workDays}</TableCell>
                      <TableCell>{emp.presentDays}</TableCell>
                      <TableCell>{emp.absentDays}</TableCell>
                      <TableCell>{formatMinutes(emp.totalWorkedMinutes)}</TableCell>
                      <TableCell>{emp.attendanceRate.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="flex justify-between font-bold">
                <span>Média Frequência: {averages.avgRate.toFixed(1)}%</span>
                <span>Média Horas: {formatMinutes(Math.round(averages.avgWorked))}</span>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
