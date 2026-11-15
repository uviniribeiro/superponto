'use client';

import type { Company } from '@/lib/api';
import { TenantPicker } from './tenant-picker';

/** Ações do cabeçalho: cliente (só SuperAdmin) e empresa (quando há mais de uma). */
export function CompanyActions({ isPlatform, tenantId, pickTenant, companies, companyId, setCompanyId }: {
  isPlatform: boolean; tenantId: string | null; pickTenant: (id: string | null) => void; companies: Company[]; companyId: string; setCompanyId: (id: string) => void;
}) {
  return (
    <>
      {isPlatform && <TenantPicker value={tenantId} onChange={pickTenant} />}
      {companies.length > 1 && <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="glass h-10 max-w-xs rounded-full px-4 text-sm [&>option]:bg-elevated">{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select>}
    </>
  );
}

export const fieldCls = 'h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated';
export const labelCls = 'text-xs font-semibold uppercase tracking-wider text-subtle';
