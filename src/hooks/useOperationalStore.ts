import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Camada de dados do módulo Controle Operacional.
 * Tudo é lido e gravado nas tabelas op_* do banco, sempre no escopo da empresa
 * do usuário logado. Motoristas reutilizam o cadastro de colaboradores (profiles).
 */

export type OpDriverStatus = 'ativo' | 'ferias' | 'afastado' | 'inativo';
export type OpVehicleStatus = 'operando' | 'manutencao' | 'reserva' | 'inativo';
export type OpScheduleStatus = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';
export type OpOccurrenceSeverity = 'baixa' | 'media' | 'alta';

export interface OpDriver {
  id: string;
  name: string;
  registration: string;
  cnh: string;
  cnhCategory: string;
  cnhExpiry: string;
  phone: string;
  status: OpDriverStatus;
}

export interface OpEmployee {
  id: string;
  userId: string;
  name: string;
  email: string;
  registration: string;
  isDriver: boolean;
}

export interface OpVehicle {
  id: string;
  plate: string;
  number: string;
  model: string;
  capacity: number;
  status: OpVehicleStatus;
  garage: string;
}

export interface OpLine {
  id: string;
  code: string;
  name: string;
  origin: string;
  destination: string;
  km: number;
  active: boolean;
}

export interface OpService {
  id: string;
  lineId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  trips: number;
}

export interface OpSchedule {
  id: string;
  date: string;
  driverId: string;
  vehicleId: string;
  lineId: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  status: OpScheduleStatus;
  notes?: string;
}

export interface OpOccurrence {
  id: string;
  date: string;
  scheduleId?: string;
  driverId?: string;
  vehicleId?: string;
  type: string;
  severity: OpOccurrenceSeverity;
  description: string;
  resolved: boolean;
}

export interface OpPermission {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  canCreateSchedules: boolean;
  canSwapDrivers: boolean;
  canEditOccurrences: boolean;
  canViewReports: boolean;
}

export interface OpTimeRecord {
  id: string;
  profileId: string;
  recordedAt: string;
  recordType: string;
}

export interface OperationalData {
  drivers: OpDriver[];
  employees: OpEmployee[];
  vehicles: OpVehicle[];
  lines: OpLine[];
  services: OpService[];
  schedules: OpSchedule[];
  occurrences: OpOccurrence[];
  permissions: OpPermission[];
  timeRecords: OpTimeRecord[];
}

const emptyData: OperationalData = {
  drivers: [], employees: [], vehicles: [], lines: [], services: [],
  schedules: [], occurrences: [], permissions: [], timeRecords: [],
};

const hhmm = (v?: string | null) => (v ? String(v).slice(0, 5) : '00:00');

type Collection = 'vehicles' | 'lines' | 'services' | 'schedules' | 'occurrences' | 'permissions';

export function useOperationalStore() {
  const { profile } = useAuth();
  const companyId = (profile as { company_id?: string | null } | null)?.company_id ?? null;
  const [data, setData] = useState<OperationalData>(emptyData);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!companyId) {
      setData(emptyData);
      setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString();
    const [profilesRes, vehiclesRes, linesRes, servicesRes, schedulesRes, occRes, permRes, recRes] = await Promise.all([
      supabase.from('profiles').select('id, user_id, full_name, email, registration_number, phone, is_driver, cnh, cnh_category, cnh_expiry, op_driver_status').eq('company_id', companyId).order('full_name'),
      supabase.from('op_vehicles').select('*').eq('company_id', companyId).order('plate'),
      supabase.from('op_lines').select('*').eq('company_id', companyId).order('code'),
      supabase.from('op_services').select('*').eq('company_id', companyId).order('code'),
      supabase.from('op_schedules').select('*').eq('company_id', companyId).order('start_time'),
      supabase.from('op_occurrences').select('*').eq('company_id', companyId).order('occurred_on', { ascending: false }),
      supabase.from('op_user_permissions').select('*').eq('company_id', companyId).order('user_name'),
      supabase.from('time_records').select('id, profile_id, recorded_at, record_type').eq('company_id', companyId).gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(2000),
    ]);

    const profiles = (profilesRes.data ?? []) as Record<string, unknown>[];

    setData({
      employees: profiles.map((p) => ({
        id: String(p.id), userId: String(p.user_id ?? ''), name: String(p.full_name ?? ''),
        email: String(p.email ?? ''), registration: String(p.registration_number ?? ''), isDriver: Boolean(p.is_driver),
      })),
      drivers: profiles.filter((p) => p.is_driver).map((p) => ({
        id: String(p.id),
        name: String(p.full_name ?? ''),
        registration: String(p.registration_number ?? ''),
        cnh: String(p.cnh ?? ''),
        cnhCategory: String(p.cnh_category ?? 'D'),
        cnhExpiry: p.cnh_expiry ? String(p.cnh_expiry) : '',
        phone: String(p.phone ?? ''),
        status: (String(p.op_driver_status ?? 'ativo') as OpDriverStatus),
      })),
      vehicles: (vehiclesRes.data ?? []).map((v: Record<string, unknown>) => ({
        id: String(v.id), plate: String(v.plate ?? ''), number: String(v.number ?? ''), model: String(v.model ?? ''),
        capacity: Number(v.capacity ?? 0), status: String(v.status ?? 'operando') as OpVehicleStatus, garage: String(v.garage ?? ''),
      })),
      lines: (linesRes.data ?? []).map((l: Record<string, unknown>) => ({
        id: String(l.id), code: String(l.code ?? ''), name: String(l.name ?? ''), origin: String(l.origin ?? ''),
        destination: String(l.destination ?? ''), km: Number(l.km ?? 0), active: Boolean(l.active),
      })),
      services: (servicesRes.data ?? []).map((s: Record<string, unknown>) => ({
        id: String(s.id), lineId: String(s.line_id ?? ''), code: String(s.code ?? ''), name: String(s.name ?? ''),
        startTime: hhmm(s.start_time as string), endTime: hhmm(s.end_time as string), trips: Number(s.trips ?? 0),
      })),
      schedules: (schedulesRes.data ?? []).map((s: Record<string, unknown>) => ({
        id: String(s.id), date: String(s.work_date ?? ''), driverId: String(s.profile_id ?? ''),
        vehicleId: String(s.vehicle_id ?? ''), lineId: String(s.line_id ?? ''), serviceId: String(s.service_id ?? ''),
        startTime: hhmm(s.start_time as string), endTime: hhmm(s.end_time as string),
        status: String(s.status ?? 'planejada') as OpScheduleStatus, notes: (s.notes as string) ?? undefined,
      })),
      occurrences: (occRes.data ?? []).map((o: Record<string, unknown>) => ({
        id: String(o.id), date: String(o.occurred_on ?? ''), scheduleId: (o.schedule_id as string) ?? undefined,
        driverId: (o.profile_id as string) ?? undefined, vehicleId: (o.vehicle_id as string) ?? undefined,
        type: String(o.type ?? ''), severity: String(o.severity ?? 'media') as OpOccurrenceSeverity,
        description: String(o.description ?? ''), resolved: Boolean(o.resolved),
      })),
      permissions: (permRes.data ?? []).map((p: Record<string, unknown>) => ({
        id: String(p.id), userId: String(p.user_id ?? ''), userName: String(p.user_name ?? ''), userEmail: String(p.user_email ?? ''),
        role: String(p.role_label ?? ''), canCreateSchedules: Boolean(p.can_create_schedules), canSwapDrivers: Boolean(p.can_swap_drivers),
        canEditOccurrences: Boolean(p.can_edit_occurrences), canViewReports: Boolean(p.can_view_reports),
      })),
      timeRecords: (recRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id), profileId: String(r.profile_id ?? ''), recordedAt: String(r.recorded_at ?? ''), recordType: String(r.record_type ?? ''),
      })),
    });
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const toRow = (key: Collection, item: Record<string, unknown>) => {
    switch (key) {
      case 'vehicles':
        return { plate: item.plate, number: item.number, model: item.model, capacity: item.capacity, status: item.status, garage: item.garage };
      case 'lines':
        return { code: item.code, name: item.name, origin: item.origin, destination: item.destination, km: item.km, active: item.active };
      case 'services':
        return { line_id: item.lineId || null, code: item.code, name: item.name, start_time: item.startTime, end_time: item.endTime, trips: item.trips };
      case 'schedules':
        return {
          work_date: item.date, profile_id: item.driverId || null, vehicle_id: item.vehicleId || null,
          line_id: item.lineId || null, service_id: item.serviceId || null,
          start_time: item.startTime, end_time: item.endTime, status: item.status, notes: item.notes ?? null,
        };
      case 'occurrences':
        return {
          occurred_on: item.date, schedule_id: item.scheduleId || null, profile_id: item.driverId || null,
          vehicle_id: item.vehicleId || null, type: item.type, severity: item.severity,
          description: item.description, resolved: item.resolved,
        };
      case 'permissions':
        return {
          user_id: item.userId, user_name: item.userName, user_email: item.userEmail, role_label: item.role,
          can_create_schedules: item.canCreateSchedules, can_swap_drivers: item.canSwapDrivers,
          can_edit_occurrences: item.canEditOccurrences, can_view_reports: item.canViewReports,
        };
    }
  };

  const table = (key: Collection) => `op_${key === 'permissions' ? 'user_permissions' : key}` as const;

  const clean = (row: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));

  const insert = useCallback(async (key: Collection, item: Record<string, unknown>) => {
    if (!companyId) throw new Error('Empresa não identificada.');
    const { error } = await supabase.from(table(key) as never).insert({ ...clean(toRow(key, item) as Record<string, unknown>), company_id: companyId } as never);
    if (error) throw error;
    await fetchAll();
  }, [companyId, fetchAll]);

  const update = useCallback(async (key: Collection, id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from(table(key) as never).update(clean(toRow(key, patch) as Record<string, unknown>) as never).eq('id', id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const remove = useCallback(async (key: Collection, id: string) => {
    const { error } = await supabase.from(table(key) as never).delete().eq('id', id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  /** Marca/atualiza um colaborador existente como motorista. */
  const saveDriver = useCallback(async (profileId: string, values: Partial<OpDriver> & { isDriver?: boolean }) => {
    const patch: Record<string, unknown> = {};
    if (values.isDriver !== undefined) patch.is_driver = values.isDriver;
    if (values.cnh !== undefined) patch.cnh = values.cnh;
    if (values.cnhCategory !== undefined) patch.cnh_category = values.cnhCategory;
    if (values.cnhExpiry !== undefined) patch.cnh_expiry = values.cnhExpiry || null;
    if (values.phone !== undefined) patch.phone = values.phone;
    if (values.status !== undefined) patch.op_driver_status = values.status;
    const { error } = await supabase.from('profiles').update(patch).eq('id', profileId);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  return { data, loading, refetch: fetchAll, insert, update, remove, saveDriver };
}
