'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type Page, type Ref } from './api';

interface Dept { id: string; name: string; depth: number; path: string; sectors: Array<{ id: string; name: string }> }
const list = <T,>(path: string) => api<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}pageSize=500`).then((r) => r.data);

/** Opções dos cadastros para selects (por empresa quando aplicável). */
export function useStructureOptions(tenantId: string | null, companyId: string | null) {
  const on = !!tenantId;
  const units = useQuery({ queryKey: ['opt', 'units', companyId], queryFn: () => list<Ref>(`/units?companyId=${companyId}`), enabled: on && !!companyId, retry: false });
  const departments = useQuery({ queryKey: ['opt', 'departments', companyId], queryFn: () => api<Dept[]>(`/departments?companyId=${companyId}`), enabled: on && !!companyId });
  const positions = useQuery({ queryKey: ['opt', 'positions', companyId], queryFn: () => list<Ref>(`/job-positions?companyId=${companyId}`), enabled: on && !!companyId });
  const functions = useQuery({ queryKey: ['opt', 'functions', tenantId], queryFn: () => list<Ref & { active: boolean }>('/job-functions'), enabled: on, retry: false });
  const costCenters = useQuery({ queryKey: ['opt', 'cost-centers', tenantId], queryFn: () => list<Ref & { active: boolean }>('/cost-centers'), enabled: on, retry: false });
  const types = useQuery({ queryKey: ['opt', 'employee-types', tenantId], queryFn: () => list<Ref & { active: boolean }>('/employee-types'), enabled: on, retry: false });
  const unions = useQuery({ queryKey: ['opt', 'unions', tenantId], queryFn: () => list<Ref & { acronym: string; active: boolean }>('/labor-unions'), enabled: on, retry: false });
  const groupings = useQuery({ queryKey: ['opt', 'groupings', tenantId], queryFn: () => list<Ref & { active: boolean }>('/groupings'), enabled: on, retry: false });
  const active = <T extends { active?: boolean }>(r: T[] | undefined) => (r ?? []).filter((x) => x.active !== false);
  return {
    units: units.data ?? [],
    departments: departments.data ?? [],
    positions: positions.data ?? [],
    functions: active(functions.data),
    costCenters: active(costCenters.data),
    types: active(types.data),
    unions: active(unions.data),
    groupings: active(groupings.data),
  };
}

export const CONTRACT_TYPES: Array<[string, string]> = [
  ['CLT', 'CLT'], ['STATUTORY', 'Estatutário'], ['TEMPORARY', 'Temporário'], ['INTERN', 'Estagiário'], ['APPRENTICE', 'Aprendiz'],
  ['CONTRACTOR', 'Terceirizado'], ['SERVICE_PROVIDER', 'Autônomo / prestador'], ['VOLUNTEER', 'Voluntário'], ['OTHER', 'Outro'],
];
export const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Ativo', ON_LEAVE: 'Afastado', SUSPENDED: 'Suspenso', TERMINATED: 'Desligado' };
