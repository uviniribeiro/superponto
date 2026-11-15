'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { maskCnpjInput, normalizeCnpj, isValidCnpj, formatCnpj } from '@superponto/br-docs';
import { Building2, Pencil, Plus, Search, Trash2, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDeferredValue, useEffect, useState } from 'react';
import { api, type Company, type Page as Paged } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Page, PageHeader } from './page';
import { can, useSession } from './providers';
import { TenantPicker, useActiveTenant } from './tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from './ui';

/** Campo de formulário de um cadastro. */
export type Field =
  | { key: string; label: string; type: 'text'; required?: boolean; max?: number; hint?: string; placeholder?: string; mono?: boolean }
  | { key: string; label: string; type: 'date'; required?: boolean }
  | { key: string; label: string; type: 'cnpj' }
  | { key: string; label: string; type: 'select'; options: Array<[string, string]>; required?: boolean; empty?: string }
  | { key: string; label: string; type: 'active' };

export interface CatalogDef {
  title: string;
  singular: string;
  /** substantivo feminino (Função, Competência): ajusta "cadastrada/excluída" */
  feminine?: boolean;
  description: string;
  path: string;
  readPermission: string;
  managePermission: string;
  icon: LucideIcon;
  fields: Field[];
  /** linha secundária da lista */
  subtitle?: (row: Row) => string;
  /** etiqueta à direita */
  badge?: (row: Row) => string | null;
  /** registros pertencem a uma empresa (escolhida no topo) */
  companyScoped?: boolean;
  emptyBody?: string;
}

type Row = Record<string, unknown> & { id: string; name: string; active?: boolean; inUse?: number };

const toForm = (def: CatalogDef, row: Row | null) => Object.fromEntries(def.fields.map((f) => {
  const v = row?.[f.key];
  if (f.type === 'active') return [f.key, row ? row.active !== false : true];
  if (f.type === 'date') return [f.key, typeof v === 'string' ? v.slice(0, 10) : ''];
  if (f.type === 'cnpj') return [f.key, typeof v === 'string' ? maskCnpjInput(v) : ''];
  return [f.key, v === null || v === undefined ? '' : String(v)];
}));

function CatalogForm({ def, row, companyId, onDone }: { def: CatalogDef; row: Row | null; companyId: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const a = def.feminine ? 'a' : 'o';
  const [f, setF] = useState<Record<string, unknown>>(() => toForm(def, row));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (row ? api(`/${def.path}/${row.id}`, { method: 'PATCH', json: body }) : api(`/${def.path}`, { method: 'POST', json: body })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['catalog', def.path] }); toast('success', row ? `${def.singular} atualizad${a}` : `${def.singular} cadastrad${a}`); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    const errs: Record<string, string> = {};
    for (const field of def.fields) {
      const v = f[field.key];
      if (field.type === 'active') { body[field.key] = v; continue; }
      const s = String(v ?? '').trim();
      if (!s) {
        if ('required' in field && field.required) errs[field.key] = 'Obrigatório';
        continue;
      }
      if (field.type === 'text' && field.key === 'name' && s.length < 3) errs[field.key] = 'Mínimo de 3 caracteres';
      if (field.type === 'cnpj') { const c = normalizeCnpj(s); if (!isValidCnpj(c)) errs[field.key] = 'CNPJ inválido'; else body[field.key] = c; continue; }
      if (field.type === 'select' && field.key === 'baseMonth') { body[field.key] = Number(s); continue; }
      body[field.key] = s;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (def.companyScoped && !row) body.companyId = companyId;
    save.mutate(body);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {def.fields.map((field) => {
        if (field.type === 'active') {
          return (
            <label key={field.key} className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm">
              <span>{field.label}</span>
              <input type="checkbox" checked={!!f[field.key]} onChange={(e) => setF({ ...f, [field.key]: e.target.checked })} className="size-4 accent-[var(--brand)]" />
            </label>
          );
        }
        if (field.type === 'select') {
          return (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle">{field.label}</span>
              <select value={String(f[field.key] ?? '')} onChange={(e) => setF({ ...f, [field.key]: e.target.value })} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
                {field.empty !== undefined && <option value="">{field.empty}</option>}
                {field.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          );
        }
        const value = String(f[field.key] ?? '');
        return (
          <Input
            key={field.key}
            label={field.label}
            type={field.type === 'date' ? 'date' : 'text'}
            value={value}
            onChange={(e) => setF({ ...f, [field.key]: field.type === 'cnpj' ? maskCnpjInput(e.target.value) : e.target.value })}
            error={errors[field.key]}
            required={'required' in field && field.required}
            maxLength={field.type === 'text' ? field.max : undefined}
            placeholder={field.type === 'text' ? field.placeholder : field.type === 'cnpj' ? '00.000.000/0000-00' : undefined}
            hint={field.type === 'text' ? field.hint : undefined}
            className={cn((field.type === 'cnpj' || (field.type === 'text' && field.mono)) && 'font-mono')}
            autoFocus={field === def.fields[0]}
          />
        );
      })}
      <Button type="submit" loading={save.isPending} className="h-12 w-full">{row ? 'Salvar alterações' : `Cadastrar ${def.singular.toLowerCase()}`}</Button>
    </form>
  );
}

/** Tela padrão de cadastro: lista com busca, criar/editar em painel lateral e excluir com confirmação. */
export function CatalogPage({ def }: { def: CatalogDef }) {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [editing, setEditing] = useState<Row | null | 'new'>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [companyId, setCompanyId] = useState<string>('');
  const canManage = can(me, def.managePermission);

  const companies = useQuery({ queryKey: ['companies', tenantId, 'all'], queryFn: () => api<Paged<Company>>('/companies?pageSize=200'), enabled: !!tenantId && !!def.companyScoped });
  useEffect(() => {
    const list = companies.data?.data ?? [];
    if (def.companyScoped && list.length && !list.some((c) => c.id === companyId)) setCompanyId(list[0]!.id);
  }, [companies.data, companyId, def.companyScoped]);

  const ready = !!tenantId && (!def.companyScoped || !!companyId);
  const rows = useQuery({
    queryKey: ['catalog', def.path, tenantId, companyId, q],
    queryFn: () => api<Paged<Row>>(`/${def.path}?pageSize=200${def.companyScoped ? `&companyId=${companyId}` : ''}${q ? `&search=${encodeURIComponent(q)}` : ''}`),
    enabled: ready,
    placeholderData: (p) => p,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/${def.path}/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['catalog', def.path] }); toast('success', `${def.singular} excluíd${def.feminine ? 'a' : 'o'}`); setRemoving(null); },
    onError: (e: Error) => { toast('error', e.message); setRemoving(null); },
  });
  const Icon = def.icon;
  const list = rows.data?.data ?? [];

  return (
    <Page>
      <PageHeader title={def.title} description={def.description} actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {canManage && ready && <Button onClick={() => setEditing('new')}><Plus className="size-4" />Novo</Button>}
      </>} />
      {!tenantId ? (
        <Card><EmptyState icon={Icon} title="Escolha uma organização" body="Selecione acima o cliente que você quer administrar." /></Card>
      ) : def.companyScoped && companies.data && !companies.data.data.length ? (
        <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body={`${def.title} pertencem a uma empresa.`} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
            {def.companyScoped && (
              <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-9 max-w-xs rounded-xl border border-line bg-hover px-3 text-sm outline-none [&>option]:bg-elevated">
                {companies.data?.data.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}
              </select>
            )}
            <Search className="size-4 text-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" aria-label={`Buscar ${def.title.toLowerCase()}`} className="h-9 min-w-40 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" />
            {rows.data && <span className="text-xs text-subtle">{rows.data.total} registro(s)</span>}
          </div>
          {rows.isLoading || !ready ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !list.length ? (
            <EmptyState icon={Icon} title={q ? 'Nada encontrado' : `Nenhum registro`} body={q ? 'Tente outro termo.' : def.emptyBody ?? `Cadastre o primeiro.`} action={!q && canManage ? <Button onClick={() => setEditing('new')}><Plus className="size-4" />Novo</Button> : undefined} />
          ) : (
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {list.map((r, i) => (
                  <motion.li key={r.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.025 } }} exit={{ opacity: 0 }} className={cn('group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-hover', r.active === false && 'opacity-55')}>
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}{r.active === false && <span className="ml-2 text-xs text-subtle">(inativo)</span>}</p>
                      {def.subtitle && <p className="truncate text-xs text-muted">{def.subtitle(r)}</p>}
                    </div>
                    {def.badge?.(r) && <span className="hidden rounded-full border border-line px-2.5 py-1 text-xs text-muted sm:inline">{def.badge(r)}</span>}
                    {typeof r.inUse === 'number' && r.inUse > 0 && <span className="hidden rounded-full bg-hover px-2.5 py-1 text-xs text-muted md:inline">{r.inUse} em uso</span>}
                    {canManage && (
                      <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        <Button variant="ghost" className="size-9 px-0" onClick={() => setEditing(r)} aria-label={`Editar ${r.name}`}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" className="size-9 px-0 hover:text-danger" onClick={() => setRemoving(r)} aria-label={`Excluir ${r.name}`}><Trash2 className="size-4" /></Button>
                      </div>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? `Novo: ${def.singular.toLowerCase()}` : `Editar ${def.singular.toLowerCase()}`}>
        {editing !== null && <CatalogForm key={editing === 'new' ? 'new' : editing.id} def={def} row={editing === 'new' ? null : editing} companyId={companyId || null} onDone={() => setEditing(null)} />}
      </Sheet>
      <Confirm open={!!removing} title={`Excluir ${def.singular.toLowerCase()}?`} body={removing?.inUse ? `"${removing.name}" está em uso e não pode ser excluíd${def.feminine ? 'a' : 'o'}; desative em vez de excluir.` : `"${removing?.name}" deixa de aparecer nas listas. O histórico fica na auditoria.`} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => removing && remove.mutate(removing.id)} onCancel={() => setRemoving(null)} />
    </Page>
  );
}

export { formatCnpj };
