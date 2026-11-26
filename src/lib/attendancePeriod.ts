// Apuração de um período para vários funcionários (base dos relatórios analíticos e do espelho diário).
// Usa o motor já testado (calculateDay) com o horário vigente de cada funcionário, feriados e
// afastamentos aprovados.
import { supabase } from '@/integrations/supabase/client';
import { calculateDay, DEFAULT_ATTENDANCE_RULES, type DayCalculationResult, type PunchInput } from './timeCalculation';

export interface PersonRow { id: string; full_name: string; registration_number: string | null; department: string | null; position: string | null; pis: string | null; cpf?: string | null; birth_date?: string | null; failed_login_attempts?: number | null; last_failed_login?: string | null }
export interface DayRow { person: PersonRow; date: string; result: DayCalculationResult; punches: { type: string; at: string; mobile: boolean }[]; scheduled: boolean; absenceReason?: string; breakStart?: string | null; breakMobility?: number }

type Schedule = Record<string, string | number | null>;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const db = supabase as any;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/** Dias de `from` até `to` (AAAA-MM-DD, inclusive). */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T12:00:00`); ymd(d) <= to; d.setDate(d.getDate() + 1)) out.push(ymd(d));
  return out;
}

export async function loadPeriod(from: string, to: string, opts: { department?: string; profileId?: string } = {}): Promise<{ people: PersonRow[]; days: DayRow[] }> {
  let pq = db.from('profiles').select('id, full_name, registration_number, department, position, pis, cpf, birth_date, failed_login_attempts, last_failed_login').eq('is_active', true).order('full_name');
  if (opts.department) pq = pq.eq('department', opts.department);
  if (opts.profileId) pq = pq.eq('id', opts.profileId);
  const { data: people = [] } = await pq;
  const ids = (people as PersonRow[]).map((p) => p.id);
  if (!ids.length) return { people: [], days: [] };

  const startIso = new Date(`${from}T00:00:00-03:00`).toISOString();
  const endIso = new Date(`${to}T23:59:59-03:00`).toISOString();
  const [sch, hol, rec, abs, scales] = await Promise.all([
    db.from('employee_schedules').select('profile_id, start_date, end_date, work_schedules(*)').in('profile_id', ids),
    db.from('holidays').select('date, end_date, is_recurring'),
    db.from('time_records').select('profile_id, record_type, recorded_at, latitude, device_info').in('profile_id', ids).gte('recorded_at', startIso).lte('recorded_at', endIso).order('recorded_at'),
    db.from('employee_absences').select('profile_id, start_date, end_date, absence_type, reason').in('profile_id', ids).eq('status', 'approved').lte('start_date', to).gte('end_date', from),
    db.from('scheduled_scales').select('profile_id, scale_date, is_work_day').in('profile_id', ids).gte('scale_date', from).lte('scale_date', to),
  ]);
  const scaleOf = new Map<string, boolean>(((scales?.data ?? []) as any[]).map((x) => [`${x.profile_id}|${x.scale_date}`, x.is_work_day !== false]));

  const isHoliday = (day: string) => (hol.data ?? []).some((h: any) => {
    if (h.is_recurring) return String(h.date).slice(5) === day.slice(5);
    return day >= h.date && day <= (h.end_date ?? h.date);
  });

  const recordsBy = new Map<string, any[]>();
  for (const r of rec.data ?? []) {
    const day = new Date(r.recorded_at).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const k = `${r.profile_id}|${day}`;
    if (!recordsBy.has(k)) recordsBy.set(k, []);
    recordsBy.get(k)!.push(r);
  }

  const days: DayRow[] = [];
  for (const person of people as PersonRow[]) {
    const mine = (sch.data ?? []).filter((s: any) => s.profile_id === person.id);
    for (const day of eachDay(from, to)) {
      const ws: Schedule | undefined = mine.find((s: any) => s.start_date <= day && (!s.end_date || s.end_date >= day))?.work_schedules;
      const dow = DAYS[new Date(`${day}T12:00:00`).getDay()];
      let start = ws?.[`${dow}_start`] as string | null | undefined;
      let end = ws?.[`${dow}_end`] as string | null | undefined;
      // Escala agendada (inclusive trocas aprovadas) prevalece sobre o horário semanal.
      const override = scaleOf.get(`${person.id}|${day}`);
      if (override === false) { start = null; end = null; }
      if (override === true && !(start && end) && ws) {
        const d = DAYS.find((x) => ws[`${x}_start`] && ws[`${x}_end`]);
        if (d) { start = ws[`${d}_start`] as string; end = ws[`${d}_end`] as string; }
      }
      const breakMin = Number(ws?.break_duration_minutes ?? 0);
      const holiday = isHoliday(day);
      const scheduled = !!(start && end) && !holiday;
      const expected = scheduled ? Math.max(0, toMin(end!) - toMin(start!) - breakMin) : 0;
      const recs = recordsBy.get(`${person.id}|${day}`) ?? [];
      const absence = (abs.data ?? []).find((a: any) => a.profile_id === person.id && a.start_date <= day && a.end_date >= day);
      const tol = Number(ws?.tolerance_minutes ?? DEFAULT_ATTENDANCE_RULES.entry_tolerance_minutes);
      const result = calculateDay({
        date: new Date(`${day}T12:00:00`),
        punches: recs.map((r) => ({ record_type: r.record_type, recorded_at: r.recorded_at })) as PunchInput[],
        journey: { start: scheduled ? start : null, end: scheduled ? end : null, expectedMinutes: expected, breakMinutes: breakMin },
        dayKind: holiday ? 'holiday' : scheduled ? 'normal' : 'rest',
        rules: { ...DEFAULT_ATTENDANCE_RULES, entry_tolerance_minutes: tol, exit_tolerance_minutes: tol },
        absence: absence ? { type: 'full', reason: absence.reason ?? absence.absence_type } : null,
      });
      days.push({
        person, date: day, result, scheduled, breakStart: scheduled ? (ws?.break_start as string | null) ?? null : null, breakMobility: Number(ws?.break_mobility_minutes ?? 0), absenceReason: absence ? (absence.reason ?? absence.absence_type) : undefined,
        punches: recs.map((r) => ({ type: r.record_type, at: r.recorded_at, mobile: r.latitude != null || /android|iphone|mobile|app/i.test(r.device_info ?? '') })),
      });
    }
  }
  return { people: people as PersonRow[], days };
}

export const fmtMin = (m: number) => `${m < 0 ? '-' : ''}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}`;
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
export const fmtDate = (d: string) => d.split('-').reverse().join('/');
