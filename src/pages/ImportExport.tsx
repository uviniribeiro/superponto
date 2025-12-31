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
  const [activeTab, setActiveTab] = useState('import');
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRecords, setImportRecords] = useState<AFDRecord[]>([]);
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

  // ========== IMPORT FUNCTIONS ==========
  
  const parseAFDFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const records: AFDRecord[] = [];
    
    for (const line of lines) {
      // Skip header (type 1) and trailer (type 9)
      const recordType = line.charAt(0);
      
      if (recordType === '3') {
        // Portaria 1510/671 - Registro de marcação
        // Formato: Tipo(1) + NSR(9) + TipoIdent(1) + PIS(11) + Data(8) + Hora(4)
        try {
          const nsr = parseInt(line.substring(1, 10));
          const pis = line.substring(11, 22).trim();
          const dateStr = line.substring(22, 30);
          const timeStr = line.substring(30, 34);
          
          const day = dateStr.substring(0, 2);
          const month = dateStr.substring(2, 4);
          const year = dateStr.substring(4, 8);
          const hour = timeStr.substring(0, 2);
          const minute = timeStr.substring(2, 4);
          
          const formattedDate = `${day}/${month}/${year}`;
          const formattedTime = `${hour}:${minute}`;
          
          // Find matching profile by PIS
          const matchedProfile = profiles.find(p => p.pis === pis);
          
          records.push({
            nsr,
            pis,
            date: formattedDate,
            time: formattedTime,
            recordType: 'marcacao',
            matched: !!matchedProfile,
            profileId: matchedProfile?.id || null,
            profileName: matchedProfile?.full_name || null,
          });
        } catch (e) {
          console.error('Error parsing line:', line, e);
        }
      } else if (recordType === '2') {
        // Portaria 373 - Registro simplificado
        // Formato pode variar, tentar formato comum
        try {
          const parts = line.split(';');
          if (parts.length >= 4) {
            const pis = parts[1]?.trim();
            const dateStr = parts[2]?.trim();
            const timeStr = parts[3]?.trim();
            
            const matchedProfile = profiles.find(p => p.pis === pis);
            
            records.push({
              nsr: records.length + 1,
              pis,
              date: dateStr,
              time: timeStr,
              recordType: 'marcacao',
              matched: !!matchedProfile,
              profileId: matchedProfile?.id || null,
              profileName: matchedProfile?.full_name || null,
            });
          }
        } catch (e) {
          console.error('Error parsing Portaria 373 line:', line, e);
        }
      }
    }
    
    // Try CSV format if no records found
    if (records.length === 0 && (file.name.endsWith('.csv') || text.includes(';') || text.includes(','))) {
      const delimiter = text.includes(';') ? ';' : ',';
      const csvLines = text.split(/\r?\n/).filter(line => line.trim());
      
      // Skip header if present
      const startIndex = csvLines[0]?.toLowerCase().includes('pis') || 
                        csvLines[0]?.toLowerCase().includes('matricula') ? 1 : 0;
      
      for (let i = startIndex; i < csvLines.length; i++) {
        const parts = csvLines[i].split(delimiter);
        if (parts.length >= 3) {
          const pis = parts[0]?.trim().replace(/\D/g, '');
          const dateStr = parts[1]?.trim();
          const timeStr = parts[2]?.trim();
          
          const matchedProfile = profiles.find(p => 
            p.pis === pis || p.registration_number === parts[0]?.trim()
          );
          
          records.push({
            nsr: i,
            pis,
            date: dateStr,
            time: timeStr,
            recordType: 'marcacao',
            matched: !!matchedProfile,
            profileId: matchedProfile?.id || null,
            profileName: matchedProfile?.full_name || null,
          });
        }
      }
    }
    
    return records;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    setImportComplete(false);
    
    try {
      const records = await parseAFDFile(file);
      setImportRecords(records);
      
      const matched = records.filter(r => r.matched).length;
      const unmatched = records.length - matched;
      
      toast.success(`${records.length} registros encontrados. ${matched} vinculados, ${unmatched} não vinculados.`);
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
        
        for (const [dateKey, records] of Object.entries(profileRecords)) {
          const dayRecords = records.sort((a: any, b: any) => 
            new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
          );
          
          const recordData: Record<string, string> = {
            company_code: '00001',
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
        if (Object.keys(profileRecords).length === 0 && selectedLayout.id !== 'gaia') {
          const recordData: Record<string, string> = {
            company_code: '00001',
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

  const openLayoutEditor = (layout?: ExportLayout) => {
    if (layout) {
      setEditingLayout({ ...layout, id: layout.id === 'gaia' ? `custom_${Date.now()}` : layout.id });
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
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="import" className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Importação
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Exportação
          </TabsTrigger>
        </TabsList>

        {/* ========== IMPORT TAB ========== */}
        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importar Arquivo AFD
              </CardTitle>
              <CardDescription>
                Compatível com equipamentos Portaria 1510, 373 e 671 do MTE. Formatos: .txt e .csv
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Label>Selecionar Arquivo</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.csv"
                      onChange={handleFileSelect}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {importFile && (
                <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">{importFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(importFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{importRecords.length} registros</Badge>
                    <Badge variant="default" className="bg-green-500">{matchedCount} vinculados</Badge>
                    {unmatchedCount > 0 && (
                      <Badge variant="destructive">{unmatchedCount} não vinculados</Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {importRecords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Prévia dos Registros</CardTitle>
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
                        <TableHead>NSR</TableHead>
                        <TableHead>PIS</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Funcionário</TableHead>
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
                          <TableCell className="font-mono">{record.nsr}</TableCell>
                          <TableCell className="font-mono">{record.pis}</TableCell>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>{record.time}</TableCell>
                          <TableCell>
                            {record.profileName || (
                              <span className="text-muted-foreground italic">PIS não cadastrado</span>
                            )}
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
                    {selectedLayout?.id === 'gaia' ? 'Criar Baseado' : 'Editar'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openLayoutEditor()}
                  >
                    Novo Layout
                  </Button>
                </div>

                {selectedLayout && selectedLayout.id !== 'gaia' && (
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
                <Label>Campos</Label>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Ativo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="w-20">Tamanho</TableHead>
                        <TableHead className="w-24">Preenchimento</TableHead>
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
                              <SelectContent>
                                <SelectItem value="registration_number">Matrícula</SelectItem>
                                <SelectItem value="full_name">Nome</SelectItem>
                                <SelectItem value="cpf">CPF</SelectItem>
                                <SelectItem value="pis">PIS</SelectItem>
                                <SelectItem value="department">Departamento</SelectItem>
                                <SelectItem value="position">Cargo</SelectItem>
                                <SelectItem value="hire_date">Data Admissão</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="company_code">Cód. Empresa</SelectItem>
                                <SelectItem value="record_date">Data Registro</SelectItem>
                                <SelectItem value="entry_time">Hora Entrada</SelectItem>
                                <SelectItem value="break_start_time">Saída Intervalo</SelectItem>
                                <SelectItem value="break_end_time">Retorno Intervalo</SelectItem>
                                <SelectItem value="exit_time">Hora Saída</SelectItem>
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
