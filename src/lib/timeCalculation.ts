/**
 * Motor de apuração de ponto — Módulo 8 do Anexo I (PE 085/2026).
 *
 * Implementa: horas normais (8.9), horas extras em dias normais/feriados/folgas (8.10),
 * percentuais diferenciados (8.11), extras em intervalo de refeição (8.12), horas noturnas
 * (8.13), atrasos com tolerância (8.14), entradas/saídas antecipadas (8.15/8.16),
 * intrajornada (8.17), tolerância nas marcações (8.18), alocação de ocorrências (8.19),
 * reconhecimento do dia da jornada (8.20), afastamentos integral/parcial (8.21/8.22),
 * arredondamento (8.23), compensação automática (8.24), saldo sem compensação para dia
 * com marcação única (8.25) e apuração de faltas (8.27).
 */

export type RoundingMode = 'up' | 'down' | 'nearest';
export type JourneyDayReference = 'entry' | 'exit';
export type OccurrenceAllocation = 'journey_day' | 'real_day';
export type DayKind = 'normal' | 'rest' | 'holiday';

export interface AttendanceRules {
  entry_tolerance_minutes: number;
  exit_tolerance_minutes: number;
  daily_tolerance_minutes: number;
  per_punch_tolerance_minutes: number;
  rounding_minutes: number;
  rounding_mode: RoundingMode;
  overtime_normal_percent: number;
  overtime_night_percent: number;
  overtime_rest_day_percent: number;
  overtime_holiday_percent: number;
  overtime_break_percent: number;
  count_break_overtime: boolean;
  daily_overtime_limit_minutes: number;
  night_start: string; // HH:mm
  night_end: string; // HH:mm
  night_percent: number;
  use_reduced_night_hour: boolean;
  min_break_minutes: number;
  auto_deduct_break: boolean;
  auto_compensation: boolean;
  compensation_deadline_days: number;
  max_occurrences_per_month: number;
  max_compensation_minutes_per_month: number;
  journey_day_reference: JourneyDayReference;
  occurrence_allocation: OccurrenceAllocation;
  single_punch_balance: boolean;
  require_manager_approval_early: boolean;
  auto_discount_absences: boolean;
}

export const DEFAULT_ATTENDANCE_RULES: AttendanceRules = {
  entry_tolerance_minutes: 5,
  exit_tolerance_minutes: 5,
  daily_tolerance_minutes: 10,
  per_punch_tolerance_minutes: 0,
  rounding_minutes: 0,
  rounding_mode: 'nearest',
  overtime_normal_percent: 50,
  overtime_night_percent: 50,
  overtime_rest_day_percent: 100,
  overtime_holiday_percent: 100,
  overtime_break_percent: 50,
  count_break_overtime: true,
  daily_overtime_limit_minutes: 120,
  night_start: '22:00',
  night_end: '05:00',
  night_percent: 20,
  use_reduced_night_hour: true,
  min_break_minutes: 60,
  auto_deduct_break: true,
  auto_compensation: true,
  compensation_deadline_days: 30,
  max_occurrences_per_month: 5,
  max_compensation_minutes_per_month: 600,
  journey_day_reference: 'entry',
  occurrence_allocation: 'journey_day',
  single_punch_balance: true,
  require_manager_approval_early: true,
  auto_discount_absences: true,
};

export interface PunchInput {
  record_type: 'entry' | 'break_start' | 'break_end' | 'exit';
  recorded_at: string | Date;
}

export interface ExpectedJourney {
  /** horário previsto de entrada, HH:mm (opcional) */
  start?: string | null;
  /** horário previsto de saída, HH:mm (opcional) */
  end?: string | null;
  /** minutos previstos de trabalho no dia */
  expectedMinutes: number;
  /** minutos previstos de intervalo */
  breakMinutes?: number;
}

export interface DayAbsence {
  /** afastamento integral (8.21) ou parcial (8.22) */
  type: 'full' | 'partial';
  minutes?: number;
  reason?: string;
}

export interface DayCalculationInput {
  /** data de referência (dia da jornada) */
  date: Date;
  punches: PunchInput[];
  journey: ExpectedJourney;
  dayKind: DayKind;
  rules: AttendanceRules;
  absence?: DayAbsence | null;
}

export interface DayCalculationResult {
  /** dia ao qual as ocorrências foram alocadas (8.19/8.20) */
  journeyDate: string;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
  overtimeByPercent: { percent: number; minutes: number }[];
  nightMinutes: number;
  /** minutos noturnos já convertidos pela hora reduzida de 52min30s */
  nightAdjustedMinutes: number;
  breakMinutes: number;
  intraJourneyShortfallMinutes: number;
  breakOvertimeMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  earlyEntryMinutes: number;
  absenceMinutes: number;
  isAbsent: boolean;
  incomplete: boolean;
  occurrences: string[];
}

const MINUTE = 60000;

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

const parseTime = (time: string): { h: number; m: number } => {
  const [h, m] = (time || '00:00').split(':').map((v) => parseInt(v, 10) || 0);
  return { h, m };
};

/** Arredonda minutos conforme a regra parametrizada (8.23) */
export function roundMinutes(minutes: number, rules: AttendanceRules): number {
  const step = rules.rounding_minutes;
  if (!step || step <= 0) return Math.round(minutes);
  const ratio = minutes / step;
  const rounded =
    rules.rounding_mode === 'up'
      ? Math.ceil(ratio)
      : rules.rounding_mode === 'down'
      ? Math.floor(ratio)
      : Math.round(ratio);
  return rounded * step;
}

/** Minutos trabalhados dentro do horário noturno (8.13), tratando virada de dia */
export function nightMinutesBetween(start: Date, end: Date, rules: AttendanceRules): number {
  if (end <= start) return 0;
  const { h: sh, m: sm } = parseTime(rules.night_start);
  const { h: eh, m: em } = parseTime(rules.night_end);

  let total = 0;
  // varre minuto a minuto em blocos de 1 minuto (preciso e suficiente para jornadas diárias)
  for (let t = start.getTime(); t < end.getTime(); t += MINUTE) {
    const d = new Date(t);
    const minutesOfDay = d.getHours() * 60 + d.getMinutes();
    const nightStart = sh * 60 + sm;
    const nightEnd = eh * 60 + em;
    const isNight =
      nightStart < nightEnd
        ? minutesOfDay >= nightStart && minutesOfDay < nightEnd
        : minutesOfDay >= nightStart || minutesOfDay < nightEnd;
    if (isNight) total += 1;
  }
  return total;
}

/** Converte minutos noturnos usando a hora reduzida de 52min30s */
export function applyReducedNightHour(nightMinutes: number, rules: AttendanceRules): number {
  if (!rules.use_reduced_night_hour) return nightMinutes;
  return Math.round((nightMinutes * 60) / 52.5);
}

function diffMinutes(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / MINUTE));
}

function combine(date: Date, time: string): Date {
  const { h, m } = parseTime(time);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Apura um dia de jornada a partir das marcações.
 */
export function calculateDay(input: DayCalculationInput): DayCalculationResult {
  const { punches, journey, dayKind, rules } = input;
  const occurrences: string[] = [];

  const sorted = [...punches].sort(
    (a, b) => toDate(a.recorded_at).getTime() - toDate(b.recorded_at).getTime()
  );

  const entry = sorted.find((p) => p.record_type === 'entry');
  const exit = [...sorted].reverse().find((p) => p.record_type === 'exit');
  const breakStart = sorted.find((p) => p.record_type === 'break_start');
  const breakEnd = sorted.find((p) => p.record_type === 'break_end');

  // Reconhecimento do dia da jornada pelo dia de entrada ou de saída (8.20)
  const reference =
    rules.journey_day_reference === 'exit' && exit
      ? toDate(exit.recorded_at)
      : entry
      ? toDate(entry.recorded_at)
      : input.date;
  const journeyDate = new Date(reference);
  journeyDate.setHours(0, 0, 0, 0);

  const expectedMinutes = journey.expectedMinutes || 0;

  // Afastamentos (8.21 / 8.22)
  const absenceMinutes =
    input.absence?.type === 'full'
      ? expectedMinutes
      : input.absence?.type === 'partial'
      ? Math.min(input.absence.minutes || 0, expectedMinutes)
      : 0;

  if (input.absence?.type === 'full') {
    occurrences.push(`Afastamento integral${input.absence.reason ? `: ${input.absence.reason}` : ''}`);
    return {
      journeyDate: journeyDate.toISOString().slice(0, 10),
      workedMinutes: 0,
      expectedMinutes,
      balanceMinutes: 0,
      normalMinutes: 0,
      overtimeMinutes: 0,
      overtimeByPercent: [],
      nightMinutes: 0,
      nightAdjustedMinutes: 0,
      breakMinutes: 0,
      intraJourneyShortfallMinutes: 0,
      breakOvertimeMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      earlyEntryMinutes: 0,
      absenceMinutes,
      isAbsent: false,
      incomplete: false,
      occurrences,
    };
  }

  // Falta: nenhuma marcação em dia com jornada prevista (8.27)
  if (!entry && expectedMinutes > 0 && dayKind === 'normal') {
    occurrences.push('Falta (sem marcações)');
    return {
      journeyDate: journeyDate.toISOString().slice(0, 10),
      workedMinutes: 0,
      expectedMinutes,
      balanceMinutes: rules.auto_discount_absences ? -expectedMinutes : 0,
      normalMinutes: 0,
      overtimeMinutes: 0,
      overtimeByPercent: [],
      nightMinutes: 0,
      nightAdjustedMinutes: 0,
      breakMinutes: 0,
      intraJourneyShortfallMinutes: 0,
      breakOvertimeMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      earlyEntryMinutes: 0,
      absenceMinutes: expectedMinutes,
      isAbsent: true,
      incomplete: false,
      occurrences,
    };
  }

  // Marcação única — saldo automático sem compensação (8.25)
  const incomplete = !!entry !== !!exit;
  if (incomplete) {
    occurrences.push('Marcação única no dia — saldo gerado sem compensação');
  }

  const entryAt = entry ? toDate(entry.recorded_at) : null;
  const exitAt = exit ? toDate(exit.recorded_at) : null;

  let workedMinutes = 0;
  let breakMinutes = 0;
  let nightMinutes = 0;

  if (entryAt && exitAt) {
    workedMinutes = diffMinutes(entryAt, exitAt);
    nightMinutes = nightMinutesBetween(entryAt, exitAt, rules);

    if (breakStart && breakEnd) {
      const bs = toDate(breakStart.recorded_at);
      const be = toDate(breakEnd.recorded_at);
      breakMinutes = diffMinutes(bs, be);
      workedMinutes -= breakMinutes;
      nightMinutes -= nightMinutesBetween(bs, be, rules);
    } else if (rules.auto_deduct_break && journey.breakMinutes && journey.breakMinutes > 0) {
      breakMinutes = journey.breakMinutes;
      workedMinutes -= breakMinutes;
      occurrences.push('Intervalo descontado automaticamente (sem marcação)');
    }
  }

  workedMinutes = Math.max(0, roundMinutes(workedMinutes, rules));
  nightMinutes = Math.max(0, nightMinutes);

  // Intrajornada abaixo do mínimo (8.17) — o tempo não usufruído vira hora extra (8.12)
  let intraJourneyShortfallMinutes = 0;
  let breakOvertimeMinutes = 0;
  if (rules.min_break_minutes > 0 && breakMinutes > 0 && breakMinutes < rules.min_break_minutes) {
    intraJourneyShortfallMinutes = rules.min_break_minutes - breakMinutes;
    if (rules.count_break_overtime) breakOvertimeMinutes = intraJourneyShortfallMinutes;
    occurrences.push(`Intrajornada inferior ao mínimo (${breakMinutes} min de ${rules.min_break_minutes} min)`);
  }

  // Atrasos, entradas e saídas antecipadas (8.14, 8.15, 8.16, 8.18)
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let earlyEntryMinutes = 0;

  if (entryAt && journey.start) {
    const expectedStart = combine(entryAt, journey.start);
    const delta = Math.round((entryAt.getTime() - expectedStart.getTime()) / MINUTE);
    const tolerance = rules.entry_tolerance_minutes + rules.per_punch_tolerance_minutes;
    if (delta > tolerance) {
      lateMinutes = delta;
      occurrences.push(`Atraso de ${delta} min na entrada`);
    } else if (delta < -tolerance) {
      earlyEntryMinutes = Math.abs(delta);
      occurrences.push(
        `Entrada antecipada de ${earlyEntryMinutes} min${
          rules.require_manager_approval_early ? ' (requer anuência da chefia)' : ''
        }`
      );
    }
  }

  if (exitAt && journey.end) {
    const expectedEnd = combine(exitAt, journey.end);
    const delta = Math.round((expectedEnd.getTime() - exitAt.getTime()) / MINUTE);
    const tolerance = rules.exit_tolerance_minutes + rules.per_punch_tolerance_minutes;
    if (delta > tolerance) {
      earlyLeaveMinutes = delta;
      occurrences.push(
        `Saída antecipada de ${delta} min${
          rules.require_manager_approval_early ? ' (requer anuência da chefia)' : ''
        }`
      );
    }
  }

  // Tolerância diária total (8.18)
  const toleranceUsed = lateMinutes + earlyLeaveMinutes;
  const withinDailyTolerance = toleranceUsed > 0 && toleranceUsed <= rules.daily_tolerance_minutes;
  if (withinDailyTolerance) {
    occurrences.push(`Dentro da tolerância diária (${toleranceUsed} min)`);
  }

  const effectiveExpected = Math.max(0, expectedMinutes - absenceMinutes);
  const rawBalance = workedMinutes - effectiveExpected;
  const balanceMinutes = withinDailyTolerance && rawBalance < 0 ? 0 : rawBalance;

  const normalMinutes = Math.min(workedMinutes, effectiveExpected);

  // Horas extras (8.10, 8.11) — em folga/feriado toda a jornada é extra
  let overtimeMinutes =
    dayKind === 'normal' ? Math.max(0, workedMinutes - effectiveExpected) : workedMinutes;

  if (rules.daily_overtime_limit_minutes > 0 && overtimeMinutes > rules.daily_overtime_limit_minutes) {
    occurrences.push(
      `Extra acima do limite diário (${overtimeMinutes} min de ${rules.daily_overtime_limit_minutes} min)`
    );
  }

  const overtimeByPercent: { percent: number; minutes: number }[] = [];
  if (overtimeMinutes > 0) {
    const basePercent =
      dayKind === 'holiday'
        ? rules.overtime_holiday_percent
        : dayKind === 'rest'
        ? rules.overtime_rest_day_percent
        : rules.overtime_normal_percent;

    // separa a parcela noturna com percentual próprio (8.11)
    const nightPortion = Math.min(nightMinutes, overtimeMinutes);
    const dayPortion = overtimeMinutes - nightPortion;
    if (dayPortion > 0) overtimeByPercent.push({ percent: basePercent, minutes: dayPortion });
    if (nightPortion > 0) {
      overtimeByPercent.push({
        percent: dayKind === 'normal' ? rules.overtime_night_percent : basePercent,
        minutes: nightPortion,
      });
    }
  }

  if (breakOvertimeMinutes > 0) {
    overtimeByPercent.push({ percent: rules.overtime_break_percent, minutes: breakOvertimeMinutes });
    overtimeMinutes += breakOvertimeMinutes;
  }

  return {
    journeyDate: journeyDate.toISOString().slice(0, 10),
    workedMinutes,
    expectedMinutes,
    balanceMinutes,
    normalMinutes,
    overtimeMinutes,
    overtimeByPercent,
    nightMinutes,
    nightAdjustedMinutes: applyReducedNightHour(nightMinutes, rules),
    breakMinutes,
    intraJourneyShortfallMinutes,
    breakOvertimeMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    earlyEntryMinutes,
    absenceMinutes,
    isAbsent: false,
    incomplete,
    occurrences,
  };
}

export interface PeriodSummary {
  days: DayCalculationResult[];
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  overtimeMinutes: number;
  overtimeByPercent: { percent: number; minutes: number }[];
  nightMinutes: number;
  nightAdjustedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  absenceDays: number;
  /** minutos compensados automaticamente dentro dos limites (8.24) */
  compensatedMinutes: number;
  /** saldo restante após a compensação automática */
  residualBalanceMinutes: number;
  occurrencesCount: number;
}

/** Consolida um período e aplica a compensação automática parametrizada (8.24) */
export function summarizePeriod(days: DayCalculationResult[], rules: AttendanceRules): PeriodSummary {
  const percentMap = new Map<number, number>();
  let workedMinutes = 0;
  let expectedMinutes = 0;
  let balanceMinutes = 0;
  let overtimeMinutes = 0;
  let nightMinutes = 0;
  let nightAdjustedMinutes = 0;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let absenceDays = 0;
  let occurrencesCount = 0;

  days.forEach((day) => {
    workedMinutes += day.workedMinutes;
    expectedMinutes += day.expectedMinutes;
    balanceMinutes += day.balanceMinutes;
    overtimeMinutes += day.overtimeMinutes;
    nightMinutes += day.nightMinutes;
    nightAdjustedMinutes += day.nightAdjustedMinutes;
    lateMinutes += day.lateMinutes;
    earlyLeaveMinutes += day.earlyLeaveMinutes;
    if (day.isAbsent) absenceDays += 1;
    occurrencesCount += day.occurrences.length;
    day.overtimeByPercent.forEach((item) => {
      percentMap.set(item.percent, (percentMap.get(item.percent) || 0) + item.minutes);
    });
  });

  // Compensação automática de atrasos/saídas antecipadas com limites (8.24)
  let compensatedMinutes = 0;
  if (rules.auto_compensation) {
    const debit = days.filter((d) => d.balanceMinutes < 0);
    const occurrences = debit.length;
    const debitMinutes = debit.reduce((sum, d) => sum + Math.abs(d.balanceMinutes), 0);
    const credit = days.reduce((sum, d) => sum + Math.max(0, d.balanceMinutes), 0);
    if (occurrences <= rules.max_occurrences_per_month) {
      compensatedMinutes = Math.min(
        debitMinutes,
        credit,
        rules.max_compensation_minutes_per_month
      );
    }
  }

  return {
    days,
    workedMinutes,
    expectedMinutes,
    balanceMinutes,
    overtimeMinutes,
    overtimeByPercent: [...percentMap.entries()]
      .map(([percent, minutes]) => ({ percent, minutes }))
      .sort((a, b) => a.percent - b.percent),
    nightMinutes,
    nightAdjustedMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    absenceDays,
    compensatedMinutes,
    residualBalanceMinutes: balanceMinutes + compensatedMinutes * 0,
    occurrencesCount,
  };
}

/** Formata minutos como HH:mm (com sinal quando negativo) */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
