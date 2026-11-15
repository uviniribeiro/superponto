'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Search, UsersRound } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { CatalogPage, type CatalogDef } from '@/components/catalog-page';
import { useActiveTenant } from '@/components/tenant-picker';
import { Button, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Company, type Employee, type Page, type Ref } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Members { employments: Array<{ id: string; fullName: string; registration: string; status: string }>; positions: Ref[]; units: Ref[] }

function MembersEditor({ groupingId, onDone }: { groupingId: string; onDone: () => void }) {
  const { tenantId } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const current = useQuery({ queryKey: ['grouping-members', groupingId], queryFn: () => api<Members>(`/groupings/${groupingId}/members`) });
  const [emp, setEmp] = useState<Map<string, string>>(new Map());
  const [pos, setPos] = useState<Map<string, string>>(new Map());
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [companyId, setCompanyId] = useState('');
  useEffect(() => {
    if (current.data && !ready) {
      setEmp(new Map(current.data.employments.map((e) => [e.id, `${e.fullName} · ${e.registration}`])));
      setPos(new Map(current.data.positions.map((p) => [p.id, p.name])));
      setReady(true);
    }
  }, [current.data, ready]);
  const employees = useQuery({ queryKey: ['employees', 'pick', q], queryFn: () => api<Page<Employee>>(`/employees?pageSize=30&status=ALL${q ? `&search=${encodeURIComponent(q)}` : ''}`), enabled: !!tenantId });
  const companies = useQuery({ queryKey: ['companies', tenantId, 'all'], queryFn: () => api<Page<Company>>('/companies?pageSize=200'), enabled: !!tenantId });
  useEffect(() => { const l = companies.data?.data ?? []; if (l.length && !companyId) setCompanyId(l[0]!.id); }, [companies.data, companyId]);
  const positions = useQuery({ queryKey: ['opt', 'positions', companyId], queryFn: () => api<Page<Ref>>(`/job-positions?companyId=${companyId}&pageSize=500`), enabled: !!companyId });
  const save = useMutation({
    mutationFn: () => api(`/groupings/${groupingId}/members`, { method: 'PUT', json: { employmentIds: [...emp.keys()], positionIds: [...pos.keys()] } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['catalog', 'groupings'] }); qc.invalidateQueries({ queryKey: ['grouping-members', groupingId] }); toast('success', 'Membros salvos'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  const toggle = (map: Map<string, string>, set: (m: Map<string, string>) => void, id: string, label: string) => { const n = new Map(map); if (n.has(id)) n.delete(id); else n.set(id, label); set(n); };
  if (!ready) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
  return (
    <div className="space-y-6">
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand">Funcionários ({emp.size})</p>
        {emp.size > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{[...emp].map(([id, label]) => <button key={id} onClick={() => toggle(emp, setEmp, id, label)} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs" title="Remover">{label} ✕</button>)}</div>}
        <div className="flex items-center gap-2 rounded-2xl border border-line px-3"><Search className="size-4 text-subtle" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar funcionário por nome ou matrícula…" aria-label="Buscar funcionário" className="h-10 flex-1 bg-transparent text-sm outline-none" /></div>
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-line">
          {(employees.data?.data ?? []).map((e) => {
            const label = `${e.socialName ?? e.fullName} · ${e.registration}`;
            return (
              <li key={e.id}><label className={cn('flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-hover', emp.has(e.id) && 'bg-brand-soft/50')}>
                <input type="checkbox" className="accent-[var(--brand)]" checked={emp.has(e.id)} onChange={() => toggle(emp, setEmp, e.id, label)} />
                <span className="flex-1 truncate">{label}</span><span className="text-xs text-subtle">{e.company.tradeName ?? e.company.legalName}</span>
              </label></li>
            );
          })}
          {employees.data && !employees.data.data.length && <li className="px-3 py-4 text-center text-xs text-subtle">Nenhum funcionário encontrado</li>}
        </ul>
      </section>
      <section>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">Cargos ({pos.size})</p>
          <select aria-label="Empresa dos cargos" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="ml-auto h-8 rounded-xl border border-line bg-hover px-2 text-xs outline-none [&>option]:bg-elevated">
            {companies.data?.data.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(positions.data?.data ?? []).map((p) => (
            <label key={p.id} className={cn('flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs', pos.has(p.id) ? 'border-brand/50 bg-brand-soft' : 'border-line text-muted')}>
              <input type="checkbox" className="accent-[var(--brand)]" checked={pos.has(p.id)} onChange={() => toggle(pos, setPos, p.id, p.name)} />{p.name}
            </label>
          ))}
          {positions.data && !positions.data.data.length && <span className="text-xs text-subtle">Esta empresa não tem cargos cadastrados.</span>}
        </div>
      </section>
      <Button onClick={() => save.mutate()} loading={save.isPending} className="h-12 w-full">Salvar membros</Button>
    </div>
  );
}

function MembersButton({ id, name, inUse, canManage }: { id: string; name: string; inUse: number; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-brand/40 hover:text-fg"><UsersRound className="size-3.5" />{inUse} funcionário(s)</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Membros: ${name}`} wide>
        {open && (canManage ? <MembersEditor groupingId={id} onDone={() => setOpen(false)} /> : <p className="text-sm text-muted">Você pode ver o agrupamento, mas não alterar os membros.</p>)}
      </Sheet>
    </>
  );
}

const DEF: CatalogDef = {
  title: 'Agrupamentos', singular: 'Agrupamento', path: 'groupings', icon: Boxes,
  description: 'Grupos livres de funcionários e cargos (ex.: "Plantão noturno", "Motoristas da frota") para filtrar relatórios, cálculo em lote e envio aos relógios.',
  readPermission: 'org.groupings:read', managePermission: 'org.groupings:manage',
  fields: [
    { key: 'name', label: 'Descrição', type: 'text', required: true, max: 120 },
    { key: 'code', label: 'Código', type: 'text', max: 20, mono: true },
    { key: 'active', label: 'Ativo', type: 'active' },
  ],
  subtitle: (r) => (r.code ? `Código ${r.code}` : 'Sem código'),
  rowExtra: (r, canManage) => <MembersButton id={r.id} name={r.name} inUse={Number(r.inUse ?? 0)} canManage={canManage} />,
};

export default function Page_() {
  return <CatalogPage def={DEF} />;
}
