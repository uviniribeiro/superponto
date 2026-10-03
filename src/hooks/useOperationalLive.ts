import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Operação do dia em tempo real: escalas, ocorrências, posições de GPS e
 * eventos de telemetria da empresa, atualizando sozinho sem recarregar a tela.
 */

export interface LiveSchedule {
  id: string;
  date: string;
  driverId: string | null;
  driverName: string;
  vehicleId: string | null;
  vehicleLabel: string;
  lineLabel: string;
  lineOrigin: string;
  lineDestination: string;
  serviceLabel: string;
  startTime: string;
  endTime: string;
  status: string;
  firstPunch: string | null;
  diffMinutes: number | null;
  situation: 'Sem motorista' | 'Sem registro' | 'Atrasado' | 'Em dia' | 'Adiantado';
  actualStartAt: string | null;
  actualEndAt: string | null;

}

export interface LivePosition {
  id: string;
  vehicleId: string | null;
  scheduleId: string | null;
  profileId: string | null;
  vehicleLabel: string;
  driverName: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  recordedAt: string;
}

export interface LiveTelemetry {
  id: string;
  vehicleLabel: string;
  driverName: string;
  eventType: string;
  severity: string;
  description: string | null;
  occurredAt: string;
}

export interface LiveOccurrence {
  id: string;
  type: string;
  severity: string;
  description: string;
  driverName: string;
  resolved: boolean;
  date: string;
}

interface LiveData {
  schedules: LiveSchedule[];
  positions: LivePosition[];
  telemetry: LiveTelemetry[];
  occurrences: LiveOccurrence[];
}

const empty: LiveData = { schedules: [], positions: [], telemetry: [], occurrences: [] };
const hhmm = (v?: string | null) => (v ? String(v).slice(0, 5) : '--:--');

export function useOperationalLive(dateISO?: string, onlyProfileId?: string | null, enabled = true) {
  const { profile } = useAuth();
  const companyId = (profile as { company_id?: string | null } | null)?.company_id ?? null;
  const day = dateISO ?? new Date().toISOString().slice(0, 10);
  const [data, setData] = useState<LiveData>(empty);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled) return;
    if (!companyId) {
      setData(empty);
      setLoading(false);
      return;
    }
    const [schedRes, profRes, vehRes, lineRes, servRes, recRes, occRes, gpsRes, telRes] = await Promise.all([
      supabase.from('op_schedules').select('*').eq('company_id', companyId).eq('work_date', day).order('start_time'),
      supabase.from('profiles').select('id, full_name').eq('company_id', companyId),
      supabase.from('op_vehicles').select('id, plate, number').eq('company_id', companyId),
      supabase.from('op_lines').select('id, code, name, origin, destination').eq('company_id', companyId),
      supabase.from('op_services').select('id, code, name').eq('company_id', companyId),
      supabase.from('time_records').select('id, profile_id, recorded_at').eq('company_id', companyId)
        .gte('recorded_at', `${day}T00:00:00`).lte('recorded_at', `${day}T23:59:59`).order('recorded_at'),
      supabase.from('op_occurrences').select('*').eq('company_id', companyId).eq('occurred_on', day),
      supabase.from('op_gps_positions').select('*').eq('company_id', companyId)
        .order('recorded_at', { ascending: false }).limit(100),
      supabase.from('op_telemetry_events').select('*').eq('company_id', companyId)
        .order('occurred_at', { ascending: false }).limit(50),
    ]);

    const nameOf = new Map((profRes.data ?? []).map((p) => [p.id, p.full_name ?? '']));
    const vehOf = new Map((vehRes.data ?? []).map((v) => [v.id, `${v.number ?? ''} ${v.plate ?? ''}`.trim()]));
    const lineOf = new Map((lineRes.data ?? []).map((l) => [l.id, `${l.code ?? ''} ${l.name ?? ''}`.trim()]));
    const routeOf = new Map((lineRes.data ?? []).map((l) => [l.id, { origin: l.origin ?? '', destination: l.destination ?? '' }]));
    const servOf = new Map((servRes.data ?? []).map((s) => [s.id, `${s.code ?? ''} ${s.name ?? ''}`.trim()]));

    const punches = new Map<string, string>();
    for (const r of recRes.data ?? []) {
      if (r.profile_id && !punches.has(r.profile_id)) punches.set(r.profile_id, r.recorded_at);
    }

    const schedules: LiveSchedule[] = (schedRes.data ?? [])
      .filter((s) => (onlyProfileId ? s.profile_id === onlyProfileId : true))
      .map((s) => {
        const first = s.profile_id ? punches.get(s.profile_id) ?? null : null;
        let diff: number | null = null;
        let situation: LiveSchedule['situation'] = 'Sem motorista';
        if (s.profile_id) situation = first ? 'Em dia' : 'Sem registro';
        if (first) {
          const d = new Date(first);
          const [ph, pm] = hhmm(s.start_time).split(':').map(Number);
          diff = d.getHours() * 60 + d.getMinutes() - (ph * 60 + pm);
          situation = diff > 5 ? 'Atrasado' : diff < -30 ? 'Adiantado' : 'Em dia';
        }
        return {
          id: s.id,
          date: s.work_date,
          driverId: s.profile_id,
          driverName: s.profile_id ? nameOf.get(s.profile_id) ?? 'Colaborador' : 'Sem motorista',
          vehicleId: s.vehicle_id ?? null,
          vehicleLabel: s.vehicle_id ? vehOf.get(s.vehicle_id) ?? '—' : '—',
          lineLabel: s.line_id ? lineOf.get(s.line_id) ?? '—' : '—',
          lineOrigin: s.line_id ? routeOf.get(s.line_id)?.origin ?? '' : '',
          lineDestination: s.line_id ? routeOf.get(s.line_id)?.destination ?? '' : '',
          serviceLabel: s.service_id ? servOf.get(s.service_id) ?? '—' : '—',
          startTime: hhmm(s.start_time),
          endTime: hhmm(s.end_time),
          status: s.status ?? 'planejada',
          firstPunch: first ? new Date(first).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null,
          diffMinutes: diff,
          situation,
          actualStartAt: s.actual_start_at ?? null,
          actualEndAt: s.actual_end_at ?? null,

        };
      });

    setData({
      schedules,
      positions: (gpsRes.data ?? []).map((p) => ({
        id: p.id,
        vehicleId: p.vehicle_id ?? null,
        scheduleId: p.schedule_id ?? null,
        profileId: p.profile_id ?? null,
        vehicleLabel: p.vehicle_id ? vehOf.get(p.vehicle_id) ?? '—' : '—',
        driverName: p.profile_id ? nameOf.get(p.profile_id) ?? '—' : '—',
        latitude: Number(p.latitude), longitude: Number(p.longitude),
        speedKmh: p.speed_kmh != null ? Number(p.speed_kmh) : null,
        recordedAt: p.recorded_at,
      })),
      telemetry: (telRes.data ?? []).map((t) => ({
        id: t.id,
        vehicleLabel: t.vehicle_id ? vehOf.get(t.vehicle_id) ?? '—' : '—',
        driverName: t.profile_id ? nameOf.get(t.profile_id) ?? '—' : '—',
        eventType: t.event_type, severity: t.severity,
        description: t.description, occurredAt: t.occurred_at,
      })),
      occurrences: (occRes.data ?? []).map((o) => ({
        id: o.id, type: o.type, severity: o.severity, description: o.description ?? '',
        driverName: o.profile_id ? nameOf.get(o.profile_id) ?? '—' : '—',
        resolved: Boolean(o.resolved), date: o.occurred_on,
      })),
    });
    setUpdatedAt(new Date());
    setLoading(false);
  }, [companyId, day, onlyProfileId, enabled]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Atualização em tempo real das tabelas que alimentam a operação.
  useEffect(() => {
    if (!companyId || !enabled) return;
    const channel = supabase.channel(`op-live-${companyId}-${day}`);
    for (const t of ['op_schedules', 'op_occurrences', 'op_gps_positions', 'op_telemetry_events', 'time_records']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => { void fetchAll(); });
    }
    channel.subscribe();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchAll();
    }, 60000);
    return () => { supabase.removeChannel(channel); window.clearInterval(timer); };
  }, [companyId, day, enabled, fetchAll]);

  return { ...data, loading, updatedAt, refetch: fetchAll };
}
