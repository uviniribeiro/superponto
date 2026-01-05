import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  nsr: number;
  profiles?: {
    full_name: string;
    pis?: string | null;
    registration_number?: string | null;
  };
}

interface CompanySettings {
  company_name: string;
  cnpj?: string | null;
  cei?: string | null;
  rep_number?: string | null;
}

interface MTEExportsProps {
  records: TimeRecord[];
  companySettings: CompanySettings | null;
  startDate: string;
  endDate: string;
}

export function MTEExports({ records, companySettings, startDate, endDate }: MTEExportsProps) {
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateAFD = () => {
    if (records.length === 0) {
      toast.error('Nenhum registro para exportar');
      return;
    }

    const lines: string[] = [];
    const cleanCnpj = (companySettings?.cnpj || '').replace(/[^\d]/g, '').padStart(14, '0');
    const cleanCei = (companySettings?.cei || '').replace(/[^\d]/g, '').padStart(12, '0');
    
    // Linha 1 - Cabeçalho (Tipo 1)
    const header = [
      '1',
      '1',
      cleanCnpj,
      cleanCei,
      (companySettings?.company_name || 'EMPRESA').padEnd(150, ' ').slice(0, 150),
      (companySettings?.rep_number || '').padStart(17, '0'),
      format(new Date(startDate), 'ddMMyyyy'),
      format(new Date(endDate), 'ddMMyyyy'),
      format(new Date(), 'ddMMyyyyHHmmss'),
    ].join('');
    lines.push(header);

    // Registros de marcação (Tipo 3)
    records.forEach((record) => {
      const identifier = record.profiles?.registration_number || 
                        record.profiles?.pis || 
                        '00000000000';
      
      const recordLine = [
        '3',
        String(record.nsr).padStart(9, '0'),
        '1',
        identifier.replace(/[^\d]/g, '').padStart(11, '0'),
        format(new Date(record.recorded_at), 'ddMMyyyy'),
        format(new Date(record.recorded_at), 'HHmm'),
      ].join('');
      lines.push(recordLine);
    });

    // Trailer (Tipo 9)
    const trailer = [
      '9',
      String(lines.length + 1).padStart(9, '0'),
    ].join('');
    lines.push(trailer);

    downloadFile(lines.join('\r\n'), `AFD_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`);
    toast.success('AFD gerado conforme Portaria 671!');
  };

  const generateAFDT = () => {
    if (records.length === 0) {
      toast.error('Nenhum registro para exportar');
      return;
    }

    const lines: string[] = [];
    const cleanCnpj = (companySettings?.cnpj || '').replace(/[^\d]/g, '').padStart(14, '0');
    const cleanCei = (companySettings?.cei || '').replace(/[^\d]/g, '').padStart(12, '0');
    
    // Cabeçalho AFDT (Tipo 1)
    const header = [
      '1',
      '1',
      cleanCnpj,
      cleanCei,
      (companySettings?.company_name || 'EMPRESA').padEnd(150, ' ').slice(0, 150),
      format(new Date(startDate), 'ddMMyyyy'),
      format(new Date(endDate), 'ddMMyyyy'),
      format(new Date(), 'ddMMyyyyHHmmss'),
    ].join('');
    lines.push(header);

    // Registros AFDT (Tipo 4)
    records.forEach((record, index) => {
      const recordTypeCode = {
        'entry': '1',
        'break_start': '2',
        'break_end': '3',
        'exit': '4'
      }[record.record_type] || '1';

      const identifier = record.profiles?.registration_number || 
                        record.profiles?.pis || 
                        '00000000000';

      const recordLine = [
        '4',
        String(index + 1).padStart(9, '0'),
        format(new Date(record.recorded_at), 'ddMMyyyy'),
        format(new Date(record.recorded_at), 'HHmm'),
        identifier.replace(/[^\d]/g, '').padStart(11, '0'),
        (record.profiles?.full_name || 'N/A').toUpperCase().padEnd(52, ' ').slice(0, 52),
        recordTypeCode,
      ].join('');
      lines.push(recordLine);
    });

    // Trailer (Tipo 9)
    const trailer = [
      '9',
      String(lines.length + 1).padStart(9, '0'),
    ].join('');
    lines.push(trailer);

    downloadFile(lines.join('\r\n'), `AFDT_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`);
    toast.success('AFDT gerado conforme Portaria 671!');
  };

  const generateACJEF = () => {
    if (records.length === 0) {
      toast.error('Nenhum registro para exportar');
      return;
    }

    const lines: string[] = [];
    const cleanCnpj = (companySettings?.cnpj || '').replace(/[^\d]/g, '').padStart(14, '0');
    const cleanCei = (companySettings?.cei || '').replace(/[^\d]/g, '').padStart(12, '0');

    // Cabeçalho ACJEF (Tipo 1)
    const header = [
      '1',
      '1',
      cleanCnpj,
      cleanCei,
      (companySettings?.company_name || 'EMPRESA').padEnd(150, ' ').slice(0, 150),
      format(new Date(startDate), 'ddMMyyyy'),
      format(new Date(endDate), 'ddMMyyyy'),
      format(new Date(), 'ddMMyyyyHHmmss'),
    ].join('');
    lines.push(header);

    // Agrupa por funcionário e data para calcular jornada
    const employeeGroups = new Map<string, Map<string, typeof records>>();
    records.forEach(record => {
      const empId = record.profile_id;
      const dateKey = format(new Date(record.recorded_at), 'yyyy-MM-dd');
      
      if (!employeeGroups.has(empId)) {
        employeeGroups.set(empId, new Map());
      }
      if (!employeeGroups.get(empId)!.has(dateKey)) {
        employeeGroups.get(empId)!.set(dateKey, []);
      }
      employeeGroups.get(empId)!.get(dateKey)!.push(record);
    });

    let seq = 1;
    employeeGroups.forEach((dates, empId) => {
      dates.forEach((dayRecords, dateKey) => {
        const entry = dayRecords.find(r => r.record_type === 'entry');
        const exit = dayRecords.find(r => r.record_type === 'exit');
        
        if (entry && exit) {
          const identifier = entry.profiles?.registration_number || 
                            entry.profiles?.pis || 
                            '00000000000';

          const entryTime = new Date(entry.recorded_at);
          const exitTime = new Date(exit.recorded_at);
          const workedMinutes = Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000);
          const workedHours = Math.floor(workedMinutes / 60);
          const workedMins = workedMinutes % 60;

          const recordLine = [
            '5', // Tipo 5 - Registro de jornada
            String(seq++).padStart(9, '0'),
            identifier.replace(/[^\d]/g, '').padStart(11, '0'),
            (entry.profiles?.full_name || 'N/A').toUpperCase().padEnd(52, ' ').slice(0, 52),
            format(entryTime, 'ddMMyyyy'),
            format(entryTime, 'HHmm'),
            format(exitTime, 'HHmm'),
            String(workedHours).padStart(2, '0') + String(workedMins).padStart(2, '0'),
            '0000', // Horas extras
            '0000', // Horas noturnas
          ].join('');
          lines.push(recordLine);
        }
      });
    });

    // Trailer (Tipo 9)
    const trailer = [
      '9',
      String(lines.length + 1).padStart(9, '0'),
    ].join('');
    lines.push(trailer);

    downloadFile(lines.join('\r\n'), `ACJEF_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`);
    toast.success('ACJEF gerado conforme Portaria 671!');
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={generateAFD}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            AFD
          </CardTitle>
          <CardDescription>
            Arquivo Fonte de Dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Arquivo com todos os registros de ponto brutos conforme exigido pelo MTE.
          </p>
          <Button className="w-full" variant="outline" disabled={records.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Gerar AFD
          </Button>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={generateAFDT}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-500" />
            AFDT
          </CardTitle>
          <CardDescription>
            Arquivo Fonte de Dados Tratados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Registros tratados com identificação completa do funcionário.
          </p>
          <Button className="w-full" variant="outline" disabled={records.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Gerar AFDT
          </Button>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={generateACJEF}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            ACJEF
          </CardTitle>
          <CardDescription>
            Arquivo de Controle de Jornada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Resumo de jornada diária para efeitos fiscais.
          </p>
          <Button className="w-full" variant="outline" disabled={records.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Gerar ACJEF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
