'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, getActiveTenant, setActiveTenant, type Page, type Tenant } from '@/lib/api';
import { useSession } from './providers';

/** SuperAdmin escolhe a organização que está administrando; usuários comuns não veem. */
export function useActiveTenant() {
  const { me } = useSession();
  const [tenantId, setTenantId] = useState<string | null>(null);
  useEffect(() => setTenantId(getActiveTenant()), []);
  const qc = useQueryClient();
  const select = (id: string | null) => {
    setActiveTenant(id);
    setTenantId(id);
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'tenants' });
  };
  // Usuário comum: a própria organização, sem escolha.
  const effective = me?.isPlatformAdmin ? tenantId : me?.tenantId ?? null;
  return { tenantId: effective, select, isPlatform: !!me?.isPlatformAdmin };
}

export function TenantPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { data } = useQuery({ queryKey: ['tenants', 'all'], queryFn: () => api<Page<Tenant>>('/platform/tenants?pageSize=100') });
  const tenants = data?.data ?? [];
  useEffect(() => {
    if (value && data && !tenants.some((t) => t.id === value)) onChange(null);
  }, [value, data, tenants, onChange]);
  return (
    <label className="glass flex h-10 items-center gap-2 rounded-full pl-3.5 pr-1.5 text-sm">
      <Building className="size-4 text-brand" />
      <select
        aria-label="Organização"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 max-w-[220px] cursor-pointer rounded-xl bg-transparent pr-2 outline-none [&>option]:bg-elevated"
      >
        <option value="">Escolha a organização…</option>
        {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </label>
  );
}
