import React, { useState } from 'react';
import { ReportExportMenu } from '@/components/reports/ReportExportMenu';
import type { ReportData } from '@/lib/reportExport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Download, Eye, Printer } from 'lucide-react';
import { format, parseISO, eachDayOfInterval, isSameDay, isWeekend } from 'date-fns';
import { 
  createA4PDF, 
  getContentStartY, 
  addCompanyInfo, 
  addTable, 
  addFooter, 
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

interface AbsencesReportProps {
  records: TimeRecord[];
  employees: { id: string; full_name: string; department?: string | null }[];
  holidays: Date[];
  companySettings: CompanySettings | null;
  startDate: string;
  endDate: string;
}

interface EmployeeAbsence {
  profileId: string;
  name: string;
  department: string;
  absenceDays: number;
  lateDays: number;
  incompleteRecords: number;
  details: {
    date: Date;
    type: 'absence' | 'late' | 'incomplete';
    description: string;
  }[];
}

export function AbsencesReport({ records, employees, holidays, companySettings, startDate, endDate }: AbsencesReportProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const calculateAbsences = (): EmployeeAbsence[] => {
    const employeeMap = new Map<string, EmployeeAbsence>();
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const workDays = eachDayOfInterval({ start, end }).filter(day => 
      !isWeekend(day) && !holidays.some(h => isSameDay(h, day))
    );

    // Initialize all employees
    employees.forEach(emp => {
      employeeMap.set(emp.id, {
        profileId: emp.id,
        name: emp.full_name,
        department: emp.department || 'N/A',
        absenceDays: 0,
        lateDays: 0,
        incompleteRecords: 0,
        details: [],
      });
    });

    // Check each work day for each employee
    workDays.forEach(day => {
      employees.forEach(emp => {
        const dayRecords = records.filter(r => 
          r.profile_id === emp.id && isSameDay(parseISO(r.recorded_at), day)
        );

        const employeeData = employeeMap.get(emp.id)!;
        const entry = dayRecords.find(r => r.record_type === 'entry');
        const exit = dayRecords.find(r => r.record_type === 'exit');

        if (dayRecords.length === 0) {
          // Absence
          employeeData.absenceDays++;
          employeeData.details.push({
            date: day,
            type: 'absence',
            description: 'Falta não justificada',
          });
        } else if (entry && !exit) {
          // Incomplete record
          employeeData.incompleteRecords++;
          employeeData.details.push({
            date: day,
            type: 'incomplete',
            description: 'Saída não registrada',
          });
        } else if (!entry && exit) {
          // Incomplete record
          employeeData.incompleteRecords++;
          employeeData.details.push({
            date: day,
            type: 'incomplete',
            description: 'Entrada não registrada',
          });
        } else if (entry) {
          // Check for late arrival (after 9:00)
          const entryTime = parseISO(entry.recorded_at);
          const entryHour = entryTime.getHours();
          const entryMinute = entryTime.getMinutes();
          
          // Assuming work starts at 8:00, late if after 8:10
          if (entryHour > 8 || (entryHour === 8 && entryMinute > 10)) {
            employeeData.lateDays++;
            employeeData.details.push({
              date: day,
              type: 'late',
              description: `Atraso: entrada às ${format(entryTime, 'HH:mm')}`,
            });
          }
        }
      });
    });

    return Array.from(employeeMap.values())
      .filter(emp => emp.absenceDays > 0 || emp.lateDays > 0 || emp.incompleteRecords > 0)
      .sort((a, b) => (b.absenceDays + b.lateDays + b.incompleteRecords) - (a.absenceDays + a.lateDays + a.incompleteRecords));
  };

  const absenceData = calculateAbsences();

  const getTotals = () => {
    return absenceData.reduce((acc, emp) => ({
      absences: acc.absences + emp.absenceDays,
      lates: acc.lates + emp.lateDays,
      incompletes: acc.incompletes + emp.incompleteRecords,
    }), { absences: 0, lates: 0, incompletes: 0 });
  };

  const totals = getTotals();

  /** Mesmo conteúdo do PDF, para todos os formatos de exportação e o envio por e-mail. */
  const reportData = (): ReportData => {
    const tableData = absenceData.map(emp => [
      emp.name,
      emp.department,
      String(emp.absenceDays),
      String(emp.lateDays),
      String(emp.incompleteRecords),
      String(emp.absenceDays + emp.lateDays + emp.incompleteRecords),
    ]);
    return { title: 'Relatório de Faltas e Atrasos', period: { start: startDate, end: endDate }, columns: [['Funcionário', 'Departamento', 'Faltas', 'Atrasos', 'Incompletos', 'Total']][0], rows: tableData, totals: [
        'TOTAL',
        '',
        String(totals.absences),
        String(totals.lates),
        String(totals.incompletes),
        String(totals.absences + totals.lates + totals.incompletes),
      ] };
  };


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Relatório de Faltas e Atrasos
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

          <div className="grid grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Faltas</span>
                </div>
                <p className="text-xl font-bold">{totals.absences}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Atrasos</span>
                </div>
                <p className="text-xl font-bold">{totals.lates}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Incompletos</span>
                </div>
                <p className="text-xl font-bold">{totals.incompletes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Funcionários</span>
                </div>
                <p className="text-xl font-bold">{absenceData.length}</p>
              </CardContent>
            </Card>
          </div>

          {absenceData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma ocorrência registrada no período
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Faltas</TableHead>
                  <TableHead>Atrasos</TableHead>
                  <TableHead>Incompletos</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {absenceData.map((emp) => (
                  <TableRow key={emp.profileId}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>
                      {emp.absenceDays > 0 && (
                        <Badge variant="destructive">{emp.absenceDays}</Badge>
                      )}
                      {emp.absenceDays === 0 && '-'}
                    </TableCell>
                    <TableCell>
                      {emp.lateDays > 0 && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{emp.lateDays}</Badge>
                      )}
                      {emp.lateDays === 0 && '-'}
                    </TableCell>
                    <TableCell>
                      {emp.incompleteRecords > 0 && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">{emp.incompleteRecords}</Badge>
                      )}
                      {emp.incompleteRecords === 0 && '-'}
                    </TableCell>
                    <TableCell className="font-bold">
                      {emp.absenceDays + emp.lateDays + emp.incompleteRecords}
                    </TableCell>
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
            <DialogTitle>Prévia - Relatório de Faltas e Atrasos</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh]">
            <div className="p-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">RELATÓRIO DE FALTAS E ATRASOS</h2>
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
                    <TableHead>Faltas</TableHead>
                    <TableHead>Atrasos</TableHead>
                    <TableHead>Incompletos</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absenceData.map((emp) => (
                    <TableRow key={emp.profileId}>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.absenceDays}</TableCell>
                      <TableCell>{emp.lateDays}</TableCell>
                      <TableCell>{emp.incompleteRecords}</TableCell>
                      <TableCell className="font-bold">
                        {emp.absenceDays + emp.lateDays + emp.incompleteRecords}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="flex justify-between font-bold">
                <span>TOTAIS:</span>
                <span>Faltas: {totals.absences}</span>
                <span>Atrasos: {totals.lates}</span>
                <span>Incompletos: {totals.incompletes}</span>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
