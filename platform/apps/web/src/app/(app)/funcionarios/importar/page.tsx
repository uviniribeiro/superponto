'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, useToast } from '@/components/ui';
import { api, type Company, type Page as Paged } from '@/lib/api';
import { cn } from '@/lib/cn';
import { decodeFile, parseCsv, templateCsv, toImportRows } from '@/lib/csv';

interface Result { line: number; registration: string | null; name: string | null; status: 'ok' | 'created' | 'updated' | 'error' | 'skipped'; messages: string[] }
interface Report { dryRun: boolean; total: number; valid: number; errors: number; created: number; updated: number; toCreate: Record<string, string[]>; results: Result[] }

const BUCKET: Record<string, string> = { departments: 'departamentos', positions: 'cargos', functions: 'funções', costCenters: 'centros de custo', types: 'tipos de funcionário' };

export default function ImportPage() {
  const { tenantId, select, isPlatform } = useActiveTenant();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [companyId, setCompanyId] = useState('');
  const [file, setFile] = useState<{ name: string; rows: Array<Record<string, string>>; ignored: string[]; recognized: string[] } | null>(null);
  const [opts, setOpts] = useState({ createMissing: false, updateExisting: false });
  const [report, setReport] = useState<Report | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);

  const companies = useQuery({ queryKey: ['companies', tenantId, 'all'], queryFn: () => api<Paged<Company>>('/companies?pageSize=200'), enabled: !!tenantId });
  useEffect(() => { const l = companies.data?.data ?? []; if (l.length && !l.some((c) => c.id === companyId)) setCompanyId(l[0]!.id); }, [companies.data, companyId]);

  const run = useMutation({
    mutationFn: (dryRun: boolean) => api<Report>('/employees/import', { method: 'POST', json: { companyId, dryRun, ...opts, rows: file!.rows } }),
    onSuccess: (r) => { setReport(r); if (!r.dryRun) toast('success', `${r.created} cadastrado(s), ${r.updated} atualizado(s)`); },
    onError: (e: Error) => toast('error', e.message),
  });

  async function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast('error', 'Arquivo acima de 10 MB'); return; }
    if (!/\.(csv|txt)$/i.test(f.name)) { toast('error', 'Salve a planilha como CSV (no Excel: Arquivo › Salvar como › CSV)'); return; }
    const parsed = toImportRows(parseCsv(decodeFile(await f.arrayBuffer())));
    if (!parsed.rows.length) { toast('error', 'Nenhuma linha encontrada abaixo do cabeçalho'); return; }
    if (!parsed.recognized.includes('nome') || !parsed.recognized.includes('matricula')) { toast('error', 'A planilha precisa das colunas Nome e Matrícula'); return; }
    setFile({ name: f.name, ...parsed });
    setReport(null);
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'modelo-funcionarios-superponto.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const results = (report?.results ?? []).filter((r) => !onlyErrors || r.status === 'error');
  const toCreate = report ? Object.entries(report.toCreate).filter(([, v]) => v.length) : [];

  return (
    <Page>
      <PageHeader title="Importar funcionários" description="Envie uma planilha CSV: o sistema confere cada linha antes de gravar." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        <Button variant="outline" onClick={downloadTemplate}><Download className="size-4" />Baixar modelo</Button>
      </>} />
      {!tenantId ? (
        <Card><EmptyState icon={FileSpreadsheet} title="Escolha uma organização" body="Selecione acima o cliente que você quer administrar." /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card className="h-fit space-y-5 p-5">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Empresa</span>
              <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setReport(null); }} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
                {companies.data?.data.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}
              </select>
            </label>
            <div>
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" className="hidden" aria-label="Arquivo CSV" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
              <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center transition-colors hover:border-brand/60">
                <Upload className="size-6 text-brand" />
                <span className="text-sm font-medium">{file ? file.name : 'Escolher arquivo CSV'}</span>
                <span className="text-xs text-subtle">{file ? `${file.rows.length} linha(s) · ${file.recognized.length} coluna(s) reconhecida(s)` : 'Separador ; ou , · até 5.000 linhas'}</span>
              </button>
              {file && file.ignored.length > 0 && <p className="mt-2 text-xs text-subtle">Colunas ignoradas: {file.ignored.join(', ')}</p>}
            </div>
            <div className="space-y-2">
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-[var(--brand)]" checked={opts.createMissing} onChange={(e) => { setOpts({ ...opts, createMissing: e.target.checked }); setReport(null); }} /><span>Criar departamentos, cargos, funções, centros de custo e tipos que não existirem<span className="block text-xs text-subtle">Sindicatos precisam estar cadastrados</span></span></label>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-[var(--brand)]" checked={opts.updateExisting} onChange={(e) => { setOpts({ ...opts, updateExisting: e.target.checked }); setReport(null); }} /><span>Atualizar funcionários com matrícula já cadastrada</span></label>
            </div>
            <div className="flex flex-col gap-2">
              <Button disabled={!file || !companyId} loading={run.isPending && run.variables === true} onClick={() => run.mutate(true)} variant="outline">1. Conferir planilha</Button>
              <Button disabled={!report?.dryRun || !report.valid} loading={run.isPending && run.variables === false} onClick={() => run.mutate(false)}>2. Importar {report?.dryRun ? `${report.valid} linha(s) válida(s)` : ''}</Button>
            </div>
            <p className="text-xs text-subtle">Datas em dd/mm/aaaa. Cada linha precisa de nome, matrícula, admissão e CPF ou PIS. <Link href="/funcionarios" className="text-brand">Voltar para funcionários</Link></p>
          </Card>

          <Card className="overflow-hidden">
            {!report ? (
              <EmptyState icon={FileSpreadsheet} title="Nada conferido ainda" body="Escolha o arquivo e clique em Conferir planilha: nada é gravado nessa etapa." />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
                  <span className="font-display text-lg font-bold">{report.dryRun ? 'Conferência' : 'Resultado da importação'}</span>
                  <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">{report.dryRun ? `${report.valid} válida(s)` : `${report.created} cadastrado(s) · ${report.updated} atualizado(s)`}</span>
                  {report.errors > 0 && <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs text-danger">{report.errors} com erro</span>}
                  <label className="ml-auto flex items-center gap-2 text-xs text-muted"><input type="checkbox" className="accent-[var(--brand)]" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />Só erros</label>
                </div>
                {toCreate.length > 0 && (
                  <p className="border-b border-line bg-brand-soft/40 px-5 py-2 text-xs text-muted">{report.dryRun ? 'Serão criados' : 'Foram criados'}: {toCreate.map(([k, v]) => `${BUCKET[k] ?? k} (${v.join(', ')})`).join('; ')}</p>
                )}
                <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
                  {results.map((r) => (
                    <motion.li key={r.line} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                      {r.status === 'error' ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
                      <span className="w-14 shrink-0 font-mono text-xs text-subtle">linha {r.line}</span>
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate', r.status === 'error' && 'text-fg')}>{r.name ?? '(sem nome)'} {r.registration && <span className="font-mono text-xs text-subtle">· {r.registration}</span>}</p>
                        {r.messages.length > 0 && <p className="text-xs text-danger">{r.messages.join(' · ')}</p>}
                      </div>
                      <span className="text-xs text-subtle">{{ ok: 'pronta', created: 'cadastrada', updated: 'atualizada', error: 'erro', skipped: 'ignorada' }[r.status]}</span>
                    </motion.li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}
