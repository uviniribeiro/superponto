'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { BarChart3, Building2, FileSpreadsheet, FileText, Play, Printer, Search, Wand2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Skeleton, useToast } from '@/components/ui';
import { api, type Page as Paged, type Ref } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick } from '@/lib/schedules';
import { addDays, monthRange, todayBr } from '@/lib/timesheet';

type ColType = 'text' | 'minutes' | 'number' | 'date' | 'percent' | 'datetime';
interface Catalog { reports: Array<{ key: string; title: string; category: string; description: string; period: 'required' | 'optional' | 'none' }>; builderFields: Array<{ key: string; label: string; type: ColType }> }
interface Result { key: string; title: string; columns: Array<{ key: string; label: string; type?: ColType }>; rows: Array<Record<string, unknown>>; totals: Record<string, number>; generatedAt: string }
type Dept = Ref & { depth: number };

const fmt = (v: unknown, type?: ColType) => {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'minutes') { const m = Number(v), a = Math.abs(m); return `${m < 0 ? '−' : ''}${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}`; }
  if (type === 'percent') return `${(Number(v) * 100).toFixed(1).replace('.', ',')}%`;
  if (type === 'date') return String(v).split('-').reverse().join('/');
  if (type === 'datetime') return new Date(String(v)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  if (type === 'number') return Number(v).toLocaleString('pt-BR');
  return String(v);
};
const CUSTOM = { key: 'customizado', title: 'Montador de relatório', category: 'Personalizado', description: 'Escolha os campos (uma linha por funcionário e dia).', period: 'required' as const };

export default function RelatoriosPage() {
  const { me } = useSession();
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const toast = useToast();
  const canExport = can(me, 'reports.reports:export');
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const catalog = useQuery({ queryKey: ['reports-catalog', tenantId], queryFn: () => api<Catalog>('/reports'), enabled: !!tenantId });
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim().toLowerCase());
  const [key, setKey] = useState('horas-trabalhadas');
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [departmentId, setDepartmentId] = useState('');
  const [includeSub, setIncludeSub] = useState(true);
  const [groupingId, setGroupingId] = useState('');
  const [fields, setFields] = useState<string[]>(['name', 'date', 'punches', 'worked', 'balance', 'flags']);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => { const d = new Date(`${todayBr()}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); setPeriod(monthRange(d.toISOString().slice(0, 10))); }, []);
  const depts = useQuery({ queryKey: ['opt', 'departments', companyId], queryFn: () => api<Dept[]>(`/departments?companyId=${companyId}`), enabled: !!companyId, retry: false });
  const groupings = useQuery({ queryKey: ['opt', 'groupings', tenantId], queryFn: () => api<Paged<Ref>>('/groupings?pageSize=200'), enabled: !!tenantId, retry: false });
  const all = useMemo(() => [...(catalog.data?.reports ?? []), CUSTOM], [catalog.data]);
  const def = all.find((r) => r.key === key) ?? all[0];
  const categories = useMemo(() => {
    const m = new Map<string, typeof all>();
    for (const r of all.filter((x) => !q || x.title.toLowerCase().includes(q) || x.description.toLowerCase().includes(q))) m.set(r.category, [...(m.get(r.category) ?? []), r]);
    return [...m];
  }, [all, q]);
  const body = () => ({ companyId, ...(def?.period !== 'none' ? period : {}), ...(departmentId ? { departmentId, includeSubdepartments: includeSub } : {}), ...(groupingId ? { groupingId } : {}), ...(key === 'customizado' ? { fields } : {}) });
  const runIt = useMutation({ mutationFn: () => api<Result>(`/reports/${key}/run`, { method: 'POST', json: body() }), onSuccess: (r) => setResult(r), onError: (e: Error) => toast('error', e.message) });
  const exportIt = useMutation({
    mutationFn: (format: 'csv' | 'xlsx') => api<{ filename: string; mime: string; base64: string }>(`/reports/${key}/export?format=${format}`, { method: 'POST', json: body() }),
    onSuccess: (r) => { const bin = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bin], { type: r.mime })); const a = document.createElement('a'); a.href = url; a.download = r.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); },
    onError: (e: Error) => toast('error', e.message),
  });
  const quick = (k: 'thisMonth' | 'lastMonth' | 'last7' | 'today') => {
    const t = todayBr();
    if (k === 'thisMonth') setPeriod({ from: monthRange(t).from, to: t });
    if (k === 'lastMonth') { const d = new Date(`${t}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); setPeriod(monthRange(d.toISOString().slice(0, 10))); }
    if (k === 'last7') setPeriod({ from: addDays(t, -6), to: t });
    if (k === 'today') setPeriod({ from: t, to: t });
  };
  const sel = 'h-10 w-full rounded-2xl border border-line bg-hover px-3 text-sm outline-none [&>option]:bg-elevated';

  return (
    <Page>
      <PageHeader title="Relatórios" description="Escolha o relatório, filtre por empresa, período, departamento e agrupamento, e exporte em Excel, CSV ou PDF (impressão)." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={pickTenant} />}
        {companies.length > 1 && <select aria-label="Empresa" value={companyId} onChange={(e) => { setCompanyId(e.target.value); setDepartmentId(''); }} className="glass h-10 max-w-xs rounded-full px-4 text-sm [&>option]:bg-elevated">{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select>}
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="Os relatórios são por empresa." /></Card> : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card className="no-print h-fit space-y-3 rounded-[28px] p-4 lg:sticky lg:top-4">
            <div className="flex items-center gap-2 rounded-2xl border border-line px-3"><Search className="size-4 text-subtle" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar relatório…" aria-label="Buscar relatório" className="h-9 flex-1 bg-transparent text-sm outline-none" /></div>
            {!catalog.data ? <Skeleton className="h-80" /> : (
              <nav className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {categories.map(([cat, list]) => (
                  <div key={cat}>
                    <p className="px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle">{cat}</p>
                    <ul className="mt-1 space-y-0.5">{list.map((r) => <li key={r.key}><button onClick={() => { setKey(r.key); setResult(null); }} className={cn('w-full rounded-xl px-3 py-1.5 text-left text-sm transition-colors', key === r.key ? 'pill-light font-medium' : 'text-muted hover:bg-hover hover:text-fg')}>{r.key === 'customizado' && <Wand2 className="mr-1.5 inline size-3.5" />}{r.title}</button></li>)}</ul>
                  </div>
                ))}
              </nav>
            )}
          </Card>
          <div className="min-w-0 space-y-4">
            <Card className="no-print space-y-4 rounded-[28px]">
              <div><h2 className="text-lg font-semibold">{def?.title}</h2><p className="text-sm text-muted">{def?.description}</p></div>
              {def?.period !== 'none' && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-wider text-subtle">De</span><input type="date" aria-label="De" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} className="h-10 rounded-2xl border border-line bg-hover px-3 text-sm" /></label>
                  <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-wider text-subtle">Até</span><input type="date" aria-label="Até" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} className="h-10 rounded-2xl border border-line bg-hover px-3 text-sm" /></label>
                  <div className="flex flex-wrap gap-1">{([['today', 'Hoje'], ['last7', '7 dias'], ['thisMonth', 'Este mês'], ['lastMonth', 'Mês passado']] as const).map(([k, l]) => <button key={k} onClick={() => quick(k)} className="h-8 rounded-full border border-line px-3 text-xs text-muted hover:text-fg">{l}</button>)}</div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <select aria-label="Departamento" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={sel}><option value="">Todos os departamentos</option>{(depts.data ?? []).map((d) => <option key={d.id} value={d.id}>{' '.repeat(d.depth * 2)}{d.name}</option>)}</select>
                  {departmentId && <label className="flex items-center gap-2 px-1 text-xs text-muted"><input type="checkbox" checked={includeSub} onChange={(e) => setIncludeSub(e.target.checked)} className="accent-[var(--brand)]" />Incluir subdepartamentos</label>}
                </div>
                <select aria-label="Agrupamento" value={groupingId} onChange={(e) => setGroupingId(e.target.value)} className={sel}><option value="">Todos os agrupamentos</option>{(groupings.data?.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              </div>
              {key === 'customizado' && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Campos ({fields.length})</span>
                  <div className="flex flex-wrap gap-1.5">{(catalog.data?.builderFields ?? []).map((f) => { const on = fields.includes(f.key); return <button key={f.key} onClick={() => setFields(on ? fields.filter((x) => x !== f.key) : [...fields, f.key])} className={cn('rounded-full border px-3 py-1 text-xs', on ? 'border-brand/50 bg-brand-soft' : 'border-line text-muted')}>{f.label}</button>; })}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => runIt.mutate()} loading={runIt.isPending} disabled={!companyId}><Play className="size-4" />Gerar</Button>
                {canExport && <><Button variant="outline" onClick={() => exportIt.mutate('xlsx')} loading={exportIt.isPending && exportIt.variables === 'xlsx'} disabled={!companyId}><FileSpreadsheet className="size-4" />Excel</Button><Button variant="outline" onClick={() => exportIt.mutate('csv')} loading={exportIt.isPending && exportIt.variables === 'csv'} disabled={!companyId}><FileText className="size-4" />CSV</Button></>}
                {result && <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" />Imprimir / PDF</Button>}
              </div>
            </Card>
            {runIt.isPending ? <Skeleton className="h-80 rounded-[28px]" /> : !result ? <Card className="no-print"><EmptyState icon={BarChart3} title="Escolha os filtros e gere" body="O resultado aparece aqui; exporte em Excel ou CSV, ou imprima em PDF." /></Card> : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="print-area overflow-hidden rounded-[28px] p-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
                    <div><h2 className="font-semibold">{result.title}</h2><p className="text-xs text-muted">{companies.find((c) => c.id === companyId)?.legalName}{def?.period !== 'none' && period.from ? ` · ${period.from.split('-').reverse().join('/')} a ${period.to.split('-').reverse().join('/')}` : ''}</p></div>
                    <span className="text-xs text-subtle">{result.rows.length} linha(s) · gerado em {fmt(result.generatedAt, 'datetime')}</span>
                  </div>
                  {!result.rows.length ? <EmptyState icon={BarChart3} title="Nada encontrado" body="Nenhuma linha com esses filtros." /> : (
                    <div className="max-h-[70vh] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-[var(--bg-elevated)] text-left text-xs text-muted"><tr>{result.columns.map((c) => <th key={c.key} className={cn('whitespace-nowrap px-3 py-2', (c.type === 'minutes' || c.type === 'number' || c.type === 'percent') && 'text-right')}>{c.label}</th>)}</tr></thead>
                        <tbody>
                          {result.rows.slice(0, 3000).map((r, i) => (
                            <tr key={i} className="border-t border-line">
                              {result.columns.map((c) => <td key={c.key} className={cn('px-3 py-1.5', (c.type === 'minutes' || c.type === 'number' || c.type === 'percent') && 'text-right font-mono text-xs', c.type === 'minutes' && Number(r[c.key]) < 0 && 'text-danger')}>{fmt(r[c.key], c.type)}</td>)}
                            </tr>
                          ))}
                          {!!Object.keys(result.totals).length && (
                            <tr className="border-t-2 border-line font-semibold">{result.columns.map((c, i) => <td key={c.key} className={cn('px-3 py-2', c.key in result.totals && 'text-right font-mono text-xs')}>{i === 0 ? 'Total' : c.key in result.totals ? fmt(result.totals[c.key], c.type) : ''}</td>)}</tr>
                          )}
                        </tbody>
                      </table>
                      {result.rows.length > 3000 && <p className="px-5 py-3 text-xs text-warning">Mostrando 3.000 de {result.rows.length} linhas: exporte em Excel ou CSV para ver tudo.</p>}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
