'use client';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

const TENANT_KEY = 'sp-tenant';

/** Organização ativa escolhida pelo SuperAdmin (usuário comum usa sempre a própria). */
export function getActiveTenant(): string | null {
  try { return typeof window === 'undefined' ? null : localStorage.getItem(TENANT_KEY); } catch { return null; }
}
export function setActiveTenant(id: string | null) {
  try { if (id) localStorage.setItem(TENANT_KEY, id); else localStorage.removeItem(TENANT_KEY); } catch { /* sem storage */ }
}
function tenantHeader(): Record<string, string> {
  const id = getActiveTenant();
  return id ? { 'X-Tenant-Id': id } : {};
}

/** Chamada à API pelo BFF (/api/...). Sessão expirada leva ao login. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path.startsWith('/api') ? path : `/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...tenantHeader(), ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth/login')) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? 'Erro inesperado';
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

export interface Me {
  id: string;
  email: string;
  displayName: string;
  tenantId: string | null;
  isPlatformAdmin: boolean;
  permissions: string[];
}

export interface Page<T> { data: T[]; page: number; pageSize: number; total: number }

export interface Company {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  segment: 'GENERAL' | 'EDUCATION' | 'HEALTH' | 'PUBLIC_SECTOR' | 'INDUSTRY' | 'RETAIL' | 'SERVICES';
  timezone: string;
  createdAt: string;
}

export interface Tenant { id: string; name: string; slug: string; status: string; createdAt: string }
