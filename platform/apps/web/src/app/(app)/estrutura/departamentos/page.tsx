'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronRight, FolderPlus, FolderTree, LayoutList, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Company, type Page as Paged } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Dept { id: string; name: string; code: string | null; parentId: string | null; depth: number; path: string; sectors: Array<{ id: string; name: string }>; employees: number; children: number }

function DeptForm({ companyId, depts, dept, parentId, onDone }: { companyId: string; depts: Dept[]; dept: Dept | null; parentId: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(dept?.name ?? '');
  const [code, setCode] = useState(dept?.code ?? '');
  const [parent, setParent] = useState<string>(dept ? dept.parentId ?? '' : parentId ?? '');
  // não oferece como pai o próprio departamento nem seus descendentes
  const blocked = new Set<string>();
  if (dept) { blocked.add(dept.id); for (const d of depts) if (d.path.startsWith(`${dept.path} › `)) blocked.add(d.id); }
  const save = useMutation({
    mutationFn: () => dept
      ? api(`/departments/${dept.id}`, { method: 'PATCH', json: { name, code: code || undefined, parentId: parent || null } })
      : api('/departments', { method: 'POST', json: { companyId, name, code: code || undefined, parentId: parent || undefined } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast('success', dept ? 'Departamento atualizado' : 'Departamento cadastrado'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <Input label="Descrição" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} autoFocus />
      <Input label="Código" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} hint="Opcional; único na empresa" className="font-mono" />
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Dentro de</span>
        <select value={parent} onChange={(e) => setParent(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
          <option value="">— Raiz (departamento principal) —</option>
          {depts.filter((d) => !blocked.has(d.id)).map((d) => <option key={d.id} value={d.id}>{'  '.repeat(d.depth)}{d.name}</option>)}
        </select>
      </label>
      <Button type="submit" loading={save.isPending} className="h-12 w-full">{dept ? 'Salvar alterações' : 'Cadastrar departamento'}</Button>
    </form>
  );
}

export default function DepartmentsPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = can(me, 'org.departments:manage');
  const [companyId, setCompanyId] = useState('');
  const [editing, setEditing] = useState<{ dept: Dept | null; parentId: string | null } | null>(null);
  const [removing, setRemoving] = useState<Dept | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sectorDraft, setSectorDraft] = useState<Record<string, string>>({});

  const companies = useQuery({ queryKey: ['companies', tenantId, 'all'], queryFn: () => api<Paged<Company>>('/companies?pageSize=200'), enabled: !!tenantId });
  useEffect(() => { const l = companies.data?.data ?? []; if (l.length && !l.some((c) => c.id === companyId)) setCompanyId(l[0]!.id); }, [companies.data, companyId]);
  const depts = useQuery({ queryKey: ['departments', companyId], queryFn: () => api<Dept[]>(`/departments?companyId=${companyId}`), enabled: !!companyId });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/departments/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast('success', 'Departamento excluído'); setRemoving(null); },
    onError: (e: Error) => { toast('error', e.message); setRemoving(null); },
  });
  const addSector = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api(`/departments/${id}/sectors`, { method: 'POST', json: { name } }),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['departments'] }); setSectorDraft((s) => ({ ...s, [v.id]: '' })); toast('success', 'Seção adicionada'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const removeSector = useMutation({
    mutationFn: ({ id, sectorId }: { id: string; sectorId: string }) => api(`/departments/${id}/sectors/${sectorId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
    onError: (e: Error) => toast('error', e.message),
  });

  const list = depts.data ?? [];
  // esconde descendentes de nós recolhidos
  const hiddenBy = (d: Dept) => list.some((p) => collapsed.has(p.id) && d.path.startsWith(`${p.path} › `));
  const visible = list.filter((d) => !hiddenBy(d));

  return (
    <Page>
      <PageHeader title="Departamentos" description="Estrutura em árvore, com subdepartamentos ilimitados e seções dentro de cada departamento." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {canManage && companyId && <Button onClick={() => setEditing({ dept: null, parentId: null })}><Plus className="size-4" />Novo departamento</Button>}
      </>} />
      {!tenantId ? (
        <Card><EmptyState icon={FolderTree} title="Escolha uma organização" body="Selecione acima o cliente que você quer administrar." /></Card>
      ) : companies.data && !companies.data.data.length ? (
        <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="Os departamentos pertencem a uma empresa." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-9 max-w-xs rounded-xl border border-line bg-hover px-3 text-sm outline-none [&>option]:bg-elevated">
              {companies.data?.data.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}
            </select>
            <span className="ml-auto text-xs text-subtle">{list.length} departamento(s)</span>
          </div>
          {depts.isLoading || !companyId ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !list.length ? (
            <EmptyState icon={FolderTree} title="Nenhum departamento" body="Comece pelos departamentos principais (ex.: Secretaria de Saúde) e adicione os subdepartamentos dentro deles." action={canManage ? <Button onClick={() => setEditing({ dept: null, parentId: null })}><Plus className="size-4" />Novo departamento</Button> : undefined} />
          ) : (
            <ul className="py-2">
              <AnimatePresence initial={false}>
                {visible.map((d) => (
                  <motion.li key={d.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="group px-3">
                    <div className="flex items-center gap-2 rounded-xl py-2 pr-2 transition-colors hover:bg-hover" style={{ paddingLeft: `${12 + d.depth * 26}px` }}>
                      <button aria-label={collapsed.has(d.id) ? `Expandir ${d.name}` : `Recolher ${d.name}`} disabled={!d.children} onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} className={cn('grid size-6 place-items-center rounded-md text-subtle', !d.children && 'invisible')}>
                        <ChevronRight className={cn('size-4 transition-transform', !collapsed.has(d.id) && 'rotate-90')} />
                      </button>
                      <FolderTree className="size-4 text-brand" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.name}{d.code && <span className="ml-2 font-mono text-xs text-subtle">{d.code}</span>}</p>
                        <p className="text-[11px] text-subtle">{d.employees} funcionário(s){d.children ? ` · ${d.children} subdepartamento(s)` : ''}</p>
                      </div>
                      {canManage && (
                        <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                          <Button variant="ghost" className="size-8 px-0" title="Novo subdepartamento" aria-label={`Novo subdepartamento em ${d.name}`} onClick={() => setEditing({ dept: null, parentId: d.id })}><FolderPlus className="size-4" /></Button>
                          <Button variant="ghost" className="size-8 px-0" aria-label={`Editar ${d.name}`} onClick={() => setEditing({ dept: d, parentId: null })}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" className="size-8 px-0 hover:text-danger" aria-label={`Excluir ${d.name}`} onClick={() => setRemoving(d)}><Trash2 className="size-4" /></Button>
                        </div>
                      )}
                    </div>
                    {(d.sectors.length > 0 || canManage) && (
                      <div className="flex flex-wrap items-center gap-1.5 pb-2" style={{ paddingLeft: `${44 + d.depth * 26}px` }}>
                        {d.sectors.map((s) => (
                          <span key={s.id} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                            <LayoutList className="size-3" />{s.name}
                            {canManage && <button aria-label={`Remover seção ${s.name}`} onClick={() => removeSector.mutate({ id: d.id, sectorId: s.id })} className="text-subtle hover:text-danger"><X className="size-3" /></button>}
                          </span>
                        ))}
                        {canManage && (
                          <form onSubmit={(e) => { e.preventDefault(); const n = (sectorDraft[d.id] ?? '').trim(); if (n.length >= 3) addSector.mutate({ id: d.id, name: n }); else toast('error', 'Seção: mínimo de 3 caracteres'); }} className="hidden group-hover:flex group-focus-within:flex">
                            <input value={sectorDraft[d.id] ?? ''} onChange={(e) => setSectorDraft((s) => ({ ...s, [d.id]: e.target.value }))} placeholder="+ seção" aria-label={`Nova seção em ${d.name}`} className="h-6 w-28 rounded-full border border-dashed border-line bg-transparent px-2.5 text-xs outline-none focus:border-brand" />
                          </form>
                        )}
                      </div>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.dept ? 'Editar departamento' : 'Novo departamento'}>
        {editing && <DeptForm key={editing.dept?.id ?? `new-${editing.parentId}`} companyId={companyId} depts={list} dept={editing.dept} parentId={editing.parentId} onDone={() => setEditing(null)} />}
      </Sheet>
      <Confirm open={!!removing} title="Excluir departamento?" body={removing?.children ? 'Este departamento tem subdepartamentos: mova ou exclua-os antes.' : `"${removing?.name}" deixa de aparecer nas listas.`} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => removing && remove.mutate(removing.id)} onCancel={() => setRemoving(null)} />
    </Page>
  );
}
