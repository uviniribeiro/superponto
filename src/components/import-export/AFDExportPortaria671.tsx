import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Download, FileText, Building2, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parse, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CompanySettings {
  id: string;
  company_name: string;
  cnpj: string | null;
  cei: string | null;
  rep_number: string | null;
  rep_manufacturer: string | null;
  rep_model: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  pis: string | null;
  cpf: string | null;
  registration_number: string | null;
}

interface TimeRecord {
  id: string;
  profile_id: string;
  recorded_at: string;
  record_type: string;
  nsr: number;
}

export default function AFDExportPortaria671() {
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [repType, setRepType] = useState<'REP-C' | 'REP-A' | 'REP-P'>('REP-C');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [settingsResult, profilesResult] = await Promise.all([
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase.from('profiles').select('id, full_name, pis, cpf, registration_number').eq('is_active', true).order('full_name')
    ]);

    setCompanySettings(settingsResult.data);
    setProfiles(profilesResult.data || []);
  };

  const toggleProfileSelection = (profileId: string) => {
    setSelectedProfiles(prev =>
      prev.includes(profileId)
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const padLeft = (value: string | number, length: number, char: string = '0'): string => {
    return String(value).padStart(length, char);
  };

  const padRight = (value: string, length: number, char: string = ' '): string => {
    return value.slice(0, length).padEnd(length, char);
  };

  const formatDateAFD = (date: Date): string => {
    return format(date, 'ddMMyyyy');
  };

  const formatTimeAFD = (date: Date): string => {
    return format(date, 'HHmm');
  };

  const cleanCNPJ = (cnpj: string | null): string => {
    if (!cnpj) return ''.padStart(14, '0');
    return cnpj.replace(/\D/g, '').padStart(14, '0');
  };

  const cleanPIS = (pis: string | null): string => {
    if (!pis) return ''.padStart(11, '0');
    return pis.replace(/\D/g, '').padStart(11, '0');
  };

  const generateAFDPortaria671 = async () => {
    if (!companySettings) {
      toast.error('Configurações da empresa não encontradas');
      return;
    }

    const profilesToExport = selectedProfiles.length > 0
      ? profiles.filter(p => selectedProfiles.includes(p.id))
      : profiles;

    if (profilesToExport.length === 0) {
      toast.error('Nenhum funcionário selecionado');
      return;
    }

    setLoading(true);

    try {
      // Fetch time records for selected profiles and date range
      const { data: timeRecords, error } = await supabase
        .from('time_records')
        .select('*')
        .in('profile_id', profilesToExport.map(p => p.id))
        .gte('recorded_at', `${startDate}T00:00:00`)
        .lte('recorded_at', `${endDate}T23:59:59`)
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      const lines: string[] = [];
      const now = new Date();
      let sequenceNumber = 1;

      // ========== TIPO 1 - CABEÇALHO ==========
      // Layout Portaria 671 (igual à 1510 para compatibilidade)
      const header = [
        '1',                                                    // Tipo de registro
        '1',                                                    // Tipo de identificador do empregador (1=CNPJ)
        cleanCNPJ(companySettings.cnpj),                       // CNPJ (14 posições)
        padRight(companySettings.cei || '', 12),               // CEI (12 posições)
        padRight(companySettings.company_name || '', 150),     // Razão social (150 posições)
        padLeft(companySettings.rep_number || '0', 17),        // Número de fabricação do REP (17 posições)
        formatDateAFD(parse(startDate, 'yyyy-MM-dd', new Date())), // Data início (8 posições)
        formatDateAFD(parse(endDate, 'yyyy-MM-dd', new Date())),   // Data fim (8 posições)
        formatDateAFD(now),                                    // Data de geração (8 posições)
        formatTimeAFD(now),                                    // Hora de geração (4 posições)
      ].join('');
      lines.push(header);

      // ========== TIPO 2 - INCLUSÃO/ALTERAÇÃO DE EMPREGADO ==========
      for (const profile of profilesToExport) {
        sequenceNumber++;
        const employeeRecord = [
          '2',                                                  // Tipo de registro
          padLeft(sequenceNumber, 9),                          // NSR (9 posições)
          'I',                                                  // Tipo de operação (I=Inclusão)
          '1',                                                  // Tipo de identificador (1=PIS)
          cleanPIS(profile.pis),                               // PIS (11 posições)
          padRight(profile.full_name || '', 52),               // Nome do trabalhador (52 posições)
        ].join('');
        lines.push(employeeRecord);
      }

      // ========== TIPO 3 - MARCAÇÃO DE PONTO ==========
      const profileMap = new Map(profilesToExport.map(p => [p.id, p]));

      for (const record of timeRecords || []) {
        const profile = profileMap.get(record.profile_id);
        if (!profile) continue;

        sequenceNumber++;
        const recordedAt = new Date(record.recorded_at);
        
        const pointRecord = [
          '3',                                                  // Tipo de registro
          padLeft(sequenceNumber, 9),                          // NSR (9 posições)
          '1',                                                  // Tipo de identificação (1=PIS)
          cleanPIS(profile.pis),                               // PIS (11 posições)
          formatDateAFD(recordedAt),                           // Data (8 posições)
          formatTimeAFD(recordedAt),                           // Hora (4 posições)
        ].join('');
        lines.push(pointRecord);
      }

      // ========== TIPO 9 - TRAILER ==========
      const trailer = [
        '9',                                                    // Tipo de registro
        padLeft(lines.length + 1, 9),                          // Total de registros no arquivo
      ].join('');
      lines.push(trailer);

      // Generate file
      const content = lines.join('\r\n');
      const filename = `AFD_${repType}_${format(now, 'yyyyMMdd_HHmmss')}.txt`;

      // Download file
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`AFD Portaria 671 gerado com sucesso! ${timeRecords?.length || 0} marcações exportadas.`);
    } catch (error) {
      console.error('Error generating AFD:', error);
      toast.error('Erro ao gerar arquivo AFD');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Exportação AFD - Portaria 671/2021
        </CardTitle>
        <CardDescription>
          Gerar arquivo AFD (Arquivo-Fonte de Dados) conforme Portaria 671/2021 do MTE para fins de fiscalização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Company Info */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-5 w-5 text-primary" />
            <h4 className="font-semibold">Dados do Empregador</h4>
          </div>
          <div className="grid gap-2 md:grid-cols-3 text-sm">
            <div>
              <span className="text-muted-foreground">Razão Social:</span>
              <span className="ml-2">{companySettings?.company_name || 'Não configurado'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CNPJ:</span>
              <span className="ml-2 font-mono">{companySettings?.cnpj || 'Não configurado'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">REP:</span>
              <span className="ml-2 font-mono">{companySettings?.rep_number || 'Não configurado'}</span>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Tipo de REP</Label>
            <Select value={repType} onValueChange={(v) => setRepType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REP-C">REP-C (Convencional)</SelectItem>
                <SelectItem value="REP-A">REP-A (Alternativo)</SelectItem>
                <SelectItem value="REP-P">REP-P (Programa)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={generateAFDPortaria671}
              disabled={loading}
              className="w-full gradient-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Gerar AFD
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Employee Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Selecionar Funcionários</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="selectAll"
                checked={selectAll || selectedProfiles.length === profiles.length}
                onCheckedChange={(checked) => {
                  setSelectAll(!!checked);
                  setSelectedProfiles(checked ? profiles.map(p => p.id) : []);
                }}
              />
              <Label htmlFor="selectAll" className="text-sm cursor-pointer">
                Selecionar Todos
              </Label>
              <Badge variant="secondary" className="ml-2">
                {selectedProfiles.length > 0 ? selectedProfiles.length : 'Todos'} funcionários
              </Badge>
            </div>
          </div>

          <div className="max-h-48 overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>PIS</TableHead>
                  <TableHead>Matrícula</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map(profile => (
                  <TableRow
                    key={profile.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleProfileSelection(profile.id)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedProfiles.includes(profile.id)}
                        onCheckedChange={() => toggleProfileSelection(profile.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{profile.full_name}</TableCell>
                    <TableCell className="font-mono">{profile.pis || '-'}</TableCell>
                    <TableCell className="font-mono">{profile.registration_number || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Information */}
        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/50">
          <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
            Sobre o AFD - Portaria 671/2021
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>O arquivo AFD é obrigatório para fiscalização do MTE (Ministério do Trabalho)</li>
            <li>Contém registros tipo 1 (cabeçalho), tipo 2 (funcionários), tipo 3 (marcações) e tipo 9 (trailer)</li>
            <li>Compatível com REP-C (Convencional), REP-A (Alternativo) e REP-P (Programa)</li>
            <li>O arquivo deve ser mantido disponível por 5 anos para fiscalização</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
