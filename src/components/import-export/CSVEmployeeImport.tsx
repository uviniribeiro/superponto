import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Trash2, Loader2, Download, Users } from 'lucide-react';
import { validateCPF, formatCPF, validatePIS, formatPIS } from '@/lib/validators';

interface EmployeeImportRow {
  lineNumber: number;
  nome: string;
  email: string;
  cpf: string;
  cpfFormatted: string;
  pis: string;
  pisFormatted: string;
  matricula: string;
  departamento: string;
  cargo: string;
  telefone: string;
  dataAdmissao: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  selected: boolean;
  exists: boolean;
}

export default function CSVEmployeeImport() {
  const [file, setFile] = useState<File | null>(null);
  const [employees, setEmployees] = useState<EmployeeImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSVFile = async (file: File): Promise<EmployeeImportRow[]> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Arquivo CSV deve conter cabeçalho e pelo menos uma linha de dados');
    }

    // Parse header
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim().replace(/"/g, ''));
    
    // Find column indexes
    const nameIndex = headers.findIndex(h => ['nome', 'name', 'full_name', 'nome_completo'].includes(h));
    const emailIndex = headers.findIndex(h => ['email', 'e-mail', 'e_mail'].includes(h));
    const cpfIndex = headers.findIndex(h => ['cpf', 'cpf_number'].includes(h));
    const pisIndex = headers.findIndex(h => ['pis', 'pis_pasep', 'nit'].includes(h));
    const regIndex = headers.findIndex(h => ['matricula', 'registration_number', 'registro', 'mat'].includes(h));
    const deptIndex = headers.findIndex(h => ['departamento', 'department', 'depto', 'setor'].includes(h));
    const posIndex = headers.findIndex(h => ['cargo', 'position', 'funcao'].includes(h));
    const phoneIndex = headers.findIndex(h => ['telefone', 'phone', 'tel', 'celular'].includes(h));
    const hireDateIndex = headers.findIndex(h => ['data_admissao', 'hire_date', 'admissao', 'dt_admissao'].includes(h));

    if (nameIndex === -1) {
      throw new Error('Coluna "nome" não encontrada no arquivo');
    }
    if (emailIndex === -1) {
      throw new Error('Coluna "email" não encontrada no arquivo');
    }
    if (cpfIndex === -1) {
      throw new Error('Coluna "cpf" não encontrada no arquivo');
    }

    // Check for existing employees
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('cpf, email');

    const existingCPFs = new Set((existingProfiles || []).map(p => p.cpf?.replace(/\D/g, '')).filter(Boolean));
    const existingEmails = new Set((existingProfiles || []).map(p => p.email?.toLowerCase()).filter(Boolean));

    const employees: EmployeeImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
      
      const nome = values[nameIndex] || '';
      const email = values[emailIndex] || '';
      const cpf = values[cpfIndex]?.replace(/\D/g, '') || '';
      const pis = pisIndex !== -1 ? values[pisIndex]?.replace(/\D/g, '') || '' : '';
      const matricula = regIndex !== -1 ? values[regIndex] || '' : '';
      const departamento = deptIndex !== -1 ? values[deptIndex] || '' : '';
      const cargo = posIndex !== -1 ? values[posIndex] || '' : '';
      const telefone = phoneIndex !== -1 ? values[phoneIndex] || '' : '';
      const dataAdmissao = hireDateIndex !== -1 ? values[hireDateIndex] || '' : '';

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate name
      if (!nome || nome.length < 3) {
        errors.push('Nome inválido ou muito curto');
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        errors.push('Email inválido');
      }

      // Validate CPF
      if (!cpf) {
        errors.push('CPF é obrigatório');
      } else {
        const cpfValidation = validateCPF(cpf);
        if (!cpfValidation.valid) {
          errors.push(cpfValidation.message);
        }
      }

      // Validate PIS (optional)
      if (pis) {
        const pisValidation = validatePIS(pis);
        if (!pisValidation.valid) {
          warnings.push(pisValidation.message);
        }
      }

      // Check for duplicates
      const exists = existingCPFs.has(cpf) || existingEmails.has(email.toLowerCase());
      if (exists) {
        warnings.push('Funcionário já cadastrado');
      }

      employees.push({
        lineNumber: i + 1,
        nome,
        email,
        cpf,
        cpfFormatted: cpf ? formatCPF(cpf) : '',
        pis,
        pisFormatted: pis ? formatPIS(pis) : '',
        matricula,
        departamento,
        cargo,
        telefone,
        dataAdmissao,
        valid: errors.length === 0,
        errors,
        warnings,
        selected: errors.length === 0 && !exists,
        exists,
      });
    }

    return employees;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportComplete(false);

    try {
      const parsed = await parseCSVFile(selectedFile);
      setEmployees(parsed);

      const validCount = parsed.filter(e => e.valid && !e.exists).length;
      const invalidCount = parsed.filter(e => !e.valid).length;
      const existsCount = parsed.filter(e => e.exists).length;

      if (invalidCount > 0) {
        toast.warning(`${parsed.length} linhas processadas. ${invalidCount} com erros.`);
      } else {
        toast.success(`${parsed.length} funcionários encontrados. ${validCount} válidos para importação.`);
      }
    } catch (error: any) {
      console.error('Error parsing CSV:', error);
      toast.error(error.message || 'Erro ao processar arquivo CSV');
    }
  };

  const toggleEmployeeSelection = (lineNumber: number) => {
    setEmployees(prev =>
      prev.map(emp =>
        emp.lineNumber === lineNumber && emp.valid && !emp.exists
          ? { ...emp, selected: !emp.selected }
          : emp
      )
    );
  };

  const selectAllValid = () => {
    setEmployees(prev =>
      prev.map(emp => ({
        ...emp,
        selected: emp.valid && !emp.exists
      }))
    );
  };

  const deselectAll = () => {
    setEmployees(prev =>
      prev.map(emp => ({ ...emp, selected: false }))
    );
  };

  const handleImport = async () => {
    const selectedEmployees = employees.filter(e => e.selected);
    if (selectedEmployees.length === 0) {
      toast.error('Nenhum funcionário selecionado para importação');
      return;
    }

    setImporting(true);

    try {
      let imported = 0;
      let errors = 0;

      for (const emp of selectedEmployees) {
        try {
          // Create auth user with temporary password
          const tempPassword = `Temp${Date.now().toString(36)}!${Math.random().toString(36).slice(2, 6)}`;
          
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: emp.email,
            password: tempPassword,
            options: {
              data: {
                full_name: emp.nome,
              }
            }
          });

          if (authError) {
            // If user exists, try to find and update profile
            if (authError.message.includes('already registered')) {
              errors++;
              continue;
            }
            throw authError;
          }

          if (!authData.user) {
            errors++;
            continue;
          }

          // Parse hire date if provided
          let hireDate: string | null = null;
          if (emp.dataAdmissao) {
            // Try different date formats
            const dateFormats = [
              /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
              /^(\d{4})-(\d{2})-(\d{2})$/,   // YYYY-MM-DD
              /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
            ];
            
            for (const format of dateFormats) {
              const match = emp.dataAdmissao.match(format);
              if (match) {
                if (format.toString().includes('YYYY-MM-DD')) {
                  hireDate = emp.dataAdmissao;
                } else {
                  // DD/MM/YYYY or DD-MM-YYYY
                  hireDate = `${match[3]}-${match[2]}-${match[1]}`;
                }
                break;
              }
            }
          }

          // Create profile
          const { error: profileError } = await supabase.from('profiles').insert({
            user_id: authData.user.id,
            email: emp.email,
            full_name: emp.nome,
            cpf: emp.cpf,
            pis: emp.pis || null,
            registration_number: emp.matricula || null,
            department: emp.departamento || null,
            position: emp.cargo || null,
            phone: emp.telefone || null,
            hire_date: hireDate,
            is_active: true,
            must_change_password: true,
          });

          if (profileError) {
            console.error('Profile error:', profileError);
            errors++;
            continue;
          }

          // Assign employee role
          await supabase.from('user_roles').insert({
            user_id: authData.user.id,
            role: 'employee'
          });

          imported++;
        } catch (err) {
          console.error('Error importing employee:', emp.nome, err);
          errors++;
        }
      }

      setImportComplete(true);
      toast.success(`Importação concluída! ${imported} funcionários importados, ${errors} erros.`);
      
      if (imported > 0) {
        toast.info('Os funcionários importados receberão um email para definir suas senhas.', { duration: 10000 });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro durante a importação');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['nome', 'email', 'cpf', 'pis', 'matricula', 'departamento', 'cargo', 'telefone', 'data_admissao'];
    const example = ['João Silva', 'joao.silva@empresa.com', '12345678909', '12345678901', '001', 'TI', 'Analista', '11999999999', '01/01/2024'];
    
    const content = headers.join(';') + '\r\n' + example.join(';');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_importacao_funcionarios.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Modelo baixado com sucesso!');
  };

  const validCount = employees.filter(e => e.valid && !e.exists).length;
  const invalidCount = employees.filter(e => !e.valid).length;
  const existsCount = employees.filter(e => e.exists).length;
  const selectedCount = employees.filter(e => e.selected).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Importação de Funcionários via CSV
        </CardTitle>
        <CardDescription>
          Importe funcionários em lote com validação de CPF e PIS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Download */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div>
            <h4 className="font-semibold">Modelo de Arquivo CSV</h4>
            <p className="text-sm text-muted-foreground">
              Baixe o modelo com os campos corretos para importação
            </p>
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Modelo
          </Button>
        </div>

        {/* File Selection */}
        <div className="space-y-2">
          <Label>Selecionar Arquivo CSV</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Colunas obrigatórias: nome, email, cpf | Opcionais: pis, matricula, departamento, cargo, telefone, data_admissao
          </p>
        </div>

        {/* Statistics */}
        {employees.length > 0 && (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{employees.length}</p>
              <p className="text-xs text-muted-foreground">Total de linhas</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">{validCount}</p>
              <p className="text-xs text-muted-foreground">Válidos para importação</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-600">{existsCount}</p>
              <p className="text-xs text-muted-foreground">Já cadastrados</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">{invalidCount}</p>
              <p className="text-xs text-muted-foreground">Com erros</p>
            </div>
          </div>
        )}

        {/* Preview Table */}
        {employees.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Prévia dos Funcionários ({selectedCount} selecionados)</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllValid}>
                  Selecionar Válidos
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Limpar Seleção
                </Button>
              </div>
            </div>

            <div className="max-h-96 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>PIS</TableHead>
                    <TableHead>Erros/Avisos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow
                      key={emp.lineNumber}
                      className={`cursor-pointer ${!emp.valid ? 'bg-destructive/10' : emp.exists ? 'bg-amber-500/10' : ''}`}
                      onClick={() => toggleEmployeeSelection(emp.lineNumber)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={emp.selected}
                          disabled={!emp.valid || emp.exists}
                          onCheckedChange={() => toggleEmployeeSelection(emp.lineNumber)}
                        />
                      </TableCell>
                      <TableCell>
                        {emp.valid && !emp.exists ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : emp.exists ? (
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{emp.lineNumber}</TableCell>
                      <TableCell className="font-medium">{emp.nome}</TableCell>
                      <TableCell className="text-sm">{emp.email}</TableCell>
                      <TableCell className="font-mono text-xs">{emp.cpfFormatted || emp.cpf}</TableCell>
                      <TableCell className="font-mono text-xs">{emp.pisFormatted || emp.pis || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {emp.errors.map((err, idx) => (
                            <Badge key={idx} variant="destructive" className="text-xs">
                              {err}
                            </Badge>
                          ))}
                          {emp.warnings.map((warn, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {warn}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setEmployees([]);
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
                disabled={importing || selectedCount === 0}
                className="gradient-primary"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar {selectedCount} Funcionários
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <h4 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Instruções de Importação
          </h4>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
            <li>O arquivo deve estar no formato CSV com delimitador ";" ou ","</li>
            <li>A primeira linha deve conter os nomes das colunas</li>
            <li>CPF e PIS serão validados automaticamente</li>
            <li>Funcionários já cadastrados serão identificados e não serão duplicados</li>
            <li>Os funcionários importados receberão um email para definir suas senhas</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
