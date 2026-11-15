'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type Employee, type Page, type Ref } from '@/lib/api';

/** Unidades e funcionários ativos da empresa, para os formulários dos módulos. */
export function useCompanyOptions(companyId: string) {
  const units = useQuery({ queryKey: ['opt', 'units', companyId], queryFn: () => api<Page<Ref>>(`/units?companyId=${companyId}&pageSize=200`), enabled: !!companyId, retry: false });
  const emps = useQuery({ queryKey: ['opt', 'employees', companyId], queryFn: () => api<Page<Employee>>(`/employees?companyId=${companyId}&pageSize=200`), enabled: !!companyId, retry: false });
  return {
    units: units.data?.data ?? [],
    employees: (emps.data?.data ?? []).map((e) => ({ id: e.id, name: `${e.socialName ?? e.fullName} · ${e.registration}` })),
  };
}
