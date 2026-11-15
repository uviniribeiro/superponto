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
  isSupport?: boolean;
  mustChangePassword?: boolean;
  permissions: string[];
}

export interface RoleRef { id: string; key: string; name: string }
export interface UserRow { id: string; email: string; displayName: string; isActive: boolean; isSupport: boolean; lastLoginAt: string | null; roles: RoleRef[]; editable: boolean; isSelf: boolean; accessWeekdays: number[]; mustChangePassword: boolean; accessBlocks: Array<{ id: string; reason: string; startsAt: string; endsAt: string | null }>; activeBlock: { id: string; reason: string; startsAt: string; endsAt: string | null } | null }
export interface RoleRow { id: string; key: string; name: string; description: string | null; isSystem: boolean; editable: boolean; permissions: string[]; users: number }
export interface PermissionModule { key: string; label: string; resources: Array<{ key: string; label: string; available: boolean; actions: Array<{ permission: string; action: string; label: string; description: string }> }> }

export interface Page<T> { data: T[]; page: number; pageSize: number; total: number }

export interface Company {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  segment: 'GENERAL' | 'EDUCATION' | 'HEALTH' | 'PUBLIC_SECTOR' | 'INDUSTRY' | 'RETAIL' | 'SERVICES';
  timezone: string;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  ibgeCode: string | null;
  phone: string | null;
  email: string | null;
  stateRegistration: string | null;
  cno: string | null;
  externalCode: string | null;
  logoUpdatedAt: string | null;
  createdAt: string;
}

export interface AddressLookup { cep: string; street: string; number?: string; complement?: string; district: string; city: string; uf: string; ibge: string | null; timezone?: string }
export interface CnpjLookup { cnpj: string; legalName: string; tradeName: string | null; status: string | null; activity: string | null; phone: string | null; email: string | null; address: AddressLookup | null; source: string }

export interface CompanyHoliday {
  date: string; name: string; scope: 'NATIONAL' | 'STATE' | 'MUNICIPAL' | 'COMPANY'; kind: 'HOLIDAY' | 'OPTIONAL';
  basis: string | null; review: boolean; workday: boolean; overridden: boolean; ruleId?: string; note?: string | null;
}
export interface HolidayList { year: number; location: { city: string | null; state: string | null; ibge: string | null; municipalBase: boolean }; holidays: CompanyHoliday[] }

export interface Tenant { id: string; name: string; slug: string; status: string; createdAt: string }

export interface Ref { id: string; name: string }
export interface Employee {
  id: string; personId: string; fullName: string; socialName: string | null; cpf: string | null; pis: string | null; sensitiveVisible: boolean;
  birthDate: string | null; email: string | null; phone: string | null; address: Record<string, string> | null;
  registration: string; status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED'; contractType: string; weeklyHours: number | null;
  hiredAt: string; terminatedAt: string | null;
  company: { id: string; legalName: string; tradeName: string | null }; department: Ref | null; sector: Ref | null;
  position: (Ref & { cbo: string | null }) | null; function: Ref | null; costCenter: Ref | null; employeeType: Ref | null;
  union: { id: string; acronym: string } | null; supervisor: { id: string; fullName: string } | null; unitId: string | null;
}
export interface EmployeeDetail extends Employee {
  history: Array<{ id: string; field: string; oldValue: string | null; newValue: string | null; effectiveAt: string; reason: string | null; createdAt: string }>;
  otherEmployments: Array<{ id: string; registration: string; status: string; company: { legalName: string; tradeName: string | null } }>;
}
export interface AccessBlock { id: string; reason: string; startsAt: string; endsAt: string | null }
