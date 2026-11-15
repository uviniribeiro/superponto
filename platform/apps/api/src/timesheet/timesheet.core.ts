import { Injectable } from '@nestjs/common';
import type { Prisma } from '@superponto/database';
import { assignPunchesToDays, calculateDay, DEFAULT_RULES, summarizePeriod, type AttendanceRules, type DayAbsence, type DayResult, type ExpectedDay } from '@superponto/time-engine';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { ExpectedScheduleService } from '../schedules/schedules.service.js';

export const TZ = 'America/Sao_Paulo';
export const toDate = (v: string) => new Date(`${v}T00:00:00Z`);
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (v: string, n: number) => iso(new Date(toDate(v).getTime() + n * 86_400_000));
export function* daysBetween(from: string, to: string) { for (let d = from; d <= to; d = addDays(d, 1)) yield d; }
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** Data e hora locais (Brasília) de um instante. */
export function local(at: Date) {
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export const LEAVE_LABEL: Record<string, string> = {
  MEDICAL: 'Atestado médico', VACATION: 'Férias', MATERNITY: 'Licença-maternidade', PATERNITY: 'Licença-paternidade',
  WORK_ACCIDENT: 'Acidente de trabalho', UNPAID: 'Licença não remunerada', SUSPENSION: 'Suspensão', OTHER: 'Afastamento',
};

export type PunchStatus = 'ORIGINAL' | 'INCLUDED' | 'DISREGARDED' | 'PENDING_INCLUDE' | 'PENDING_DISREGARD';
export interface PunchView { id: string; adjustmentId: string | null; at: string; time: string; date: string; source: string; status: PunchStatus; justification: string | null }
export type Emp = { id: string; companyId: string; ruleSetId: string | null; registration: string; status: string; hiredAt: Date; terminatedAt: Date | null; person: { fullName: string; socialName: string | null } };
export const EMP_SELECT = { id: true, companyId: true, ruleSetId: true, registration: true, status: true, hiredAt: true, terminatedAt: true, person: { select: { fullName: true, socialName: true } } } satisfies Prisma.EmploymentSelect;

export interface DayView {
  date: string;
  expected: Record<string, unknown>;
  punches: PunchView[];
  result: (Omit<DayResult, 'flags'> & { flags: string[]; unauthorizedOvertimeMinutes: number }) | null;
  allowance: { id: string; justification: string; disregardsDebits: boolean; fullDay: boolean; minutes: number; note: string | null } | null;
  leave: { id: string; type: string; label: string; note: string | null } | null;
  onCall: Array<{ id: string; startTime: string; endTime: string; minutes: number }>;
  closed: boolean;
  outsideEmployment: boolean;
}

/**
 * Apuração: jornada prevista + marcações (originais, incluídas e desconsideradas por ajuste aprovado)
 * + abonos e afastamentos + regras de apuração -> resultado diário pelo motor. Nada é gravado aqui.
 */
@Injectable()
export class TimesheetCore {
  constructor(private readonly prisma: PrismaService, private readonly expected: ExpectedScheduleService) {}

  async compute(tenantId: string, emps: Emp[], from: string, to: string): Promise<Map<string, DayView[]>> {
    if (!emps.length) return new Map();
    const companies = [...new Set(emps.map((e) => e.companyId))];
    const hol = await this.expected.holidayMap(tenantId, companies, from, to);
    return this.prisma.forTenant(tenantId, async (tx) => this.computeTx(tx, emps, from, to, hol));
  }

  async computeTx(tx: Tx, emps: Emp[], from: string, to: string, hol: Map<string, Map<string, { name: string; workday: boolean }>>) {
    const ids = emps.map((e) => e.id);
    const winFrom = new Date(toDate(from).getTime() - 86_400_000);
    const winTo = new Date(toDate(to).getTime() + 2 * 86_400_000);
    const [plan, records, adjustments, allowances, leaves, onCalls, ruleSets, closings, authorizations, persisted] = await Promise.all([
      this.expected.computeEngine(tx, emps, from, to, hol),
      tx.timeRecord.findMany({ where: { employmentId: { in: ids }, recordedAt: { gte: winFrom, lt: winTo } }, orderBy: { recordedAt: 'asc' }, select: { id: true, employmentId: true, recordedAt: true, source: true } }),
      tx.timeRecordAdjustment.findMany({ where: { employmentId: { in: ids }, status: { in: ['APPROVED', 'PENDING'] }, OR: [{ recordedAt: { gte: winFrom, lt: winTo } }, { timeRecord: { recordedAt: { gte: winFrom, lt: winTo } } }] } }),
      tx.allowance.findMany({ where: { employmentId: { in: ids }, date: { gte: toDate(from), lte: toDate(to) } }, include: { justification: true } }),
      tx.leave.findMany({ where: { employmentId: { in: ids }, deletedAt: null, startDate: { lte: toDate(to) }, endDate: { gte: toDate(from) } } }),
      tx.onCallPeriod.findMany({ where: { employmentId: { in: ids }, date: { gte: toDate(from), lte: toDate(to) } } }),
      tx.attendanceRuleSet.findMany({ where: { companyId: { in: [...new Set(emps.map((e) => e.companyId))] }, deletedAt: null } }),
      tx.timeClosing.findMany({ where: { companyId: { in: [...new Set(emps.map((e) => e.companyId))] }, status: 'CLOSED', periodStart: { lte: toDate(to) }, periodEnd: { gte: toDate(from) } } }),
      tx.overtimeAuthorization.findMany({ where: { employmentId: { in: ids }, date: { gte: toDate(from), lte: toDate(to) } } }),
      tx.timeCalculation.findMany({ where: { employmentId: { in: ids }, workDate: { gte: toDate(from), lte: toDate(to) } }, select: { employmentId: true, workDate: true, details: true } }),
    ]);
    const persistedMap = new Map(persisted.map((p) => [`${p.employmentId}|${iso(p.workDate)}`, p.details as unknown as DayView | null]));
    const out = new Map<string, DayView[]>();
    for (const e of emps) {
      const days = plan.get(e.id)!;
      const ruleFor = (ruleSetId: string | null): AttendanceRules & { overtimeRequiresAuthorization?: boolean } => {
        const own = ruleSets.find((r) => r.id === (e.ruleSetId ?? ruleSetId)) ?? ruleSets.find((r) => r.companyId === e.companyId && r.isDefault);
        const r = (own?.rules ?? {}) as Partial<AttendanceRules> & { overtimeRequiresAuthorization?: boolean };
        return { ...DEFAULT_RULES, ...r, overtimePercent: { ...DEFAULT_RULES.overtimePercent, ...r.overtimePercent } };
      };
      // Marcações efetivas e a visão de cada uma (para o espelho).
      const mineAdj = adjustments.filter((a) => a.employmentId === e.id);
      const views: PunchView[] = [];
      const effective: Array<{ at: Date; id: string }> = [];
      for (const r of records.filter((x) => x.employmentId === e.id)) {
        const dis = mineAdj.find((a) => a.kind === 'DISREGARD' && a.timeRecordId === r.id);
        const status: PunchStatus = dis?.status === 'APPROVED' ? 'DISREGARDED' : dis ? 'PENDING_DISREGARD' : 'ORIGINAL';
        const l = local(r.recordedAt);
        views.push({ id: r.id, adjustmentId: dis?.id ?? null, at: r.recordedAt.toISOString(), time: l.time, date: l.date, source: r.source, status, justification: dis?.justification ?? null });
        if (status !== 'DISREGARDED') effective.push({ at: r.recordedAt, id: r.id });
      }
      for (const a of mineAdj.filter((x) => x.kind === 'INCLUDE' && x.recordedAt)) {
        const l = local(a.recordedAt!);
        views.push({ id: a.id, adjustmentId: a.id, at: a.recordedAt!.toISOString(), time: l.time, date: l.date, source: 'MANUAL_ADJUSTMENT', status: a.status === 'APPROVED' ? 'INCLUDED' : 'PENDING_INCLUDE', justification: a.justification });
        if (a.status === 'APPROVED') effective.push({ at: a.recordedAt!, id: a.id });
      }
      const byDay = assignPunchesToDays(effective, days.map((d) => d.engine), TZ);
      const dayOfView = new Map<string, string>();
      for (const [date, list] of byDay) for (const p of list) dayOfView.set(p.id!, date);
      const list: DayView[] = [];
      for (const d of days) {
        const date = d.view.date;
        const closed = closings.some((c) => c.companyId === e.companyId && iso(c.periodStart) <= date && iso(c.periodEnd) >= date);
        const snap = closed ? persistedMap.get(`${e.id}|${date}`) : null;
        if (snap) { list.push({ ...snap, closed: true }); continue; }
        const outside = date < iso(e.hiredAt) || (!!e.terminatedAt && date > iso(e.terminatedAt));
        const punchViews = views.filter((v) => (dayOfView.get(v.id) ?? (v.status.startsWith('PENDING') || v.status === 'DISREGARDED' ? v.date : null)) === date)
          .sort((a, b) => a.at.localeCompare(b.at));
        const lv = leaves.find((x) => x.employmentId === e.id && iso(x.startDate) <= date && iso(x.endDate) >= date);
        const al = allowances.find((x) => x.employmentId === e.id && iso(x.date) === date);
        const oc = onCalls.filter((x) => x.employmentId === e.id && iso(x.date) === date);
        let absence: DayAbsence | null = null;
        if (lv) absence = { kind: 'full', reason: LEAVE_LABEL[lv.type] };
        else if (al && al.justification.disregardsDebits) absence = al.fullDay ? { kind: 'full', reason: al.justification.name } : { kind: 'partial', minutes: al.minutes, reason: al.justification.name };
        const rules = ruleFor(d.ruleSetId);
        let result: DayView['result'] = null;
        if (!outside) {
          const exp: ExpectedDay = d.engine;
          const r = calculateDay({ date, timeZone: TZ, expected: exp, punches: (byDay.get(date) ?? []).map((p) => ({ at: p.at, id: p.id })), rules, absence });
          const flags: string[] = [...r.flags];
          if (al && !al.justification.disregardsDebits) flags.push('JUSTIFIED');
          let unauthorized = 0;
          if (rules.overtimeRequiresAuthorization && r.overtimeMinutes > 0) {
            const auth = authorizations.find((x) => x.employmentId === e.id && iso(x.date) === date)?.maxMinutes ?? 0;
            unauthorized = Math.max(0, r.overtimeMinutes - auth);
            if (unauthorized > 0) flags.push('OVERTIME_UNAUTHORIZED');
          }
          result = { ...r, flags, unauthorizedOvertimeMinutes: unauthorized };
        }
        list.push({
          date, expected: d.view, punches: punchViews, result,
          allowance: al ? { id: al.id, justification: al.justification.name, disregardsDebits: al.justification.disregardsDebits, fullDay: al.fullDay, minutes: al.minutes, note: al.note } : null,
          leave: lv ? { id: lv.id, type: lv.type, label: LEAVE_LABEL[lv.type] ?? lv.type, note: lv.note } : null,
          onCall: oc.map((o) => ({ id: o.id, startTime: o.startTime, endTime: o.endTime, minutes: o.minutes })),
          closed, outsideEmployment: outside,
        });
      }
      out.set(e.id, list);
    }
    return out;
  }

  /** Totais do período (espelho), com sobreaviso e extra não autorizada. */
  summary(days: DayView[]) {
    const results = days.map((d) => d.result).filter((r): r is NonNullable<DayView['result']> => !!r) as unknown as DayResult[];
    const s = summarizePeriod(results);
    const onCallMinutes = days.reduce((t, d) => t + d.onCall.reduce((x, o) => x + o.minutes, 0), 0);
    return {
      ...s,
      onCallMinutes,
      onCallPaidMinutes: Math.round(onCallMinutes / 3),
      allowanceDays: days.filter((d) => d.allowance?.fullDay).length,
      leaveDays: days.filter((d) => d.leave).length,
      unauthorizedOvertimeMinutes: days.reduce((t, d) => t + (d.result?.unauthorizedOvertimeMinutes ?? 0), 0),
      pendingAdjustments: days.reduce((t, d) => t + d.punches.filter((p) => p.status.startsWith('PENDING')).length, 0),
    };
  }

  /** Grava a apuração dos dias abertos (dias de período fechado não são regravados). */
  async persist(tx: Tx, tenantId: string, map: Map<string, DayView[]>) {
    let n = 0;
    for (const [employmentId, days] of map) {
      for (const d of days) {
        if (d.closed || !d.result) continue;
        const r = d.result;
        const data = {
          expectedMinutes: r.expectedMinutes, workedMinutes: r.workedMinutes, balanceMinutes: r.balanceMinutes, overtime: r.overtime as unknown as Prisma.InputJsonValue,
          nightMinutes: r.nightMinutes, lateMinutes: r.lateMinutes, earlyLeaveMinutes: r.earlyLeaveMinutes, absenceMinutes: r.absenceMinutes, breakMinutes: r.breakMinutes,
          flags: r.flags as unknown as Prisma.InputJsonValue, details: d as unknown as Prisma.InputJsonValue, engineVersion: r.engineVersion, calculatedAt: new Date(),
        };
        await tx.timeCalculation.upsert({ where: { employmentId_workDate: { employmentId, workDate: toDate(d.date) } }, create: { tenantId, employmentId, workDate: toDate(d.date), ...data }, update: data });
        n++;
      }
    }
    return n;
  }
}
