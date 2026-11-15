'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Download, FileOutput, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CompanyActions, fieldCls, labelCls } from '@/components/company-actions';
import { Page, PageHeader } from '@/components/page';
import { useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { downloadBase64 } from '@/lib/download';
import { useCompanyPick } from '@/lib/schedules';
import { monthRange, todayBr } from '@/lib/timesheet';

interface Item { key: string; label: string; unit: 'hours' | 'days' }
interface Layout { id: string; name: string; events: Record<string, string>; separator: string; quantityFormat: 'HHMM' | 'DECIMAL' | 'MINUTES'; includeHeader: boolean; employeeKey: 'MATRICULA' | 'CPF' }
type Form = Omit<Layout, 'id'>;
const SEP: Record<string, string> = { ';': 'Ponto e vírgula (;)', ',': 'Vírgula (,)', '|': 'Barra vertical (|)', TAB: 'Tabulação' };
const QF: Record<string, string> = { HHMM: 'Horas (08:30)', DECIMAL: 'Decimal (8,50)', MINUTES: 'Minutos (510)' };

export default function FolhaPage() {
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const toast = useToast();
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ['payroll-items'], queryFn: () => api<Item[]>('/payroll-layouts/items'), enabled: !!tenantId });
  const list = useQuery({ queryKey: ['payroll-layouts', tenantId, companyId], queryFn: () => api<Layout[]>(`/payroll-layouts?companyId=${companyId}`), enabled: !!companyId });
  const [edit, setEdit] = useState<{ id: string | null; f: Form } | null>(null);
  const [del, setDel] = useState<Layout | null>(null);
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [last, setLast] = useState<{ lines: number; employees: number; missingKey: string[]; unmappedItems: string[] } | null>(null);
  useEffect(() => { const d = new Date(`${todayBr()}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); setPeriod(monthRange(d.toISOString().slice(0, 10))); }, []);
  const refresh = () => qc.invalidateQueries({ queryKey: ['payroll-layouts'] });
  const save = useMutation({
    mutationFn: () => {
      const f = edit!.f;
      const json = { ...f, events: Object.fromEntries(Object.entries(f.events).filter(([, v]) => v.trim())) };
      return edit!.id ? api(`/payroll-layouts/${edit!.id}`, { method: 'PUT', json }) : api('/payroll-layouts', { method: 'POST', json: { ...json, companyId } });
    },
    onSuccess: () => { toast('success', 'Layout salvo'); setEdit(null); refresh(); },
    onError: (e: Error) => toast('error', e.message),
  });
  const remove = useMutation({ mutationFn: (id: string) => api(`/payroll-layouts/${id}`, { method: 'DELETE' }), onSuccess: () => { setDel(null); refresh(); }, onError: (e: Error) => toast('error', e.message) });
  const exp = useMutation({
    mutationFn: (id: string) => api<{ filename: string; mime: string; base64: string; lines: number; employees: number; missingKey: string[]; unmappedItems: string[] }>(`/payroll-layouts/${id}/export`, { method: 'POST', json: period }),
    onSuccess: (r) => { downloadBase64(r); setLast(r); },
    onError: (e: Error) => toast('error', e.message),
  });
  const set = (p: Partial<Form>) => setEdit((e) => e && { ...e, f: { ...e.f, ...p } });
  const label = (k: string) => items.data?.find((i) => i.key === k)?.label ?? k;

  return (
    <Page>
      <PageHeader title="Exportação para a folha" description="Monte o layout com o código de evento de cada verba e gere o arquivo do período para importar no seu sistema de folha. O SuperPonto só gera o arquivo; não envia dados a outros sistemas." actions={<>
        <CompanyActions {...{ isPlatform, tenantId, pickTenant, companies, companyId, setCompanyId }} />
        <Button onClick={() => setEdit({ id: null, f: { name: '', events: { normal: '', ot50: '', ot100: '', night: '', absence: '' }, separator: ';', quantityFormat: 'HHMM', includeHeader: true, employeeKey: 'MATRICULA' } })} disabled={!companyId}><Plus className="size-4" />Novo layout</Button>
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="O layout é por empresa." /></Card> : (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-end gap-3 rounded-[24px]">
            <label className="space-y-1"><span className={labelCls}>De</span><input type="date" aria-label="De" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} className="h-10 rounded-2xl border border-line bg-hover px-3 text-sm" /></label>
            <label className="space-y-1"><span className={labelCls}>Até</span><input type="date" aria-label="Até" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} className="h-10 rounded-2xl border border-line bg-hover px-3 text-sm" /></label>
            <p className="text-sm text-muted">Os valores saem da folha de conferência do período (calcule e feche o período antes de exportar).</p>
          </Card>
          {last && <Card className="rounded-[24px] text-sm">Arquivo gerado: <b>{last.lines}</b> linha(s) para <b>{last.employees}</b> funcionário(s).{!!last.missingKey.length && <span className="block text-warning">Sem CPF/matrícula (ficaram de fora): {last.missingKey.join(', ')}</span>}{!!last.unmappedItems.length && <span className="block text-warning">Verbas com valor no período e sem código no layout: {last.unmappedItems.map(label).join(', ')}</span>}</Card>}
          {!list.data ? <Skeleton className="h-48 rounded-[28px]" /> : !list.data.length ? <Card><EmptyState icon={FileOutput} title="Nenhum layout" body="Crie o layout com os códigos de evento usados no seu sistema de folha." /></Card> : list.data.map((l) => (
            <Card key={l.id} className="flex flex-wrap items-center gap-4 rounded-[24px]">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{l.name}</h3>
                <p className="text-sm text-muted">{Object.entries(l.events).map(([k, v]) => `${label(k)} → ${v}`).join(' · ')}</p>
                <p className="text-xs text-subtle">{l.employeeKey === 'CPF' ? 'CPF' : 'Matrícula'} · {SEP[l.separator]} · {QF[l.quantityFormat]}{l.includeHeader ? ' · com cabeçalho' : ''}</p>
              </div>
              <Button onClick={() => exp.mutate(l.id)} loading={exp.isPending && exp.variables === l.id} disabled={!period.from || !period.to}><Download className="size-4" />Gerar arquivo</Button>
              <Button variant="ghost" aria-label="Editar" onClick={() => { const { id, ...f } = l; setEdit({ id, f: { ...f, events: { ...Object.fromEntries((items.data ?? []).map((i) => [i.key, ''])), ...f.events } } }); }}><Pencil className="size-4" /></Button>
              <Button variant="ghost" aria-label="Excluir" onClick={() => setDel(l)}><Trash2 className="size-4" /></Button>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar layout' : 'Novo layout'} wide>
        {edit && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Input label="Nome" required value={edit.f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Folha mensal" />
            <div className="space-y-2">
              <span className={labelCls}>Código do evento por verba (em branco = não exporta)</span>
              <div className="grid gap-2 sm:grid-cols-2">{(items.data ?? []).map((i) => (
                <label key={i.key} className="flex items-center gap-2 text-sm"><span className="w-48 shrink-0 text-muted">{i.label}</span><input aria-label={i.label} maxLength={20} value={edit.f.events[i.key] ?? ''} onChange={(e) => set({ events: { ...edit.f.events, [i.key]: e.target.value } })} className="h-9 w-full rounded-xl border border-line bg-hover px-3 font-mono text-sm outline-none focus:border-brand" /></label>
              ))}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5"><span className={labelCls}>Funcionário por</span><select value={edit.f.employeeKey} onChange={(e) => set({ employeeKey: e.target.value as Form['employeeKey'] })} className={fieldCls}><option value="MATRICULA">Matrícula</option><option value="CPF">CPF</option></select></label>
              <label className="space-y-1.5"><span className={labelCls}>Separador</span><select value={edit.f.separator} onChange={(e) => set({ separator: e.target.value })} className={fieldCls}>{Object.entries(SEP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="space-y-1.5"><span className={labelCls}>Quantidade</span><select value={edit.f.quantityFormat} onChange={(e) => set({ quantityFormat: e.target.value as Form['quantityFormat'] })} className={fieldCls}>{Object.entries(QF).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.f.includeHeader} onChange={(e) => set({ includeHeader: e.target.checked })} className="accent-[var(--brand)]" />Primeira linha com os nomes das colunas</label>
            <p className="rounded-2xl bg-hover px-4 py-3 font-mono text-xs text-muted">Exemplo de linha: {edit.f.employeeKey === 'CPF' ? '52998224725' : '1001'}{edit.f.separator === 'TAB' ? '⇥' : edit.f.separator}{Object.values(edit.f.events).find((v) => v.trim()) || '150'}{edit.f.separator === 'TAB' ? '⇥' : edit.f.separator}{edit.f.quantityFormat === 'HHMM' ? '02:30' : edit.f.quantityFormat === 'DECIMAL' ? '2,50' : '150'}{edit.f.separator === 'TAB' ? '⇥' : edit.f.separator}01/10/2026{edit.f.separator === 'TAB' ? '⇥' : edit.f.separator}31/10/2026</p>
            <Button type="submit" loading={save.isPending} className="w-full">Salvar</Button>
          </form>
        )}
      </Sheet>
      <Confirm open={!!del} title="Excluir layout?" body={`"${del?.name ?? ''}" deixa de estar disponível.`} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} onCancel={() => setDel(null)} />
    </Page>
  );
}
