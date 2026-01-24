import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clock, Download, Eye, Printer } from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
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

interface WorkedHoursReportProps {
  records: TimeRecord[];
  companySettings: CompanySettings | null;
  startDate: string;
  endDate: string;
}

interface EmployeeWorkedHours {
  profileId: string;
  name: string;
  department: string;
  position: string;
  totalWorkedMinutes: number;
  daysWorked: number;
  avgDailyMinutes: number;
}

export function WorkedHoursReport({ records, companySettings, startDate, endDate }: WorkedHoursReportProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const calculateWorkedHours = (): EmployeeWorkedHours[] => {
    const employeeMap = new Map<string, EmployeeWorkedHours>();

    const groupedByEmployee = new Map<string, TimeRecord[]>();
    records.forEach(record => {
      const key = record.profile_id;
      if (!groupedByEmployee.has(key)) {
        groupedByEmployee.set(key, []);
      }
      groupedByEmployee.get(key)!.push(record);
    });

    groupedByEmployee.forEach((empRecords, profileId) => {
      const firstRecord = empRecords.find(r => r.profiles);
      
      // Group by date
      const dateGroups = new Map<string, TimeRecord[]>();
      empRecords.forEach(r => {
        const dateKey = format(parseISO(r.recorded_at), 'yyyy-MM-dd');
        if (!dateGroups.has(dateKey)) {
          dateGroups.set(dateKey, []);
        }
        dateGroups.get(dateKey)!.push(r);
      });

      let totalWorkedMinutes = 0;
      let daysWorked = 0;

      dateGroups.forEach((dayRecords) => {
        const entry = dayRecords.find(r => r.record_type === 'entry');
        const exit = dayRecords.find(r => r.record_type === 'exit');
        const breakStart = dayRecords.find(r => r.record_type === 'break_start');
        const breakEnd = dayRecords.find(r => r.record_type === 'break_end');

        if (entry && exit) {
          let worked = differenceInMinutes(parseISO(exit.recorded_at), parseISO(entry.recorded_at));
          
          if (breakStart && breakEnd) {
            worked -= differenceInMinutes(parseISO(breakEnd.recorded_at), parseISO(breakStart.recorded_at));
          } else {
            worked -= 60; // Default 1 hour break
          }
          
          totalWorkedMinutes += Math.max(0, worked);
          daysWorked++;
        }
      });

      employeeMap.set(profileId, {
        profileId,
        name: firstRecord?.profiles?.full_name || 'N/A',
        department: firstRecord?.profiles?.department || 'N/A',
        position: firstRecord?.profiles?.position || 'N/A',
        totalWorkedMinutes,
        daysWorked,
        avgDailyMinutes: daysWorked > 0 ? Math.round(totalWorkedMinutes / daysWorked) : 0,
      });
    });

    return Array.from(employeeMap.values()).sort((a, b) => b.totalWorkedMinutes - a.totalWorkedMinutes);
  };

  const workedData = calculateWorkedHours();

  const formatMinutes = (minutes: number): string => {
    return formatMinutesToHHMM(minutes);
  };

  const getTotals = () => {
    const totalMinutes = workedData.reduce((acc, emp) => acc + emp.totalWorkedMinutes, 0);
    const totalDays = workedData.reduce((acc, emp) => acc + emp.daysWorked, 0);
    return { totalMinutes, totalDays };
  };

  const totals = getTotals();

  const generatePDF = async () => {
    const doc = await createA4PDF({
      title: 'Relatório de Horas Trabalhadas',
      period: {
        start: format(parseISO(startDate), 'dd/MM/yyyy'),
        end: format(parseISO(endDate), 'dd/MM/yyyy'),
      },
    });

    const branding = await getCompanyBranding();
    let y = getContentStartY(doc);
    y = addCompanyInfo(doc, y, branding);

    const tableData = workedData.map(emp => [
      emp.name,
      emp.department,
      emp.position,
      String(emp.daysWorked),
      formatMinutes(emp.totalWorkedMinutes),
      formatMinutes(emp.avgDailyMinutes),
    ]);

    addTable(
      doc,
      y,
      [['Funcionário', 'Departamento', 'Cargo', 'Dias', 'Total Horas', 'Média Diária']],
      tableData,
      [[
        'TOTAL',
        '',
        '',
        String(totals.totalDays),
        formatMinutes(totals.totalMinutes),
        '',
      ]],
      { headColor: [59, 130, 246] }
    );

    addFooter(doc);
    doc.save(`Relatorio_Horas_Trabalhadas_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Relatório de Horas Trabalhadas
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
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Total Horas</span>
                </div>
                <p className="text-xl font-bold">{formatMinutes(totals.totalMinutes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Total Dias</span>
                </div>
                <p className="text-xl font-bold">{totals.totalDays}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Funcionários</span>
                </div>
                <p className="text-xl font-bold">{workedData.length}</p>
              </CardContent>
            </Card>
          </div>

          {workedData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro no período
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workedData.map((emp) => (
                  <TableRow key={emp.profileId}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell>{emp.daysWorked}</TableCell>
                    <TableCell className="font-bold">{formatMinutes(emp.totalWorkedMinutes)}</TableCell>
                    <TableCell>{formatMinutes(emp.avgDailyMinutes)}</TableCell>
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
            <DialogTitle>Prévia - Relatório de Horas Trabalhadas</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh]">
            <div className="p-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">RELATÓRIO DE HORAS TRABALHADAS</h2>
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
                    <TableHead>Cargo</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workedData.map((emp) => (
                    <TableRow key={emp.profileId}>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.position}</TableCell>
                      <TableCell>{emp.daysWorked}</TableCell>
                      <TableCell className="font-bold">{formatMinutes(emp.totalWorkedMinutes)}</TableCell>
                      <TableCell>{formatMinutes(emp.avgDailyMinutes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="flex justify-between font-bold">
                <span>Total: {formatMinutes(totals.totalMinutes)}</span>
                <span>Dias: {totals.totalDays}</span>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
