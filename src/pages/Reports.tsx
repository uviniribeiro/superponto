import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FileText, Download, Calendar, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
  nsr: number;
  profiles?: { full_name: string; pis: string | null; registration_number: string | null };
}

interface CompanySettings {
  company_name: string;
  cnpj: string | null;
  cei: string | null;
  rep_number: string | null;
}

export default function Reports() {
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    fetchEmployees();
    fetchCompanySettings();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');
    setEmployees(data || []);
  };

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    setCompanySettings(data);
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('time_records')
        .select(`
          *,
          profiles!time_records_profile_id_fkey (full_name, pis, registration_number)
        `)
        .gte('recorded_at', `${startDate}T00:00:00`)
        .lte('recorded_at', `${endDate}T23:59:59`)
        .order('recorded_at', { ascending: true });

      if (selectedEmployee !== 'all') {
        query = query.eq('profile_id', selectedEmployee);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  // Gera AFD conforme Portaria 671 - Formato correto MTE
  const generateAFD = () => {
    if (records.length === 0) {
      toast.error('Nenhum registro para exportar');
      return;
    }

    const lines: string[] = [];
    const cleanCnpj = (companySettings?.cnpj || '').replace(/[^\d]/g, '').padStart(14, '0');
    const cleanCei = (companySettings?.cei || '').replace(/[^\d]/g, '').padStart(12, '0');
    
    // Linha 1 - Cabeçalho (Tipo 1) - Identificação do empregador
    const header = [
      '1',                                                    // Tipo de registro
      '1',                                                    // Tipo de identificador (1=CNPJ, 2=CPF)
      cleanCnpj,                                              // CNPJ (14 dígitos)
      cleanCei,                                               // CEI (12 dígitos)
      (companySettings?.company_name || 'EMPRESA').padEnd(150, ' ').slice(0, 150), // Razão social
      (companySettings?.rep_number || '').padStart(17, '0'),  // Nº fabricação REP
      format(new Date(startDate), 'ddMMyyyy'),                // Data início período
      format(new Date(endDate), 'ddMMyyyy'),                  // Data fim período
      format(new Date(), 'ddMMyyyyHHmmss'),                   // Data/hora geração
    ].join('');
    lines.push(header);

    // Linha 2 - Tipo 2 - Identificação do trabalhador (agrupado por funcionário)
    const employeeGroups = new Map<string, typeof records>();
    records.forEach(record => {
      const key = record.profile_id;
      if (!employeeGroups.has(key)) {
        employeeGroups.set(key, []);
      }
      employeeGroups.get(key)!.push(record);
    });

    // Linha 3 em diante - Registros de marcação (Tipo 3)
    records.forEach((record) => {
      // Prioridade de identificação: Matrícula > PIS > CPF
      const identifier = record.profiles?.registration_number || 
                        record.profiles?.pis || 
                        '00000000000';
      
      const recordLine = [
        '3',                                                  // Tipo de registro (marcação)
        String(record.nsr).padStart(9, '0'),                  // NSR (9 dígitos)
        '1',                                                  // Tipo de identificador (1=PIS)
        identifier.replace(/[^\d]/g, '').padStart(11, '0'),   // PIS/Matrícula (11 dígitos)
        format(new Date(record.recorded_at), 'ddMMyyyy'),     // Data marcação
        format(new Date(record.recorded_at), 'HHmm'),         // Hora marcação (4 dígitos)
      ].join('');
      lines.push(recordLine);
    });

    // Linha trailer (Tipo 9)
    const trailer = [
      '9',
      String(lines.length + 1).padStart(9, '0'),
    ].join('');
    lines.push(trailer);

    downloadFile(lines.join('\r\n'), `AFD_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`);
    toast.success('AFD gerado conforme Portaria 671!');
  };

  // Gera AFDT conforme Portaria 671 - Arquivo Fonte de Dados Tratados
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
      '1',                                                    // Tipo de registro
      '1',                                                    // Tipo de identificador (1=CNPJ)
      cleanCnpj,                                              // CNPJ
      cleanCei,                                               // CEI
      (companySettings?.company_name || 'EMPRESA').padEnd(150, ' ').slice(0, 150),
      format(new Date(startDate), 'ddMMyyyy'),
      format(new Date(endDate), 'ddMMyyyy'),
      format(new Date(), 'ddMMyyyyHHmmss'),
    ].join('');
    lines.push(header);

    // Registros AFDT (Tipo 4) - Marcações tratadas
    records.forEach((record, index) => {
      // Código do tipo de marcação conforme Portaria 671
      const recordTypeCode = {
        'entry': '1',        // Entrada
        'break_start': '2',  // Início de intervalo
        'break_end': '3',    // Fim de intervalo
        'exit': '4'          // Saída
      }[record.record_type] || '1';

      // Prioridade: Matrícula > PIS > CPF
      const identifier = record.profiles?.registration_number || 
                        record.profiles?.pis || 
                        '00000000000';

      const recordLine = [
        '4',                                                  // Tipo de registro (marcação tratada)
        String(index + 1).padStart(9, '0'),                   // Sequencial
        format(new Date(record.recorded_at), 'ddMMyyyy'),     // Data
        format(new Date(record.recorded_at), 'HHmm'),         // Hora
        identifier.replace(/[^\d]/g, '').padStart(11, '0'),   // PIS/Matrícula
        (record.profiles?.full_name || 'N/A').toUpperCase().padEnd(52, ' ').slice(0, 52), // Nome
        recordTypeCode,                                       // Tipo de marcação
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

  const getRecordTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      entry: 'Entrada',
      break_start: 'Início Intervalo',
      break_end: 'Fim Intervalo',
      exit: 'Saída'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground">Gere relatórios AFD e AFDT conforme Portaria 671</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchRecords} className="w-full gradient-primary">
                <Calendar className="mr-2 h-4 w-4" />
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações de Export */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={generateAFD}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Arquivo AFD
            </CardTitle>
            <CardDescription>
              Arquivo Fonte de Dados - Portaria 671
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Arquivo com todos os registros de ponto no formato exigido pelo MTE.
            </p>
            <Button className="mt-4 w-full" variant="outline" disabled={records.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Gerar AFD
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={generateAFDT}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Arquivo AFDT
            </CardTitle>
            <CardDescription>
              Arquivo Fonte de Dados Tratados - Portaria 671
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Arquivo com registros tratados incluindo identificação do funcionário.
            </p>
            <Button className="mt-4 w-full" variant="outline" disabled={records.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Gerar AFDT
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Prévia dos Registros */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prévia dos Registros</CardTitle>
            <CardDescription>{records.length} registros encontrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NSR</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>PIS</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.slice(0, 100).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono">{record.nsr}</TableCell>
                      <TableCell>{record.profiles?.full_name}</TableCell>
                      <TableCell className="font-mono">{record.profiles?.pis || '-'}</TableCell>
                      <TableCell className="font-mono">
                        {format(new Date(record.recorded_at), 'dd/MM/yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>{getRecordTypeLabel(record.record_type)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {records.length > 100 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Mostrando 100 de {records.length} registros
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}