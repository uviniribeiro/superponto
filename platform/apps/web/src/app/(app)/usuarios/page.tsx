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

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function Blocks({ user }: { user: UserRow }) {
  const qc = useQueryClient();
  const toast = useToast();
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [form, setForm] = useState({ reason: '', startsAt: local(new Date()), endsAt: '' });
  const [blocks, setBlocks] = useState(user.accessBlocks);
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  const add = useMutation({
    mutationFn: () => api<UserRow['accessBlocks'][number]>(`/users/${user.id}/blocks`, { method: 'POST', json: { reason: form.reason, startsAt: new Date(form.startsAt).toISOString(), ...(form.endsAt ? { endsAt: new Date(form.endsAt).toISOString() } : {}) } }),
    onSuccess: (b) => { setBlocks((x) => [b, ...x]); refresh(); setForm({ reason: '', startsAt: local(new Date()), endsAt: '' }); toast('success', 'Bloqueio registrado: as sessões do usuário são encerradas enquanto valer'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const revoke = useMutation({ mutationFn: (id: string) => api(`/users/${user.id}/blocks/${id}`, { method: 'DELETE' }).then(() => id), onSuccess: (id) => { setBlocks((x) => x.filter((b) => b.id !== id)); refresh(); toast('success', 'Bloqueio encerrado'); }, onError: (e: Error) => toast('error', e.message) });
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'indeterminado');
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold uppercase tracking-wider text-subtle">Bloqueio de acesso</legend>
      {blocks.map((b) => (
        <div key={b.id} className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs">
          <span className="flex-1">{b.reason} · {fmt(b.startsAt)} até {fmt(b.endsAt)}</span>
          <button type="button" onClick={() => revoke.mutate(b.id)} className="text-brand">Encerrar</button>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="Início" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        <Input label="Fim (opcional)" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Motivo (ex.: férias, afastamento)" aria-label="Motivo do bloqueio" className="h-10 flex-1 rounded-2xl border border-line bg-hover px-3 text-sm outline-none focus:border-brand" />
        <Button type="button" variant="outline" disabled={form.reason.trim().length < 3} loading={add.isPending} onClick={() => add.mutate()}>Bloquear</Button>
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
  const [days, setDays] = useState<number[]>(user?.accessWeekdays ?? []);
  const [mustChange, setMustChange] = useState(user?.mustChangePassword ?? false);
  const [source, setSource] = useState<'LOCAL' | 'LDAP'>(user?.authSource ?? 'LOCAL');
  const ldap = source === 'LDAP';
  const save = useMutation({
    mutationFn: () => (user
      ? api(`/users/${user.id}`, { method: 'PATCH', json: { displayName: name, isActive: active, roleIds, accessWeekdays: days, mustChangePassword: ldap ? false : mustChange, ...(user.isSelf ? {} : { authSource: source }) } })
      : api('/users', { method: 'POST', json: { displayName: name, email, roleIds, accessWeekdays: days, mustChangePassword: ldap ? false : mustChange, authSource: source } })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['roles'] }); toast('success', user ? 'Usuário atualizado' : ldap ? 'Usuário criado: ele entra com a senha da rede da organização' : 'Usuário criado: o convite para definir a senha foi enviado por e-mail'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!roleIds.length) { toast('error', 'Escolha ao menos um perfil'); return; } save.mutate(); }} className="space-y-4">
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus />
      <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!user} hint={user ? 'O e-mail é o login e não pode ser trocado' : ldap ? 'O e-mail precisa ser o mesmo do diretório da organização' : 'O usuário recebe um convite para criar a própria senha'} />
      {!user?.isSelf && (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold uppercase tracking-wider text-subtle">Forma de login</legend>
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line p-1">
            {([['LOCAL', 'Senha do SuperPonto'], ['LDAP', 'Rede da organização (LDAP)']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={source === k} onClick={() => setSource(k)} className={cn('h-9 rounded-xl text-xs font-medium transition-colors', source === k ? 'pill-light' : 'text-muted hover:text-fg')}>{l}</button>
            ))}
          </div>
          <span className="text-xs text-subtle">{ldap ? 'A senha é conferida no Active Directory/LDAP configurado em "Login pela rede".' : user?.authSource === 'LDAP' ? 'Ao salvar, o usuário recebe um convite para criar uma senha própria.' : 'O usuário cria a própria senha pelo convite enviado por e-mail.'}</span>
        </fieldset>
      )}
      {user && !user.isSelf && (
        <label className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm">
          <span>Acesso ativo</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--brand)]" />
        </label>
      )}
      <RolePicker roles={roles} value={roleIds} onChange={setRoleIds} />
      {!user?.isSelf && (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold uppercase tracking-wider text-subtle">Dias com acesso</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const on = days.includes(i);
              return <button key={d} type="button" aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i].sort())} className={cn('h-9 w-12 rounded-xl border text-xs', on ? 'border-brand/50 bg-brand-soft text-fg' : 'border-line text-muted')}>{d}</button>;
            })}
          </div>
          <span className="text-xs text-subtle">{days.length ? 'Fora desses dias o login é recusado (horário de Brasília).' : 'Nenhum dia marcado: acesso todos os dias.'}</span>
        </fieldset>
      )}
      {!user?.isSelf && !ldap && (
        <label className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm">
          <span>Pedir troca de senha no próximo acesso</span>
          <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} className="size-4 accent-[var(--brand)]" />
        </label>
      )}
      <Button type="submit" loading={save.isPending} className="h-12 w-full">{user ? 'Salvar alterações' : 'Criar usuário'}</Button>
      {user && !user.isSelf && <div className="border-t border-line pt-5"><Blocks user={user} /></div>}
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
                      <p className="truncate text-xs text-muted">{u.email} · {u.activeBlock ? `Bloqueado: ${u.activeBlock.reason}` : u.isActive ? lastSeen(u.lastLoginAt) : 'Acesso desativado'}{u.accessWeekdays.length ? ` · ${u.accessWeekdays.map((d) => WEEKDAYS[d]).join(', ')}` : ''}</p>
                    </div>
                    <div className="hidden flex-wrap justify-end gap-1 md:flex">
                      {u.isSupport && <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-400">Suporte e treinamento</span>}
                      {u.authSource === 'LDAP' && <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">LDAP</span>}
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
