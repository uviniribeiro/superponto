'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import { isValidCnpj, normalizeCnpj } from '@superponto/br-docs';
import { CnpjInput } from '@/components/cnpj-input';
import { Page, PageHeader } from '@/components/page';
import { useSession } from '@/components/providers';
import { useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Page as Paged, type Tenant } from '@/lib/api';

const STATUS: Record<string, string> = { TRIAL: 'Em teste', ACTIVE: 'Ativo', SUSPENDED: 'Suspenso', CANCELLED: 'Cancelado' };

const slugify = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

function TenantForm({ onSaved }: { onSaved: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const create = useMutation({
    mutationFn: (body: unknown) => api('/platform/tenants', { method: 'POST', json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast('success', 'Cliente criado. O administrador recebeu o e-mail para definir a senha.');
      onSaved();
    },
    onError: (e: Error) => toast('error', e.message),
  });
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const document = normalizeCnpj(String(f.get('document') ?? ''));
    if (document && !isValidCnpj(document)) { toast('error', 'CNPJ do titular inválido'); return; }
    create.mutate({
      name: String(f.get('name')).trim(),
      slug,
      ...(document ? { document } : {}),
      admin: { email: String(f.get('adminEmail')).trim(), displayName: String(f.get('adminName')).trim() },
    });
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input label="Nome da organização" name="name" required minLength={2} autoFocus onChange={(e) => { if (!slugTouched) setSlug(slugify(e.target.value)); }} />
      <Input label="Identificador" name="slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} required minLength={1} maxLength={64} hint="Letras minúsculas, números e hífen" />
      <CnpjInput name="document" label="CNPJ do titular" />
      <div className="border-t border-line pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand">Primeiro administrador</p>
        <div className="space-y-4">
          <Input label="Nome" name="adminName" required minLength={2} />
          <Input label="E-mail" name="adminEmail" type="email" required hint="Recebe o link para criar a senha" />
        </div>
      </div>
      <Button type="submit" loading={create.isPending} className="h-12 w-full">Criar cliente</Button>
    </form>
  );
}

export default function TenantsPage() {
  const { me, loading } = useSession();
  const router = useRouter();
  const { select } = useActiveTenant();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [creating, setCreating] = useState(false);
  const tenants = useQuery({
    queryKey: ['tenants', 'list', q],
    queryFn: () => api<Paged<Tenant>>(`/platform/tenants?pageSize=100${q ? `&search=${encodeURIComponent(q)}` : ''}`),
    enabled: !!me?.isPlatformAdmin,
    placeholderData: (prev) => prev,
  });

  if (!loading && !me?.isPlatformAdmin) {
    return <Page><Card><EmptyState icon={ShieldCheck} title="Acesso restrito" body="Esta área é exclusiva da equipe SuperPonto." /></Card></Page>;
  }
  const rows = tenants.data?.data ?? [];

  return (
    <Page>
      <PageHeader title="Clientes" description="Organizações que usam o SuperPonto." actions={<Button onClick={() => setCreating(true)}><Plus className="size-4" />Novo cliente</Button>} />
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <Search className="size-4 text-subtle" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…" className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" aria-label="Buscar clientes" />
          {tenants.data && <span className="text-xs text-subtle">{tenants.data.total} no total</span>}
        </div>
        {tenants.isLoading ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={q ? 'Nada encontrado' : 'Nenhum cliente ainda'} body={q ? 'Tente outro termo.' : 'Crie a primeira organização.'} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t, i) => (
              <motion.li key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}>
                <button onClick={() => { select(t.id); router.push('/empresas'); }} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-hover">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft font-display font-bold text-brand">{t.name.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="truncate text-xs text-muted">{t.slug} · desde {new Date(t.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${t.status === 'ACTIVE' ? 'bg-success/15 text-success' : t.status === 'TRIAL' ? 'bg-brand-soft text-brand' : 'bg-hover text-muted'}`}>{STATUS[t.status] ?? t.status}</span>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>
      <Sheet open={creating} onClose={() => setCreating(false)} title="Novo cliente">
        {creating && <TenantForm onSaved={() => setCreating(false)} />}
      </Sheet>
    </Page>
  );
}
