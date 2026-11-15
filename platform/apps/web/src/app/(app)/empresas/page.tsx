'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDeferredValue, useState } from 'react';
import { formatCnpj } from '@superponto/br-docs';
import { CompanyForm, SEGMENTS } from '@/components/company-form';
import { CompanyLogo } from '@/components/company-logo';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Company, type Page as Paged } from '@/lib/api';

const showCnpj = (v: string | null) => (v ? formatCnpj(v) : 'Sem CNPJ');

export default function CompaniesPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [editing, setEditing] = useState<Company | null | 'new'>(null);
  const [removing, setRemoving] = useState<Company | null>(null);

  const companies = useQuery({
    queryKey: ['companies', tenantId, q],
    queryFn: () => api<Paged<Company>>(`/companies?pageSize=100${q ? `&search=${encodeURIComponent(q)}` : ''}`),
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/companies/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast('success', 'Empresa removida'); setRemoving(null); },
    onError: (e: Error) => toast('error', e.message),
  });

  const canCreate = can(me, 'org.companies:create');
  const canUpdate = can(me, 'org.companies:update');
  const canDelete = can(me, 'org.companies:delete');
  const rows = companies.data?.data ?? [];

  return (
    <Page>
      <PageHeader
        title="Empresas"
        description="Empresas e filiais (CNPJs) da organização."
        actions={<>
          {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
          {canCreate && tenantId && <Button onClick={() => setEditing('new')}><Plus className="size-4" />Nova empresa</Button>}
        </>}
      />

      {!tenantId ? (
        <Card><EmptyState icon={Building2} title="Escolha uma organização" body="Como SuperAdmin, selecione acima qual cliente você quer administrar." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <Search className="size-4 text-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou CNPJ (com ou sem letras)…" className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" aria-label="Buscar empresas" />
            {companies.data && <span className="text-xs text-subtle">{companies.data.total} {companies.data.total === 1 ? 'empresa' : 'empresas'}</span>}
          </div>
          {companies.isLoading ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : companies.isError ? (
            <EmptyState icon={Building2} title="Não foi possível carregar" body={(companies.error as Error).message} action={<Button variant="outline" onClick={() => companies.refetch()}>Tentar de novo</Button>} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Building2} title={q ? 'Nada encontrado' : 'Nenhuma empresa ainda'} body={q ? 'Tente outro termo de busca.' : 'Cadastre a primeira empresa para começar.'} action={!q && canCreate ? <Button onClick={() => setEditing('new')}><Plus className="size-4" />Nova empresa</Button> : undefined} />
          ) : (
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {rows.map((c, i) => (
                  <motion.li key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }} exit={{ opacity: 0, x: -16 }} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-hover">
                    <CompanyLogo company={c} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.tradeName ?? c.legalName}</p>
                      <p className="truncate text-xs text-muted">{c.tradeName ? `${c.legalName} · ` : ''}<span className="font-mono">{showCnpj(c.cnpj)}</span>{c.city ? ` · ${c.city}/${c.state}` : ''}</p>
                    </div>
                    <span className="hidden rounded-full border border-line px-2.5 py-1 text-xs text-muted sm:inline">{SEGMENTS[c.segment]}</span>
                    <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      {canUpdate && <Button variant="ghost" className="size-9 px-0" onClick={() => setEditing(c)} aria-label={`Editar ${c.legalName}`}><Pencil className="size-4" /></Button>}
                      {canDelete && <Button variant="ghost" className="size-9 px-0 hover:text-danger" onClick={() => setRemoving(c)} aria-label={`Remover ${c.legalName}`}><Trash2 className="size-4" /></Button>}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nova empresa' : 'Editar empresa'}>
        {editing !== null && <CompanyForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onSaved={() => setEditing(null)} />}
      </Sheet>
      <Confirm
        open={!!removing}
        title="Remover empresa?"
        body={`"${removing?.legalName}" deixa de aparecer nas listas. O histórico fica guardado na auditoria.`}
        confirmLabel="Remover"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
        onCancel={() => setRemoving(null)}
      />
    </Page>
  );
}
