'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, GitBranch, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Skeleton, useToast } from '@/components/ui';
import { api, type RoleRow } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCompanyPick } from '@/lib/schedules';

type Step = { label: string; approver: 'SUPERVISOR' | 'ROLE' | 'PERMISSION'; roleId?: string };
interface Flow { id: string; requestType: string; steps: Step[]; isActive: boolean }
const TYPES: Array<[string, string]> = [['RECORD_CORRECTION', 'Inclusão de marcação'], ['ABSENCE_JUSTIFICATION', 'Justificativa de falta/atraso'], ['SCHEDULE_CHANGE', 'Troca de folga'], ['OVERTIME_AUTHORIZATION', 'Autorização de hora extra'], ['OTHER', 'Outros pedidos']];
const APPROVER: Array<[Step['approver'], string]> = [['SUPERVISOR', 'Superior imediato'], ['ROLE', 'Quem tem o perfil…'], ['PERMISSION', 'Quem pode aprovar solicitações']];

function FlowEditor({ companyId, type, flow, roles, canManage }: { companyId: string; type: [string, string]; flow: Flow | undefined; roles: RoleRow[]; canManage: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [steps, setSteps] = useState<Step[]>(flow?.steps ?? [{ label: 'Aprovação', approver: 'PERMISSION' }]);
  const [active, setActive] = useState(flow?.isActive ?? true);
  useEffect(() => { setSteps(flow?.steps ?? [{ label: 'Aprovação', approver: 'PERMISSION' }]); setActive(flow?.isActive ?? true); }, [flow]);
  const save = useMutation({
    mutationFn: () => api('/approval-flows', { method: 'PUT', json: { companyId, requestType: type[0], steps, isActive: active } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flows'] }); toast('success', `Fluxo de "${type[1]}" salvo`); },
    onError: (e: Error) => toast('error', e.message),
  });
  const set = (i: number, s: Partial<Step>) => setSteps(steps.map((x, j) => (j === i ? { ...x, ...s } : x)));
  return (
    <Card className="rounded-[24px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{type[1]}</h2>
        <span className={cn('rounded-full px-2.5 py-1 text-xs', flow ? (flow.isActive ? 'bg-success/15 text-success' : 'bg-hover text-muted') : 'bg-hover text-muted')}>{flow ? (flow.isActive ? 'Ativo' : 'Desativado') : 'Padrão: 1 etapa'}</span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-2">
            <span className="grid size-7 place-items-center rounded-full bg-brand text-xs font-bold text-brand-fg">{i + 1}</span>
            <input aria-label={`Etapa ${i + 1}: nome`} value={s.label} disabled={!canManage} onChange={(e) => set(i, { label: e.target.value })} className="h-9 w-36 rounded-xl border border-line bg-hover px-2 text-sm" />
            <select aria-label={`Etapa ${i + 1}: quem aprova`} value={s.approver} disabled={!canManage} onChange={(e) => set(i, { approver: e.target.value as Step['approver'], roleId: undefined })} className="h-9 rounded-xl border border-line bg-hover px-2 text-sm [&>option]:bg-elevated">{APPROVER.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            {s.approver === 'ROLE' && <select aria-label={`Etapa ${i + 1}: perfil`} value={s.roleId ?? ''} disabled={!canManage} onChange={(e) => set(i, { roleId: e.target.value })} className="h-9 rounded-xl border border-line bg-hover px-2 text-sm [&>option]:bg-elevated"><option value="">Perfil…</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
            {canManage && steps.length > 1 && <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="ml-auto text-subtle hover:text-danger" aria-label="Remover etapa"><Trash2 className="size-4" /></button>}
          </li>
        ))}
      </ol>
      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {steps.length < 5 && <Button variant="ghost" className="h-9 text-xs" onClick={() => setSteps([...steps, { label: `Etapa ${steps.length + 1}`, approver: 'PERMISSION' }])}><Plus className="size-4" />Etapa</Button>}
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--brand)]" />Ativo</label>
          <Button className="ml-auto h-9" onClick={() => save.mutate()} loading={save.isPending}>Salvar</Button>
        </div>
      )}
    </Card>
  );
}

export default function FluxosPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const canManage = can(me, 'requests.flows:manage');
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const flows = useQuery({ queryKey: ['flows', tenantId, companyId], queryFn: () => api<Flow[]>(`/approval-flows?companyId=${companyId}`), enabled: !!companyId });
  const roles = useQuery({ queryKey: ['roles', tenantId], queryFn: () => api<RoleRow[]>('/roles'), enabled: !!tenantId && canManage, retry: false });
  return (
    <Page>
      <PageHeader title="Fluxos de aprovação" description="Quem aprova cada tipo de solicitação, em até 5 etapas (ex.: superior imediato e depois o RH). Sem fluxo, aprova quem tem a permissão de aprovar solicitações." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {companies.length > 1 && <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="glass h-10 max-w-xs rounded-full px-4 text-sm [&>option]:bg-elevated">{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select>}
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="Fluxos são por empresa." /></Card>
        : !flows.data ? <Skeleton className="h-60 rounded-[28px]" />
        : (
          <div className="grid gap-4 lg:grid-cols-2">
            {TYPES.map((t) => <FlowEditor key={t[0]} companyId={companyId} type={t} flow={flows.data.find((f) => f.requestType === t[0])} roles={roles.data ?? []} canManage={canManage} />)}
          </div>
        )}
      <p className="mt-4 flex items-center gap-2 text-xs text-subtle"><GitBranch className="size-3.5" />O superior imediato é definido no cadastro do funcionário; o usuário dele precisa estar ligado ao funcionário em Usuários.</p>
    </Page>
  );
}
