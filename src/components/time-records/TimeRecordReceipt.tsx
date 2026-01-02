import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Download, Printer, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface TimeRecordReceiptProps {
  record: {
    id: string;
    nsr: number;
    recorded_at: string;
    record_type: string;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
  };
  employee: {
    full_name: string;
    pis?: string | null;
    cpf?: string | null;
    registration_number?: string | null;
  };
  company: {
    company_name: string;
    cnpj?: string | null;
    address?: string | null;
  };
  onClose?: () => void;
}

const recordTypeLabels: Record<string, string> = {
  entry: 'ENTRADA',
  break_start: 'INÍCIO INTERVALO',
  break_end: 'FIM INTERVALO',
  exit: 'SAÍDA'
};

export default function TimeRecordReceipt({ record, employee, company, onClose }: TimeRecordReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatDocument = (doc: string | null | undefined, type: 'cpf' | 'pis' | 'cnpj') => {
    if (!doc) return 'N/A';
    const clean = doc.replace(/[^\d]/g, '');
    
    if (type === 'cpf' && clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (type === 'pis' && clean.length === 11) {
      return clean.replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, '$1.$2.$3-$4');
    }
    if (type === 'cnpj' && clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  const generatePDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 150] // Formato de cupom térmico
    });

    const margin = 5;
    let y = 10;

    // Título
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROVANTE DE REGISTRO DE PONTO', 40, y, { align: 'center' });
    y += 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Portaria 671/2021 - MTE', 40, y, { align: 'center' });
    y += 6;

    // Linha separadora
    doc.setLineWidth(0.3);
    doc.line(margin, y, 80 - margin, y);
    y += 5;

    // Empresa
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPREGADOR', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(company.company_name || 'N/A', margin, y);
    y += 3;
    doc.text(`CNPJ: ${formatDocument(company.cnpj, 'cnpj')}`, margin, y);
    y += 6;

    // Funcionário
    doc.setFont('helvetica', 'bold');
    doc.text('TRABALHADOR', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(employee.full_name || 'N/A', margin, y);
    y += 3;
    doc.text(`PIS: ${formatDocument(employee.pis, 'pis')}`, margin, y);
    y += 3;
    if (employee.registration_number) {
      doc.text(`Matrícula: ${employee.registration_number}`, margin, y);
      y += 3;
    }
    y += 3;

    // Linha separadora
    doc.line(margin, y, 80 - margin, y);
    y += 5;

    // Dados do registro
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const recordDate = new Date(record.recorded_at);
    doc.text(format(recordDate, 'dd/MM/yyyy', { locale: ptBR }), 40, y, { align: 'center' });
    y += 5;
    doc.setFontSize(14);
    doc.text(format(recordDate, 'HH:mm:ss', { locale: ptBR }), 40, y, { align: 'center' });
    y += 6;

    doc.setFontSize(9);
    doc.text(recordTypeLabels[record.record_type] || record.record_type, 40, y, { align: 'center' });
    y += 6;

    // NSR
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`NSR: ${String(record.nsr).padStart(9, '0')}`, 40, y, { align: 'center' });
    y += 6;

    // Linha separadora
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    // Localização (se disponível)
    if (record.address || (record.latitude && record.longitude)) {
      doc.setFontSize(7);
      doc.text('LOCALIZAÇÃO:', margin, y);
      y += 3;
      if (record.address) {
        const addressLines = doc.splitTextToSize(record.address, 70);
        addressLines.forEach((line: string) => {
          doc.text(line, margin, y);
          y += 3;
        });
      }
      if (record.latitude && record.longitude) {
        doc.text(`Lat: ${record.latitude.toFixed(6)} / Lon: ${record.longitude.toFixed(6)}`, margin, y);
        y += 3;
      }
      y += 3;
    }

    // Rodapé
    doc.setFontSize(6);
    doc.text('Este comprovante atende às exigências da', 40, y, { align: 'center' });
    y += 3;
    doc.text('Portaria 671/2021 do Ministério do Trabalho', 40, y, { align: 'center' });
    y += 3;
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`, 40, y, { align: 'center' });

    // Salvar
    doc.save(`comprovante_ponto_${record.nsr}_${format(recordDate, 'yyyyMMdd_HHmmss')}.pdf`);
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Comprovante de Registro de Ponto</title>
              <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; }
                .header { text-align: center; margin-bottom: 10px; }
                .title { font-weight: bold; font-size: 14px; }
                .subtitle { font-size: 10px; color: #666; }
                .separator { border-top: 1px dashed #000; margin: 10px 0; }
                .section-title { font-weight: bold; margin-top: 10px; }
                .time { font-size: 24px; font-weight: bold; text-align: center; margin: 10px 0; }
                .record-type { font-size: 16px; text-align: center; font-weight: bold; }
                .nsr { text-align: center; margin: 10px 0; }
                .footer { font-size: 10px; text-align: center; margin-top: 15px; color: #666; }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="title">COMPROVANTE DE REGISTRO DE PONTO</div>
                <div class="subtitle">Portaria 671/2021 - MTE</div>
              </div>
              <div class="separator"></div>
              <div class="section-title">EMPREGADOR</div>
              <div>${company.company_name || 'N/A'}</div>
              <div>CNPJ: ${formatDocument(company.cnpj, 'cnpj')}</div>
              <div class="section-title">TRABALHADOR</div>
              <div>${employee.full_name || 'N/A'}</div>
              <div>PIS: ${formatDocument(employee.pis, 'pis')}</div>
              ${employee.registration_number ? `<div>Matrícula: ${employee.registration_number}</div>` : ''}
              <div class="separator"></div>
              <div style="text-align: center; font-weight: bold;">${format(new Date(record.recorded_at), 'dd/MM/yyyy', { locale: ptBR })}</div>
              <div class="time">${format(new Date(record.recorded_at), 'HH:mm:ss', { locale: ptBR })}</div>
              <div class="record-type">${recordTypeLabels[record.record_type] || record.record_type}</div>
              <div class="nsr">NSR: ${String(record.nsr).padStart(9, '0')}</div>
              <div class="separator"></div>
              ${record.address ? `<div><strong>Localização:</strong><br/>${record.address}</div>` : ''}
              <div class="footer">
                Este comprovante atende às exigências da<br/>
                Portaria 671/2021 do Ministério do Trabalho<br/>
                Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <Card className="max-w-sm mx-auto" ref={receiptRef}>
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Comprovante de Registro</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Portaria 671/2021 - MTE</p>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-4">
        {/* Empresa */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground">EMPREGADOR</p>
          <p className="font-medium">{company.company_name}</p>
          <p className="text-sm">CNPJ: {formatDocument(company.cnpj, 'cnpj')}</p>
        </div>

        {/* Funcionário */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground">TRABALHADOR</p>
          <p className="font-medium">{employee.full_name}</p>
          <p className="text-sm">PIS: {formatDocument(employee.pis, 'pis')}</p>
          {employee.registration_number && (
            <p className="text-sm">Matrícula: {employee.registration_number}</p>
          )}
        </div>

        <Separator />

        {/* Registro */}
        <div className="text-center py-2">
          <p className="text-lg font-bold">
            {format(new Date(record.recorded_at), 'dd/MM/yyyy', { locale: ptBR })}
          </p>
          <p className="text-3xl font-bold text-primary">
            {format(new Date(record.recorded_at), 'HH:mm:ss', { locale: ptBR })}
          </p>
          <p className="text-lg font-semibold mt-1">
            {recordTypeLabels[record.record_type] || record.record_type}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            NSR: {String(record.nsr).padStart(9, '0')}
          </p>
        </div>

        <Separator />

        {/* Localização */}
        {record.address && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">LOCALIZAÇÃO</p>
            <p className="text-sm">{record.address}</p>
          </div>
        )}

        {/* Rodapé */}
        <div className="text-center text-xs text-muted-foreground pt-2">
          <p>Este comprovante atende às exigências da</p>
          <p>Portaria 671/2021 do Ministério do Trabalho</p>
          <p className="mt-1">
            Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
          </p>
        </div>

        {/* Botões */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={generatePDF} className="flex-1 gradient-primary">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>

        {onClose && (
          <Button variant="ghost" onClick={onClose} className="w-full mt-2">
            Fechar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
