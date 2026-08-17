import React, { useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Upload, Download, FileSpreadsheet, FileText, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Database, Trash2, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  importSchemas, importGroups, buildCsvTemplate, buildTxtTemplate,
  type ImportSchema, type ImportField,
} from '@/config/importSchemas';
import CSVEmployeeImport from '@/components/import-export/CSVEmployeeImport';

type FileMode = 'delimited' | 'fixed';

interface ParsedRow {
  line: number;
  values: Record<string, string>;
  record: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const truthy = ['1', 'sim', 's', 'true', 'ativo', 'yes', 'y', 'verdadeiro'];
const falsy = ['0', 'nao', 'n', 'false', 'inativo', 'no', 'falso'];

function parseDateBR(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  let m = v.match(/^(\d{2})\/?(\d{2})\/?(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return v;
  m = v.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseDateTimeBR(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, ' ');
  if (!v) return null;
  const [datePart, timePart = '00:00'] = v.split(' ');
  const date = parseDateBR(datePart);
  if (!date) return null;
  const t = timePart.match(/^(\d{2}):?(\d{2})(?::?(\d{2}))?$/);
  if (!t) return null;
  return `${date}T${t[1]}:${t[2]}:${t[3] ?? '00'}`;
}

function detectDelimiter(line: string): string {
  const candidates = [';', ',', '\t', '|'];
  let best = ';';
  let max = 0;
  for (const c of candidates) {
    const n = line.split(c).length - 1;
    if (n > max) {
      max = n;
      best = c;
    }
  }
  return max === 0 ? ';' : best;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function coerce(field: ImportField, raw: string, errors: string[]): unknown {
  const value = (raw ?? '').trim();
  if (!value) {
    if (field.required) errors.push(`${field.label}: obrigatório`);
    return field.defaultValue !== undefined ? field.defaultValue : null;
  }
  switch (field.type) {
    case 'number': {
      const n = Number(value.replace(',', '.'));
      if (Number.isNaN(n)) {
        errors.push(`${field.label}: número inválido (${value})`);
        return null;
      }
      return n;
    }
    case 'boolean': {
      const v = normalize(value);
      if (truthy.includes(v)) return true;
      if (falsy.includes(v)) return false;
      errors.push(`${field.label}: use SIM/NAO`);
      return field.defaultValue ?? null;
    }
    case 'date': {
      const d = parseDateBR(value);
      if (!d) errors.push(`${field.label}: data inválida (${value}) — use DD/MM/AAAA`);
      return d;
    }
    case 'datetime': {
      const d = parseDateTimeBR(value);
      if (!d) errors.push(`${field.label}: data/hora inválida (${value}) — use DD/MM/AAAA HH:MM`);
      return d;
    }
    case 'time': {
      const t = value.match(/^(\d{1,2}):?(\d{2})$/);
      if (!t) {
        errors.push(`${field.label}: hora inválida (${value})`);
        return null;
      }
      return `${t[1].padStart(2, '0')}:${t[2]}`;
    }
    case 'cpf':
    case 'pis':
    case 'cnpj': {
      const digits = field.type === 'cnpj' ? value.replace(/[^0-9A-Za-z]/g, '').toUpperCase() : value.replace(/\D/g, '');
      const expected = field.type === 'cpf' ? 11 : field.type === 'pis' ? 11 : 14;
      if (digits.length !== expected) errors.push(`${field.label}: deve ter ${expected} caracteres`);
      return digits;
    }
    case 'enum': {
      const v = normalize(value);
      const match = field.options?.find((o) => normalize(o) === v);
      if (!match) {
        errors.push(`${field.label}: valor inválido (${value}). Opções: ${field.options?.join(', ')}`);
        return field.defaultValue ?? null;
      }
      return match;
    }
    default:
      return value;
  }
}

export default function DataImport() {
  const { profile } = useAuth();
  const companyId = (profile as { company_id?: string } | null)?.company_id ?? null;

  const [schemaId, setSchemaId] = useState<string>('departments');
  const [mode, setMode] = useState<FileMode>('delimited');
  const [delimiter, setDelimiter] = useState<string>(';');
  const [hasHeader, setHasHeader] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const schema = useMemo(() => importSchemas.find((s) => s.id === schemaId)!, [schemaId]);
  const validRows = rows.filter((r) => r.errors.length === 0);

  const reset = () => {
    setRawLines([]);
    setHeaders([]);
    setMapping({});
    setRows([]);
    setResult(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const autoMap = (hdrs: string[], target: ImportSchema) => {
    const map: Record<string, number> = {};
    target.fields.forEach((f) => {
      const names = [normalize(f.label), normalize(f.key), ...(f.aliases ?? []).map(normalize)];
      const idx = hdrs.findIndex((h) => names.includes(normalize(h)));
      if (idx >= 0) map[f.key] = idx;
    });
    return map;
  };

  const handleFile = async (file: File) => {
    reset();
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trimStart().startsWith('#'));
    if (!lines.length) {
      toast.error('Arquivo vazio');
      return;
    }
    setFileName(file.name);
    setRawLines(lines);

    const isTxt = file.name.toLowerCase().endsWith('.txt');
    const detected = detectDelimiter(lines[0]);
    const fixed = isTxt && lines[0].split(detected).length === 1;
    setMode(fixed ? 'fixed' : 'delimited');
    setDelimiter(detected);

    if (fixed) {
      setHeaders(schema.fields.map((f) => f.label));
      setMapping(Object.fromEntries(schema.fields.map((f, i) => [f.key, i])));
    } else {
      const first = splitCsvLine(lines[0], detected);
      const looksHeader = schema.fields.some((f) =>
        first.some((h) => [normalize(f.label), normalize(f.key), ...(f.aliases ?? []).map(normalize)].includes(normalize(h))),
      );
      setHasHeader(looksHeader);
      const hdrs = looksHeader ? first : first.map((_, i) => `Coluna ${i + 1}`);
      setHeaders(hdrs);
      setMapping(looksHeader ? autoMap(hdrs, schema) : Object.fromEntries(schema.fields.map((f, i) => [f.key, i])));
    }
    toast.success(`${lines.length} linha(s) carregada(s)`);
  };

  const splitFixed = (line: string): string[] => {
    let pos = 0;
    return schema.fields.map((f) => {
      const w = f.width ?? 30;
      const v = line.substring(pos, pos + w).trim();
      pos += w;
      return v;
    });
  };

  const analyze = () => {
    if (!rawLines.length) return;
    const dataLines = mode === 'delimited' && hasHeader ? rawLines.slice(1) : rawLines;
    const parsed: ParsedRow[] = dataLines.map((line, i) => {
      const cols = mode === 'fixed' ? splitFixed(line) : splitCsvLine(line, delimiter);
      const errors: string[] = [];
      const warnings: string[] = [];
      const values: Record<string, string> = {};
      const record: Record<string, unknown> = {};

      schema.fields.forEach((f) => {
        const idx = mapping[f.key];
        const raw = idx !== undefined && idx >= 0 ? (cols[idx] ?? '') : '';
        values[f.key] = raw;
        const v = coerce(f, raw, errors);
        if (f.key.startsWith('__')) return;
        if (v !== null && v !== undefined && v !== '') record[f.key] = v;
        else if (v === false) record[f.key] = false;
      });

      if (schema.employeeLookup && !values.__employee) {
        errors.push('Funcionário não informado');
      }
      if (!cols.some((c) => c.trim())) errors.push('Linha vazia');
      return { line: i + 1 + (mode === 'delimited' && hasHeader ? 1 : 0), values, record, errors, warnings };
    });
    setRows(parsed);
    setResult(null);
    const invalid = parsed.filter((r) => r.errors.length).length;
    if (invalid) toast.warning(`${invalid} linha(s) com erro. Corrija ou importe apenas as válidas.`);
    else toast.success('Todas as linhas estão válidas');
  };

  const runImport = async () => {
    if (!validRows.length) return;
    if (!companyId) {
      toast.error('Empresa não identificada no seu perfil');
      return;
    }
    setImporting(true);
    try {
      const payload: Record<string, unknown>[] = [];

      let employeeIndex: Record<string, string> = {};
      if (schema.employeeLookup) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, cpf, pis, registration_number')
          .eq('company_id', companyId);
        employeeIndex = {};
        (profiles ?? []).forEach((p) => {
          [p.cpf, p.pis, p.registration_number].forEach((k) => {
            if (k) employeeIndex[String(k).replace(/\D/g, '') || String(k)] = p.id;
          });
        });
      }

      const skipped: number[] = [];
      for (const row of validRows) {
        const record: Record<string, unknown> = { ...row.record, company_id: companyId };
        if (schema.employeeLookup) {
          const key = row.values.__employee.trim();
          const pid = employeeIndex[key.replace(/\D/g, '')] ?? employeeIndex[key];
          if (!pid) {
            skipped.push(row.line);
            continue;
          }
          record.profile_id = pid;
        }
        if (schema.id === 'employee_absences') {
          const start = new Date(String(record.start_date));
          const end = new Date(String(record.end_date));
          record.total_days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
        }
        if (schema.id === 'vacation_periods') {
          const entitled = Number(record.days_entitled ?? 30);
          const taken = Number(record.days_taken ?? 0);
          record.days_remaining = Math.max(0, entitled - taken);
        }
        payload.push(record);
      }

      let ok = 0;
      let fail = 0;
      const chunkSize = 200;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from(schema.table as never).insert(chunk as never);
        if (error) {
          fail += chunk.length;
          toast.error(`Erro ao importar lote ${i / chunkSize + 1}: ${error.message}`);
        } else {
          ok += chunk.length;
        }
      }

      if (skipped.length) {
        toast.warning(`${skipped.length} linha(s) ignorada(s): funcionário não localizado (linhas ${skipped.slice(0, 8).join(', ')}${skipped.length > 8 ? '…' : ''})`);
      }
      setResult({ ok, fail: fail + skipped.length });
      if (ok) toast.success(`${ok} registro(s) importado(s) em ${schema.label}`);
    } catch (e) {
      toast.error(`Falha na importação: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const download = (content: string, name: string) => {
    const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Upload}
        title="Importação de Dados"
        description="Importe cadastros e movimentos do sistema a partir de arquivos CSV ou TXT posicional"
      />

      <Tabs defaultValue="generic" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generic">Importação Geral</TabsTrigger>
          <TabsTrigger value="employees">Funcionários (Layout Padrão)</TabsTrigger>
          <TabsTrigger value="layouts">Layouts e Modelos</TabsTrigger>
        </TabsList>

        {/* ---------- Importação Geral ---------- */}
        <TabsContent value="generic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-primary" /> 1. Escolha o que importar
              </CardTitle>
              <CardDescription>Selecione a tabela de destino dos dados do arquivo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {importGroups.map((group) => (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {importSchemas
                      .filter((s) => s.group === group)
                      .map((s) => {
                        const Icon = s.icon;
                        const active = s.id === schemaId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSchemaId(s.id);
                              reset();
                            }}
                            className={cn(
                              'flex items-start gap-3 rounded-2xl border p-3 text-left transition-all hover:shadow-md',
                              active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card',
                            )}
                          >
                            <span className={cn('rounded-xl p-2', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{s.label}</span>
                              <span className="block text-xs text-muted-foreground line-clamp-2">{s.description}</span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="h-5 w-5 text-primary" /> 2. Envie o arquivo — {schema.label}
                </CardTitle>
                <CardDescription>Aceita CSV (;, vírgula, tab ou pipe) e TXT posicional</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => download(buildCsvTemplate(schema), `modelo_${schema.id}.csv`)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Modelo CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => download(buildTxtTemplate(schema), `layout_${schema.id}.txt`)}>
                  <FileText className="mr-2 h-4 w-4" /> Layout TXT
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Arquivo (.csv ou .txt)</Label>
                  <Input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Formato</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as FileMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delimited">Delimitado (CSV)</SelectItem>
                      <SelectItem value="fixed">Posicional (TXT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Separador</Label>
                  <Select value={delimiter} onValueChange={setDelimiter} disabled={mode === 'fixed'}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=";">Ponto e vírgula (;)</SelectItem>
                      <SelectItem value=",">Vírgula (,)</SelectItem>
                      <SelectItem value={'\t'}>Tabulação</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {fileName && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium">{fileName}</span>
                  <Badge variant="secondary">{rawLines.length} linha(s)</Badge>
                  <Badge variant="outline">{mode === 'fixed' ? 'Posicional' : 'Delimitado'}</Badge>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remover
                  </Button>
                </div>
              )}

              {!!headers.length && mode === 'delimited' && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">3. Relacione as colunas</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {schema.fields.map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label className="flex items-center gap-1">
                          {f.label} {f.required && <span className="text-destructive">*</span>}
                        </Label>
                        <Select
                          value={mapping[f.key] !== undefined ? String(mapping[f.key]) : 'none'}
                          onValueChange={(v) =>
                            setMapping((m) => {
                              const next = { ...m };
                              if (v === 'none') delete next[f.key];
                              else next[f.key] = Number(v);
                              return next;
                            })
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Não importar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Não importar</SelectItem>
                            {headers.map((h, i) => (
                              <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button onClick={analyze} disabled={!rawLines.length}>
                  <ArrowRight className="mr-2 h-4 w-4" /> Validar arquivo
                </Button>
                <Button onClick={runImport} disabled={!validRows.length || importing} variant="default">
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Importar {validRows.length ? `${validRows.length} registro(s)` : ''}
                </Button>
              </div>

              {result && (
                <div className="flex flex-wrap gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
                  <span className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> {result.ok} importado(s)</span>
                  <span className="flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4" /> {result.fail} não importado(s)</span>
                </div>
              )}
            </CardContent>
          </Card>

          {!!rows.length && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pré-visualização</CardTitle>
                <CardDescription>
                  {validRows.length} válida(s) · {rows.length - validRows.length} com erro
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        <TableHead className="w-28">Situação</TableHead>
                        {schema.fields.map((f) => (
                          <TableHead key={f.key}>{f.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 300).map((r) => (
                        <TableRow key={r.line} className={r.errors.length ? 'bg-destructive/5' : undefined}>
                          <TableCell className="font-mono text-xs">{r.line}</TableCell>
                          <TableCell>
                            {r.errors.length ? (
                              <span title={r.errors.join(' • ')} className="flex items-center gap-1 text-xs text-destructive">
                                <AlertTriangle className="h-3.5 w-3.5" /> {r.errors.length} erro(s)
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" /> OK
                              </span>
                            )}
                          </TableCell>
                          {schema.fields.map((f) => (
                            <TableCell key={f.key} className="whitespace-nowrap text-xs">{r.values[f.key] || '—'}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {rows.some((r) => r.errors.length) && (
                  <div className="mt-4 space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
                    <p className="font-semibold text-destructive">Erros encontrados</p>
                    {rows.filter((r) => r.errors.length).slice(0, 10).map((r) => (
                      <p key={r.line}>Linha {r.line}: {r.errors.join(' • ')}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---------- Funcionários ---------- */}
        <TabsContent value="employees">
          <CSVEmployeeImport />
        </TabsContent>

        {/* ---------- Layouts ---------- */}
        <TabsContent value="layouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Layouts padrão de importação</CardTitle>
              <CardDescription>Baixe o modelo CSV (com cabeçalho) ou a documentação do layout TXT posicional</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Campos</TableHead>
                    <TableHead>Obrigatórios</TableHead>
                    <TableHead className="text-right">Modelos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importSchemas.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      </TableCell>
                      <TableCell className="text-sm">{s.fields.length}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.fields.filter((f) => f.required).map((f) => f.label).join(', ') || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => download(buildCsvTemplate(s), `modelo_${s.id}.csv`)}>
                            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => download(buildTxtTemplate(s), `layout_${s.id}.txt`)}>
                            <Download className="mr-1.5 h-3.5 w-3.5" /> TXT
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
