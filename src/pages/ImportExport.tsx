import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Upload, Download, FileText, Settings, Users, Clock, 
  CheckCircle2, XCircle, AlertTriangle, Save, Trash2,
  ArrowUpDown, FileUp, FileDown
} from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CompanySettings {
  id: string;
  company_name: string;
  rep_number: string | null;
  rep_manufacturer: string | null;
  rep_model: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  pis: string | null;
  cpf: string | null;
  registration_number: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  email: string;
}

interface AFDRecord {
  nsr: number;
  pis: string;
  date: string;
  time: string;
  recordType: string;
  matched: boolean;
  profileId: string | null;
  profileName: string | null;
  error?: string;
  lineNumber?: number;
  portaria?: string;
}

interface AFDParseResult {
  records: AFDRecord[];
  errors: AFDParseError[];
  warnings: string[];
  detectedFormat: string;
  headerInfo: AFDHeader | null;
  trailerInfo: AFDTrailer | null;
  totalLines: number;
  validLines: number;
  invalidLines: number;
}

interface AFDParseError {
  line: number;
  content: string;
  error: string;
  severity: 'error' | 'warning';
  portaria?: string;
}

interface AFDHeader {
  tipoRegistro: string;
  cnpjCpf: string;
  razaoSocial: string;
  repNumero: string;
  dataInicio: string;
  dataFim: string;
  dataGeracao: string;
  horaGeracao: string;
}

interface AFDTrailer {
  tipoRegistro: string;
  totalRegistros: number;
}

interface ExportLayout {
  id: string;
  name: string;
  description: string;
  fields: ExportField[];
  delimiter: string;
  includeHeader: boolean;
  dateFormat: string;
  timeFormat: string;
  encoding: string;
}

interface ExportField {
  id: string;
  name: string;
  source: string;
  position: number;
  length: number;
  padding: 'left' | 'right' | 'none';
  paddingChar: string;
  format?: string;
  enabled: boolean;
}

const defaultFields: ExportField[] = [
  { id: '1', name: 'Matrícula', source: 'registration_number', position: 1, length: 10, padding: 'left', paddingChar: '0', enabled: true },
  { id: '2', name: 'Nome', source: 'full_name', position: 2, length: 50, padding: 'right', paddingChar: ' ', enabled: true },
  { id: '3', name: 'CPF', source: 'cpf', position: 3, length: 11, padding: 'left', paddingChar: '0', enabled: true },
  { id: '4', name: 'PIS', source: 'pis', position: 4, length: 11, padding: 'left', paddingChar: '0', enabled: true },
  { id: '5', name: 'Departamento', source: 'department', position: 5, length: 30, padding: 'right', paddingChar: ' ', enabled: true },
  { id: '6', name: 'Cargo', source: 'position', position: 6, length: 30, padding: 'right', paddingChar: ' ', enabled: true },
  { id: '7', name: 'Data Admissão', source: 'hire_date', position: 7, length: 10, padding: 'none', paddingChar: '', format: 'dd/MM/yyyy', enabled: true },
  { id: '8', name: 'Email', source: 'email', position: 8, length: 50, padding: 'right', paddingChar: ' ', enabled: true },
];

// Layout Gaia
const gaiaLayout: ExportLayout = {
  id: 'gaia',
  name: 'Sistema Gaia',
  description: 'Layout padrão de importação do Sistema Gaia para folha de pagamento',
  fields: [
    { id: '1', name: 'Código Empresa', source: 'company_code', position: 1, length: 5, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Matrícula', source: 'registration_number', position: 2, length: 8, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'Data', source: 'record_date', position: 3, length: 8, padding: 'none', paddingChar: '', format: 'ddMMyyyy', enabled: true },
    { id: '4', name: 'Hora Entrada', source: 'entry_time', position: 4, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '5', name: 'Hora Saída Intervalo', source: 'break_start_time', position: 5, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '6', name: 'Hora Retorno Intervalo', source: 'break_end_time', position: 6, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '7', name: 'Hora Saída', source: 'exit_time', position: 7, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '8', name: 'PIS', source: 'pis', position: 8, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '9', name: 'CPF', source: 'cpf', position: 9, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '10', name: 'Nome', source: 'full_name', position: 10, length: 40, padding: 'right', paddingChar: ' ', enabled: true },
  ],
  delimiter: '',
  includeHeader: false,
  dateFormat: 'ddMMyyyy',
  timeFormat: 'HHmm',
  encoding: 'UTF-8',
};

// Layout Domínio (Thomson Reuters)
const dominioLayout: ExportLayout = {
  id: 'dominio',
  name: 'Domínio Sistemas',
  description: 'Layout de importação para Domínio Contábil/Folha (Thomson Reuters)',
  fields: [
    { id: '1', name: 'Empresa', source: 'company_code', position: 1, length: 4, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Código Funcionário', source: 'registration_number', position: 2, length: 6, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'Data', source: 'record_date', position: 3, length: 10, padding: 'none', paddingChar: '', format: 'dd/MM/yyyy', enabled: true },
    { id: '4', name: 'Entrada 1', source: 'entry_time', position: 4, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '5', name: 'Saída 1', source: 'break_start_time', position: 5, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '6', name: 'Entrada 2', source: 'break_end_time', position: 6, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '7', name: 'Saída 2', source: 'exit_time', position: 7, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
  ],
  delimiter: ';',
  includeHeader: true,
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  encoding: 'UTF-8',
};

// Layout Fortes Pessoal
const fortesLayout: ExportLayout = {
  id: 'fortes',
  name: 'Fortes Pessoal',
  description: 'Layout de importação para Fortes AC Pessoal',
  fields: [
    { id: '1', name: 'PIS', source: 'pis', position: 1, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Data', source: 'record_date', position: 2, length: 8, padding: 'none', paddingChar: '', format: 'ddMMyyyy', enabled: true },
    { id: '3', name: 'Hora 1', source: 'entry_time', position: 3, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '4', name: 'Hora 2', source: 'break_start_time', position: 4, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '5', name: 'Hora 3', source: 'break_end_time', position: 5, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '6', name: 'Hora 4', source: 'exit_time', position: 6, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
  ],
  delimiter: '',
  includeHeader: false,
  dateFormat: 'ddMMyyyy',
  timeFormat: 'HHmm',
  encoding: 'UTF-8',
};

// Layout Senior Sistemas
const seniorLayout: ExportLayout = {
  id: 'senior',
  name: 'Senior Sistemas',
  description: 'Layout de importação para Senior HCM/Rubi',
  fields: [
    { id: '1', name: 'Empresa', source: 'company_code', position: 1, length: 4, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Filial', source: 'branch_code', position: 2, length: 4, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'Matrícula', source: 'registration_number', position: 3, length: 9, padding: 'left', paddingChar: '0', enabled: true },
    { id: '4', name: 'Data', source: 'record_date', position: 4, length: 10, padding: 'none', paddingChar: '', format: 'dd/MM/yyyy', enabled: true },
    { id: '5', name: 'Marcação 1', source: 'entry_time', position: 5, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '6', name: 'Marcação 2', source: 'break_start_time', position: 6, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '7', name: 'Marcação 3', source: 'break_end_time', position: 7, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '8', name: 'Marcação 4', source: 'exit_time', position: 8, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
  ],
  delimiter: ';',
  includeHeader: false,
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  encoding: 'UTF-8',
};

// Layout TOTVS Protheus
const totvsLayout: ExportLayout = {
  id: 'totvs',
  name: 'TOTVS Protheus',
  description: 'Layout de importação para TOTVS Protheus RH',
  fields: [
    { id: '1', name: 'Filial', source: 'branch_code', position: 1, length: 2, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Matrícula', source: 'registration_number', position: 2, length: 6, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'Data', source: 'record_date', position: 3, length: 8, padding: 'none', paddingChar: '', format: 'yyyyMMdd', enabled: true },
    { id: '4', name: 'Hora 1', source: 'entry_time', position: 4, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '5', name: 'Hora 2', source: 'break_start_time', position: 5, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '6', name: 'Hora 3', source: 'break_end_time', position: 6, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '7', name: 'Hora 4', source: 'exit_time', position: 7, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '8', name: 'PIS', source: 'pis', position: 8, length: 11, padding: 'left', paddingChar: '0', enabled: true },
  ],
  delimiter: '',
  includeHeader: false,
  dateFormat: 'yyyyMMdd',
  timeFormat: 'HHmm',
  encoding: 'UTF-8',
};

// Layout ADP
const adpLayout: ExportLayout = {
  id: 'adp',
  name: 'ADP Brasil',
  description: 'Layout de importação para ADP Expert/Celeridade',
  fields: [
    { id: '1', name: 'Código Empresa', source: 'company_code', position: 1, length: 6, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Matrícula', source: 'registration_number', position: 2, length: 10, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'CPF', source: 'cpf', position: 3, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '4', name: 'Data', source: 'record_date', position: 4, length: 10, padding: 'none', paddingChar: '', format: 'dd/MM/yyyy', enabled: true },
    { id: '5', name: 'Entrada', source: 'entry_time', position: 5, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '6', name: 'Saída Almoço', source: 'break_start_time', position: 6, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '7', name: 'Retorno Almoço', source: 'break_end_time', position: 7, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '8', name: 'Saída', source: 'exit_time', position: 8, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
  ],
  delimiter: ';',
  includeHeader: true,
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  encoding: 'UTF-8',
};

// Layout Questor
const questorLayout: ExportLayout = {
  id: 'questor',
  name: 'Questor Sistemas',
  description: 'Layout de importação para Questor Folha',
  fields: [
    { id: '1', name: 'Empresa', source: 'company_code', position: 1, length: 3, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Funcionário', source: 'registration_number', position: 2, length: 5, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'Data', source: 'record_date', position: 3, length: 8, padding: 'none', paddingChar: '', format: 'ddMMyyyy', enabled: true },
    { id: '4', name: 'Batida 1', source: 'entry_time', position: 4, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '5', name: 'Batida 2', source: 'break_start_time', position: 5, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '6', name: 'Batida 3', source: 'break_end_time', position: 6, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '7', name: 'Batida 4', source: 'exit_time', position: 7, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
  ],
  delimiter: '',
  includeHeader: false,
  dateFormat: 'ddMMyyyy',
  timeFormat: 'HHmm',
  encoding: 'UTF-8',
};

// Layout Alterdata
const alterdataLayout: ExportLayout = {
  id: 'alterdata',
  name: 'Alterdata Pack',
  description: 'Layout de importação para Alterdata Departamento Pessoal',
  fields: [
    { id: '1', name: 'Empresa', source: 'company_code', position: 1, length: 4, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Matrícula', source: 'registration_number', position: 2, length: 6, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'PIS', source: 'pis', position: 3, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '4', name: 'Data', source: 'record_date', position: 4, length: 10, padding: 'none', paddingChar: '', format: 'dd/MM/yyyy', enabled: true },
    { id: '5', name: 'Hora 1', source: 'entry_time', position: 5, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '6', name: 'Hora 2', source: 'break_start_time', position: 6, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '7', name: 'Hora 3', source: 'break_end_time', position: 7, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '8', name: 'Hora 4', source: 'exit_time', position: 8, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
  ],
  delimiter: ';',
  includeHeader: false,
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  encoding: 'UTF-8',
};

// Layout Sage
const sageLayout: ExportLayout = {
  id: 'sage',
  name: 'Sage Folha',
  description: 'Layout de importação para Sage IOB Folha',
  fields: [
    { id: '1', name: 'CNPJ Empresa', source: 'company_cnpj', position: 1, length: 14, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'CPF', source: 'cpf', position: 2, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'PIS', source: 'pis', position: 3, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '4', name: 'Data', source: 'record_date', position: 4, length: 8, padding: 'none', paddingChar: '', format: 'ddMMyyyy', enabled: true },
    { id: '5', name: 'Entrada', source: 'entry_time', position: 5, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '6', name: 'Intervalo Início', source: 'break_start_time', position: 6, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '7', name: 'Intervalo Fim', source: 'break_end_time', position: 7, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '8', name: 'Saída', source: 'exit_time', position: 8, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
  ],
  delimiter: '',
  includeHeader: false,
  dateFormat: 'ddMMyyyy',
  timeFormat: 'HHmm',
  encoding: 'UTF-8',
};

// Layout Contmatic
const contmaticLayout: ExportLayout = {
  id: 'contmatic',
  name: 'Contmatic Phoenix',
  description: 'Layout de importação para Contmatic Folha Phoenix',
  fields: [
    { id: '1', name: 'Código', source: 'registration_number', position: 1, length: 5, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Data', source: 'record_date', position: 2, length: 8, padding: 'none', paddingChar: '', format: 'ddMMyyyy', enabled: true },
    { id: '3', name: 'Marcação 1', source: 'entry_time', position: 3, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '4', name: 'Marcação 2', source: 'break_start_time', position: 4, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '5', name: 'Marcação 3', source: 'break_end_time', position: 5, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '6', name: 'Marcação 4', source: 'exit_time', position: 6, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
  ],
  delimiter: '',
  includeHeader: false,
  dateFormat: 'ddMMyyyy',
  timeFormat: 'HHmm',
  encoding: 'UTF-8',
};

// Layout Metadados
const metadadosLayout: ExportLayout = {
  id: 'metadados',
  name: 'Metadados RH',
  description: 'Layout de importação para Metadados Sistemas',
  fields: [
    { id: '1', name: 'Empresa', source: 'company_code', position: 1, length: 4, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Matrícula', source: 'registration_number', position: 2, length: 8, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'CPF', source: 'cpf', position: 3, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '4', name: 'Data', source: 'record_date', position: 4, length: 10, padding: 'none', paddingChar: '', format: 'dd/MM/yyyy', enabled: true },
    { id: '5', name: 'Ent 1', source: 'entry_time', position: 5, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '6', name: 'Sai 1', source: 'break_start_time', position: 6, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '7', name: 'Ent 2', source: 'break_end_time', position: 7, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '8', name: 'Sai 2', source: 'exit_time', position: 8, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
  ],
  delimiter: ';',
  includeHeader: true,
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  encoding: 'UTF-8',
};

// Layout FPW (Folha de Pagamento Windows)
const fpwLayout: ExportLayout = {
  id: 'fpw',
  name: 'FPW Folha',
  description: 'Layout de importação para FPW Folha de Pagamento',
  fields: [
    { id: '1', name: 'Matrícula', source: 'registration_number', position: 1, length: 6, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'Nome', source: 'full_name', position: 2, length: 40, padding: 'right', paddingChar: ' ', enabled: true },
    { id: '3', name: 'Data', source: 'record_date', position: 3, length: 8, padding: 'none', paddingChar: '', format: 'ddMMyyyy', enabled: true },
    { id: '4', name: 'H1', source: 'entry_time', position: 4, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '5', name: 'H2', source: 'break_start_time', position: 5, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '6', name: 'H3', source: 'break_end_time', position: 6, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
    { id: '7', name: 'H4', source: 'exit_time', position: 7, length: 4, padding: 'left', paddingChar: '0', format: 'HHmm', enabled: true },
  ],
  delimiter: '',
  includeHeader: false,
  dateFormat: 'ddMMyyyy',
  timeFormat: 'HHmm',
  encoding: 'UTF-8',
};

// Layout eSocial (Formato padrão do governo)
const esocialLayout: ExportLayout = {
  id: 'esocial',
  name: 'eSocial S-1200',
  description: 'Layout compatível com eventos do eSocial para ponto',
  fields: [
    { id: '1', name: 'CPF Trabalhador', source: 'cpf', position: 1, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '2', name: 'NIS (PIS)', source: 'pis', position: 2, length: 11, padding: 'left', paddingChar: '0', enabled: true },
    { id: '3', name: 'Matrícula', source: 'registration_number', position: 3, length: 30, padding: 'right', paddingChar: ' ', enabled: true },
    { id: '4', name: 'Data', source: 'record_date', position: 4, length: 10, padding: 'none', paddingChar: '', format: 'yyyy-MM-dd', enabled: true },
    { id: '5', name: 'Hora Entrada', source: 'entry_time', position: 5, length: 8, padding: 'none', paddingChar: '', format: 'HH:mm:ss', enabled: true },
    { id: '6', name: 'Hora Saída Int.', source: 'break_start_time', position: 6, length: 8, padding: 'none', paddingChar: '', format: 'HH:mm:ss', enabled: true },
    { id: '7', name: 'Hora Retorno Int.', source: 'break_end_time', position: 7, length: 8, padding: 'none', paddingChar: '', format: 'HH:mm:ss', enabled: true },
    { id: '8', name: 'Hora Saída', source: 'exit_time', position: 8, length: 8, padding: 'none', paddingChar: '', format: 'HH:mm:ss', enabled: true },
  ],
  delimiter: ';',
  includeHeader: true,
  dateFormat: 'yyyy-MM-dd',
  timeFormat: 'HH:mm:ss',
  encoding: 'UTF-8',
};

// Layout CSV Genérico
const csvGenericoLayout: ExportLayout = {
  id: 'csv_generico',
  name: 'CSV Genérico',
  description: 'Layout CSV genérico para importação em qualquer sistema',
  fields: [
    { id: '1', name: 'Matrícula', source: 'registration_number', position: 1, length: 20, padding: 'none', paddingChar: '', enabled: true },
    { id: '2', name: 'Nome', source: 'full_name', position: 2, length: 60, padding: 'none', paddingChar: '', enabled: true },
    { id: '3', name: 'CPF', source: 'cpf', position: 3, length: 14, padding: 'none', paddingChar: '', enabled: true },
    { id: '4', name: 'PIS', source: 'pis', position: 4, length: 14, padding: 'none', paddingChar: '', enabled: true },
    { id: '5', name: 'Data', source: 'record_date', position: 5, length: 10, padding: 'none', paddingChar: '', format: 'dd/MM/yyyy', enabled: true },
    { id: '6', name: 'Entrada', source: 'entry_time', position: 6, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '7', name: 'Saída Intervalo', source: 'break_start_time', position: 7, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '8', name: 'Retorno Intervalo', source: 'break_end_time', position: 8, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '9', name: 'Saída', source: 'exit_time', position: 9, length: 5, padding: 'none', paddingChar: '', format: 'HH:mm', enabled: true },
    { id: '10', name: 'Departamento', source: 'department', position: 10, length: 30, padding: 'none', paddingChar: '', enabled: true },
    { id: '11', name: 'Cargo', source: 'position', position: 11, length: 30, padding: 'none', paddingChar: '', enabled: true },
  ],
  delimiter: ';',
  includeHeader: true,
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm',
  encoding: 'UTF-8',
};

// Array com todos os layouts nativos
const nativeLayouts: ExportLayout[] = [
  gaiaLayout,
  dominioLayout,
  fortesLayout,
  seniorLayout,
  totvsLayout,
  adpLayout,
  questorLayout,
  alterdataLayout,
  sageLayout,
  contmaticLayout,
  metadadosLayout,
  fpwLayout,
  esocialLayout,
  csvGenericoLayout,
];

export default function ImportExport() {
  const [activeTab, setActiveTab] = useState('import-afd');
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRecords, setImportRecords] = useState<AFDRecord[]>([]);
  const [parseResult, setParseResult] = useState<AFDParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Export states
  const [exportLayouts, setExportLayouts] = useState<ExportLayout[]>(nativeLayouts);
  const [selectedLayout, setSelectedLayout] = useState<ExportLayout | null>(gaiaLayout);
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);
  const [editingLayout, setEditingLayout] = useState<ExportLayout | null>(null);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchCompanySettings();
    fetchProfiles();
    loadSavedLayouts();
  }, []);

  useEffect(() => {
    if (selectAll) {
      setSelectedProfiles(profiles.map(p => p.id));
    } else if (selectedProfiles.length === profiles.length) {
      setSelectedProfiles([]);
    }
  }, [selectAll]);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    setCompanySettings(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, pis, cpf, registration_number, department, position, hire_date, email')
      .eq('is_active', true)
      .order('full_name');
    setProfiles(data || []);
  };

  const loadSavedLayouts = () => {
    const saved = localStorage.getItem('exportLayouts');
    if (saved) {
      try {
        const layouts = JSON.parse(saved);
        setExportLayouts([...nativeLayouts, ...layouts]);
      } catch (e) {
        console.error('Error loading layouts:', e);
      }
    }
  };

  const saveLayout = (layout: ExportLayout) => {
    const nativeIds = nativeLayouts.map(l => l.id);
    const customLayouts = exportLayouts.filter(l => !nativeIds.includes(l.id) && l.id !== layout.id);
    customLayouts.push(layout);
    localStorage.setItem('exportLayouts', JSON.stringify(customLayouts));
    setExportLayouts([...nativeLayouts, ...customLayouts]);
    setSelectedLayout(layout);
    toast.success('Layout salvo com sucesso!');
  };

  const deleteLayout = (layoutId: string) => {
    const nativeIds = nativeLayouts.map(l => l.id);
    if (nativeIds.includes(layoutId)) {
      toast.error('Não é possível excluir layouts nativos do sistema');
      return;
    }
    const customLayouts = exportLayouts.filter(l => !nativeIds.includes(l.id) && l.id !== layoutId);
    localStorage.setItem('exportLayouts', JSON.stringify(customLayouts));
    setExportLayouts([...nativeLayouts, ...customLayouts]);
    setSelectedLayout(gaiaLayout);
    toast.success('Layout excluído com sucesso!');
  };

  // ========== AFD VALIDATION FUNCTIONS ==========
  
  const validatePISFormat = (pis: string): { valid: boolean; error?: string } => {
    if (!pis || pis.length === 0) {
      return { valid: false, error: 'PIS não informado' };
    }
    const cleanPis = pis.replace(/\D/g, '');
    if (cleanPis.length !== 11) {
      return { valid: false, error: `PIS deve ter 11 dígitos (encontrado: ${cleanPis.length})` };
    }
    if (/^0+$/.test(cleanPis) || /^1+$/.test(cleanPis)) {
      return { valid: false, error: 'PIS inválido (sequência repetida)' };
    }
    return { valid: true };
  };

  const validateDate = (dateStr: string): { valid: boolean; error?: string; formatted?: string } => {
    if (!dateStr || dateStr.length !== 8) {
      return { valid: false, error: `Data inválida: "${dateStr}" (esperado 8 dígitos)` };
    }
    const day = parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const year = parseInt(dateStr.substring(4, 8));
    
    if (day < 1 || day > 31) {
      return { valid: false, error: `Dia inválido: ${day}` };
    }
    if (month < 1 || month > 12) {
      return { valid: false, error: `Mês inválido: ${month}` };
    }
    if (year < 1900 || year > 2100) {
      return { valid: false, error: `Ano inválido: ${year}` };
    }
    
    return { valid: true, formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` };
  };

  const validateTime = (timeStr: string): { valid: boolean; error?: string; formatted?: string } => {
    if (!timeStr || timeStr.length !== 4) {
      return { valid: false, error: `Hora inválida: "${timeStr}" (esperado 4 dígitos)` };
    }
    const hour = parseInt(timeStr.substring(0, 2));
    const minute = parseInt(timeStr.substring(2, 4));
    
    if (hour < 0 || hour > 23) {
      return { valid: false, error: `Hora inválida: ${hour}` };
    }
    if (minute < 0 || minute > 59) {
      return { valid: false, error: `Minuto inválido: ${minute}` };
    }
    
    return { valid: true, formatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
  };

  const validateNSR = (nsrStr: string): { valid: boolean; error?: string; value?: number } => {
    const nsr = parseInt(nsrStr);
    if (isNaN(nsr) || nsr < 0) {
      return { valid: false, error: `NSR inválido: "${nsrStr}"` };
    }
    return { valid: true, value: nsr };
  };

  // ========== IMPORT FUNCTIONS ==========
  
  const parseAFDFile = async (file: File): Promise<AFDParseResult> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    
    const result: AFDParseResult = {
      records: [],
      errors: [],
      warnings: [],
      detectedFormat: 'Desconhecido',
      headerInfo: null,
      trailerInfo: null,
      totalLines: lines.length,
      validLines: 0,
      invalidLines: 0,
    };

    let lineNumber = 0;
    let hasType1Header = false;
    let hasType9Trailer = false;

    for (const rawLine of lines) {
      lineNumber++;
      const line = rawLine.trim();
      
      if (!line) continue;

      const recordType = line.charAt(0);

      // Tipo 1 - Cabeçalho (Portaria 1510/671)
      if (recordType === '1') {
        hasType1Header = true;
        result.detectedFormat = 'Portaria 1510/671 (REP)';
        
        if (line.length < 232) {
          result.errors.push({
            line: lineNumber,
            content: line.substring(0, 50) + '...',
            error: `Cabeçalho tipo 1 incompleto. Esperado mínimo 232 caracteres, encontrado ${line.length}`,
            severity: 'warning',
            portaria: '1510/671'
          });
        } else {
          try {
            result.headerInfo = {
              tipoRegistro: '1',
              cnpjCpf: line.substring(11, 25).trim(),
              razaoSocial: line.substring(26, 176).trim(),
              repNumero: line.substring(176, 193).trim(),
              dataInicio: line.substring(193, 201),
              dataFim: line.substring(201, 209),
              dataGeracao: line.substring(209, 217),
              horaGeracao: line.substring(217, 221),
            };
            result.validLines++;
          } catch (e) {
            result.errors.push({
              line: lineNumber,
              content: line.substring(0, 50) + '...',
              error: 'Erro ao interpretar cabeçalho',
              severity: 'warning',
              portaria: '1510/671'
            });
          }
        }
        continue;
      }

      // Tipo 2 - Inclusão/Alteração de funcionário (Portaria 1510) ou marcação (Portaria 373)
      if (recordType === '2') {
        // Verificar se é Portaria 1510 (funcionário) ou 373 (marcação)
        if (hasType1Header && line.length >= 200) {
          // Portaria 1510 - Registro de funcionário (ignorar)
          result.validLines++;
          continue;
        } else if (line.includes(';')) {
          // Portaria 373 - Formato delimitado
          result.detectedFormat = 'Portaria 373 (Sistema Alternativo)';
          const parts = line.split(';');
          
          if (parts.length < 4) {
            result.errors.push({
              line: lineNumber,
              content: line.substring(0, 80),
              error: `Formato inválido. Esperado mínimo 4 campos separados por ";", encontrado ${parts.length}`,
              severity: 'error',
              portaria: '373'
            });
            result.invalidLines++;
            continue;
          }

          const pis = parts[1]?.trim().replace(/\D/g, '');
          const dateStr = parts[2]?.trim();
          const timeStr = parts[3]?.trim();

          const pisValidation = validatePISFormat(pis);
          if (!pisValidation.valid) {
            result.errors.push({
              line: lineNumber,
              content: line.substring(0, 80),
              error: pisValidation.error || 'PIS inválido',
              severity: 'warning',
              portaria: '373'
            });
          }

          const matchedProfile = profiles.find(p => p.pis?.replace(/\D/g, '') === pis);

          result.records.push({
            nsr: result.records.length + 1,
            pis,
            date: dateStr,
            time: timeStr,
            recordType: 'marcacao',
            matched: !!matchedProfile,
            profileId: matchedProfile?.id || null,
            profileName: matchedProfile?.full_name || null,
            lineNumber,
            portaria: '373',
          });
          result.validLines++;
        }
        continue;
      }

      // Tipo 3 - Marcação de ponto (Portaria 1510/671)
      if (recordType === '3') {
        result.detectedFormat = 'Portaria 1510/671 (REP)';
        
        // Validar tamanho mínimo
        if (line.length < 34) {
          result.errors.push({
            line: lineNumber,
            content: line,
            error: `Registro tipo 3 incompleto. Esperado mínimo 34 caracteres, encontrado ${line.length}`,
            severity: 'error',
            portaria: '1510/671'
          });
          result.invalidLines++;
          continue;
        }

        // Extrair campos
        const nsrStr = line.substring(1, 10);
        const tipoIdent = line.charAt(10);
        const pis = line.substring(11, 22).trim();
        const dateStr = line.substring(22, 30);
        const timeStr = line.substring(30, 34);

        // Validar NSR
        const nsrValidation = validateNSR(nsrStr);
        if (!nsrValidation.valid) {
          result.errors.push({
            line: lineNumber,
            content: line.substring(0, 40),
            error: nsrValidation.error || 'NSR inválido',
            severity: 'error',
            portaria: '1510/671'
          });
          result.invalidLines++;
          continue;
        }

        // Validar tipo de identificação
        if (!['1', '2', '3'].includes(tipoIdent)) {
          result.errors.push({
            line: lineNumber,
            content: line.substring(0, 40),
            error: `Tipo de identificação inválido: "${tipoIdent}" (esperado 1=PIS, 2=CPF, 3=Outro)`,
            severity: 'warning',
            portaria: '1510/671'
          });
        }

        // Validar PIS
        const pisValidation = validatePISFormat(pis);
        if (!pisValidation.valid) {
          result.errors.push({
            line: lineNumber,
            content: line.substring(0, 40),
            error: pisValidation.error || 'PIS inválido',
            severity: 'warning',
            portaria: '1510/671'
          });
        }

        // Validar Data
        const dateValidation = validateDate(dateStr);
        if (!dateValidation.valid) {
          result.errors.push({
            line: lineNumber,
            content: line.substring(0, 40),
            error: dateValidation.error || 'Data inválida',
            severity: 'error',
            portaria: '1510/671'
          });
          result.invalidLines++;
          continue;
        }

        // Validar Hora
        const timeValidation = validateTime(timeStr);
        if (!timeValidation.valid) {
          result.errors.push({
            line: lineNumber,
            content: line.substring(0, 40),
            error: timeValidation.error || 'Hora inválida',
            severity: 'error',
            portaria: '1510/671'
          });
          result.invalidLines++;
          continue;
        }

        // Buscar funcionário pelo PIS
        const matchedProfile = profiles.find(p => p.pis?.replace(/\D/g, '') === pis.replace(/\D/g, ''));

        result.records.push({
          nsr: nsrValidation.value!,
          pis,
          date: dateValidation.formatted!,
          time: timeValidation.formatted!,
          recordType: 'marcacao',
          matched: !!matchedProfile,
          profileId: matchedProfile?.id || null,
          profileName: matchedProfile?.full_name || null,
          lineNumber,
          portaria: '1510/671',
        });
        result.validLines++;
        continue;
      }

      // Tipo 9 - Trailer (Portaria 1510/671)
      if (recordType === '9') {
        hasType9Trailer = true;
        if (line.length >= 10) {
          result.trailerInfo = {
            tipoRegistro: '9',
            totalRegistros: parseInt(line.substring(1, 10)) || 0,
          };
        }
        result.validLines++;
        continue;
      }
    }

    // Tentar CSV se nenhum registro encontrado
    if (result.records.length === 0 && (file.name.endsWith('.csv') || text.includes(';') || text.includes(','))) {
      result.detectedFormat = 'CSV Genérico';
      const delimiter = text.includes(';') ? ';' : ',';
      const csvLines = lines.filter(line => line.trim());
      
      const startIndex = csvLines[0]?.toLowerCase().includes('pis') || 
                        csvLines[0]?.toLowerCase().includes('matricula') ? 1 : 0;
      
      for (let i = startIndex; i < csvLines.length; i++) {
        const parts = csvLines[i].split(delimiter);
        if (parts.length >= 3) {
          const pis = parts[0]?.trim().replace(/\D/g, '');
          const dateStr = parts[1]?.trim();
          const timeStr = parts[2]?.trim();
          
          const matchedProfile = profiles.find(p => 
            p.pis?.replace(/\D/g, '') === pis || p.registration_number === parts[0]?.trim()
          );
          
          result.records.push({
            nsr: i,
            pis,
            date: dateStr,
            time: timeStr,
            recordType: 'marcacao',
            matched: !!matchedProfile,
            profileId: matchedProfile?.id || null,
            profileName: matchedProfile?.full_name || null,
            lineNumber: i + 1,
            portaria: 'CSV',
          });
          result.validLines++;
        }
      }
    }

    // Adicionar warnings gerais
    if (hasType1Header && !hasType9Trailer) {
      result.warnings.push('Arquivo sem registro de trailer (tipo 9). O arquivo pode estar incompleto.');
    }
    
    if (result.trailerInfo && result.trailerInfo.totalRegistros !== result.records.length) {
      result.warnings.push(
        `Total de registros no trailer (${result.trailerInfo.totalRegistros}) difere do total encontrado (${result.records.length})`
      );
    }

    if (result.records.length === 0 && result.errors.length === 0) {
      result.errors.push({
        line: 0,
        content: '',
        error: 'Nenhum registro de marcação encontrado. Verifique se o arquivo está no formato AFD correto.',
        severity: 'error'
      });
    }

    return result;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    setImportComplete(false);
    setParseResult(null);
    
    try {
      const result = await parseAFDFile(file);
      setParseResult(result);
      setImportRecords(result.records);
      
      const matched = result.records.filter(r => r.matched).length;
      const unmatched = result.records.length - matched;
      
      if (result.errors.filter(e => e.severity === 'error').length > 0) {
        toast.warning(`${result.records.length} registros. ${result.errors.length} problemas encontrados.`);
      } else {
        toast.success(`${result.records.length} registros encontrados. ${matched} vinculados, ${unmatched} não vinculados.`);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao processar arquivo. Verifique o formato.');
    }
  };

  const handleImport = async () => {
    if (importRecords.length === 0) {
      toast.error('Nenhum registro para importar');
      return;
    }
    
    const matchedRecords = importRecords.filter(r => r.matched && r.profileId);
    if (matchedRecords.length === 0) {
      toast.error('Nenhum registro vinculado a funcionários cadastrados');
      return;
    }
    
    setImporting(true);
    
    try {
      let imported = 0;
      let errors = 0;
      
      for (const record of matchedRecords) {
        try {
          // Parse date and time
          const dateParts = record.date.split('/');
          const timeParts = record.time.split(':');
          
          let recordedAt: Date;
          if (dateParts.length === 3) {
            recordedAt = new Date(
              parseInt(dateParts[2]),
              parseInt(dateParts[1]) - 1,
              parseInt(dateParts[0]),
              parseInt(timeParts[0]),
              parseInt(timeParts[1])
            );
          } else {
            recordedAt = parse(`${record.date} ${record.time}`, 'dd/MM/yyyy HH:mm', new Date());
          }
          
          if (!isValid(recordedAt)) {
            errors++;
            continue;
          }
          
          // Check for duplicate
          const { data: existing } = await supabase
            .from('time_records')
            .select('id')
            .eq('profile_id', record.profileId)
            .eq('recorded_at', recordedAt.toISOString())
            .maybeSingle();
          
          if (existing) {
            continue; // Skip duplicates
          }
          
          const { error } = await supabase
            .from('time_records')
            .insert({
              profile_id: record.profileId,
              recorded_at: recordedAt.toISOString(),
              record_type: 'entry', // Will be auto-determined based on sequence
              device_info: `Importado AFD - NSR: ${record.nsr}`,
            });
          
          if (error) throw error;
          imported++;
        } catch (e) {
          console.error('Error importing record:', record, e);
          errors++;
        }
      }
      
      setImportComplete(true);
      toast.success(`Importação concluída! ${imported} registros importados, ${errors} erros.`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro durante a importação');
    } finally {
      setImporting(false);
    }
  };

  // ========== EXPORT FUNCTIONS ==========
  
  const toggleProfileSelection = (profileId: string) => {
    setSelectedProfiles(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleExport = async () => {
    if (!selectedLayout) {
      toast.error('Selecione um layout de exportação');
      return;
    }
    
    const profilesToExport = selectedProfiles.length > 0 
      ? profiles.filter(p => selectedProfiles.includes(p.id))
      : profiles;
    
    if (profilesToExport.length === 0) {
      toast.error('Nenhum funcionário selecionado para exportar');
      return;
    }
    
    try {
      // Fetch time records for selected profiles and date range
      const { data: timeRecords, error } = await supabase
        .from('time_records')
        .select('*, profiles!time_records_profile_id_fkey(full_name, pis, cpf, registration_number)')
        .in('profile_id', profilesToExport.map(p => p.id))
        .gte('recorded_at', `${startDate}T00:00:00`)
        .lte('recorded_at', `${endDate}T23:59:59`)
        .order('recorded_at', { ascending: true });
      
      if (error) throw error;

      // Fetch work schedules for employees
      const { data: schedules } = await supabase
        .from('employee_schedules')
        .select('*, work_schedules(*)')
        .in('profile_id', profilesToExport.map(p => p.id));

      // Fetch holidays
      const { data: holidays } = await supabase
        .from('holidays')
        .select('date')
        .gte('date', startDate)
        .lte('date', endDate);

      const holidayDates = new Set((holidays || []).map(h => h.date));
      
      // Group records by profile and date
      const groupedRecords: Record<string, Record<string, any[]>> = {};
      
      for (const record of timeRecords || []) {
        const profileId = record.profile_id;
        const dateKey = format(new Date(record.recorded_at), 'yyyy-MM-dd');
        
        if (!groupedRecords[profileId]) {
          groupedRecords[profileId] = {};
        }
        if (!groupedRecords[profileId][dateKey]) {
          groupedRecords[profileId][dateKey] = [];
        }
        groupedRecords[profileId][dateKey].push(record);
      }

      // Helper function to calculate worked minutes for a day
      const calculateWorkedMinutes = (dayRecords: any[]): number => {
        if (dayRecords.length < 2) return 0;
        let totalMinutes = 0;
        for (let i = 0; i < dayRecords.length - 1; i += 2) {
          const entry = new Date(dayRecords[i].recorded_at);
          const exit = dayRecords[i + 1] ? new Date(dayRecords[i + 1].recorded_at) : null;
          if (exit) {
            totalMinutes += (exit.getTime() - entry.getTime()) / 60000;
          }
        }
        return Math.round(totalMinutes);
      };

      // Get expected minutes for a profile on a given day
      const getExpectedMinutes = (profileId: string, dateKey: string): number => {
        const dayOfWeek = new Date(dateKey).getDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        const schedule = (schedules || []).find(s => s.profile_id === profileId);
        if (!schedule?.work_schedules) return 480; // Default 8h
        
        const ws = schedule.work_schedules;
        const startKey = `${dayName}_start` as keyof typeof ws;
        const endKey = `${dayName}_end` as keyof typeof ws;
        
        if (!ws[startKey] || !ws[endKey]) return 0;
        
        const start = ws[startKey] as string;
        const end = ws[endKey] as string;
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        
        let minutes = (eh * 60 + em) - (sh * 60 + sm);
        if (ws.break_duration_minutes) {
          minutes -= ws.break_duration_minutes;
        }
        return minutes > 0 ? minutes : 0;
      };

      // Format time in HH:mm or decimal
      const formatMinutes = (minutes: number, asDecimal: boolean = false): string => {
        if (asDecimal) {
          return (minutes / 60).toFixed(2);
        }
        const h = Math.floor(Math.abs(minutes) / 60);
        const m = Math.abs(minutes) % 60;
        const sign = minutes < 0 ? '-' : '';
        return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };
      
      // Generate export content
      const lines: string[] = [];
      
      if (selectedLayout.includeHeader) {
        const headerFields = selectedLayout.fields
          .filter(f => f.enabled)
          .sort((a, b) => a.position - b.position)
          .map(f => f.name);
        lines.push(headerFields.join(selectedLayout.delimiter || ';'));
      }
      
      for (const profile of profilesToExport) {
        const profileRecords = groupedRecords[profile.id] || {};
        
        // Calculate monthly totals
        let monthlyWorkedMinutes = 0;
        let monthlyExpectedMinutes = 0;
        let monthlyOvertimeMinutes = 0;
        let monthlyDeficitMinutes = 0;
        let absenceDays = 0;
        
        // Get all days in the period
        const start = new Date(startDate);
        const end = new Date(endDate);
        const allDays: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          allDays.push(format(d, 'yyyy-MM-dd'));
        }
        
        for (const dateKey of allDays) {
          const dayRecords = profileRecords[dateKey] || [];
          const expectedMinutes = getExpectedMinutes(profile.id, dateKey);
          const workedMinutes = calculateWorkedMinutes(dayRecords);
          const isHoliday = holidayDates.has(dateKey);
          const isWeekend = [0, 6].includes(new Date(dateKey).getDay());
          
          if (expectedMinutes > 0 && !isHoliday) {
            monthlyExpectedMinutes += expectedMinutes;
            if (workedMinutes === 0 && !isWeekend) {
              absenceDays++;
            }
          }
          
          monthlyWorkedMinutes += workedMinutes;
          
          const balance = workedMinutes - expectedMinutes;
          if (balance > 0 && !isHoliday) {
            monthlyOvertimeMinutes += balance;
          } else if (balance < 0 && expectedMinutes > 0 && !isHoliday) {
            monthlyDeficitMinutes += Math.abs(balance);
          }
        }
        
        const monthlyBalanceMinutes = monthlyWorkedMinutes - monthlyExpectedMinutes;
        
        for (const [dateKey, records] of Object.entries(profileRecords)) {
          const dayRecords = records.sort((a: any, b: any) => 
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );
          
          const workedMinutes = calculateWorkedMinutes(dayRecords);
          const expectedMinutes = getExpectedMinutes(profile.id, dateKey);
          const dailyBalance = workedMinutes - expectedMinutes;
          const dailyOvertime = dailyBalance > 0 ? dailyBalance : 0;
          const dailyDeficit = dailyBalance < 0 ? Math.abs(dailyBalance) : 0;
          const isHoliday = holidayDates.has(dateKey);
          
          const recordData: Record<string, string> = {
            company_code: '00001',
            branch_code: '0001',
            company_cnpj: companySettings?.rep_number || '',
            registration_number: profile.registration_number || '',
            full_name: profile.full_name || '',
            cpf: profile.cpf?.replace(/\D/g, '') || '',
            pis: profile.pis || '',
            department: profile.department || '',
            position: profile.position || '',
            hire_date: profile.hire_date ? format(new Date(profile.hire_date), selectedLayout.dateFormat) : '',
            email: profile.email || '',
            record_date: format(new Date(dateKey), selectedLayout.dateFormat),
            entry_time: dayRecords[0] ? format(new Date(dayRecords[0].recorded_at), selectedLayout.timeFormat) : '',
            break_start_time: dayRecords[1] ? format(new Date(dayRecords[1].recorded_at), selectedLayout.timeFormat) : '',
            break_end_time: dayRecords[2] ? format(new Date(dayRecords[2].recorded_at), selectedLayout.timeFormat) : '',
            exit_time: dayRecords[3] ? format(new Date(dayRecords[3].recorded_at), selectedLayout.timeFormat) : '',
            extra_entry_1: dayRecords[4] ? format(new Date(dayRecords[4].recorded_at), selectedLayout.timeFormat) : '',
            extra_exit_1: dayRecords[5] ? format(new Date(dayRecords[5].recorded_at), selectedLayout.timeFormat) : '',
            extra_entry_2: dayRecords[6] ? format(new Date(dayRecords[6].recorded_at), selectedLayout.timeFormat) : '',
            extra_exit_2: dayRecords[7] ? format(new Date(dayRecords[7].recorded_at), selectedLayout.timeFormat) : '',
            // Daily calculations
            worked_hours: formatMinutes(workedMinutes),
            worked_hours_decimal: formatMinutes(workedMinutes, true),
            expected_hours: formatMinutes(expectedMinutes),
            expected_hours_decimal: formatMinutes(expectedMinutes, true),
            daily_balance: formatMinutes(dailyBalance),
            daily_balance_decimal: formatMinutes(dailyBalance, true),
            daily_overtime: formatMinutes(dailyOvertime),
            daily_overtime_decimal: formatMinutes(dailyOvertime, true),
            daily_deficit: formatMinutes(dailyDeficit),
            daily_deficit_decimal: formatMinutes(dailyDeficit, true),
            is_holiday: isHoliday ? 'S' : 'N',
            day_of_week: format(new Date(dateKey), 'EEEE', { locale: ptBR }),
            day_of_week_short: format(new Date(dateKey), 'EEE', { locale: ptBR }),
            // Monthly totals (same for all days of the employee)
            monthly_worked: formatMinutes(monthlyWorkedMinutes),
            monthly_worked_decimal: formatMinutes(monthlyWorkedMinutes, true),
            monthly_expected: formatMinutes(monthlyExpectedMinutes),
            monthly_expected_decimal: formatMinutes(monthlyExpectedMinutes, true),
            monthly_overtime: formatMinutes(monthlyOvertimeMinutes),
            monthly_overtime_decimal: formatMinutes(monthlyOvertimeMinutes, true),
            monthly_deficit: formatMinutes(monthlyDeficitMinutes),
            monthly_deficit_decimal: formatMinutes(monthlyDeficitMinutes, true),
            monthly_balance: formatMinutes(monthlyBalanceMinutes),
            monthly_balance_decimal: formatMinutes(monthlyBalanceMinutes, true),
            time_bank_balance: formatMinutes(monthlyBalanceMinutes),
            time_bank_balance_decimal: formatMinutes(monthlyBalanceMinutes, true),
            absence_days: String(absenceDays),
            total_records: String(dayRecords.length),
          };
          
          const lineValues = selectedLayout.fields
            .filter(f => f.enabled)
            .sort((a, b) => a.position - b.position)
            .map(field => {
              let value = recordData[field.source] || '';
              
              if (field.padding === 'left') {
                value = value.padStart(field.length, field.paddingChar);
              } else if (field.padding === 'right') {
                value = value.padEnd(field.length, field.paddingChar);
              }
              
              return value.slice(0, field.length);
            });
          
          lines.push(lineValues.join(selectedLayout.delimiter || ''));
        }
        
        // If no records, still export profile data for employee export
        if (Object.keys(profileRecords).length === 0) {
          const nativeIds = nativeLayouts.map(l => l.id);
          if (!nativeIds.includes(selectedLayout.id) || selectedLayout.id === 'csv_generico') {
            const recordData: Record<string, string> = {
              company_code: '00001',
              branch_code: '0001',
              company_cnpj: companySettings?.rep_number || '',
              registration_number: profile.registration_number || '',
              full_name: profile.full_name || '',
              cpf: profile.cpf?.replace(/\D/g, '') || '',
              pis: profile.pis || '',
              department: profile.department || '',
              position: profile.position || '',
              hire_date: profile.hire_date ? format(new Date(profile.hire_date), selectedLayout.dateFormat) : '',
              email: profile.email || '',
              record_date: '',
              entry_time: '',
              break_start_time: '',
              break_end_time: '',
              exit_time: '',
              extra_entry_1: '',
              extra_exit_1: '',
              extra_entry_2: '',
              extra_exit_2: '',
              worked_hours: '00:00',
              worked_hours_decimal: '0.00',
              expected_hours: '00:00',
              expected_hours_decimal: '0.00',
              daily_balance: '00:00',
              daily_balance_decimal: '0.00',
              daily_overtime: '00:00',
              daily_overtime_decimal: '0.00',
              daily_deficit: '00:00',
              daily_deficit_decimal: '0.00',
              is_holiday: 'N',
              day_of_week: '',
              day_of_week_short: '',
              monthly_worked: '00:00',
              monthly_worked_decimal: '0.00',
              monthly_expected: '00:00',
              monthly_expected_decimal: '0.00',
              monthly_overtime: '00:00',
              monthly_overtime_decimal: '0.00',
              monthly_deficit: '00:00',
              monthly_deficit_decimal: '0.00',
              monthly_balance: '00:00',
              monthly_balance_decimal: '0.00',
              time_bank_balance: '00:00',
              time_bank_balance_decimal: '0.00',
              absence_days: '0',
              total_records: '0',
            };
            
            const lineValues = selectedLayout.fields
              .filter(f => f.enabled)
              .sort((a, b) => a.position - b.position)
              .map(field => {
                let value = recordData[field.source] || '';
                
                if (field.padding === 'left') {
                  value = value.padStart(field.length, field.paddingChar);
                } else if (field.padding === 'right') {
                  value = value.padEnd(field.length, field.paddingChar);
                }
                
                return value.slice(0, field.length);
              });
            
            lines.push(lineValues.join(selectedLayout.delimiter || ''));
          }
        }
      }
      
      const content = lines.join('\r\n');
      const filename = `export_${selectedLayout.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.txt`;
      
      downloadFile(content, filename);
      toast.success(`Exportação concluída! ${lines.length - (selectedLayout.includeHeader ? 1 : 0)} registros exportados.`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro durante a exportação');
    }
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

  const openLayoutEditor = (layout?: ExportLayout, duplicate: boolean = false) => {
    const nativeIds = nativeLayouts.map(l => l.id);
    if (layout) {
      const isNative = nativeIds.includes(layout.id);
      const newId = (isNative || duplicate) ? `custom_${Date.now()}` : layout.id;
      const newName = duplicate ? `${layout.name} (Cópia)` : (isNative ? `${layout.name} (Personalizado)` : layout.name);
      setEditingLayout({ 
        ...layout, 
        id: newId,
        name: newName,
        fields: layout.fields.map(f => ({ ...f })),
      });
    } else {
      setEditingLayout({
        id: `custom_${Date.now()}`,
        name: 'Novo Layout',
        description: '',
        fields: [...defaultFields],
        delimiter: ';',
        includeHeader: true,
        dateFormat: 'dd/MM/yyyy',
        timeFormat: 'HH:mm',
        encoding: 'UTF-8',
      });
    }
    setLayoutDialogOpen(true);
  };

  const matchedCount = importRecords.filter(r => r.matched).length;
  const unmatchedCount = importRecords.length - matchedCount;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ArrowUpDown className="h-8 w-8 text-primary" />
            Importação / Exportação
          </h1>
          <p className="text-muted-foreground">
            Importar AFD (Portarias 1510/373/671) e exportar dados para folha de pagamento
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="import-afd" className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Importar AFD
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar Dados
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Exportação
          </TabsTrigger>
        </TabsList>

        {/* ========== IMPORT AFD TAB ========== */}
        <TabsContent value="import-afd" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Importação de Arquivo AFD (Portarias MTE)
              </CardTitle>
              <CardDescription>
                Importar arquivos AFD (Arquivo-Fonte de Dados) de relógios de ponto conforme Portaria 1510/2009, Portaria 373/2011 e Portaria 671/2021
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Informações sobre formatos suportados */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300">Portaria 1510/2009</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formato padrão para REP (Registrador Eletrônico de Ponto). Arquivo .txt com registros tipo 3.
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                  <h4 className="font-semibold text-green-700 dark:text-green-300">Portaria 373/2011</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sistemas alternativos de controle de ponto. Formato flexível com identificador tipo 2.
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-950">
                  <h4 className="font-semibold text-purple-700 dark:text-purple-300">Portaria 671/2021</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Consolidação das regras. Compatível com REP-C, REP-A e REP-P.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>REP Cadastrado</Label>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">{companySettings?.rep_manufacturer || 'Não configurado'}</p>
                    <p className="text-sm text-muted-foreground">
                      Modelo: {companySettings?.rep_model || '-'} | Nº: {companySettings?.rep_number || '-'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Selecionar Arquivo AFD</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.afd,.csv"
                      onChange={handleFileSelect}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: .txt, .afd, .csv
                  </p>
                </div>
              </div>

              {importFile && parseResult && (
                <div className="space-y-4">
                  {/* File Info */}
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <FileText className="h-10 w-10 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{importFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(importFile.size / 1024).toFixed(2)} KB • {parseResult.detectedFormat}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary">{parseResult.records.length} registros</Badge>
                      <Badge variant="default" className="bg-green-500">{matchedCount} vinculados</Badge>
                      {unmatchedCount > 0 && (
                        <Badge variant="destructive">{unmatchedCount} não vinculados</Badge>
                      )}
                    </div>
                  </div>

                  {/* Parse Statistics */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-primary">{parseResult.totalLines}</p>
                      <p className="text-xs text-muted-foreground">Linhas no arquivo</p>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{parseResult.validLines}</p>
                      <p className="text-xs text-muted-foreground">Linhas válidas</p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-600">{parseResult.invalidLines}</p>
                      <p className="text-xs text-muted-foreground">Linhas inválidas</p>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-center">
                      <p className="text-2xl font-bold text-amber-600">{parseResult.errors.length}</p>
                      <p className="text-xs text-muted-foreground">Problemas encontrados</p>
                    </div>
                  </div>

                  {/* Header Info */}
                  {parseResult.headerInfo && (
                    <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/50">
                      <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                        Informações do Cabeçalho AFD
                      </h4>
                      <div className="grid gap-2 md:grid-cols-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">CNPJ/CPF:</span>
                          <span className="ml-2 font-mono">{parseResult.headerInfo.cnpjCpf}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">REP:</span>
                          <span className="ml-2 font-mono">{parseResult.headerInfo.repNumero}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Período:</span>
                          <span className="ml-2">
                            {parseResult.headerInfo.dataInicio.substring(0, 2)}/{parseResult.headerInfo.dataInicio.substring(2, 4)}/{parseResult.headerInfo.dataInicio.substring(4, 8)} a{' '}
                            {parseResult.headerInfo.dataFim.substring(0, 2)}/{parseResult.headerInfo.dataFim.substring(2, 4)}/{parseResult.headerInfo.dataFim.substring(4, 8)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Gerado em:</span>
                          <span className="ml-2">
                            {parseResult.headerInfo.dataGeracao.substring(0, 2)}/{parseResult.headerInfo.dataGeracao.substring(2, 4)}/{parseResult.headerInfo.dataGeracao.substring(4, 8)} às{' '}
                            {parseResult.headerInfo.horaGeracao.substring(0, 2)}:{parseResult.headerInfo.horaGeracao.substring(2, 4)}
                          </span>
                        </div>
                      </div>
                      {parseResult.headerInfo.razaoSocial && (
                        <p className="mt-2 text-sm">
                          <span className="text-muted-foreground">Empresa:</span>
                          <span className="ml-2">{parseResult.headerInfo.razaoSocial}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Warnings */}
                  {parseResult.warnings.length > 0 && (
                    <div className="p-4 border border-amber-300 rounded-lg bg-amber-50 dark:bg-amber-950/50">
                      <h4 className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Avisos ({parseResult.warnings.length})
                      </h4>
                      <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
                        {parseResult.warnings.map((warning, idx) => (
                          <li key={idx}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Errors */}
                  {parseResult.errors.length > 0 && (
                    <div className="p-4 border border-red-300 rounded-lg bg-red-50 dark:bg-red-950/50">
                      <h4 className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Erros de Parsing ({parseResult.errors.length})
                      </h4>
                      <div className="mt-2 max-h-48 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Linha</TableHead>
                              <TableHead className="w-24">Portaria</TableHead>
                              <TableHead className="w-20">Tipo</TableHead>
                              <TableHead>Erro</TableHead>
                              <TableHead>Conteúdo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parseResult.errors.slice(0, 50).map((error, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono">{error.line}</TableCell>
                                <TableCell>
                                  <Badge variant={error.portaria ? 'outline' : 'secondary'}>
                                    {error.portaria || 'N/A'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={error.severity === 'error' ? 'destructive' : 'secondary'}>
                                    {error.severity === 'error' ? 'Erro' : 'Aviso'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{error.error}</TableCell>
                                <TableCell className="font-mono text-xs max-w-xs truncate">
                                  {error.content}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {parseResult.errors.length > 50 && (
                          <p className="text-center text-sm text-muted-foreground mt-2">
                            Mostrando 50 de {parseResult.errors.length} erros
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Instruções de uso */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Importante
                </h4>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Certifique-se de que os funcionários estejam cadastrados com o PIS correto</li>
                  <li>Registros duplicados (mesma data/hora/funcionário) serão ignorados automaticamente</li>
                  <li>Registros não vinculados a funcionários não serão importados</li>
                  <li>O arquivo AFD deve ser extraído diretamente do equipamento REP</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {importRecords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Prévia dos Registros AFD</span>
                  {parseResult && (
                    <Badge variant="outline" className="font-normal">
                      {parseResult.detectedFormat}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Verifique os registros antes de importar. Registros não vinculados serão ignorados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Linha</TableHead>
                        <TableHead>NSR</TableHead>
                        <TableHead>PIS</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Portaria</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRecords.slice(0, 100).map((record, idx) => (
                        <TableRow key={idx} className={!record.matched ? 'bg-destructive/10' : ''}>
                          <TableCell>
                            {record.matched ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{record.lineNumber || '-'}</TableCell>
                          <TableCell className="font-mono">{record.nsr}</TableCell>
                          <TableCell className="font-mono">{record.pis}</TableCell>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{record.time}</TableCell>
                          <TableCell>
                            {record.profileName || (
                              <span className="text-muted-foreground italic">PIS não cadastrado</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {record.portaria || 'N/A'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importRecords.length > 100 && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      Mostrando 100 de {importRecords.length} registros
                    </p>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportFile(null);
                      setImportRecords([]);
                      setParseResult(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Limpar
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={importing || matchedCount === 0}
                    className="gradient-primary"
                  >
                    {importing ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Importar {matchedCount} Registros
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ========== IMPORT DATA TAB ========== */}
        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importar Dados de Funcionários
              </CardTitle>
              <CardDescription>
                Importe dados de funcionários em formato CSV para atualização em lote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de Importação</Label>
                  <Select defaultValue="employees">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employees">Funcionários (CSV)</SelectItem>
                      <SelectItem value="schedules">Horários de Trabalho (CSV)</SelectItem>
                      <SelectItem value="departments">Departamentos (CSV)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Selecionar Arquivo CSV</Label>
                  <Input
                    type="file"
                    accept=".csv"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold">Formato do arquivo CSV para Funcionários:</h4>
                <p className="text-sm text-muted-foreground mt-2">
                  Colunas obrigatórias: nome, email, cpf
                </p>
                <p className="text-sm text-muted-foreground">
                  Colunas opcionais: pis, matricula, departamento, cargo, telefone, data_admissao
                </p>
                <div className="mt-3 p-2 bg-background rounded text-xs font-mono">
                  nome;email;cpf;pis;matricula;departamento;cargo<br/>
                  João Silva;joao@empresa.com;12345678900;12345678901;001;TI;Analista
                </div>
              </div>

              <div className="flex justify-end">
                <Button disabled className="gradient-primary">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Dados
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== EXPORT TAB ========== */}
        <TabsContent value="export" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Layout Selection */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Layout de Exportação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select 
                  value={selectedLayout?.id || ''} 
                  onValueChange={(id) => setSelectedLayout(exportLayouts.find(l => l.id === id) || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um layout" />
                  </SelectTrigger>
                  <SelectContent>
                    {exportLayouts.map(layout => (
                      <SelectItem key={layout.id} value={layout.id}>
                        {layout.name}
                        {layout.id === 'gaia' && ' (Padrão)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedLayout && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p className="font-medium">{selectedLayout.name}</p>
                    <p className="text-muted-foreground">{selectedLayout.description}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <p>Campos: {selectedLayout.fields.filter(f => f.enabled).length}</p>
                      <p>Delimitador: {selectedLayout.delimiter || 'Posicional'}</p>
                      <p>Formato Data: {selectedLayout.dateFormat}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openLayoutEditor(selectedLayout || undefined)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Personalizar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openLayoutEditor()}
                  >
                    Novo
                  </Button>
                </div>

                {selectedLayout && !nativeLayouts.map(l => l.id).includes(selectedLayout.id) && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full"
                    onClick={() => deleteLayout(selectedLayout.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir Layout
                  </Button>
                )}

                <div className="space-y-2 pt-4 border-t">
                  <Label>Período</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employee Selection */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Selecionar Funcionários
                </CardTitle>
                <CardDescription>
                  Selecione funcionários específicos ou exporte todos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="selectAll"
                      checked={selectAll || selectedProfiles.length === profiles.length}
                      onCheckedChange={(checked) => {
                        setSelectAll(!!checked);
                        if (checked) {
                          setSelectedProfiles(profiles.map(p => p.id));
                        } else {
                          setSelectedProfiles([]);
                        }
                      }}
                    />
                    <Label htmlFor="selectAll">Selecionar Todos</Label>
                  </div>
                  <Badge variant="secondary">
                    {selectedProfiles.length} de {profiles.length} selecionados
                  </Badge>
                </div>

                <div className="max-h-64 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Matrícula</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>PIS</TableHead>
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
                          <TableCell className="font-mono">{profile.registration_number || '-'}</TableCell>
                          <TableCell className="font-mono">{profile.cpf || '-'}</TableCell>
                          <TableCell className="font-mono">{profile.pis || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end mt-4">
                  <Button
                    onClick={handleExport}
                    disabled={!selectedLayout}
                    className="gradient-primary"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar {selectedProfiles.length > 0 ? selectedProfiles.length : 'Todos'} Funcionários
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Layout Editor Dialog */}
      <Dialog open={layoutDialogOpen} onOpenChange={setLayoutDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLayout?.id.startsWith('custom_') ? 'Novo Layout' : 'Editar Layout'}
            </DialogTitle>
            <DialogDescription>
              Configure os campos e formato de exportação
            </DialogDescription>
          </DialogHeader>

          {editingLayout && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome do Layout</Label>
                  <Input
                    value={editingLayout.name}
                    onChange={(e) => setEditingLayout({ ...editingLayout, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delimitador</Label>
                  <Select
                    value={editingLayout.delimiter || 'none'}
                    onValueChange={(value) => setEditingLayout({ ...editingLayout, delimiter: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Posicional (sem delimitador)</SelectItem>
                      <SelectItem value=";">Ponto e vírgula (;)</SelectItem>
                      <SelectItem value=",">Vírgula (,)</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={editingLayout.description}
                  onChange={(e) => setEditingLayout({ ...editingLayout, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Formato Data</Label>
                  <Select
                    value={editingLayout.dateFormat}
                    onValueChange={(value) => setEditingLayout({ ...editingLayout, dateFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dd/MM/yyyy">DD/MM/AAAA</SelectItem>
                      <SelectItem value="ddMMyyyy">DDMMAAAA</SelectItem>
                      <SelectItem value="yyyy-MM-dd">AAAA-MM-DD</SelectItem>
                      <SelectItem value="yyyyMMdd">AAAAMMDD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Formato Hora</Label>
                  <Select
                    value={editingLayout.timeFormat}
                    onValueChange={(value) => setEditingLayout({ ...editingLayout, timeFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HH:mm">HH:MM</SelectItem>
                      <SelectItem value="HHmm">HHMM</SelectItem>
                      <SelectItem value="HH:mm:ss">HH:MM:SS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeHeader"
                      checked={editingLayout.includeHeader}
                      onCheckedChange={(checked) => 
                        setEditingLayout({ ...editingLayout, includeHeader: !!checked })
                      }
                    />
                    <Label htmlFor="includeHeader">Incluir cabeçalho</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Campos</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newField: ExportField = {
                        id: `field_${Date.now()}`,
                        name: 'Novo Campo',
                        source: 'registration_number',
                        position: editingLayout.fields.length + 1,
                        length: 10,
                        padding: 'none',
                        paddingChar: '',
                        enabled: true,
                      };
                      setEditingLayout({
                        ...editingLayout,
                        fields: [...editingLayout.fields, newField],
                      });
                    }}
                  >
                    + Adicionar Campo
                  </Button>
                </div>
                <div className="border rounded-lg overflow-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Ativo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="w-20">Tamanho</TableHead>
                        <TableHead className="w-24">Preenchimento</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editingLayout.fields.map((field, idx) => (
                        <TableRow key={field.id}>
                          <TableCell>
                            <Checkbox
                              checked={field.enabled}
                              onCheckedChange={(checked) => {
                                const newFields = [...editingLayout.fields];
                                newFields[idx].enabled = !!checked;
                                setEditingLayout({ ...editingLayout, fields: newFields });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={field.name}
                              onChange={(e) => {
                                const newFields = [...editingLayout.fields];
                                newFields[idx].name = e.target.value;
                                setEditingLayout({ ...editingLayout, fields: newFields });
                              }}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={field.source}
                              onValueChange={(value) => {
                                const newFields = [...editingLayout.fields];
                                newFields[idx].source = value;
                                setEditingLayout({ ...editingLayout, fields: newFields });
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-80">
                                {/* Dados do Funcionário */}
                                <SelectItem value="registration_number">Matrícula</SelectItem>
                                <SelectItem value="full_name">Nome</SelectItem>
                                <SelectItem value="cpf">CPF</SelectItem>
                                <SelectItem value="pis">PIS</SelectItem>
                                <SelectItem value="department">Departamento</SelectItem>
                                <SelectItem value="position">Cargo</SelectItem>
                                <SelectItem value="hire_date">Data Admissão</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="company_code">Cód. Empresa</SelectItem>
                                <SelectItem value="branch_code">Cód. Filial</SelectItem>
                                <SelectItem value="company_cnpj">CNPJ Empresa</SelectItem>
                                {/* Marcações de Ponto */}
                                <SelectItem value="record_date">Data Registro</SelectItem>
                                <SelectItem value="day_of_week">Dia da Semana</SelectItem>
                                <SelectItem value="day_of_week_short">Dia Semana (Abrev)</SelectItem>
                                <SelectItem value="entry_time">Hora Entrada</SelectItem>
                                <SelectItem value="break_start_time">Saída Intervalo</SelectItem>
                                <SelectItem value="break_end_time">Retorno Intervalo</SelectItem>
                                <SelectItem value="exit_time">Hora Saída</SelectItem>
                                <SelectItem value="extra_entry_1">Entrada Extra 1</SelectItem>
                                <SelectItem value="extra_exit_1">Saída Extra 1</SelectItem>
                                <SelectItem value="extra_entry_2">Entrada Extra 2</SelectItem>
                                <SelectItem value="extra_exit_2">Saída Extra 2</SelectItem>
                                <SelectItem value="total_records">Total Marcações</SelectItem>
                                {/* Horas Diárias */}
                                <SelectItem value="worked_hours">Horas Trabalhadas (HH:mm)</SelectItem>
                                <SelectItem value="worked_hours_decimal">Horas Trabalhadas (Decimal)</SelectItem>
                                <SelectItem value="expected_hours">Horas Previstas (HH:mm)</SelectItem>
                                <SelectItem value="expected_hours_decimal">Horas Previstas (Decimal)</SelectItem>
                                <SelectItem value="daily_balance">Saldo Diário (HH:mm)</SelectItem>
                                <SelectItem value="daily_balance_decimal">Saldo Diário (Decimal)</SelectItem>
                                <SelectItem value="daily_overtime">Hora Extra Diária (HH:mm)</SelectItem>
                                <SelectItem value="daily_overtime_decimal">Hora Extra Diária (Decimal)</SelectItem>
                                <SelectItem value="daily_deficit">Débito Diário (HH:mm)</SelectItem>
                                <SelectItem value="daily_deficit_decimal">Débito Diário (Decimal)</SelectItem>
                                <SelectItem value="is_holiday">É Feriado (S/N)</SelectItem>
                                {/* Totais Mensais */}
                                <SelectItem value="monthly_worked">Total Trabalhado Mês (HH:mm)</SelectItem>
                                <SelectItem value="monthly_worked_decimal">Total Trabalhado Mês (Decimal)</SelectItem>
                                <SelectItem value="monthly_expected">Total Previsto Mês (HH:mm)</SelectItem>
                                <SelectItem value="monthly_expected_decimal">Total Previsto Mês (Decimal)</SelectItem>
                                <SelectItem value="monthly_overtime">Horas Extras Mês (HH:mm)</SelectItem>
                                <SelectItem value="monthly_overtime_decimal">Horas Extras Mês (Decimal)</SelectItem>
                                <SelectItem value="monthly_deficit">Débitos Mês (HH:mm)</SelectItem>
                                <SelectItem value="monthly_deficit_decimal">Débitos Mês (Decimal)</SelectItem>
                                <SelectItem value="monthly_balance">Saldo Mês (HH:mm)</SelectItem>
                                <SelectItem value="monthly_balance_decimal">Saldo Mês (Decimal)</SelectItem>
                                {/* Banco de Horas e Faltas */}
                                <SelectItem value="time_bank_balance">Banco Horas (HH:mm)</SelectItem>
                                <SelectItem value="time_bank_balance_decimal">Banco Horas (Decimal)</SelectItem>
                                <SelectItem value="absence_days">Dias de Falta</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={field.length}
                              onChange={(e) => {
                                const newFields = [...editingLayout.fields];
                                newFields[idx].length = parseInt(e.target.value) || 0;
                                setEditingLayout({ ...editingLayout, fields: newFields });
                              }}
                              className="h-8 w-16"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={field.padding}
                              onValueChange={(value: 'left' | 'right' | 'none') => {
                                const newFields = [...editingLayout.fields];
                                newFields[idx].padding = value;
                                setEditingLayout({ ...editingLayout, fields: newFields });
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                <SelectItem value="left">Esquerda (0)</SelectItem>
                                <SelectItem value="right">Direita (espaço)</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                const newFields = editingLayout.fields.filter((_, i) => i !== idx);
                                setEditingLayout({ ...editingLayout, fields: newFields });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setLayoutDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (editingLayout) {
                  saveLayout(editingLayout);
                  setLayoutDialogOpen(false);
                }
              }}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar Layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
