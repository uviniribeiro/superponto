'use client';

import { useMutation } from '@tanstack/react-query';
import { Building2, CheckCircle2, FileUp, Upload } from 'lucide-react';
import { useState } from 'react';
import { CompanyActions, fieldCls, labelCls } from '@/components/company-actions';
import { Page, PageHeader } from '@/components/page';
import { useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useCompanyPick } from '@/lib/schedules';

interface Result { total: number; valid: number; duplicates: number; toImport: number; imported: number; errors: Array<{ line: number; message: string }>; preview: Array<{ line: number; name: string; date: string; time: string }> }

export default function ImportarMarcacoesPage() {
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const toast = useToast();
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [employeeKey, setEmployeeKey] = useState<'MATRICULA' | 'CPF'>('MATRICULA');
  const [res, setRes] = useState<Result | null>(null);
  const run = useMutation({
    mutationFn: (dryRun: boolean) => api<Result>('/time-records/import-csv', { method: 'POST', json: { companyId, content, employeeKey, dryRun } }),
    onSuccess: (r, dryRun) => { setRes(r); if (!dryRun) toast('success', `${r.imported} marcação(ões) importada(s)`); },
    onError: (e: Error) => toast('error', e.message),
  });
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const buf = await f.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
    setContent(text); setFileName(f.name); setRes(null);
  };

  return (
    <Page>
      <PageHeader title="Importar marcações" description="Traga marcações de uma planilha (CSV ou TXT): uma por linha, com matrícula (ou CPF), data e hora. Confira antes de gravar; repetir o arquivo não duplica." actions={<CompanyActions {...{ isPlatform, tenantId, pickTenant, companies, companyId, setCompanyId }} />} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="As marcações são importadas por empresa." /></Card> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card className="space-y-4 rounded-[28px]">
            <label className="block space-y-1.5"><span className={labelCls}>Funcionário identificado por</span><select value={employeeKey} onChange={(e) => { setEmployeeKey(e.target.value as 'MATRICULA' | 'CPF'); setRes(null); }} className={fieldCls}><option value="MATRICULA">Matrícula</option><option value="CPF">CPF</option></select></label>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[22px] border border-dashed border-line-strong p-6 text-center text-sm text-muted hover:bg-hover">
              <FileUp className="size-6" />{fileName || 'Escolher arquivo .csv ou .txt'}
              <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            <label className="block space-y-1.5"><span className={labelCls}>Ou cole aqui</span><textarea aria-label="Conteúdo" rows={8} value={content} onChange={(e) => { setContent(e.target.value); setRes(null); }} placeholder={'matricula;data;hora\n1001;01/10/2026;08:00\n1001;01/10/2026;12:00'} className="w-full rounded-2xl border border-line bg-hover px-4 py-3 font-mono text-xs outline-none focus:border-brand" /></label>
            <p className="text-xs text-subtle">Separador: ponto e vírgula, vírgula ou tabulação. Data dd/mm/aaaa ou aaaa-mm-dd; hora hh:mm. A primeira linha pode ser cabeçalho.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => run.mutate(true)} loading={run.isPending && run.variables} disabled={!content.trim() || !companyId}>Conferir</Button>
              <Button onClick={() => run.mutate(false)} loading={run.isPending && !run.variables} disabled={!res || !res.toImport || res.imported > 0}><Upload className="size-4" />Importar {res?.toImport ?? ''}</Button>
            </div>
          </Card>
          <Card className="space-y-3 rounded-[28px]">
            {!res ? <EmptyState icon={CheckCircle2} title="Confira o arquivo" body="Mostramos aqui o que entra, o que já existe e os erros por linha antes de gravar." /> : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([['Linhas', res.total], ['Novas', res.imported || res.toImport], ['Já existiam', res.duplicates], ['Com erro', res.errors.length]] as const).map(([l, v]) => <div key={l} className="rounded-2xl bg-hover p-3"><p className="text-xs text-subtle">{l}</p><p className="text-xl font-semibold">{v}</p></div>)}
                </div>
                {res.imported > 0 && <p className="text-sm text-success">{res.imported} marcação(ões) gravada(s). Elas aparecem no espelho com a origem "Importação".</p>}
                {!!res.errors.length && <div><h3 className="text-sm font-semibold text-danger">Erros</h3><ul className="mt-1 max-h-48 overflow-auto text-sm">{res.errors.map((e) => <li key={e.line}>Linha {e.line}: {e.message}</li>)}</ul></div>}
                {!!res.preview.length && !res.imported && <div><h3 className="text-sm font-semibold">Prévia do que entra</h3><ul className="mt-1 max-h-60 overflow-auto font-mono text-xs">{res.preview.map((p) => <li key={p.line}>{p.date.split('-').reverse().join('/')} {p.time} — {p.name}</li>)}</ul></div>}
              </>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}
