import { summarizePeriod, type DayResult } from '@superponto/time-engine';
import { sha256Hex } from '../common/crypto.js';
import type { DayView } from '../timesheet/timesheet.core.js';

/**
 * Hash do espelho que o funcionário viu: dias (marcações e resultado) e totais. Se algo mudar depois
 * (ajuste, abono, reabertura), o hash muda e a ciência aparece como "espelho mudou depois".
 */
export function mirrorHashOf(employmentId: string, from: string, to: string, list: DayView[]) {
  const days = list.map((d) => ({
    date: d.date, punches: d.punches.map((p) => `${p.time}:${p.status}`),
    r: d.result ? [d.result.expectedMinutes, d.result.workedMinutes, d.result.balanceMinutes, d.result.lateMinutes, d.result.absenceMinutes, d.result.nightMinutes, d.result.overtimeMinutes] : null,
    allowance: d.allowance?.justification ?? null, leave: d.leave?.type ?? null,
  }));
  const s = summarizePeriod(list.map((d) => d.result).filter(Boolean) as unknown as DayResult[]);
  const summary = { expected: s.expectedMinutes, worked: s.workedMinutes, balance: s.balanceMinutes, overtime: s.overtimeMinutes, late: s.lateMinutes, early: s.earlyLeaveMinutes, absenceDays: s.absenceDays, night: s.nightMinutes };
  return { hash: sha256Hex(JSON.stringify({ e: employmentId, from, to, days, summary })), summary };
}
