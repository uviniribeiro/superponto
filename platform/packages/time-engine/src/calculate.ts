// Apuração diária de um vínculo: marcações + jornada prevista + regras -> resultado auditável.
import type { ExpectedDay } from './schedule.ts';
import { type CivilDate, minutesFrom, parseHm } from './time.ts';

export const ENGINE_VERSION = '2.0.0';

export type RoundingMode = 'up' | 'down' | 'nearest';

export interface AttendanceRules {
  /** tolerância por marcação (CLT art. 58 §1º: até 5 min) */
  markToleranceMinutes: number;
  /** tolerância diária total (CLT: até 10 min) */
  dailyToleranceMinutes: number;
  roundingMinutes: number;
  roundingMode: RoundingMode;
  overtimePercent: { normal: number; night: number; rest: number; holiday: number; break: number };
  nightStart: string;
  nightEnd: string;
  /** hora noturna reduzida de 52min30s */
  reducedNightHour: boolean;
  /** intervalo mínimo; o que faltar vira extra de intervalo */
  minBreakMinutes: number;
  /** desconta o intervalo previsto quando não houver marcação de intervalo */
  autoDeductBreak: boolean;
  dailyOvertimeLimitMinutes: number;
  /** falta sem justificativa gera saldo negativo */
  discountAbsences: boolean;
}

export const DEFAULT_RULES: AttendanceRules = {
  markToleranceMinutes: 5,
  dailyToleranceMinutes: 10,
  roundingMinutes: 0,
  roundingMode: 'nearest',
  overtimePercent: { normal: 50, night: 50, rest: 100, holiday: 100, break: 50 },
  nightStart: '22:00',
  nightEnd: '05:00',
  reducedNightHour: true,
  minBreakMinutes: 60,
  autoDeductBreak: false,
  dailyOvertimeLimitMinutes: 120,
  discountAbsences: true,
};

export interface Punch {
  at: Date;
  /** marcações desconsideradas por ajuste aprovado não entram aqui */
  id?: string;
}

export interface DayAbsence {
  kind: 'full' | 'partial';
  minutes?: number;
  reason?: string;
}

export interface DayInput {
  date: CivilDate;
  timeZone: string;
  expected: ExpectedDay;
  punches: Punch[];
  rules?: Partial<AttendanceRules>;
  absence?: DayAbsence | null;
}

export type DayFlag =
  | 'ABSENCE'
  | 'INCOMPLETE'
  | 'LATE'
  | 'EARLY_LEAVE'
  | 'EARLY_ENTRY'
  | 'INSUFFICIENT_BREAK'
  | 'AUTO_BREAK_DEDUCTED'
  | 'OVERTIME_LIMIT_EXCEEDED'
  | 'WITHIN_TOLERANCE'
  | 'WORK_ON_REST_DAY'
  | 'WORK_ON_HOLIDAY'
  | 'LEAVE_FULL'
  | 'LEAVE_PARTIAL';

export interface DayResult {
  date: CivilDate;
  engineVersion: string;
  expectedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  breakMinutes: number;
  nightMinutes: number;
  nightReducedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  earlyEntryMinutes: number;
  absenceMinutes: number;
  breakShortfallMinutes: number;
  overtime: { percent: number; minutes: number }[];
  overtimeMinutes: number;
  intervals: { start: number; end: number }[];
  flags: DayFlag[];
}

function round(minutes: number, rules: AttendanceRules): number {
  if (!rules.roundingMinutes) return Math.round(minutes);
  const ratio = minutes / rules.roundingMinutes;
  const r = rules.roundingMode === 'up' ? Math.ceil(ratio) : rules.roundingMode === 'down' ? Math.floor(ratio) : Math.round(ratio);
  return r * rules.roundingMinutes;
}

/** Minutos noturnos dentro de [start, end), onde os valores são relativos à meia-noite da data base. */
export function nightMinutes(start: number, end: number, rules: AttendanceRules): number {
  const ns = parseHm(rules.nightStart);
  const ne = parseHm(rules.nightEnd);
  let total = 0;
  for (let m = start; m < end; m++) {
    const mod = ((m % 1440) + 1440) % 1440;
    const isNight = ns < ne ? mod >= ns && mod < ne : mod >= ns || mod < ne;
    if (isNight) total++;
  }
  return total;
}

export function calculateDay(input: DayInput): DayResult {
  const rules: AttendanceRules = {
    ...DEFAULT_RULES,
    ...input.rules,
    overtimePercent: { ...DEFAULT_RULES.overtimePercent, ...input.rules?.overtimePercent },
  };
  const { expected, date } = input;
  const flags: DayFlag[] = [];
  const base = (overrides: Partial<DayResult>): DayResult => ({
    date, engineVersion: ENGINE_VERSION, expectedMinutes: expected.expectedMinutes, workedMinutes: 0, balanceMinutes: 0,
    breakMinutes: 0, nightMinutes: 0, nightReducedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, earlyEntryMinutes: 0,
    absenceMinutes: 0, breakShortfallMinutes: 0, overtime: [], overtimeMinutes: 0, intervals: [], flags, ...overrides,
  });

  // Afastamento integral: dia neutro.
  if (input.absence?.kind === 'full') {
    flags.push('LEAVE_FULL');
    return base({ absenceMinutes: expected.expectedMinutes });
  }
  const leaveMinutes = input.absence?.kind === 'partial' ? Math.min(input.absence.minutes ?? 0, expected.expectedMinutes) : 0;
  if (leaveMinutes) flags.push('LEAVE_PARTIAL');
  const effectiveExpected = Math.max(0, expected.expectedMinutes - leaveMinutes);

  const marks = [...input.punches]
    .map((p) => minutesFrom(date, p.at, input.timeZone))
    .sort((a, b) => a - b);

  // Falta: dia útil sem marcações.
  if (marks.length === 0) {
    if (expected.isWorkday && effectiveExpected > 0) {
      flags.push('ABSENCE');
      return base({
        absenceMinutes: effectiveExpected,
        balanceMinutes: rules.discountAbsences ? -effectiveExpected : 0,
      });
    }
    return base({});
  }

  // Pareamento sequencial: (1ª,2ª), (3ª,4ª)... Independe do tipo informado pelo equipamento.
  const intervals: { start: number; end: number }[] = [];
  for (let i = 0; i + 1 < marks.length; i += 2) intervals.push({ start: marks[i]!, end: marks[i + 1]! });
  const incomplete = marks.length % 2 === 1;
  if (incomplete) flags.push('INCOMPLETE');

  let worked = intervals.reduce((s, iv) => s + (iv.end - iv.start), 0);
  let breakMinutes = 0;
  for (let i = 1; i < intervals.length; i++) breakMinutes += intervals[i]!.start - intervals[i - 1]!.end;
  let night = intervals.reduce((s, iv) => s + nightMinutes(iv.start, iv.end, rules), 0);

  if (intervals.length === 1 && rules.autoDeductBreak && expected.breakMinutes > 0 && worked > expected.breakMinutes) {
    breakMinutes = expected.breakMinutes;
    worked -= breakMinutes;
    flags.push('AUTO_BREAK_DEDUCTED');
  }
  worked = Math.max(0, round(worked, rules));
  night = Math.max(0, Math.min(night, worked));

  // Intervalo inferior ao mínimo (só quando o intervalo foi marcado).
  let breakShortfall = 0;
  if (intervals.length > 1 && rules.minBreakMinutes > 0 && breakMinutes < rules.minBreakMinutes && worked > 360) {
    breakShortfall = rules.minBreakMinutes - breakMinutes;
    flags.push('INSUFFICIENT_BREAK');
  }

  // Variações em relação ao horário previsto.
  let late = 0, earlyLeave = 0, earlyEntry = 0, lateExit = 0;
  const first = marks[0]!;
  const last = incomplete ? null : marks[marks.length - 1]!;
  if (expected.start !== null) {
    if (first > expected.start) late = first - expected.start;
    else earlyEntry = expected.start - first;
  }
  if (expected.end !== null && last !== null) {
    if (last < expected.end) earlyLeave = expected.end - last;
    else lateExit = last - expected.end;
  }

  // CLT art. 58 §1º: variações de até 5 min por marcação, limitadas a 10 min no dia, são desconsideradas.
  const variations = [late, earlyLeave, earlyEntry, lateExit];
  const withinTolerance =
    expected.isWorkday && !expected.flexible && !incomplete &&
    variations.every((v) => v <= rules.markToleranceMinutes) &&
    variations.reduce((s, v) => s + v, 0) <= rules.dailyToleranceMinutes &&
    variations.some((v) => v > 0);
  if (withinTolerance) {
    flags.push('WITHIN_TOLERANCE');
    late = earlyLeave = earlyEntry = 0;
  } else {
    if (late) flags.push('LATE');
    if (earlyLeave) flags.push('EARLY_LEAVE');
    if (earlyEntry) flags.push('EARLY_ENTRY');
  }

  const dayKind: 'normal' | 'rest' | 'holiday' = expected.isHoliday ? 'holiday' : expected.isWorkday ? 'normal' : 'rest';
  if (dayKind === 'holiday') flags.push('WORK_ON_HOLIDAY');
  if (dayKind === 'rest') flags.push('WORK_ON_REST_DAY');

  let balance: number;
  let overtimeMinutes: number;
  if (incomplete) {
    // Marcação ímpar: dia pendente de tratamento; não gera extra nem desconto automático.
    balance = 0;
    overtimeMinutes = 0;
  } else if (dayKind === 'normal') {
    balance = withinTolerance ? 0 : worked - effectiveExpected;
    overtimeMinutes = Math.max(0, balance);
  } else {
    balance = worked;
    overtimeMinutes = worked;
  }

  const overtime: { percent: number; minutes: number }[] = [];
  if (overtimeMinutes > 0) {
    const pct = dayKind === 'holiday' ? rules.overtimePercent.holiday : dayKind === 'rest' ? rules.overtimePercent.rest : rules.overtimePercent.normal;
    const nightPart = Math.min(night, overtimeMinutes);
    const dayPart = overtimeMinutes - nightPart;
    if (dayPart > 0) overtime.push({ percent: pct, minutes: dayPart });
    if (nightPart > 0) overtime.push({ percent: dayKind === 'normal' ? rules.overtimePercent.night : pct, minutes: nightPart });
  }
  if (breakShortfall > 0) overtime.push({ percent: rules.overtimePercent.break, minutes: breakShortfall });
  if (rules.dailyOvertimeLimitMinutes > 0 && overtimeMinutes > rules.dailyOvertimeLimitMinutes && dayKind === 'normal') {
    flags.push('OVERTIME_LIMIT_EXCEEDED');
  }

  return base({
    expectedMinutes: expected.expectedMinutes,
    workedMinutes: worked,
    balanceMinutes: balance,
    breakMinutes,
    nightMinutes: night,
    nightReducedMinutes: rules.reducedNightHour ? Math.round((night * 60) / 52.5) : night,
    lateMinutes: late,
    earlyLeaveMinutes: earlyLeave,
    earlyEntryMinutes: earlyEntry,
    absenceMinutes: leaveMinutes,
    breakShortfallMinutes: breakShortfall,
    overtime,
    overtimeMinutes: overtimeMinutes + breakShortfall,
    intervals,
  });
}

/**
 * Atribui cada marcação ao dia de jornada: a jornada cuja janela (início - 4h até fim + 4h)
 * contém a marcação; sem jornada, a data local da marcação. Resolve plantões noturnos.
 */
export function assignPunchesToDays(
  punches: Punch[],
  days: ExpectedDay[],
  timeZone: string,
  marginMinutes = 240,
): Map<CivilDate, Punch[]> {
  const result = new Map<CivilDate, Punch[]>(days.map((d) => [d.date, []]));
  const ordered = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const punch of punches) {
    let target: CivilDate | null = null;
    for (const day of ordered) {
      if (day.start === null || day.end === null) continue;
      const m = minutesFrom(day.date, punch.at, timeZone);
      if (m >= day.start - marginMinutes && m <= day.end + marginMinutes) { target = day.date; break; }
    }
    if (!target) {
      // data local da marcação
      const local = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(punch.at);
      target = local;
    }
    if (!result.has(target)) result.set(target, []);
    result.get(target)!.push(punch);
  }
  return result;
}
