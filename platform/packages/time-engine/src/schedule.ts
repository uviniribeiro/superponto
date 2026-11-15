// Resolução da jornada prevista de um vínculo em uma data.
import { type CivilDate, diffDays, parseHm, weekday } from './time.ts';

export type ScheduleType =
  | 'FIXED'
  | 'FLEXIBLE'
  | 'SHIFT_12X36'
  | 'SHIFT_6X1'
  | 'SHIFT_5X2'
  | 'SHIFT_4X2'
  | 'ROTATING'
  | 'CUSTOM'
  | 'ON_CALL'
  | 'TEACHING';

export interface ScheduleDay {
  /** dia da semana (0-6) em jornadas semanais; posição no ciclo em escalas cíclicas */
  dayIndex: number;
  isWorkday: boolean;
  startTime?: string | null;
  endTime?: string | null;
  breakMinutes?: number;
  /** início previsto do intervalo (HH:mm); usado na mobilidade de intervalo */
  breakStart?: string | null;
  /** obrigatório em jornadas flexíveis (sem horário fixo) */
  expectedMinutes?: number;
}

export interface Schedule {
  type: ScheduleType;
  days: ScheduleDay[];
  /** tamanho do ciclo em dias (escalas cíclicas) */
  cycleDays?: number | null;
  /** feriado vira folga (padrão). Falso: o dia segue a escala (comum em 12x36 e plantões). */
  considerHolidays?: boolean;
  /** hora in itinere: minutos de deslocamento somados à jornada nos dias trabalhados (quando a convenção prevê) */
  inItinereMinutes?: number;
  /** mobilidade de jornada: a entrada pode variar até N min e a saída prevista acompanha, sem atraso nem extra */
  entryMobilityMinutes?: number;
  /** mobilidade de intervalo: o intervalo pode começar até N min antes ou depois do previsto */
  breakMobilityMinutes?: number;
}

/** Escala agendada: substitui a jornada de um dia específico (trabalho ou folga). */
export interface DayOverride {
  isWorkday: boolean;
  startTime?: string | null;
  endTime?: string | null;
  breakMinutes?: number;
  breakStart?: string | null;
  expectedMinutes?: number;
}

export interface ScheduleAssignment {
  schedule: Schedule;
  validFrom: CivilDate;
  validTo?: CivilDate | null;
  /** primeiro dia do ciclo (posição 0) */
  cycleStart?: CivilDate | null;
}

export interface CalendarDay {
  date: CivilDate;
  isHoliday: boolean;
  /** feriado/evento marcado como dia útil (ex.: dia de planejamento) */
  isWorkday?: boolean;
}

export interface ExpectedDay {
  date: CivilDate;
  isWorkday: boolean;
  isHoliday: boolean;
  /** minutos desde 00:00 da data (fim pode passar de 1440 em jornadas noturnas) */
  start: number | null;
  end: number | null;
  breakMinutes: number;
  expectedMinutes: number;
  flexible: boolean;
  /** início previsto do intervalo (minutos desde 00:00 da data) */
  breakStart?: number | null;
  inItinereMinutes?: number;
  entryMobilityMinutes?: number;
  breakMobilityMinutes?: number;
  /** dia definido por escala agendada */
  scheduled?: boolean;
}

const CYCLIC: ScheduleType[] = ['SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING', 'CUSTOM', 'ON_CALL'];

export function isCyclic(schedule: Schedule): boolean {
  return CYCLIC.includes(schedule.type) && !!schedule.cycleDays;
}

/** Vigência ativa na data (a mais recente que cobre o dia). */
export function activeAssignment(assignments: ScheduleAssignment[], date: CivilDate): ScheduleAssignment | null {
  return (
    [...assignments]
      .filter((a) => a.validFrom <= date && (!a.validTo || a.validTo >= date))
      .sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0] ?? null
  );
}

export function resolveExpectedDay(
  assignment: ScheduleAssignment | null,
  date: CivilDate,
  calendar?: CalendarDay | null,
  override?: DayOverride | null,
): ExpectedDay {
  const calendarHoliday = !!calendar?.isHoliday && !calendar.isWorkday;
  // Escalas que não consideram feriado seguem o ciclo normalmente (o dia não é tratado como feriado).
  const holiday = calendarHoliday && assignment?.schedule.considerHolidays !== false;
  const empty: ExpectedDay = {
    date, isWorkday: false, isHoliday: holiday, start: null, end: null, breakMinutes: 0, expectedMinutes: 0, flexible: false,
  };
  const extras = assignment ? {
    inItinereMinutes: assignment.schedule.inItinereMinutes ?? 0,
    entryMobilityMinutes: assignment.schedule.entryMobilityMinutes ?? 0,
    breakMobilityMinutes: assignment.schedule.breakMobilityMinutes ?? 0,
  } : {};

  // Escala agendada vence a jornada e o feriado: é uma decisão explícita para aquele dia.
  if (override) {
    if (!override.isWorkday) return { ...empty, isHoliday: calendarHoliday, scheduled: true };
    return { ...buildDay(date, override, extras), scheduled: true };
  }
  if (!assignment) return empty;

  const { schedule } = assignment;
  let index: number;
  if (isCyclic(schedule)) {
    const origin = assignment.cycleStart ?? assignment.validFrom;
    const cycle = schedule.cycleDays as number;
    index = ((diffDays(origin, date) % cycle) + cycle) % cycle;
  } else {
    index = weekday(date);
  }

  const day = schedule.days.find((d) => d.dayIndex === index);
  if (!day || !day.isWorkday || holiday) return { ...empty, isHoliday: holiday };
  return buildDay(date, day, extras);
}

function buildDay(
  date: CivilDate,
  day: { startTime?: string | null; endTime?: string | null; breakMinutes?: number; breakStart?: string | null; expectedMinutes?: number },
  extras: Pick<ExpectedDay, 'inItinereMinutes' | 'entryMobilityMinutes' | 'breakMobilityMinutes'>,
): ExpectedDay {
  const breakMinutes = day.breakMinutes ?? 0;
  if (!day.startTime || !day.endTime) {
    const expected = day.expectedMinutes ?? 0;
    return { date, isWorkday: expected > 0, isHoliday: false, start: null, end: null, breakMinutes, expectedMinutes: expected, flexible: true, ...extras };
  }
  const start = parseHm(day.startTime);
  let end = parseHm(day.endTime);
  if (end <= start) end += 1440; // atravessa a meia-noite (ex.: 19:00-07:00)
  let breakStart: number | null = day.breakStart ? parseHm(day.breakStart) : null;
  if (breakStart !== null && breakStart < start) breakStart += 1440;
  const expected = day.expectedMinutes || Math.max(0, end - start - breakMinutes);
  return { date, isWorkday: true, isHoliday: false, start, end, breakMinutes, expectedMinutes: expected, flexible: false, breakStart, ...extras };
}

/**
 * Modelos de escala prontos. `start`/`end` em HH:mm; `breakMinutes` descontado do previsto.
 *  - 12x36: trabalha 1 dia, folga 1 (ciclo de 2)
 *  - 6x1, 5x2, 4x2: N dias de trabalho seguidos de folgas
 */
export function cyclicTemplate(
  type: 'SHIFT_12X36' | 'SHIFT_6X1' | 'SHIFT_5X2' | 'SHIFT_4X2',
  start: string,
  end: string,
  breakMinutes = 0,
): Schedule {
  const pattern: Record<typeof type, [number, number]> = {
    SHIFT_12X36: [1, 1],
    SHIFT_6X1: [6, 1],
    SHIFT_5X2: [5, 2],
    SHIFT_4X2: [4, 2],
  };
  const [work, off] = pattern[type];
  const cycleDays = work + off;
  return {
    type,
    cycleDays,
    days: Array.from({ length: cycleDays }, (_, i) => ({
      dayIndex: i,
      isWorkday: i < work,
      startTime: i < work ? start : null,
      endTime: i < work ? end : null,
      breakMinutes: i < work ? breakMinutes : 0,
    })),
  };
}
