import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Wallet, Download, Eye, Printer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TimeBankEntry {
  profile_id: string;
  profiles?: {
    full_name: string;
    department?: string | null;
  };
  balance_minutes: number;
  credit_minutes: number;
  debit_minutes: number;
}

interface CompanySettings {
  company_name: string;
  cnpj?: string | null;
}

interface TimeBankReportProps {
  entries: TimeBankEntry[];
  companySettings: CompanySettings | null;
  startDate: string;
  endDate: string;
}

export function TimeBankReport({ entries, companySettings, startDate, endDate }: TimeBankReportProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '+';
    return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const getTotals = () => {
    return entries.reduce((acc, entry) => ({
      totalCredit: acc.totalCredit + entry.credit_minutes,
      totalDebit: acc.totalDebit + entry.debit_minutes,
      totalBalance: acc.totalBalance + entry.balance_minutes,
    }), { totalCredit: 0, totalDebit: 0, totalBalance: 0 });
  };

  const totals = getTotals();
  const positiveCount = entries.filter(e => e.balance_minutes > 0).length;
  const negativeCount = entries.filter(e => e.balance_minutes < 0).length;

  const generatePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('RELATÓRIO DE BANCO DE HORAS', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}`, 105, 22, { align: 'center' });

    doc.text(`Empresa: ${companySettings?.company_name || ''}`, 14, 35);
    doc.text(`CNPJ: ${companySettings?.cnpj || ''}`, 14, 41);

    const tableData = entries.map(entry => [
      entry.profiles?.full_name || 'N/A',
      entry.profiles?.department || 'N/A',
      formatMinutes(entry.credit_minutes),
      formatMinutes(-entry.debit_minutes),
      formatMinutes(entry.balance_minutes),
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Funcionário', 'Departamento', 'Crédito', 'Débito', 'Saldo']],
      body: tableData,
      foot: [[
        'TOTAL',
        '',
        formatMinutes(totals.totalCredit),
        formatMinutes(-totals.totalDebit),
        formatMinutes(totals.totalBalance),
      ]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [124, 58, 237] },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    doc.setFontSize(8);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 105, 285, { align: 'center' });

    doc.save(`Relatorio_Banco_Horas_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-500" />
            Relatório de Banco de Horas
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

          <div className="grid grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Total Crédito</span>
                </div>
                <p className="text-xl font-bold text-green-600">{formatMinutes(totals.totalCredit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Total Débito</span>
                </div>
                <p className="text-xl font-bold text-red-600">{formatMinutes(-totals.totalDebit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Saldo Positivo</span>
                </div>
                <p className="text-xl font-bold">{positiveCount} func.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Saldo Negativo</span>
                </div>
                <p className="text-xl font-bold">{negativeCount} func.</p>
              </CardContent>
            </Card>
          </div>

          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro de banco de horas no período
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Crédito</TableHead>
                  <TableHead>Débito</TableHead>
                  <TableHead>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{entry.profiles?.full_name || 'N/A'}</TableCell>
                    <TableCell>{entry.profiles?.department || 'N/A'}</TableCell>
                    <TableCell className="text-green-600">{formatMinutes(entry.credit_minutes)}</TableCell>
                    <TableCell className="text-red-600">{formatMinutes(-entry.debit_minutes)}</TableCell>
                    <TableCell className={entry.balance_minutes >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                      {formatMinutes(entry.balance_minutes)}
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
            <DialogTitle>Prévia - Relatório de Banco de Horas</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh]">
            <div className="p-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">RELATÓRIO DE BANCO DE HORAS</h2>
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
                    <TableHead>Crédito</TableHead>
                    <TableHead>Débito</TableHead>
                    <TableHead>Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{entry.profiles?.full_name || 'N/A'}</TableCell>
                      <TableCell>{entry.profiles?.department || 'N/A'}</TableCell>
                      <TableCell>{formatMinutes(entry.credit_minutes)}</TableCell>
                      <TableCell>{formatMinutes(-entry.debit_minutes)}</TableCell>
                      <TableCell className="font-bold">{formatMinutes(entry.balance_minutes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="flex justify-between font-bold">
                <span>TOTAIS:</span>
                <span className="text-green-600">Crédito: {formatMinutes(totals.totalCredit)}</span>
                <span className="text-red-600">Débito: {formatMinutes(-totals.totalDebit)}</span>
                <span>Saldo: {formatMinutes(totals.totalBalance)}</span>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
