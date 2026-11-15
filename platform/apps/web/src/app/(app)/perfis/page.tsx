'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Skeleton, useToast } from '@/components/ui';
import { api, type PermissionModule, type RoleRow } from '@/lib/api';
import { cn } from '@/lib/cn';

type Draft = { id: string | null; name: string; description: string; permissions: Set<string>; editable: boolean; isSystem: boolean };

export default function RolesPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = can(me, 'admin.roles:manage');
  const roles = useQuery({ queryKey: ['roles', tenantId], queryFn: () => api<RoleRow[]>('/roles'), enabled: !!tenantId });
  const catalog = useQuery({ queryKey: ['permissions'], queryFn: () => api<PermissionModule[]>('/permissions'), enabled: !!tenantId, staleTime: Infinity });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState(false);

  const fromRole = (r: RoleRow): Draft => ({ id: r.id, name: r.name, description: r.description ?? '', permissions: new Set(r.permissions), editable: r.editable, isSystem: r.isSystem });
  useEffect(() => { if (roles.data && !draft) setDraft(fromRole(roles.data.find((r) => r.key === 'company_admin') ?? roles.data[0]!)); }, [roles.data, draft]);

  const total = useMemo(() => catalog.data?.reduce((n, m) => n + m.resources.reduce((k, r) => k + r.actions.length, 0), 0) ?? 0, [catalog.data]);
  const readOnly = !draft?.editable || !canManage;

  const toggle = (perms: string[], on: boolean) => setDraft((d) => {
    if (!d) return d;
    const next = new Set(d.permissions);
    perms.forEach((p) => (on ? next.add(p) : next.delete(p)));
    return { ...d, permissions: next };
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { name: draft!.name.trim(), description: draft!.description.trim() || undefined, permissions: [...draft!.permissions] };
      return draft!.id ? api(`/roles/${draft!.id}`, { method: 'PATCH', json: body }) : api<{ id: string }>('/roles', { method: 'POST', json: body });
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['roles'] });
      toast('success', draft!.id ? 'Perfil salvo: vale a partir do próximo acesso de cada usuário' : 'Perfil criado');
      if (!draft!.id && res && typeof res === 'object' && 'id' in res) setDraft((d) => d && { ...d, id: (res as { id: string }).id, editable: true });
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const remove = useMutation({
    mutationFn: () => api(`/roles/${draft!.id}`, { method: 'DELETE' }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['roles'] }); setRemoving(false); setDraft(null); toast('success', 'Perfil excluído'); },
    onError: (e: Error) => { setRemoving(false); toast('error', e.message); },
  });

  return (
    <Page>
      <PageHeader title="Perfis e permissões" description="Cada recurso do sistema tem permissões separadas (ver, criar, editar, excluir, aprovar…). Monte perfis sob medida." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {canManage && tenantId && <Button onClick={() => setDraft({ id: null, name: '', description: '', permissions: new Set(), editable: true, isSystem: false })}><Plus className="size-4" />Novo perfil</Button>}
      </>} />
      {!tenantId ? (
        <Card><EmptyState icon={KeyRound} title="Escolha uma organização" body="Selecione acima o cliente que você quer administrar." /></Card>
      ) : !roles.data || !catalog.data || !draft ? (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card className="h-fit p-2 lg:sticky lg:top-6">
            <ul className="space-y-0.5">
              {roles.data.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setDraft(fromRole(r))} className={cn('relative flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm', draft.id === r.id ? 'text-fg' : 'text-muted hover:text-fg')}>
                    {draft.id === r.id && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-xl bg-brand-soft" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <span className="relative flex-1 truncate">{r.name}</span>
                    {r.isSystem ? <Lock className="relative size-3.5 text-subtle" aria-label="Perfil do sistema" /> : <span className="relative text-[10px] uppercase text-brand">próprio</span>}
                    <span className="relative min-w-6 rounded-full bg-hover px-1.5 text-center text-[11px]">{r.users}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Nome do perfil" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={readOnly} placeholder="Ex.: Recepção" />
                <Input label="Descrição" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} disabled={readOnly} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">{draft.permissions.size} de {total} permissões</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {draft.isSystem && canManage && <Button variant="outline" onClick={() => setDraft({ ...draft, id: null, name: `${draft.name} (cópia)`, editable: true, isSystem: false })}><Copy className="size-4" />Criar perfil a partir deste</Button>}
                  {!readOnly && draft.id && <Button variant="ghost" className="hover:text-danger" onClick={() => setRemoving(true)}><Trash2 className="size-4" />Excluir</Button>}
                  {!readOnly && <Button onClick={() => save.mutate()} loading={save.isPending} disabled={draft.name.trim().length < 2 || !draft.permissions.size}><Save className="size-4" />{draft.id ? 'Salvar perfil' : 'Criar perfil'}</Button>}
                </div>
              </div>
              {draft.isSystem && <p className="mt-3 flex items-center gap-2 text-xs text-subtle"><Lock className="size-3.5" />Perfil do sistema: não pode ser alterado. Use "Criar perfil a partir deste" para personalizar.</p>}
            </Card>

            {catalog.data.map((m, mi) => {
              const all = m.resources.flatMap((r) => r.actions.map((a) => a.permission));
              const on = all.filter((p) => draft.permissions.has(p)).length;
              return (
                <Card key={m.key} delay={Math.min(mi, 8) * 0.03} className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-line px-5 py-3">
                    <h2 className="font-display font-bold">{m.label} <span className="ml-1 text-xs font-normal text-subtle">{on}/{all.length}</span></h2>
                    {!readOnly && <button onClick={() => toggle(all, on < all.length)} className="text-xs text-brand">{on < all.length ? 'Marcar tudo' : 'Desmarcar tudo'}</button>}
                  </div>
                  <ul className="divide-y divide-line">
                    {m.resources.map((r) => (
                      <li key={r.key} className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center">
                        <div className="md:w-56">
                          <p className="text-sm font-medium">{r.label}</p>
                          {!r.available && <p className="text-[11px] text-subtle">módulo em construção na V2</p>}
                        </div>
                        <div className="flex flex-1 flex-wrap gap-1.5">
                          {r.actions.map((a) => {
                            const checked = draft.permissions.has(a.permission);
                            return (
                              <label key={a.permission} title={a.description} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors', checked ? 'border-brand/50 bg-brand-soft text-fg' : 'border-line text-muted', readOnly ? 'cursor-default' : 'cursor-pointer hover:border-brand/40')}>
                                <input type="checkbox" className="accent-[var(--brand)]" checked={checked} disabled={readOnly} onChange={(e) => toggle([a.permission], e.target.checked)} />
                                {a.label}
                              </label>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      <Confirm open={removing} title="Excluir perfil?" body="Só é possível excluir perfis sem usuários." confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => remove.mutate()} onCancel={() => setRemoving(false)} />
    </Page>
  );
}
