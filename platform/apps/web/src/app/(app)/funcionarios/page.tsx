'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, History, Pencil, Search, UserCheck, UserPlus, UsersRound, UserX } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useDeferredValue, useEffect, useState } from 'react';
import { EmployeeForm } from '@/components/employee-form';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Company, type Employee, type EmployeeDetail, type Page as Paged } from '@/lib/api';
import { cn } from '@/lib/cn';
import { maskCpf, maskPis } from '@/lib/masks';
import { CONTRACT_TYPES, STATUS_LABEL, useStructureOptions } from '@/lib/options';

/** CPF/PIS completos vêm só com números: formata; mascarados (com *) ficam como vieram. */
const doc = (v: string | null, kind: 'cpf' | 'pis') => (!v ? '—' : v.includes('*') ? v : kind === 'cpf' ? maskCpf(v) : maskPis(v));
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
const br = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
const FIELD: Record<string, string> = { departmentId: 'Departamento', sectorId: 'Seção', positionId: 'Cargo', functionId: 'Função', costCenterId: 'Centro de custo', employeeTypeId: 'Tipo', unionId: 'Sindicato', unitId: 'Unidade', contractType: 'Contrato', weeklyHours: 'Carga semanal', supervisorId: 'Superior', registration: 'Matrícula', status: 'Situação' };
const STATUS_CLS: Record<string, string> = { ACTIVE: 'bg-success/15 text-success', ON_LEAVE: 'bg-sky-500/15 text-sky-400', SUSPENDED: 'bg-orange-500/15 text-orange-400', TERMINATED: 'bg-hover text-muted' };

function Detail({ id, canManage, tenantId, onEdit }: { id: string; canManage: boolean; tenantId: string; onEdit: (e: EmployeeDetail) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [terminating, setTerminating] = useState(false);
  const [term, setTerm] = useState({ terminatedAt: new Date().toISOString().slice(0, 10), reason: '' });
  const e = useQuery({ queryKey: ['employee', id], queryFn: () => api<EmployeeDetail>(`/employees/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['employee', id] }); };
  const terminate = useMutation({ mutationFn: () => api(`/employees/${id}/terminate`, { method: 'POST', json: term }), onSuccess: () => { refresh(); setTerminating(false); toast('success', 'Funcionário desligado'); }, onError: (x: Error) => toast('error', x.message) });
  const reactivate = useMutation({ mutationFn: () => api(`/employees/${id}/reactivate`, { method: 'POST' }), onSuccess: () => { refresh(); toast('success', 'Funcionário reativado'); }, onError: (x: Error) => toast('error', x.message) });
  if (!e.data) return <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
  const d = e.data;
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0"><span className="text-muted">{k}</span><span className="text-right">{v || '—'}</span></div>;
  void tenantId;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft font-display text-lg font-bold text-brand">{initials(d.socialName ?? d.fullName)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{d.socialName ?? d.fullName}</p>
          <p className="text-sm text-muted">Matrícula {d.registration} · {d.company.tradeName ?? d.company.legalName}</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs', STATUS_CLS[d.status])}>{STATUS_LABEL[d.status]}</span>
      </div>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {d.status !== 'TERMINATED' && <Button variant="outline" onClick={() => onEdit(d)}><Pencil className="size-4" />Editar</Button>}
          {d.status !== 'TERMINATED' ? <Button variant="ghost" className="hover:text-danger" onClick={() => setTerminating((v) => !v)}><UserX className="size-4" />Desligar</Button>
            : <Button variant="outline" loading={reactivate.isPending} onClick={() => reactivate.mutate()}><UserCheck className="size-4" />Reativar</Button>}
        </div>
      )}
      <AnimatePresence>
        {terminating && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={(x) => { x.preventDefault(); terminate.mutate(); }} className="space-y-3 overflow-hidden rounded-2xl border border-danger/30 p-4">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <Input label="Data do desligamento" type="date" value={term.terminatedAt} onChange={(x) => setTerm({ ...term, terminatedAt: x.target.value })} />
              <Input label="Motivo" value={term.reason} onChange={(x) => setTerm({ ...term, reason: x.target.value })} required minLength={3} placeholder="Ex.: pedido de demissão" />
            </div>
            <Button type="submit" variant="danger" loading={terminate.isPending}>Confirmar desligamento</Button>
          </motion.form>
        )}
      </AnimatePresence>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">Vínculo</p>
        {row('Admissão', br(d.hiredAt))}
        {d.terminatedAt && row('Desligamento', br(d.terminatedAt))}
        {row('Contrato', CONTRACT_TYPES.find(([k]) => k === d.contractType)?.[1])}
        {row('Departamento', [d.department?.name, d.sector?.name].filter(Boolean).join(' › '))}
        {row('Cargo', d.position ? `${d.position.name}${d.position.cbo ? ` (CBO ${d.position.cbo})` : ''}` : null)}
        {row('Função', d.function?.name)}
        {row('Tipo', d.employeeType?.name)}
        {row('Centro de custo', d.costCenter?.name)}
        {row('Sindicato', d.union?.acronym)}
        {row('Carga semanal', d.weeklyHours ? `${d.weeklyHours} h` : null)}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">Pessoa</p>
        {row('CPF', <span className="font-mono">{doc(d.cpf, 'cpf')}</span>)}
        {row('PIS', <span className="font-mono">{doc(d.pis, 'pis')}</span>)}
        {row('Nascimento', br(d.birthDate))}
        {row('E-mail', d.email)}
        {row('Endereço', d.address ? [d.address.street, d.address.number, d.address.city && `${d.address.city}/${d.address.state}`].filter(Boolean).join(', ') : null)}
        {d.otherEmployments.length > 0 && row('Outros vínculos', d.otherEmployments.map((o) => `${o.registration} (${o.company.tradeName ?? o.company.legalName})`).join('; '))}
      </div>
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand"><History className="size-3.5" />Histórico</p>
        {d.history.length ? (
          <ul className="space-y-2">
            {d.history.map((h) => (
              <li key={h.id} className="rounded-xl bg-hover px-3 py-2 text-xs">
                <span className="font-medium">{FIELD[h.field] ?? h.field}</span> alterado a partir de {br(h.effectiveAt)}{h.reason ? ` — ${h.reason}` : ''}
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-subtle">Sem alterações registradas.</p>}
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const canManage = can(me, 'people.employments:manage');
  const [companyId, setCompanyId] = useState('');
  const [filters, setFilters] = useState({ departmentId: '', employeeTypeId: '', positionId: '', groupingId: '', status: 'ACTIVE' });
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [viewing, setViewing] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmployeeDetail | null | 'new'>(null);

  const companies = useQuery({ queryKey: ['companies', tenantId, 'all'], queryFn: () => api<Paged<Company>>('/companies?pageSize=200'), enabled: !!tenantId });
  useEffect(() => { const l = companies.data?.data ?? []; if (l.length && companyId && !l.some((c) => c.id === companyId)) setCompanyId(''); }, [companies.data, companyId]);
  const opt = useStructureOptions(tenantId, companyId || null);
  const params = new URLSearchParams({ pageSize: '200', status: filters.status, ...(companyId ? { companyId } : {}), ...Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && k !== 'status')), ...(q ? { search: q } : {}) });
  const list = useQuery({ queryKey: ['employees', tenantId, params.toString()], queryFn: () => api<Paged<Employee>>(`/employees?${params}`), enabled: !!tenantId, placeholderData: (p) => p });
  const rows = list.data?.data ?? [];
  const sel = (label: string, value: string, onChange: (v: string) => void, options: Array<[string, string]>, empty: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 max-w-48 rounded-xl border border-line bg-hover px-3 text-sm outline-none [&>option]:bg-elevated">
      <option value="">{empty}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <Page>
      <PageHeader title="Funcionários" description="Pessoas e seus vínculos com as empresas da organização." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {can(me, 'people.employments:import') && tenantId && <Link href="/funcionarios/importar" className="inline-flex h-10 items-center gap-2 rounded-2xl border border-line-strong px-4 text-sm font-semibold hover:bg-hover"><FileSpreadsheet className="size-4" />Importar planilha</Link>}
        {canManage && tenantId && <Button onClick={() => setEditing('new')}><UserPlus className="size-4" />Novo funcionário</Button>}
      </>} />
      {!tenantId ? (
        <Card><EmptyState icon={UsersRound} title="Escolha uma organização" body="Selecione acima o cliente que você quer administrar." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            {sel('Empresa', companyId, (v) => { setCompanyId(v); setFilters((f) => ({ ...f, departmentId: '', positionId: '' })); }, (companies.data?.data ?? []).map((c) => [c.id, c.tradeName ?? c.legalName]), 'Todas as empresas')}
            {companyId && sel('Departamento', filters.departmentId, (v) => setFilters({ ...filters, departmentId: v }), opt.departments.map((d) => [d.id, `${'  '.repeat(d.depth)}${d.name}`]), 'Todos os departamentos')}
            {companyId && sel('Cargo', filters.positionId, (v) => setFilters({ ...filters, positionId: v }), opt.positions.map((p) => [p.id, p.name]), 'Todos os cargos')}
            {sel('Tipo', filters.employeeTypeId, (v) => setFilters({ ...filters, employeeTypeId: v }), opt.types.map((t) => [t.id, t.name]), 'Todos os tipos')}
            {opt.groupings.length > 0 && sel('Agrupamento', filters.groupingId, (v) => setFilters({ ...filters, groupingId: v }), opt.groupings.map((g) => [g.id, g.name]), 'Todos os agrupamentos')}
            <select aria-label="Situação" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="h-9 rounded-xl border border-line bg-hover px-3 text-sm outline-none [&>option]:bg-elevated">
              <option value="ACTIVE">Ativos</option><option value="ON_LEAVE">Afastados</option><option value="TERMINATED">Desligados</option><option value="ALL">Todas as situações</option>
            </select>
            <div className="flex min-w-48 flex-1 items-center gap-2">
              <Search className="size-4 text-subtle" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, matrícula ou CPF…" aria-label="Buscar funcionários" className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle" />
            </div>
            {list.data && <span className="text-xs text-subtle">{list.data.total} funcionário(s)</span>}
          </div>
          {list.isLoading ? (
            <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : !rows.length ? (
            <EmptyState icon={UsersRound} title={q ? 'Nada encontrado' : 'Nenhum funcionário'} body={q ? 'Tente outro termo ou ajuste os filtros.' : 'Cadastre um funcionário ou importe uma planilha.'} action={!q && canManage ? <Button onClick={() => setEditing('new')}><UserPlus className="size-4" />Novo funcionário</Button> : undefined} />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((e, i) => (
                <motion.li key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.02 } }}>
                  <button onClick={() => setViewing(e.id)} className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-hover">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-sm font-bold text-brand">{initials(e.socialName ?? e.fullName)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.socialName ?? e.fullName}</p>
                      <p className="truncate text-xs text-muted">{e.registration} · {[e.department?.name, e.position?.name].filter(Boolean).join(' · ') || (e.company.tradeName ?? e.company.legalName)}</p>
                    </div>
                    <span className="hidden font-mono text-xs text-subtle md:inline">{e.cpf ? doc(e.cpf, 'cpf') : doc(e.pis, 'pis')}</span>
                    <span className={cn('rounded-full px-2.5 py-1 text-xs', STATUS_CLS[e.status])}>{STATUS_LABEL[e.status]}</span>
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Sheet open={!!viewing && editing === null} onClose={() => setViewing(null)} title="Funcionário">
        {viewing && tenantId && <Detail id={viewing} canManage={canManage} tenantId={tenantId} onEdit={(d) => setEditing(d)} />}
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo funcionário' : 'Editar funcionário'} wide>
        {editing !== null && tenantId && <EmployeeForm key={editing === 'new' ? 'new' : editing.id} tenantId={tenantId} employee={editing === 'new' ? null : editing} defaultCompanyId={companyId || companies.data?.data[0]?.id || null} onDone={(id) => { setEditing(null); setViewing(id); }} />}
      </Sheet>
    </Page>
  );
}
