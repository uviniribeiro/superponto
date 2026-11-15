'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Mail, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDeferredValue, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Page as Paged, type RoleRow, type UserRow } from '@/lib/api';
import { cn } from '@/lib/cn';

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
const lastSeen = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca entrou');

function RolePicker({ roles, value, onChange }: { roles: RoleRow[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold uppercase tracking-wider text-subtle">Perfis de acesso</legend>
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-line p-1.5">
        {roles.map((r) => {
          const on = value.includes(r.id);
          return (
            <label key={r.id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 transition-colors', on ? 'bg-brand-soft' : 'hover:bg-hover')}>
              <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== r.id) : [...value, r.id])} className="mt-1 accent-[var(--brand)]" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{r.name}{!r.isSystem && <span className="ml-2 text-[11px] text-brand">personalizado</span>}</span>
                {r.description && <span className="block text-xs text-muted">{r.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function UserForm({ user, roles, onDone }: { user: UserRow | null; roles: RoleRow[]; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [active, setActive] = useState(user?.isActive ?? true);
  const [roleIds, setRoleIds] = useState<string[]>(user?.roles.map((r) => r.id) ?? []);
  const save = useMutation({
    mutationFn: () => (user
      ? api(`/users/${user.id}`, { method: 'PATCH', json: { displayName: name, isActive: active, roleIds } })
      : api('/users', { method: 'POST', json: { displayName: name, email, roleIds } })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['roles'] }); toast('success', user ? 'Usuário atualizado' : 'Usuário criado: o convite para definir a senha foi enviado por e-mail'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!roleIds.length) { toast('error', 'Escolha ao menos um perfil'); return; } save.mutate(); }} className="space-y-4">
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus />
      <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!user} hint={user ? 'O e-mail é o login e não pode ser trocado' : 'O usuário recebe um convite para criar a própria senha'} />
      {user && !user.isSelf && (
        <label className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm">
          <span>Acesso ativo</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--brand)]" />
        </label>
      )}
      <RolePicker roles={roles} value={roleIds} onChange={setRoleIds} />
      <Button type="submit" loading={save.isPending} className="h-12 w-full">{user ? 'Salvar alterações' : 'Criar usuário'}</Button>
    </form>
  );
}

export default function UsersPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [editing, setEditing] = useState<UserRow | null | 'new'>(null);
  const [removing, setRemoving] = useState<UserRow | null>(null);
  const canManage = can(me, 'admin.users:manage');

  const users = useQuery({ queryKey: ['users', tenantId, q], queryFn: () => api<Paged<UserRow>>(`/users?pageSize=200${q ? `&search=${encodeURIComponent(q)}` : ''}`), enabled: !!tenantId, placeholderData: (p) => p });
  const roles = useQuery({ queryKey: ['roles', tenantId], queryFn: () => api<RoleRow[]>('/roles'), enabled: !!tenantId });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast('success', 'Usuário excluído'); setRemoving(null); },
    onError: (e: Error) => toast('error', e.message),
  });
  const invite = useMutation({
    mutationFn: (id: string) => api(`/users/${id}/invite`, { method: 'POST' }),
    onSuccess: () => toast('success', 'Convite reenviado por e-mail'),
    onError: (e: Error) => toast('error', e.message),
  });
  const rows = users.data?.data ?? [];

  return (
    <Page>
      <PageHeader title="Usuários" description="Quem acessa o sistema e com qual perfil." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {canManage && tenantId && <Button onClick={() => setEditing('new')}><UserPlus className="size-4" />Novo usuário</Button>}
      </>} />
      {!tenantId ? (
        <Card><EmptyState icon={Users} title="Escolha uma organização" body="Selecione acima o cliente que você quer administrar." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <Search className="size-4 text-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail…" aria-label="Buscar usuários" className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" />
            {users.data && <span className="text-xs text-subtle">{users.data.total} {users.data.total === 1 ? 'usuário' : 'usuários'}</span>}
          </div>
          {users.isLoading ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : !rows.length ? (
            <EmptyState icon={Users} title={q ? 'Nada encontrado' : 'Nenhum usuário'} body={q ? 'Tente outro termo.' : 'Crie o primeiro usuário.'} />
          ) : (
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {rows.map((u, i) => (
                  <motion.li key={u.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }} exit={{ opacity: 0 }} className={cn('group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-hover', !u.isActive && 'opacity-55')}>
                    <div className={cn('grid size-10 shrink-0 place-items-center rounded-full font-display text-sm font-bold', u.isSupport ? 'bg-sky-500/15 text-sky-400' : 'bg-brand-soft text-brand')}>{u.isSupport ? <Lock className="size-4" /> : initials(u.displayName)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{u.displayName}{u.isSelf && <span className="ml-2 text-xs font-normal text-subtle">(você)</span>}</p>
                      <p className="truncate text-xs text-muted">{u.email} · {u.isActive ? lastSeen(u.lastLoginAt) : 'Acesso desativado'}</p>
                    </div>
                    <div className="hidden flex-wrap justify-end gap-1 md:flex">
                      {u.isSupport && <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-400">Suporte e treinamento</span>}
                      {u.roles.map((r) => <span key={r.id} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">{r.name}</span>)}
                    </div>
                    {canManage && (u.editable ? (
                      <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        {!u.lastLoginAt && <Button variant="ghost" className="size-9 px-0" onClick={() => invite.mutate(u.id)} aria-label={`Reenviar convite para ${u.displayName}`} title="Reenviar convite"><Mail className="size-4" /></Button>}
                        <Button variant="ghost" className="size-9 px-0" onClick={() => setEditing(u)} aria-label={`Editar ${u.displayName}`}><Pencil className="size-4" /></Button>
                        {!u.isSelf && <Button variant="ghost" className="size-9 px-0 hover:text-danger" onClick={() => setRemoving(u)} aria-label={`Excluir ${u.displayName}`}><Trash2 className="size-4" /></Button>}
                      </div>
                    ) : (
                      <span title="O usuário de suporte não pode ser editado" className="flex items-center gap-1 text-xs text-subtle"><Lock className="size-3.5" />Não editável</span>
                    ))}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo usuário' : 'Editar usuário'}>
        {editing !== null && roles.data && <UserForm key={editing === 'new' ? 'new' : editing.id} user={editing === 'new' ? null : editing} roles={roles.data} onDone={() => setEditing(null)} />}
      </Sheet>
      <Confirm open={!!removing} title="Excluir usuário?" body={`${removing?.displayName} perde o acesso imediatamente. O histórico fica na auditoria.`} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => removing && remove.mutate(removing.id)} onCancel={() => setRemoving(null)} />
    </Page>
  );
}
