import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface EmployeeRow {
  full_name: string;
  login: string;
  password: string;
  cpf?: string;
  pis?: string;
  registration_number?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  phone?: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export function CsvImportDialog({ open, onOpenChange, onImportComplete }: CsvImportDialogProps) {
  const { createEmployee } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<EmployeeRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  const downloadTemplate = () => {
    const headers = 'nome_completo,login,senha,cpf,pis,matricula,departamento,cargo,data_admissao,telefone';
    const example = 'João Silva,joao.silva,senha123,123.456.789-00,12345678901,EMP001,TI,Desenvolvedor,2024-01-15,11999999999';
    const csvContent = `${headers}\n${example}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_importacao_funcionarios.csv';
    link.click();
  };

  const parseCSV = (text: string): EmployeeRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const rows: EmployeeRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 3) continue;

      const getVal = (key: string) => {
        const idx = headers.findIndex(h => 
          h.includes(key) || h === key
        );
        return idx >= 0 ? values[idx] : '';
      };

      const row: EmployeeRow = {
        full_name: getVal('nome') || getVal('name') || getVal('full_name') || getVal('nome_completo') || values[0],
        login: getVal('login') || getVal('usuario') || values[1],
        password: getVal('senha') || getVal('password') || values[2],
        cpf: getVal('cpf'),
        pis: getVal('pis'),
        registration_number: getVal('matricula') || getVal('registration'),
        department: getVal('departamento') || getVal('department'),
        position: getVal('cargo') || getVal('position'),
        hire_date: getVal('data_admissao') || getVal('hire_date') || getVal('admissao'),
        phone: getVal('telefone') || getVal('phone') || getVal('celular'),
        status: 'pending'
      };

      // Validate required fields
      if (!row.full_name || !row.login || !row.password) {
        row.status = 'error';
        row.error = 'Nome, login e senha são obrigatórios';
      } else if (row.password.length < 6) {
        row.status = 'error';
        row.error = 'Senha deve ter pelo menos 6 caracteres';
      } else if (row.login.length < 3) {
        row.status = 'error';
        row.error = 'Login deve ter pelo menos 3 caracteres';
      }

      rows.push(row);
    }

    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      setParsedData(data);
      setImportComplete(false);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(r => r.status === 'pending');
    if (validRows.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    const updatedData = [...parsedData];

    for (let i = 0; i < updatedData.length; i++) {
      const row = updatedData[i];
      if (row.status !== 'pending') continue;

      try {
        const { error } = await createEmployee({
          username: row.login,
          password: row.password,
          fullName: row.full_name,
          cpf: row.cpf,
          pis: row.pis,
          registration_number: row.registration_number,
          department: row.department,
          position: row.position,
          hire_date: row.hire_date,
          phone: row.phone
        });

        if (error) {
          updatedData[i] = { ...row, status: 'error', error: error.message };
          errorCount++;
        } else {
          updatedData[i] = { ...row, status: 'success' };
          successCount++;
        }
      } catch (err: any) {
        updatedData[i] = { ...row, status: 'error', error: err.message || 'Erro desconhecido' };
        errorCount++;
      }

      setParsedData([...updatedData]);
    }

    setImporting(false);
    setImportComplete(true);

    if (successCount > 0) {
      toast.success(`${successCount} funcionário(s) importado(s) com sucesso!`);
      onImportComplete();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erro(s) durante a importação`);
    }
  };

  const handleClose = () => {
    setParsedData([]);
    setImportComplete(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const pendingCount = parsedData.filter(r => r.status === 'pending').length;
  const successCount = parsedData.filter(r => r.status === 'success').length;
  const errorCount = parsedData.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Funcionários via CSV
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV com os dados dos funcionários
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Template download and file upload */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Baixar Modelo CSV
            </Button>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2"
              >
                <Upload className="h-4 w-4" />
                Selecionar Arquivo CSV
              </Button>
            </div>
          </div>

          {/* Stats */}
          {parsedData.length > 0 && (
            <div className="flex gap-4">
              <Badge variant="outline" className="gap-1">
                Total: {parsedData.length}
              </Badge>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Pendentes: {pendingCount}
                </Badge>
              )}
              {successCount > 0 && (
                <Badge className="gap-1 bg-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Sucesso: {successCount}
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Erros: {errorCount}
                </Badge>
              )}
            </div>
          )}

          {/* Preview table */}
          {parsedData.length > 0 && (
            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {row.status === 'pending' && (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        )}
                        {row.status === 'success' && (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                        {row.status === 'error' && (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.full_name}</TableCell>
                      <TableCell>{row.login}</TableCell>
                      <TableCell>{row.department || '-'}</TableCell>
                      <TableCell>{row.position || '-'}</TableCell>
                      <TableCell className="text-destructive text-sm">
                        {row.error || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {parsedData.length === 0 && (
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                Selecione um arquivo CSV para visualizar os dados antes de importar.
                O arquivo deve conter as colunas: nome_completo, email, senha (obrigatórios), 
                cpf, pis, matricula, departamento, cargo, data_admissao, telefone (opcionais).
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {importComplete ? 'Fechar' : 'Cancelar'}
          </Button>
          {!importComplete && pendingCount > 0 && (
            <Button 
              onClick={handleImport} 
              disabled={importing}
              className="gradient-primary"
            >
              {importing ? 'Importando...' : `Importar ${pendingCount} Funcionário(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
