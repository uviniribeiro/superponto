// Consolidação de período por vínculo (espelho de ponto).
import type { DayResult } from './calculate.ts';

export interface PeriodSummary {
  days: number;
  workdays: number;
  expectedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  overtimeMinutes: number;
  overtimeByPercent: { percent: number; minutes: number }[];
  nightMinutes: number;
  nightReducedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  absenceDays: number;
  incompleteDays: number;
}

export function summarizePeriod(days: DayResult[]): PeriodSummary {
  const byPercent = new Map<number, number>();
  const s: PeriodSummary = {
    days: days.length, workdays: 0, expectedMinutes: 0, workedMinutes: 0, balanceMinutes: 0, overtimeMinutes: 0,
    overtimeByPercent: [], nightMinutes: 0, nightReducedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0,
    absenceDays: 0, incompleteDays: 0,
  };
  for (const d of days) {
    if (d.expectedMinutes > 0) s.workdays++;
    s.expectedMinutes += d.expectedMinutes;
    s.workedMinutes += d.workedMinutes;
    s.balanceMinutes += d.balanceMinutes;
    s.overtimeMinutes += d.overtimeMinutes;
    s.nightMinutes += d.nightMinutes;
    s.nightReducedMinutes += d.nightReducedMinutes;
    s.lateMinutes += d.lateMinutes;
    s.earlyLeaveMinutes += d.earlyLeaveMinutes;
    if (d.flags.includes('ABSENCE')) s.absenceDays++;
    if (d.flags.includes('INCOMPLETE')) s.incompleteDays++;
    for (const o of d.overtime) byPercent.set(o.percent, (byPercent.get(o.percent) ?? 0) + o.minutes);
  }
  s.overtimeByPercent = [...byPercent].map(([percent, minutes]) => ({ percent, minutes })).sort((a, b) => a.percent - b.percent);
  return s;
}
